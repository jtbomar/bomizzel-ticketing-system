import { Company } from '@/models/Company';
import { User } from '@/models/User';
import { Ticket } from '@/models/Ticket';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ImportOptions {
  overwriteExisting?: boolean;
  skipDuplicates?: boolean;
  validateOnly?: boolean;
}

export interface ImportResult {
  success: boolean;
  importId: string;
  summary: {
    usersImported: number;
    usersSkipped: number;
    ticketsImported: number;
    ticketsSkipped: number;
    customFieldsImported: number;
    errors: string[];
  };
  validationErrors?: string[];
}

export class DataImportService {
  /**
   * Import company data from JSON
   */
  static async importCompanyData(
    companyId: string,
    userId: string,
    importData: any,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      logger.info('Starting data import', { companyId, userId, options });

      // Verify user has permission
      const isUserInCompany = await Company.isUserInCompany(userId, companyId);
      if (!isUserInCompany) {
        throw new AppError('User does not have permission to import data for this company', 403);
      }

      const importId = `import_${companyId}_${Date.now()}`;
      const summary = {
        usersImported: 0,
        usersSkipped: 0,
        ticketsImported: 0,
        ticketsSkipped: 0,
        customFieldsImported: 0,
        errors: [] as string[],
      };

      // Validate import data structure
      const validationErrors = this.validateImportData(importData);
      if (validationErrors.length > 0) {
        if (options.validateOnly) {
          return {
            success: false,
            importId,
            summary,
            validationErrors,
          };
        }
        throw new AppError(`Invalid import data: ${validationErrors.join(', ')}`, 400);
      }

      if (options.validateOnly) {
        return {
          success: true,
          importId,
          summary,
          validationErrors: [],
        };
      }

      // Import Users
      if (importData.data?.users) {
        const userResult = await this.importUsers(companyId, importData.data.users, options);
        summary.usersImported = userResult.imported;
        summary.usersSkipped = userResult.skipped;
        summary.errors.push(...userResult.errors);
      }

      // Import Custom Fields
      if (importData.data?.customFields) {
        const fieldResult = await this.importCustomFields(
          companyId,
          importData.data.customFields,
          options
        );
        summary.customFieldsImported = fieldResult.imported;
        summary.errors.push(...fieldResult.errors);
      }

      // Import Tickets
      if (importData.data?.tickets) {
        const ticketResult = await this.importTickets(companyId, importData.data.tickets, options);
        summary.ticketsImported = ticketResult.imported;
        summary.ticketsSkipped = ticketResult.skipped;
        summary.errors.push(...ticketResult.errors);
      }

      // Log import activity
      await this.logImportActivity(companyId, userId, importId, summary);

      logger.info('Data import completed', { importId, summary });

      return {
        success: true,
        importId,
        summary,
      };
    } catch (error) {
      logger.error('Data import failed', { error, companyId, userId });
      throw error;
    }
  }

  /**
   * Validate import data structure
   */
  private static validateImportData(importData: any): string[] {
    const errors: string[] = [];

    if (!importData || typeof importData !== 'object') {
      errors.push('Import data must be a valid JSON object');
      return errors;
    }

    if (!importData.exportInfo) {
      errors.push('Missing exportInfo section');
    }

    if (!importData.data) {
      errors.push('Missing data section');
      return errors;
    }

    // Validate users structure
    if (importData.data.users && !Array.isArray(importData.data.users)) {
      errors.push('Users data must be an array');
    }

    // Validate tickets structure
    if (importData.data.tickets && !Array.isArray(importData.data.tickets)) {
      errors.push('Tickets data must be an array');
    }

    // Validate custom fields structure
    if (importData.data.customFields && !Array.isArray(importData.data.customFields)) {
      errors.push('Custom fields data must be an array');
    }

    return errors;
  }

  /**
   * Import users
   */
  private static async importUsers(
    companyId: string,
    users: any[],
    options: ImportOptions
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await User.findByEmail(userData.email);

        if (existingUser) {
          if (options.skipDuplicates) {
            skipped++;
            continue;
          }

          if (options.overwriteExisting) {
            // Update existing user
            await User.update(existingUser.id, {
              first_name: userData.firstName,
              last_name: userData.lastName,
              phone: userData.phone,
              preferences: userData.preferences,
            });

            // Ensure user is associated with company
            const isInCompany = await Company.isUserInCompany(existingUser.id, companyId);
            if (!isInCompany) {
              await Company.addUserToCompany(
                existingUser.id,
                companyId,
                userData.companyRole || 'member'
              );
            }

            imported++;
          } else {
            skipped++;
          }
        } else {
          // Create new user (they'll need to set password on first login)
          const newUser = await User.create({
            email: userData.email,
            password_hash: '', // Will need to reset password
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone,
            role: userData.role || 'user',
            is_active: userData.isActive !== false,
            email_verified: false, // Require email verification
            preferences: userData.preferences || {},
          });

          // Associate with company
          await Company.addUserToCompany(newUser.id, companyId, userData.companyRole || 'member');
          imported++;
        }
      } catch (error) {
        errors.push(
          `Failed to import user ${userData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Import tickets
   */
  private static async importTickets(
    companyId: string,
    tickets: any[],
    options: ImportOptions
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const ticketData of tickets) {
      try {
        // Find creator by email
        let creatorId = null;
        if (ticketData.createdBy?.email) {
          const creator = await User.findByEmail(ticketData.createdBy.email);
          creatorId = creator?.id;
        }

        // Find assignee by email
        let assigneeId = null;
        if (ticketData.assignedTo?.email) {
          const assignee = await User.findByEmail(ticketData.assignedTo.email);
          assigneeId = assignee?.id;
        }

        // Create ticket
        const newTicket = await Ticket.create({
          company_id: companyId,
          title: ticketData.title,
          description: ticketData.description,
          status: ticketData.status || 'open',
          priority: ticketData.priority || 'medium',
          category: ticketData.category,
          custom_fields: ticketData.customFields,
          created_by: creatorId,
          assigned_to: assigneeId,
        });

        // Import notes
        if (ticketData.notes && Array.isArray(ticketData.notes)) {
          for (const noteData of ticketData.notes) {
            try {
              let noteAuthorId = creatorId;
              if (noteData.author?.email) {
                const author = await User.findByEmail(noteData.author.email);
                noteAuthorId = author?.id || creatorId;
              }

              await Ticket.db('ticket_notes').insert({
                ticket_id: newTicket.id,
                content: noteData.content,
                is_internal: noteData.isInternal || false,
                created_by: noteAuthorId,
                created_at: noteData.createdAt || new Date(),
              });
            } catch (error) {
              errors.push(
                `Failed to import note for ticket ${ticketData.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }
        }

        imported++;
      } catch (error) {
        errors.push(
          `Failed to import ticket ${ticketData.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Import custom fields
   */
  private static async importCustomFields(
    companyId: string,
    customFields: any[],
    options: ImportOptions
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const fieldData of customFields) {
      try {
        // Check if field already exists
        const existing = await Ticket.db('custom_fields')
          .where('company_id', companyId)
          .where('name', fieldData.name)
          .first();

        if (existing) {
          if (options.overwriteExisting) {
            await Ticket.db('custom_fields').where('id', existing.id).update({
              field_type: fieldData.fieldType,
              options: fieldData.options,
              is_required: fieldData.isRequired,
              is_active: fieldData.isActive,
              display_order: fieldData.displayOrder,
            });
            imported++;
          }
        } else {
          await Ticket.db('custom_fields').insert({
            company_id: companyId,
            name: fieldData.name,
            field_type: fieldData.fieldType,
            options: fieldData.options,
            is_required: fieldData.isRequired || false,
            is_active: fieldData.isActive !== false,
            display_order: fieldData.displayOrder || 0,
          });
          imported++;
        }
      } catch (error) {
        errors.push(
          `Failed to import custom field ${fieldData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { imported, errors };
  }

  /**
   * Log import activity
   */
  private static async logImportActivity(
    companyId: string,
    userId: string,
    importId: string,
    summary: any
  ): Promise<void> {
    try {
      await Ticket.db('data_import_logs').insert({
        company_id: companyId,
        user_id: userId,
        import_id: importId,
        imported_data: JSON.stringify(summary),
        created_at: new Date(),
      });
    } catch (error) {
      logger.error('Failed to log import activity', { error });
    }
  }

  /**
   * Get import history for a company
   */
  static async getImportHistory(companyId: string, limit: number = 10): Promise<any[]> {
    try {
      const history = await Ticket.db('data_import_logs as dil')
        .where('dil.company_id', companyId)
        .leftJoin('users as u', 'dil.user_id', 'u.id')
        .select(
          'dil.import_id',
          'dil.imported_data',
          'dil.created_at',
          'u.email as imported_by_email',
          'u.first_name',
          'u.last_name'
        )
        .orderBy('dil.created_at', 'desc')
        .limit(limit);

      return history.map((record: any) => ({
        importId: record.import_id,
        importedData: JSON.parse(record.imported_data || '{}'),
        importedAt: record.created_at,
        importedBy: {
          email: record.imported_by_email,
          firstName: record.first_name,
          lastName: record.last_name,
        },
      }));
    } catch (error) {
      logger.error('Failed to get import history', { error, companyId });
      return [];
    }
  }
}
