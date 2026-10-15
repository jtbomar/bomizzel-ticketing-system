import { FileAttachment } from '@/models/FileAttachment';
import { roleOf } from '@/utils/session';
import { Ticket } from '@/models/Ticket';
import { User } from '@/models/User';
import { FileAttachment as FileAttachmentModel } from '@/types/models';
import { FileAttachmentTable } from '@/types/database';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { canAccessTicket, isStaff, tenantContextFor } from '@/utils/tenant';
import { db } from '@/config/database';
// sharp is loaded lazily inside generateThumbnail(), NOT at module scope.
//
// sharp is a native module and fails to load when its platform binary is
// missing or the Node version is too old. FileService is imported by
// routes/files.ts and routes/tickets.ts, so a top-level import meant that one
// unloadable optional dependency threw while building the router - which
// index.ts catches, silently falling back to a partial route set. That took
// /api/tickets and /api/queues off the air entirely. Thumbnails are the only
// thing sharp is used for; they should degrade on their own.

export class FileService {
  private static readonly UPLOAD_DIR = process.env['UPLOAD_DIR'] || 'uploads';
  private static readonly MAX_FILE_SIZE = parseInt(process.env['MAX_FILE_SIZE'] || '10485760'); // 10MB default
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
  ];
  private static readonly IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  /**
   * Upload a file attachment to a ticket
   */
  static async uploadFile(
    file: Express.Multer.File,
    ticketId: string,
    uploadedById: string,
    noteId?: string
  ): Promise<FileAttachmentModel> {
    // Validate file
    this.validateFile(file);

    // Check if ticket exists and user has access
    const staff = await this.validateTicketAccess(ticketId, uploadedById);
    // A note it's attached to must be on this ticket, and a contact can't
    // attach to an internal note
    if (noteId) {
      const note = await db('ticket_notes')
        .where({ id: noteId, ticket_id: ticketId })
        .first('is_internal');
      if (!note || (note.is_internal && !staff)) throw new NotFoundError('Note not found');
    }

    // Ensure upload directory exists
    await this.ensureUploadDirectory();

    // Generate unique filename and storage path
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const storagePath = path.join(this.UPLOAD_DIR, fileName);
    const storageKey = fileName;

    // Check if file is an image
    const isImage = this.IMAGE_MIME_TYPES.includes(file.mimetype);

    try {
      // Save file to disk
      await fs.promises.writeFile(storagePath, file.buffer);

      // Generate thumbnail for images
      let thumbnailPath: string | undefined;
      if (isImage) {
        thumbnailPath = await this.generateThumbnail(storagePath, fileName);
      }

      // Create database record
      const attachmentData = await FileAttachment.createAttachment({
        ticketId,
        noteId,
        fileName,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById,
        storageKey,
        storagePath,
        isImage,
        thumbnailPath,
      });

      // Add to ticket history
      await Ticket.addHistory(
        ticketId,
        uploadedById,
        'file_attached',
        'attachment',
        undefined,
        fileName
      );

      return FileAttachment.toModel(attachmentData);
    } catch (error) {
      // Clean up file if database operation fails
      try {
        await fs.promises.unlink(storagePath);
      } catch (unlinkError) {
        console.error('Failed to clean up file after database error:', unlinkError);
      }
      throw error;
    }
  }

  /**
   * Get file attachment by ID with access control
   */
  static async getFile(
    attachmentId: string,
    userId: string
  ): Promise<{ attachment: FileAttachmentModel; filePath: string }> {
    const attachment = await FileAttachment.findById(attachmentId);
    if (!attachment) {
      throw new NotFoundError('File attachment not found');
    }

    // Check if user has access to the ticket (and, for contacts, that it isn't
    // on an internal note)
    await this.assertAttachmentVisible(attachment, userId);

    const filePath = attachment.storage_path;

    // Check if file exists on disk
    try {
      await fs.promises.access(filePath);
    } catch (error) {
      throw new NotFoundError('File not found on disk');
    }

    return {
      attachment: FileAttachment.toModel(attachment),
      filePath,
    };
  }

  /**
   * Get thumbnail for an image attachment
   */
  static async getThumbnail(
    attachmentId: string,
    userId: string
  ): Promise<{ attachment: FileAttachmentModel; thumbnailPath: string }> {
    const attachment = await FileAttachment.findById(attachmentId);
    if (!attachment) {
      throw new NotFoundError('File attachment not found');
    }

    if (!attachment.is_image || !attachment.thumbnail_path) {
      throw new ValidationError('Thumbnail not available for this file');
    }

    await this.assertAttachmentVisible(attachment, userId);

    // Check if thumbnail exists on disk
    try {
      await fs.promises.access(attachment.thumbnail_path);
    } catch (error) {
      throw new NotFoundError('Thumbnail not found on disk');
    }

    return {
      attachment: FileAttachment.toModel(attachment),
      thumbnailPath: attachment.thumbnail_path,
    };
  }

  /**
   * Delete a file attachment
   */
  static async deleteFile(attachmentId: string, userId: string): Promise<void> {
    const attachment = await FileAttachment.findById(attachmentId);
    if (!attachment) {
      throw new NotFoundError('File attachment not found');
    }

    // Check if user has access to the ticket
    await this.validateTicketAccess(attachment.ticket_id, userId);

    // Check if user is the uploader or has admin/employee role
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const canDelete =
      attachment.uploaded_by_id === userId ||
      ['admin', 'employee', 'team_lead'].includes(roleOf(user) || '');

    if (!canDelete) {
      throw new ForbiddenError('You do not have permission to delete this file');
    }

    try {
      // Delete file from disk
      await fs.promises.unlink(attachment.storage_path);

      // Delete thumbnail if exists
      if (attachment.thumbnail_path) {
        try {
          await fs.promises.unlink(attachment.thumbnail_path);
        } catch (error) {
          console.error('Failed to delete thumbnail:', error);
        }
      }
    } catch (error) {
      console.error('Failed to delete file from disk:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await FileAttachment.deleteAttachment(attachmentId);

    // Add to ticket history
    await Ticket.addHistory(
      attachment.ticket_id,
      userId,
      'file_attached',
      'attachment',
      attachment.file_name,
      undefined
    );
  }

  /**
   * Get attachments for a ticket
   */
  static async getTicketAttachments(
    ticketId: string,
    userId: string
  ): Promise<FileAttachmentModel[]> {
    // Check if user has access to the ticket
    const staff = await this.validateTicketAccess(ticketId, userId);

    const attachments = await FileAttachment.findByTicket(ticketId);
    // Contacts never see files on internal notes (they used to: only the
    // note text was hidden)
    if (!staff) {
      const internal = new Set(
        (
          await db('ticket_notes').where({ ticket_id: ticketId, is_internal: true }).select('id')
        ).map((n: any) => n.id)
      );
      return attachments
        .filter((a: any) => !a.note_id || !internal.has(a.note_id))
        .map(FileAttachment.toModel);
    }
    return attachments.map(FileAttachment.toModel);
  }

  /**
   * Validate file upload
   */
  private static validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new ValidationError('No file provided');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE} bytes`
      );
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new ValidationError(`File type ${file.mimetype} is not allowed`);
    }

    // Additional security checks
    if (
      file.originalname.includes('..') ||
      file.originalname.includes('/') ||
      file.originalname.includes('\\')
    ) {
      throw new ValidationError('Invalid filename');
    }
  }

  /**
   * Validate user has access to ticket
   */
  /** Ticket access, and for contacts, the file isn't on an internal note. */
  private static async assertAttachmentVisible(attachment: any, userId: string): Promise<void> {
    const staff = await this.validateTicketAccess(attachment.ticket_id, userId);
    if (!staff && attachment.note_id) {
      const note = await db('ticket_notes').where('id', attachment.note_id).first('is_internal');
      if (note?.is_internal) throw new NotFoundError('File attachment not found');
    }
  }

  /** Throws unless the user may see the ticket; true for staff. */
  private static async validateTicketAccess(ticketId: string, userId: string): Promise<boolean> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Staff: tickets of their own subscriber. Contacts: tickets of their own
    // account(s). Staff could read and attach files to every ticket on the
    // platform before.
    const tenant = await tenantContextFor(userId);
    const role = roleOf(user) || user.role;
    if (!canAccessTicket({ ...tenant, id: userId, role }, ticket as any)) {
      throw new NotFoundError('Ticket not found');
    }
    return isStaff({ role });
  }

  /**
   * Ensure upload directory exists
   */
  private static async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.promises.access(this.UPLOAD_DIR);
    } catch (error) {
      await fs.promises.mkdir(this.UPLOAD_DIR, { recursive: true });
    }
  }

  /**
   * Generate thumbnail for image files
   */
  private static async generateThumbnail(filePath: string, fileName: string): Promise<string> {
    const thumbnailDir = path.join(this.UPLOAD_DIR, 'thumbnails');

    // Ensure thumbnail directory exists
    try {
      await fs.promises.access(thumbnailDir);
    } catch (error) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true });
    }

    const thumbnailFileName = `thumb_${fileName}`;
    const thumbnailPath = path.join(thumbnailDir, thumbnailFileName);

    // `typeof import('sharp')` is the module namespace, which is not callable.
    // The callable factory is its default export, and require() hands that back
    // directly under CJS.
    let sharp: typeof import('sharp').default;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      sharp = require('sharp');
    } catch (error) {
      console.error(
        'sharp is unavailable, skipping thumbnail generation. ' +
          "Check that the platform binary installed and that Node meets sharp's engine requirement:",
        error instanceof Error ? error.message : error
      );
      throw new Error('Thumbnail generation unavailable');
    }

    try {
      await sharp(filePath)
        .resize(200, 200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return thumbnailPath;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      throw new Error('Thumbnail generation failed');
    }
  }
}
