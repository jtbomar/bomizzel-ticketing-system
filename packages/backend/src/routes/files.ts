import { Router, Request, Response, NextFunction } from 'express';
import { FileService } from '@/services/FileService';
import { authenticate } from '@/middleware/auth';
import { secureFileUpload, handleFileUploadError } from '@/middleware/fileUploadSecurity';
import { ValidationError, NotFoundError } from '../utils/errors';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Apply authentication to all file routes
router.use(authenticate);

/**
 * Upload a file attachment to a ticket
 * POST /files/upload
 */
router.post(
  '/upload',
  secureFileUpload,
  handleFileUploadError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId, noteId } = req.body;
      const userId = req.user?.id;

      if (!ticketId) {
        throw new ValidationError('Ticket ID is required');
      }

      if (!req.file) {
        throw new ValidationError('No file provided');
      }

      const attachment = await FileService.uploadFile(req.file, ticketId, userId, noteId);

      res.status(201).json({
        message: 'File uploaded successfully',
        data: attachment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get file attachment by ID
 * GET /files/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { attachment, filePath } = await FileService.getFile(id, userId);

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'FILE_STREAM_ERROR',
            message: 'Error reading file',
          },
        });
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get file attachment info by ID (metadata only)
 * GET /files/:id/info
 */
router.get('/:id/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { attachment } = await FileService.getFile(id, userId);

    res.json({
      data: attachment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get thumbnail for an image attachment
 * GET /files/:id/thumbnail
 */
router.get('/:id/thumbnail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { attachment, thumbnailPath } = await FileService.getThumbnail(id, userId);

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Stream the thumbnail
    const thumbnailStream = fs.createReadStream(thumbnailPath);
    thumbnailStream.pipe(res);

    thumbnailStream.on('error', (error) => {
      console.error('Error streaming thumbnail:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'THUMBNAIL_STREAM_ERROR',
            message: 'Error reading thumbnail',
          },
        });
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a file attachment
 * DELETE /files/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    await FileService.deleteFile(id, userId);

    res.json({
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get attachments for a ticket
 * GET /tickets/:ticketId/attachments
 */
router.get(
  '/tickets/:ticketId/attachments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketId } = req.params;
      const userId = req.user?.id;

      const attachments = await FileService.getTicketAttachments(ticketId, userId);

      res.json({
        data: attachments,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
