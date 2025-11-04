import { BaseModel } from './BaseModel';
import { TicketNoteTable } from '@/types/database';
import { TicketNote as TicketNoteModel } from '@/types/models';

export class TicketNote extends BaseModel {
  protected static override tableName = 'ticket_notes';

  static async createNote(noteData: {
    ticketId: string;
    authorId: string;
    content: string;
    isInternal?: boolean;
    isEmailGenerated?: boolean;
    emailMetadata?: Record<string, any>;
  }): Promise<TicketNoteTable> {
    return this.create({
      ticket_id: noteData.ticketId,
      author_id: noteData.authorId,
      content: noteData.content,
      is_internal: noteData.isInternal || false,
      is_email_generated: noteData.isEmailGenerated || false,
      email_metadata: noteData.emailMetadata || null,
    });
  }

  static async findByTicket(
    ticketId: string,
    options: {
      includeInternal?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TicketNoteTable[]> {
    let query = this.query.where('ticket_id', ticketId);

    // Filter out internal notes for customers
    if (options.includeInternal === false) {
      query = query.where('is_internal', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('created_at', 'asc');
  }

  static async findByAuthor(
    authorId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TicketNoteTable[]> {
    let query = this.query.where('author_id', authorId);

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('created_at', 'desc');
  }

  static async searchNotes(options: {
    query?: string;
    ticketIds?: string[];
    authorId?: string;
    isInternal?: boolean;
    isEmailGenerated?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<TicketNoteTable[]> {
    let query = this.query;

    if (options.query) {
      query = query.where('content', 'ilike', `%${options.query}%`);
    }

    if (options.ticketIds && options.ticketIds.length > 0) {
      query = query.whereIn('ticket_id', options.ticketIds);
    }

    if (options.authorId) {
      query = query.where('author_id', options.authorId);
    }

    if (options.isInternal !== undefined) {
      query = query.where('is_internal', options.isInternal);
    }

    if (options.isEmailGenerated !== undefined) {
      query = query.where('is_email_generated', options.isEmailGenerated);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('created_at', 'desc');
  }

  static async updateNote(
    noteId: string,
    updates: {
      content?: string;
      isInternal?: boolean;
    }
  ): Promise<TicketNoteTable | null> {
    const updateData: any = {};

    if (updates.content !== undefined) {
      updateData.content = updates.content;
    }

    if (updates.isInternal !== undefined) {
      updateData.is_internal = updates.isInternal;
    }

    return this.update(noteId, updateData);
  }

  static async deleteNote(noteId: string): Promise<boolean> {
    return this.delete(noteId);
  }

  static async getNotesWithAttachments(
    ticketId: string,
    options: {
      includeInternal?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    let query = this.db('ticket_notes as tn')
      .leftJoin('file_attachments as fa', 'tn.id', 'fa.note_id')
      .leftJoin('users as u', 'tn.author_id', 'u.id')
      .where('tn.ticket_id', ticketId);

    // Filter out internal notes for customers
    if (options.includeInternal === false) {
      query = query.where('tn.is_internal', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const results = await query
      .select(
        'tn.*',
        'u.first_name as author_first_name',
        'u.last_name as author_last_name',
        'u.email as author_email',
        'fa.id as attachment_id',
        'fa.file_name as attachment_file_name',
        'fa.original_name as attachment_original_name',
        'fa.file_size as attachment_file_size',
        'fa.mime_type as attachment_mime_type',
        'fa.is_image as attachment_is_image',
        'fa.thumbnail_path as attachment_thumbnail_path'
      )
      .orderBy('tn.created_at', 'asc');

    // Group results by note
    const notesMap = new Map();

    results.forEach((row: any) => {
      if (!notesMap.has(row.id)) {
        notesMap.set(row.id, {
          id: row.id,
          ticketId: row.ticket_id,
          authorId: row.author_id,
          content: row.content,
          isInternal: row.is_internal,
          isEmailGenerated: row.is_email_generated,
          emailMetadata: row.email_metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          author: {
            id: row.author_id,
            firstName: row.author_first_name,
            lastName: row.author_last_name,
            email: row.author_email,
          },
          attachments: [],
        });
      }

      if (row.attachment_id) {
        notesMap.get(row.id).attachments.push({
          id: row.attachment_id,
          fileName: row.attachment_file_name,
          originalName: row.attachment_original_name,
          fileSize: row.attachment_file_size,
          mimeType: row.attachment_mime_type,
          isImage: row.attachment_is_image,
          thumbnailPath: row.attachment_thumbnail_path,
        });
      }
    });

    return Array.from(notesMap.values());
  }

  static async getNotesHistory(ticketId: string): Promise<any[]> {
    return this.db('ticket_notes as tn')
      .join('users as u', 'tn.author_id', 'u.id')
      .where('tn.ticket_id', ticketId)
      .select(
        'tn.id',
        'tn.content',
        'tn.is_internal',
        'tn.is_email_generated',
        'tn.email_metadata',
        'tn.created_at',
        'u.first_name',
        'u.last_name',
        'u.email',
        'u.role'
      )
      .orderBy('tn.created_at', 'asc');
  }

  // Convert database record to API model
  static toModel(note: TicketNoteTable): TicketNoteModel {
    return {
      id: note.id,
      ticketId: note.ticket_id,
      authorId: note.author_id,
      content: note.content,
      isInternal: note.is_internal,
      isEmailGenerated: note.is_email_generated,
      emailMetadata: note.email_metadata as any,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    };
  }
}
