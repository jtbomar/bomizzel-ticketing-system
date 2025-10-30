import { TicketNoteService } from '@/services/TicketNoteService';
import { TicketNote } from '@/models/TicketNote';
import { Ticket } from '@/models/Ticket';
import { FileAttachment } from '@/models/FileAttachment';
import { db } from '@/config/database';

// Mock the models
jest.mock('@/models/TicketNote');
jest.mock('@/models/Ticket');
jest.mock('@/models/FileAttachment');

const MockedTicketNote = TicketNote as jest.Mocked<typeof TicketNote>;
const MockedTicket = Ticket as jest.Mocked<typeof Ticket>;
const MockedFileAttachment = FileAttachment as jest.Mocked<typeof FileAttachment>;

describe('TicketNoteService', () => {
  const mockTicketId = 'ticket-123';
  const mockAuthorId = 'user-123';
  const mockNoteId = 'note-123';
  const mockAttachmentId = 'attachment-123';

  const mockTicket = {
    id: mockTicketId,
    title: 'Test Ticket',
    company_id: 'company-123',
  };

  const mockNote = {
    id: mockNoteId,
    ticket_id: mockTicketId,
    author_id: mockAuthorId,
    content: 'Test note content',
    is_internal: false,
    is_email_generated: false,
    email_metadata: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNote', () => {
    it('should create a note successfully', async () => {
      MockedTicket.findById.mockResolvedValue(mockTicket);
      MockedTicketNote.createNote.mockResolvedValue(mockNote);
      MockedTicket.addHistory.mockResolvedValue(undefined);
      MockedTicketNote.toModel.mockReturnValue({
        id: mockNoteId,
        ticketId: mockTicketId,
        authorId: mockAuthorId,
        content: 'Test note content',
        isInternal: false,
        isEmailGenerated: false,
        emailMetadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await TicketNoteService.createNote(mockTicketId, mockAuthorId, {
        content: 'Test note content',
        isInternal: false,
      });

      expect(MockedTicket.findById).toHaveBeenCalledWith(mockTicketId);
      expect(MockedTicketNote.createNote).toHaveBeenCalledWith({
        ticketId: mockTicketId,
        authorId: mockAuthorId,
        content: 'Test note content',
        isInternal: false,
      });
      expect(MockedTicket.addHistory).toHaveBeenCalledWith(mockTicketId, mockAuthorId, 'note_added');
      expect(result.content).toBe('Test note content');
    });

    it('should throw error if ticket not found', async () => {
      MockedTicket.findById.mockResolvedValue(null);

      await expect(
        TicketNoteService.createNote(mockTicketId, mockAuthorId, {
          content: 'Test note content',
        })
      ).rejects.toThrow('Ticket not found');
    });
  });

  describe('createEmailNote', () => {
    it('should create an email-generated note', async () => {
      const emailMetadata = {
        subject: 'Test Email',
        to: ['customer@test.com'],
        messageId: 'msg-123',
      };

      MockedTicket.findById.mockResolvedValue(mockTicket);
      MockedTicketNote.createNote.mockResolvedValue({
        ...mockNote,
        is_email_generated: true,
        email_metadata: emailMetadata,
      });
      MockedTicket.addHistory.mockResolvedValue(undefined);
      MockedTicketNote.toModel.mockReturnValue({
        id: mockNoteId,
        ticketId: mockTicketId,
        authorId: mockAuthorId,
        content: 'Email content',
        isInternal: false,
        isEmailGenerated: true,
        emailMetadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await TicketNoteService.createEmailNote(
        mockTicketId,
        mockAuthorId,
        'Email content',
        emailMetadata
      );

      expect(MockedTicketNote.createNote).toHaveBeenCalledWith({
        ticketId: mockTicketId,
        authorId: mockAuthorId,
        content: 'Email content',
        isInternal: false,
        isEmailGenerated: true,
        emailMetadata,
      });
      expect(result.isEmailGenerated).toBe(true);
    });
  });

  describe('updateNote', () => {
    it('should update note successfully', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedTicketNote.updateNote.mockResolvedValue({
        ...mockNote,
        content: 'Updated content',
      });
      MockedTicketNote.toModel.mockReturnValue({
        id: mockNoteId,
        ticketId: mockTicketId,
        authorId: mockAuthorId,
        content: 'Updated content',
        isInternal: false,
        isEmailGenerated: false,
        emailMetadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await TicketNoteService.updateNote(mockNoteId, mockAuthorId, {
        content: 'Updated content',
      });

      expect(MockedTicketNote.updateNote).toHaveBeenCalledWith(mockNoteId, {
        content: 'Updated content',
      });
      expect(result?.content).toBe('Updated content');
    });

    it('should throw error if note not found', async () => {
      MockedTicketNote.findById.mockResolvedValue(null);

      await expect(
        TicketNoteService.updateNote(mockNoteId, mockAuthorId, {
          content: 'Updated content',
        })
      ).rejects.toThrow('Note not found');
    });

    it('should throw error if user is not the author', async () => {
      MockedTicketNote.findById.mockResolvedValue({
        ...mockNote,
        author_id: 'different-user',
      });

      await expect(
        TicketNoteService.updateNote(mockNoteId, mockAuthorId, {
          content: 'Updated content',
        })
      ).rejects.toThrow('Unauthorized to update this note');
    });

    it('should throw error if trying to update email-generated note', async () => {
      MockedTicketNote.findById.mockResolvedValue({
        ...mockNote,
        is_email_generated: true,
      });

      await expect(
        TicketNoteService.updateNote(mockNoteId, mockAuthorId, {
          content: 'Updated content',
        })
      ).rejects.toThrow('Email-generated notes cannot be edited');
    });
  });

  describe('deleteNote', () => {
    it('should delete note successfully', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedTicketNote.deleteNote.mockResolvedValue(true);

      const result = await TicketNoteService.deleteNote(mockNoteId, mockAuthorId);

      expect(MockedTicketNote.deleteNote).toHaveBeenCalledWith(mockNoteId);
      expect(result).toBe(true);
    });

    it('should throw error if note not found', async () => {
      MockedTicketNote.findById.mockResolvedValue(null);

      await expect(
        TicketNoteService.deleteNote(mockNoteId, mockAuthorId)
      ).rejects.toThrow('Note not found');
    });

    it('should throw error if user is not the author', async () => {
      MockedTicketNote.findById.mockResolvedValue({
        ...mockNote,
        author_id: 'different-user',
      });

      await expect(
        TicketNoteService.deleteNote(mockNoteId, mockAuthorId)
      ).rejects.toThrow('Unauthorized to delete this note');
    });

    it('should throw error if trying to delete email-generated note', async () => {
      MockedTicketNote.findById.mockResolvedValue({
        ...mockNote,
        is_email_generated: true,
      });

      await expect(
        TicketNoteService.deleteNote(mockNoteId, mockAuthorId)
      ).rejects.toThrow('Email-generated notes cannot be deleted');
    });
  });

  describe('linkAttachmentToNote', () => {
    const mockAttachment = {
      id: mockAttachmentId,
      ticket_id: mockTicketId,
      note_id: null,
    };

    it('should link attachment to note successfully', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedFileAttachment.findById.mockResolvedValue(mockAttachment);
      MockedFileAttachment.update.mockResolvedValue(undefined);

      await TicketNoteService.linkAttachmentToNote(mockNoteId, mockAttachmentId);

      expect(MockedFileAttachment.update).toHaveBeenCalledWith(mockAttachmentId, {
        note_id: mockNoteId,
      });
    });

    it('should throw error if note not found', async () => {
      MockedTicketNote.findById.mockResolvedValue(null);

      await expect(
        TicketNoteService.linkAttachmentToNote(mockNoteId, mockAttachmentId)
      ).rejects.toThrow('Note not found');
    });

    it('should throw error if attachment not found', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedFileAttachment.findById.mockResolvedValue(null);

      await expect(
        TicketNoteService.linkAttachmentToNote(mockNoteId, mockAttachmentId)
      ).rejects.toThrow('Attachment not found');
    });

    it('should throw error if attachment belongs to different ticket', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedFileAttachment.findById.mockResolvedValue({
        ...mockAttachment,
        ticket_id: 'different-ticket',
      });

      await expect(
        TicketNoteService.linkAttachmentToNote(mockNoteId, mockAttachmentId)
      ).rejects.toThrow('Attachment does not belong to the same ticket as the note');
    });
  });

  describe('validateNoteAccess', () => {
    const mockUser = {
      id: 'user-123',
      role: 'customer',
      companyIds: ['company-123'],
    };

    it('should allow employee access to all notes', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedTicket.findById.mockResolvedValue(mockTicket);

      const hasAccess = await TicketNoteService.validateNoteAccess(
        mockNoteId,
        mockUser.id,
        'employee',
        mockUser.companyIds
      );

      expect(hasAccess).toBe(true);
    });

    it('should allow customer access to non-internal notes in their company', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedTicket.findById.mockResolvedValue(mockTicket);

      const hasAccess = await TicketNoteService.validateNoteAccess(
        mockNoteId,
        mockUser.id,
        'customer',
        mockUser.companyIds
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny customer access to internal notes', async () => {
      MockedTicketNote.findById.mockResolvedValue({
        ...mockNote,
        is_internal: true,
      });
      MockedTicket.findById.mockResolvedValue(mockTicket);

      const hasAccess = await TicketNoteService.validateNoteAccess(
        mockNoteId,
        mockUser.id,
        'customer',
        mockUser.companyIds
      );

      expect(hasAccess).toBe(false);
    });

    it('should deny customer access to notes from different company', async () => {
      MockedTicketNote.findById.mockResolvedValue(mockNote);
      MockedTicket.findById.mockResolvedValue({
        ...mockTicket,
        company_id: 'different-company',
      });

      const hasAccess = await TicketNoteService.validateNoteAccess(
        mockNoteId,
        mockUser.id,
        'customer',
        mockUser.companyIds
      );

      expect(hasAccess).toBe(false);
    });

    it('should return false if note not found', async () => {
      MockedTicketNote.findById.mockResolvedValue(null);

      const hasAccess = await TicketNoteService.validateNoteAccess(
        mockNoteId,
        mockUser.id,
        'customer',
        mockUser.companyIds
      );

      expect(hasAccess).toBe(false);
    });
  });
});