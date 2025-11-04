import request from 'supertest';
import express from 'express';
import fileRoutes from '../src/routes/files';
import { FileService } from '../src/services/FileService';
import { authenticate } from '../src/middleware/auth';

// Mock dependencies
jest.mock('../src/services/FileService');
jest.mock('../src/middleware/auth');

const mockFileService = FileService as jest.Mocked<typeof FileService>;
const mockAuthenticate = authenticate as jest.MockedFunction<typeof authenticate>;

const app = express();
app.use(express.json());
app.use('/files', fileRoutes);

// Mock authentication middleware
mockAuthenticate.mockImplementation((req: any, res: any, next: any) => {
  req.user = { id: 'user-123', role: 'customer' };
  next();
});

describe('File Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /files/upload', () => {
    it('should upload file successfully', async () => {
      const mockAttachment = {
        id: 'attachment-123',
        ticketId: 'ticket-123',
        fileName: 'test.jpg',
        originalName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
      };

      mockFileService.uploadFile.mockResolvedValue(mockAttachment as any);

      const response = await request(app)
        .post('/files/upload')
        .field('ticketId', 'ticket-123')
        .attach('file', Buffer.from('test'), 'test.jpg');

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.data).toEqual(mockAttachment);
    });

    it('should return 400 when no file provided', async () => {
      const response = await request(app).post('/files/upload').field('ticketId', 'ticket-123');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('No file provided');
    });

    it('should return 400 when no ticketId provided', async () => {
      const response = await request(app)
        .post('/files/upload')
        .attach('file', Buffer.from('test'), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Ticket ID is required');
    });
  });

  describe('GET /files/:id/info', () => {
    it('should get file info successfully', async () => {
      const mockAttachment = {
        id: 'attachment-123',
        ticketId: 'ticket-123',
        fileName: 'test.jpg',
        originalName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
      };

      mockFileService.getFile.mockResolvedValue({
        attachment: mockAttachment as any,
        filePath: 'uploads/test.jpg',
      });

      const response = await request(app).get('/files/attachment-123/info');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockAttachment);
    });
  });

  describe('DELETE /files/:id', () => {
    it('should delete file successfully', async () => {
      mockFileService.deleteFile.mockResolvedValue(undefined);

      const response = await request(app).delete('/files/attachment-123');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File deleted successfully');
      expect(mockFileService.deleteFile).toHaveBeenCalledWith('attachment-123', 'user-123');
    });
  });

  describe('GET /files/tickets/:ticketId/attachments', () => {
    it('should get ticket attachments successfully', async () => {
      const mockAttachments = [
        {
          id: 'attachment-1',
          ticketId: 'ticket-123',
          fileName: 'test1.jpg',
        },
        {
          id: 'attachment-2',
          ticketId: 'ticket-123',
          fileName: 'test2.pdf',
        },
      ];

      mockFileService.getTicketAttachments.mockResolvedValue(mockAttachments as any);

      const response = await request(app).get('/files/tickets/ticket-123/attachments');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockAttachments);
      expect(mockFileService.getTicketAttachments).toHaveBeenCalledWith('ticket-123', 'user-123');
    });
  });
});
