import { TicketNote } from '@/models/TicketNote';
import { Ticket } from '@/models/Ticket';
import { FileAttachment } from '@/models/FileAttachment';
import {
  TicketNote as TicketNoteModel,
  CreateNoteRequest,
  PaginatedResponse,
} from '@/types/models';

export class TicketNoteService {
  static async createNote(
    ticketId: string,
    authorId: string,
    noteData: CreateNoteRequest
  ): Promise<TicketNoteModel> {
    // Verify ticket exists
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const note = await TicketNote.createNote({
      ticketId,
      authorId,
      content: noteData.content,
      isInternal: noteData.isInternal || false,
    });

    // Add history entry for note creation
    await Ticket.addHistory(ticketId, authorId, 'note_added');

    return TicketNote.toModel(note);
  }

  static async createEmailNote(
    ticketId: string,
    authorId: string,
    content: string,
    emailMetadata: Record<string, any>
  ): Promise<TicketNoteModel> {
    // Verify ticket exists
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const note = await TicketNote.createNote({
      ticketId,
      authorId,
      content,
      isInternal: false, // Email notes are always customer-visible
      isEmailGenerated: true,
      emailMetadata,
    });

    // Add history entry for email note creation
    await Ticket.addHistory(ticketId, authorId, 'note_added', undefined, undefined, undefined, {
      isEmailGenerated: true,
      emailSubject: emailMetadata['subject'],
    });

    return TicketNote.toModel(note);
  }

  static async getNoteById(noteId: string): Promise<TicketNoteModel | null> {
    const note = await TicketNote.findById(noteId);
    return note ? TicketNote.toModel(note) : null;
  }

  static async getTicketNotes(
    ticketId: string,
    options: {
      includeInternal?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResponse<any>> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    // Get notes with attachments and author info
    const notesOptions: any = { limit, offset };
    if (options.includeInternal !== undefined) {
      notesOptions.includeInternal = options.includeInternal;
    }
    const notes = await TicketNote.getNotesWithAttachments(ticketId, notesOptions);

    // Get total count for pagination
    const totalQuery = TicketNote.query.where('ticket_id', ticketId);
    if (options.includeInternal === false) {
      totalQuery.where('is_internal', false);
    }
    const total = await totalQuery.count('* as count').first();
    const totalCount = parseInt(total?.count || '0', 10);

    return {
      data: notes,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  static async updateNote(
    noteId: string,
    authorId: string,
    updates: {
      content?: string;
      isInternal?: boolean;
    }
  ): Promise<TicketNoteModel | null> {
    // Verify note exists and user has permission to update it
    const existingNote = await TicketNote.findById(noteId);
    if (!existingNote) {
      throw new Error('Note not found');
    }

    // Only the author can update their own notes (or admins could be added later)
    if (existingNote.author_id !== authorId) {
      throw new Error('Unauthorized to update this note');
    }

    // Email-generated notes cannot be edited
    if (existingNote.is_email_generated) {
      throw new Error('Email-generated notes cannot be edited');
    }

    const updatedNote = await TicketNote.updateNote(noteId, updates);
    return updatedNote ? TicketNote.toModel(updatedNote) : null;
  }

  static async deleteNote(noteId: string, authorId: string): Promise<boolean> {
    // Verify note exists and user has permission to delete it
    const existingNote = await TicketNote.findById(noteId);
    if (!existingNote) {
      throw new Error('Note not found');
    }

    // Only the author can delete their own notes (or admins could be added later)
    if (existingNote.author_id !== authorId) {
      throw new Error('Unauthorized to delete this note');
    }

    // Email-generated notes cannot be deleted
    if (existingNote.is_email_generated) {
      throw new Error('Email-generated notes cannot be deleted');
    }

    return TicketNote.deleteNote(noteId);
  }

  static async searchNotes(
    options: {
      query?: string;
      ticketIds?: string[];
      authorId?: string;
      isInternal?: boolean;
      isEmailGenerated?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResponse<TicketNoteModel>> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const searchOptions: any = { limit, offset };
    if (options.query) searchOptions.query = options.query;
    if (options.ticketIds) searchOptions.ticketIds = options.ticketIds;
    if (options.authorId) searchOptions.authorId = options.authorId;
    if (options.isInternal !== undefined) searchOptions.isInternal = options.isInternal;
    if (options.isEmailGenerated !== undefined)
      searchOptions.isEmailGenerated = options.isEmailGenerated;

    const notes = await TicketNote.searchNotes(searchOptions);

    // Get total count for pagination
    const totalOptions: any = {};
    if (options.query) totalOptions.query = options.query;
    if (options.ticketIds) totalOptions.ticketIds = options.ticketIds;
    if (options.authorId) totalOptions.authorId = options.authorId;
    if (options.isInternal !== undefined) totalOptions.isInternal = options.isInternal;
    if (options.isEmailGenerated !== undefined)
      totalOptions.isEmailGenerated = options.isEmailGenerated;

    const total = await TicketNote.searchNotes(totalOptions);

    return {
      data: notes.map((note) => TicketNote.toModel(note)),
      pagination: {
        page,
        limit,
        total: total.length,
        totalPages: Math.ceil(total.length / limit),
      },
    };
  }

  static async getNotesHistory(ticketId: string): Promise<any[]> {
    return TicketNote.getNotesHistory(ticketId);
  }

  static async linkAttachmentToNote(noteId: string, attachmentId: string): Promise<void> {
    // Verify note exists
    const note = await TicketNote.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Verify attachment exists
    const attachment = await FileAttachment.findById(attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Verify attachment belongs to the same ticket as the note
    if (attachment.ticket_id !== note.ticket_id) {
      throw new Error('Attachment does not belong to the same ticket as the note');
    }

    // Link attachment to note
    await FileAttachment.update(attachmentId, { note_id: noteId });
  }

  static async unlinkAttachmentFromNote(attachmentId: string): Promise<void> {
    // Verify attachment exists
    const attachment = await FileAttachment.findById(attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Unlink attachment from note
    await FileAttachment.update(attachmentId, { note_id: null });
  }

  static async getNoteAttachments(noteId: string): Promise<any[]> {
    // Verify note exists
    const note = await TicketNote.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    return FileAttachment.findByNote(noteId);
  }

  static async validateNoteAccess(
    noteId: string,
    _userId: string,
    userRole: string,
    userCompanyIds: string[]
  ): Promise<boolean> {
    const note = await TicketNote.findById(noteId);
    if (!note) {
      return false;
    }

    // Get the ticket to check access permissions
    const ticket = await Ticket.findById(note.ticket_id);
    if (!ticket) {
      return false;
    }

    // Employees can see all notes
    if (['agent', 'team_lead', 'admin'].includes(userRole)) {
      return true;
    }

    // Customers can only see notes for tickets in their companies
    if (userRole === 'customer') {
      // Check if user has access to the ticket's company
      if (!userCompanyIds.includes(ticket.company_id)) {
        return false;
      }

      // Customers cannot see internal notes
      if (note.is_internal) {
        return false;
      }

      return true;
    }

    return false;
  }
}
