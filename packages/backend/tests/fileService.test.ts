import { FileService } from '../src/services/FileService';
import { FileAttachment } from '../src/models/FileAttachment';
import { Ticket } from '../src/models/Ticket';
import { User } from '../src/models/User';
import { ValidationError, NotFoundError, ForbiddenError } from '../src/utils/errors';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../src/models/FileAttachment');
jest.mock('../src/models/Ticket');
jest.mock('../src/models/User');
jest.mock('fs');
jest.mock('sharp');

const mockFileAttachment = FileAttachment as jest.Mocked<typeof FileAttachment>;
const mockTicket = Ticket as jest.Mocked<typeof Ticket>;
const mockUser = User as jest.Mocked<typeof User>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('test file content'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const ticketId = 'ticket-123';
    const uploadedById = 'user-123';

    it('should upload a file successfully', async () => {
      // Mock ticket access validation
      mockTicket.findById.mockResolvedValue({
        id: ticketId,
        company_id: 'company-123',
      } as any);

      mockUser.findById.mockResolvedValue({
        id: uploadedById,
        role: 'customer',
      } as any);

      mockUser.getUserCompanies.mockResolvedValue([{ companyId: 'company-123' } as any]);

      // Mock file operations
      mockFs.promises = {
        writeFile: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Mock database creation
      const mockAttachment = {
        id: 'attachment-123',
        ticket_id: ticketId,
        file_name: 'uuid-filename.jpg',
        original_name: 'test.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        uploaded_by_id: uploadedById,
        storage_key: 'uuid-filename.jpg',
        storage_path: 'uploads/uuid-filename.jpg',
        is_image: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFileAttachment.createAttachment.mockResolvedValue(mockAttachment as any);
      mockFileAttachment.toModel.mockReturnValue({
        id: mockAttachment.id,
        ticketId: mockAttachment.ticket_id,
        fileName: mockAttachment.file_name,
        originalName: mockAttachment.original_name,
        fileSize: mockAttachment.file_size,
        mimeType: mockAttachment.mime_type,
        uploadedById: mockAttachment.uploaded_by_id,
        storageKey: mockAttachment.storage_key,
        storagePath: mockAttachment.storage_path,
        isImage: mockAttachment.is_image,
        createdAt: mockAttachment.created_at,
        updatedAt: mockAttachment.updated_at,
      } as any);

      mockTicket.addHistory.mockResolvedValue(undefined);

      const result = await FileService.uploadFile(mockFile, ticketId, uploadedById);

      expect(result).toBeDefined();
      expect(result.originalName).toBe('test.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(mockFileAttachment.createAttachment).toHaveBeenCalled();
      expect(mockTicket.addHistory).toHaveBeenCalledWith(
        ticketId,
        uploadedById,
        'file_attached',
        'attachment',
        undefined,
        expect.any(String)
      );
    });

    it('should throw ValidationError for invalid file type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/exe',
      };

      await expect(FileService.uploadFile(invalidFile, ticketId, uploadedById)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for file too large', async () => {
      const largeFile = {
        ...mockFile,
        size: 20 * 1024 * 1024, // 20MB
      };

      await expect(FileService.uploadFile(largeFile, ticketId, uploadedById)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw NotFoundError for non-existent ticket', async () => {
      mockTicket.findById.mockResolvedValue(null);

      await expect(FileService.uploadFile(mockFile, 'non-existent', uploadedById)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getFile', () => {
    const attachmentId = 'attachment-123';
    const userId = 'user-123';

    it('should get file successfully with proper access', async () => {
      const mockAttachment = {
        id: attachmentId,
        ticket_id: 'ticket-123',
        storage_path: 'uploads/test.jpg',
      };

      mockFileAttachment.findById.mockResolvedValue(mockAttachment as any);
      mockTicket.findById.mockResolvedValue({
        id: 'ticket-123',
        company_id: 'company-123',
      } as any);

      mockUser.findById.mockResolvedValue({
        id: userId,
        role: 'customer',
      } as any);

      mockUser.getUserCompanies.mockResolvedValue([{ companyId: 'company-123' } as any]);

      mockFs.promises = {
        access: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockFileAttachment.toModel.mockReturnValue({
        id: attachmentId,
      } as any);

      const result = await FileService.getFile(attachmentId, userId);

      expect(result).toBeDefined();
      expect(result.attachment.id).toBe(attachmentId);
      expect(result.filePath).toBe('uploads/test.jpg');
    });

    it('should throw NotFoundError for non-existent attachment', async () => {
      mockFileAttachment.findById.mockResolvedValue(null);

      await expect(FileService.getFile('non-existent', userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteFile', () => {
    const attachmentId = 'attachment-123';
    const userId = 'user-123';

    it('should delete file successfully when user is uploader', async () => {
      const mockAttachment = {
        id: attachmentId,
        ticket_id: 'ticket-123',
        uploaded_by_id: userId,
        storage_path: 'uploads/test.jpg',
        file_name: 'test.jpg',
      };

      mockFileAttachment.findById.mockResolvedValue(mockAttachment as any);
      mockTicket.findById.mockResolvedValue({
        id: 'ticket-123',
        company_id: 'company-123',
      } as any);

      mockUser.findById.mockResolvedValue({
        id: userId,
        role: 'customer',
      } as any);

      mockUser.getUserCompanies.mockResolvedValue([{ companyId: 'company-123' } as any]);

      mockFs.promises = {
        unlink: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockFileAttachment.deleteAttachment.mockResolvedValue(true);
      mockTicket.addHistory.mockResolvedValue(undefined);

      await FileService.deleteFile(attachmentId, userId);

      expect(mockFileAttachment.deleteAttachment).toHaveBeenCalledWith(attachmentId);
      expect(mockTicket.addHistory).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user cannot delete file', async () => {
      const mockAttachment = {
        id: attachmentId,
        ticket_id: 'ticket-123',
        uploaded_by_id: 'other-user',
        storage_path: 'uploads/test.jpg',
      };

      mockFileAttachment.findById.mockResolvedValue(mockAttachment as any);
      mockTicket.findById.mockResolvedValue({
        id: 'ticket-123',
        company_id: 'company-123',
      } as any);

      mockUser.findById.mockResolvedValue({
        id: userId,
        role: 'customer',
      } as any);

      mockUser.getUserCompanies.mockResolvedValue([{ companyId: 'company-123' } as any]);

      await expect(FileService.deleteFile(attachmentId, userId)).rejects.toThrow(ForbiddenError);
    });
  });
});
