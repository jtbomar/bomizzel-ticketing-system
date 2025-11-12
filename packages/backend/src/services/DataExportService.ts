import { Company } from '@/models/Company';
import { User } from '@/models/User';
import { Ticket } from '@/models/Ticket';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import archiver from 'archiver';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

export interface ExportOptions {
  includeUsers?: boolean;
  includeTickets?: boolean;
  includeAttachments?: boolean;
  includeCustomFields?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  format?: 'json' | 'csv';
}

export interface ExportResult {
  success: boolean;
  exportId: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: Date;
  includedData: {
    users: number;
    tickets: number;
    attachments: number;
    customFields: number;
  };
}

export class DataExportService {
  /**
   * Export company data to downloadable format
   */
  static async exportCompanyData(
    companyId: string,
    userId: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      logger.info('Starting data export', { companyId, userId, options });

      // Verify user has permission to export company data
      const isUserInCompany = await Company.isUserInCompany(userId, companyId);
      if (!isUserInCompany) {
        throw new AppError('User does not have permission to export this company data', 403);
      }

      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404);
      }

      const exportId = `export_${companyId}_${Date.now()}`;
      const exportDir = path.join(process.cwd(), 'exports', exportId);
      
      // Create export directory
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const exportData: any = {
        exportInfo: {
          exportId,
          companyId,
          companyName: company.name,
          exportedBy: userId,
          exportedAt: new Date().toISOString(),
          options
        },
        data: {}
      };

      let counts = {
        users: 0,
        tickets: 0,
        attachments: 0,
        customFields: 0
      };

      // Export Users
      if (options.includeUsers !== false) {
        const users = await this.exportUsers(companyId);
        exportData.data.users = users;
        counts.users = users.length;
      }

      // Export Tickets
      if (options.includeTickets !== false) {
        const tickets = await this.exportTickets(companyId, options);
        exportData.data.tickets = tickets;
        counts.tickets = tickets.length;
      }

      // Export Custom Fields
      if (options.includeCustomFields !== false) {
        const customFields = await this.exportCustomFields(companyId);
        exportData.data.customFields = customFields;
        counts.customFields = customFields.length;
      }

      // Export Attachments metadata
      if (options.includeAttachments !== false) {
        const attachments = await this.exportAttachments(companyId);
        exportData.data.attachments = attachments;
        counts.attachments = attachments.length;
      }

      // Write JSON file
      const jsonFileName = `${company.name.replace(/[^a-z0-9]/gi, '_')}_export_${Date.now()}.json`;
      const jsonFilePath = path.join(exportDir, jsonFileName);
      fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2));

      // Create ZIP archive
      const zipFileName = `${company.name.replace(/[^a-z0-9]/gi, '_')}_export_${Date.now()}.zip`;
      const zipFilePath = path.join(exportDir, zipFileName);
      
      await this.createZipArchive(exportDir, jsonFilePath, zipFilePath);

      const fileStats = fs.statSync(zipFilePath);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours

      // Log export activity
      await this.logExportActivity(companyId, userId, exportId, counts);

      logger.info('Data export completed', { exportId, counts });

      return {
        success: true,
        exportId,
        fileName: zipFileName,
        fileSize: fileStats.size,
        downloadUrl: `/api/data-export/download/${exportId}/${zipFileName}`,
        expiresAt,
        includedData: counts
      };

    } catch (error) {
      logger.error('Data export failed', { error, companyId, userId });
      throw error;
    }
  }

  /**
   * Export users for a company
   */
  private static async exportUsers(companyId: string): Promise<any[]> {
    const users = await User.db('users as u')
      .join('user_company_associations as uca', 'u.id', 'uca.user_id')
      .where('uca.company_id', companyId)
      .select(
        'u.id',
        'u.email',
        'u.first_name',
        'u.last_name',
        'u.phone',
        'u.role',
        'u.is_active',
        'u.email_verified',
        'u.preferences',
        'uca.role as company_role',
        'u.created_at',
        'u.updated_at'
      );

    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      companyRole: user.company_role,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      preferences: user.preferences,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
  }

  /**
   * Export tickets for a company
   */
  private static async exportTickets(companyId: string, options: ExportOptions): Promise<any[]> {
    let query = Ticket.db('tickets as t')
      .where('t.company_id', companyId)
      .leftJoin('users as creator', 't.created_by', 'creator.id')
      .leftJoin('users as assignee', 't.assigned_to', 'assignee.id')
      .select(
        't.*',
        'creator.email as creator_email',
        'creator.first_name as creator_first_name',
        'creator.last_name as creator_last_name',
        'assignee.email as assignee_email',
        'assignee.first_name as assignee_first_name',
        'assignee.last_name as assignee_last_name'
      );

    if (options.dateFrom) {
      query = query.where('t.created_at', '>=', options.dateFrom);
    }

    if (options.dateTo) {
      query = query.where('t.created_at', '<=', options.dateTo);
    }

    const tickets = await query.orderBy('t.created_at', 'desc');

    // Get notes for each ticket
    const ticketsWithNotes = await Promise.all(
      tickets.map(async (ticket: any) => {
        const notes = await Ticket.db('ticket_notes')
          .where('ticket_id', ticket.id)
          .leftJoin('users', 'ticket_notes.created_by', 'users.id')
          .select(
            'ticket_notes.*',
            'users.email as author_email',
            'users.first_name as author_first_name',
            'users.last_name as author_last_name'
          )
          .orderBy('ticket_notes.created_at', 'asc');

        return {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          customFields: ticket.custom_fields,
          createdBy: {
            email: ticket.creator_email,
            firstName: ticket.creator_first_name,
            lastName: ticket.creator_last_name
          },
          assignedTo: ticket.assignee_email ? {
            email: ticket.assignee_email,
            firstName: ticket.assignee_first_name,
            lastName: ticket.assignee_last_name
          } : null,
          notes: notes.map((note: any) => ({
            id: note.id,
            content: note.content,
            isInternal: note.is_internal,
            author: {
              email: note.author_email,
              firstName: note.author_first_name,
              lastName: note.author_last_name
            },
            createdAt: note.created_at
          })),
          createdAt: ticket.created_at,
          updatedAt: ticket.updated_at,
          resolvedAt: ticket.resolved_at
        };
      })
    );

    return ticketsWithNotes;
  }

  /**
   * Export custom fields for a company
   */
  private static async exportCustomFields(companyId: string): Promise<any[]> {
    const customFields = await Ticket.db('custom_fields')
      .where('company_id', companyId)
      .select('*');

    return customFields.map((field: any) => ({
      id: field.id,
      name: field.name,
      fieldType: field.field_type,
      options: field.options,
      isRequired: field.is_required,
      isActive: field.is_active,
      displayOrder: field.display_order,
      createdAt: field.created_at
    }));
  }

  /**
   * Export attachments metadata
   */
  private static async exportAttachments(companyId: string): Promise<any[]> {
    const attachments = await Ticket.db('ticket_attachments as ta')
      .join('tickets as t', 'ta.ticket_id', 't.id')
      .where('t.company_id', companyId)
      .leftJoin('users as uploader', 'ta.uploaded_by', 'uploader.id')
      .select(
        'ta.id',
        'ta.ticket_id',
        'ta.file_name',
        'ta.file_size',
        'ta.file_type',
        'ta.file_path',
        'ta.uploaded_at',
        'uploader.email as uploader_email',
        'uploader.first_name as uploader_first_name',
        'uploader.last_name as uploader_last_name'
      );

    return attachments.map((attachment: any) => ({
      id: attachment.id,
      ticketId: attachment.ticket_id,
      fileName: attachment.file_name,
      fileSize: attachment.file_size,
      fileType: attachment.file_type,
      filePath: attachment.file_path,
      uploadedBy: {
        email: attachment.uploader_email,
        firstName: attachment.uploader_first_name,
        lastName: attachment.uploader_last_name
      },
      uploadedAt: attachment.uploaded_at
    }));
  }

  /**
   * Create ZIP archive
   */
  private static async createZipArchive(
    exportDir: string,
    jsonFilePath: string,
    zipFilePath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.file(jsonFilePath, { name: path.basename(jsonFilePath) });
      archive.finalize();
    });
  }

  /**
   * Log export activity
   */
  private static async logExportActivity(
    companyId: string,
    userId: string,
    exportId: string,
    counts: any
  ): Promise<void> {
    try {
      await Ticket.db('data_export_logs').insert({
        company_id: companyId,
        user_id: userId,
        export_id: exportId,
        exported_data: JSON.stringify(counts),
        created_at: new Date()
      });
    } catch (error) {
      logger.error('Failed to log export activity', { error });
      // Don't throw - logging failure shouldn't stop export
    }
  }

  /**
   * Get export history for a company
   */
  static async getExportHistory(companyId: string, limit: number = 10): Promise<any[]> {
    try {
      const history = await Ticket.db('data_export_logs as del')
        .where('del.company_id', companyId)
        .leftJoin('users as u', 'del.user_id', 'u.id')
        .select(
          'del.export_id',
          'del.exported_data',
          'del.created_at',
          'u.email as exported_by_email',
          'u.first_name',
          'u.last_name'
        )
        .orderBy('del.created_at', 'desc')
        .limit(limit);

      return history.map((record: any) => ({
        exportId: record.export_id,
        exportedData: JSON.parse(record.exported_data || '{}'),
        exportedAt: record.created_at,
        exportedBy: {
          email: record.exported_by_email,
          firstName: record.first_name,
          lastName: record.last_name
        }
      }));
    } catch (error) {
      logger.error('Failed to get export history', { error, companyId });
      return [];
    }
  }

  /**
   * Clean up old export files
   */
  static async cleanupOldExports(olderThanHours: number = 24): Promise<void> {
    try {
      const exportsDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportsDir)) return;

      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      const directories = fs.readdirSync(exportsDir);

      for (const dir of directories) {
        const dirPath = path.join(exportsDir, dir);
        const stats = fs.statSync(dirPath);
        
        if (stats.isDirectory() && stats.mtimeMs < cutoffTime) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          logger.info('Cleaned up old export', { directory: dir });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old exports', { error });
    }
  }
}
