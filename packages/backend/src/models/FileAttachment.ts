import { BaseModel } from './BaseModel';
import { FileAttachmentTable } from '@/types/database';
import { FileAttachment as FileAttachmentModel } from '@/types/models';

export class FileAttachment extends BaseModel {
  protected static override tableName = 'file_attachments';

  static async createAttachment(attachmentData: {
    ticketId: string;
    noteId?: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    uploadedById: string;
    storageKey: string;
    storagePath: string;
    isImage: boolean;
    thumbnailPath?: string;
  }): Promise<FileAttachmentTable> {
    return this.create({
      ticket_id: attachmentData.ticketId,
      note_id: attachmentData.noteId,
      file_name: attachmentData.fileName,
      original_name: attachmentData.originalName,
      file_size: attachmentData.fileSize,
      mime_type: attachmentData.mimeType,
      uploaded_by_id: attachmentData.uploadedById,
      storage_key: attachmentData.storageKey,
      storage_path: attachmentData.storagePath,
      is_image: attachmentData.isImage,
      thumbnail_path: attachmentData.thumbnailPath,
    });
  }

  static async findByTicket(ticketId: string): Promise<FileAttachmentTable[]> {
    return this.query.where('ticket_id', ticketId).orderBy('created_at', 'desc');
  }

  static async findByNote(noteId: string): Promise<FileAttachmentTable[]> {
    return this.query.where('note_id', noteId).orderBy('created_at', 'desc');
  }

  static async findByUser(uploadedById: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<FileAttachmentTable[]> {
    let query = this.query.where('uploaded_by_id', uploadedById);

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('created_at', 'desc');
  }

  static async deleteAttachment(attachmentId: string): Promise<boolean> {
    const result = await this.delete(attachmentId);
    return result !== null;
  }

  static async getAttachmentsByTickets(ticketIds: string[]): Promise<FileAttachmentTable[]> {
    if (ticketIds.length === 0) return [];
    
    return this.query
      .whereIn('ticket_id', ticketIds)
      .orderBy('created_at', 'desc');
  }

  static async getTotalSizeByUser(uploadedById: string): Promise<number> {
    const result = await this.query
      .where('uploaded_by_id', uploadedById)
      .sum('file_size as total_size')
      .first();
    
    return result?.total_size || 0;
  }

  static async getTotalSizeByTicket(ticketId: string): Promise<number> {
    const result = await this.query
      .where('ticket_id', ticketId)
      .sum('file_size as total_size')
      .first();
    
    return result?.total_size || 0;
  }

  // Convert database record to API model
  static toModel(attachment: FileAttachmentTable): FileAttachmentModel {
    return {
      id: attachment.id,
      ticketId: attachment.ticket_id,
      noteId: attachment.note_id,
      fileName: attachment.file_name,
      originalName: attachment.original_name,
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
      uploadedById: attachment.uploaded_by_id,
      storageKey: attachment.storage_key,
      storagePath: attachment.storage_path,
      isImage: attachment.is_image,
      thumbnailPath: attachment.thumbnail_path,
      createdAt: attachment.created_at,
      updatedAt: attachment.updated_at,
    };
  }
}