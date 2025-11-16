import { Ticket } from '@/models/Ticket';
import { User } from '@/models/User';
import { UsageTrackingService } from './UsageTrackingService';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { logger } from '@/utils/logger';
import { TicketTable } from '@/types/database';

export interface ArchivalSuggestion {
  ticketId: string;
  title: string;
  status: string;
  completedAt: Date;
  daysSinceCompletion: number;
  canArchive: boolean;
  reason?: string;
}

export interface BulkArchivalResult {
  successful: string[];
  failed: Array<{
    ticketId: string;
    error: string;
  }>;
  totalProcessed: number;
  archivedCount: number;
}

export interface ArchivalSearchOptions {
  query?: string;
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

export class TicketArchivalService {
  /**
   * Archive a single ticket
   */
  static async archiveTicket(
    ticketId: string,
    archivedById: string,
    userRole: string
  ): Promise<void> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Validate permissions
    await this.validateArchivalAccess(ticket, archivedById, userRole);

    // Check if ticket can be archived
    if (!this.canArchiveTicket(ticket)) {
      throw new ValidationError(
        'Ticket cannot be archived. Only completed or closed tickets can be archived.'
      );
    }

    // Check if already archived
    if (ticket.archived_at) {
      throw new ValidationError('Ticket is already archived');
    }

    try {
      // Archive the ticket
      await Ticket.update(ticketId, { archived_at: new Date() });

      // Add history entry
      await Ticket.addHistory(ticketId, archivedById, 'archived');

      // Track archival for subscription usage
      await UsageTrackingService.recordTicketArchival(ticket.submitter_id, ticketId, {
        archivedBy: archivedById,
        userRole,
        originalStatus: ticket.status,
        teamId: ticket.team_id,
      });

      logger.info('Ticket archived successfully', {
        ticketId,
        archivedById,
        submitterId: ticket.submitter_id,
        status: ticket.status,
      });
    } catch (error) {
      logger.error('Failed to archive ticket', {
        ticketId,
        archivedById,
        error,
      });
      throw error;
    }
  }

  /**
   * Restore an archived ticket
   */
  static async restoreTicket(
    ticketId: string,
    restoredById: string,
    userRole: string
  ): Promise<void> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Validate permissions
    await this.validateArchivalAccess(ticket, restoredById, userRole);

    // Check if ticket is archived
    if (!ticket.archived_at) {
      throw new ValidationError('Ticket is not archived');
    }

    try {
      // Restore the ticket
      await Ticket.update(ticketId, { archived_at: null });

      // Add history entry
      await Ticket.addHistory(ticketId, restoredById, 'restored');

      // Track restoration for subscription usage (reverse archival)
      await UsageTrackingService.recordTicketRestoration(ticket.submitter_id, ticketId, {
        restoredBy: restoredById,
        userRole,
        currentStatus: ticket.status,
        teamId: ticket.team_id,
      });

      logger.info('Ticket restored successfully', {
        ticketId,
        restoredById,
        submitterId: ticket.submitter_id,
        status: ticket.status,
      });
    } catch (error) {
      logger.error('Failed to restore ticket', {
        ticketId,
        restoredById,
        error,
      });
      throw error;
    }
  }

  /**
   * Bulk archive multiple tickets
   */
  static async bulkArchiveTickets(
    ticketIds: string[],
    archivedById: string,
    userRole: string
  ): Promise<BulkArchivalResult> {
    const result: BulkArchivalResult = {
      successful: [],
      failed: [],
      totalProcessed: ticketIds.length,
      archivedCount: 0,
    };

    for (const ticketId of ticketIds) {
      try {
        await this.archiveTicket(ticketId, archivedById, userRole);
        result.successful.push(ticketId);
        result.archivedCount++;
      } catch (error) {
        result.failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Bulk archival completed', {
      totalProcessed: result.totalProcessed,
      successful: result.archivedCount,
      failed: result.failed.length,
      archivedById,
    });

    return result;
  }

  /**
   * Get archival suggestions for a user based on their subscription limits
   */
  static async getArchivalSuggestions(
    userId: string,
    userRole: string,
    limit: number = 50
  ): Promise<ArchivalSuggestion[]> {
    // Get user's subscription to check limits
    const subscription = await CustomerSubscription.findByUserId(userId);
    if (!subscription) {
      return [];
    }

    // Get current usage
    const usage = await UsageTrackingService.getCurrentUsage(userId);

    // Check if user is approaching completed ticket limits
    const completedLimit = 100; // Mock limit for demo
    if (completedLimit < 0) {
      // Unlimited plan
      return [];
    }

    const completedUsagePercentage = (usage.completedTickets / completedLimit) * 100;

    // Only suggest archival if approaching limits (75% or more)
    if (completedUsagePercentage < 75) {
      return [];
    }

    // Get completed tickets that can be archived
    const archivableTickets = await this.getArchivableTickets(userId, userRole, limit);

    const suggestions: ArchivalSuggestion[] = archivableTickets.map((ticket) => {
      const completedAt = ticket.resolved_at || ticket.closed_at || ticket.updated_at;
      const daysSinceCompletion = Math.floor(
        (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ticketId: ticket.id,
        title: ticket.title,
        status: ticket.status,
        completedAt: new Date(completedAt),
        daysSinceCompletion,
        canArchive: this.canArchiveTicket(ticket),
        reason:
          daysSinceCompletion > 30
            ? 'Completed over 30 days ago'
            : 'Approaching completed ticket limit',
      };
    });

    // Sort by oldest completed first
    return suggestions.sort((a, b) => b.daysSinceCompletion - a.daysSinceCompletion);
  }

  /**
   * Get tickets that can be archived for a user
   */
  static async getArchivableTickets(
    userId: string,
    userRole: string,
    limit: number = 100
  ): Promise<TicketTable[]> {
    let query = Ticket.query
      .whereIn('status', ['resolved', 'closed', 'completed'])
      .whereNull('archived_at')
      .orderBy('updated_at', 'asc')
      .limit(limit);

    // Apply permission filtering
    if (userRole === 'customer') {
      // Customers can only see their own tickets
      const userCompanies = await User.getUserCompanies(userId);
      const companyIds = userCompanies.map((uc) => uc.companyId);

      if (companyIds.length === 0) {
        return [];
      }

      query = query.whereIn('company_id', companyIds);
    } else if (userRole === 'agent') {
      // Employees can see tickets from their teams
      const userTeams = await User.getUserTeams(userId);
      const teamIds = userTeams.map((ut) => ut.teamId);

      if (teamIds.length > 0) {
        query = query.whereIn('team_id', teamIds);
      }
    }
    // Admins and team leads can see all archivable tickets

    return query;
  }

  /**
   * Search archived tickets
   */
  static async searchArchivedTickets(
    userId: string,
    userRole: string,
    options: ArchivalSearchOptions = {}
  ): Promise<{
    tickets: TicketTable[];
    total: number;
  }> {
    let query = Ticket.query.whereNotNull('archived_at');

    // Apply permission filtering
    if (userRole === 'customer') {
      const userCompanies = await User.getUserCompanies(userId);
      const companyIds = userCompanies.map((uc) => uc.companyId);

      if (companyIds.length === 0) {
        return { tickets: [], total: 0 };
      }

      query = query.whereIn('company_id', companyIds);
    } else if (userRole === 'agent') {
      const userTeams = await User.getUserTeams(userId);
      const teamIds = userTeams.map((ut) => ut.teamId);

      if (teamIds.length > 0) {
        query = query.whereIn('team_id', teamIds);
      }
    }

    // Apply search filters
    if (options.query) {
      query = query.where(function () {
        this.where('title', 'ilike', `%${options.query}%`).orWhere(
          'description',
          'ilike',
          `%${options.query}%`
        );
      });
    }

    if (options.status && options.status.length > 0) {
      query = query.whereIn('status', options.status);
    }

    if (options.dateRange) {
      query = query.whereBetween('archived_at', [options.dateRange.start, options.dateRange.end]);
    }

    // Get total count
    const totalQuery = query.clone();
    const totalResult = await totalQuery.count('* as count').first();
    const total = parseInt((totalResult?.count as string) || '0');

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    // Order by archived date (newest first)
    query = query.orderBy('archived_at', 'desc');

    const tickets = await query;

    return { tickets, total };
  }

  /**
   * Get archival statistics for a user
   */
  static async getArchivalStats(
    userId: string,
    userRole: string
  ): Promise<{
    totalArchived: number;
    archivedThisMonth: number;
    archivedThisYear: number;
    oldestArchived?: Date;
    newestArchived?: Date;
  }> {
    let baseQuery = Ticket.query.whereNotNull('archived_at');

    // Apply permission filtering
    if (userRole === 'customer') {
      const userCompanies = await User.getUserCompanies(userId);
      const companyIds = userCompanies.map((uc) => uc.companyId);

      if (companyIds.length === 0) {
        return {
          totalArchived: 0,
          archivedThisMonth: 0,
          archivedThisYear: 0,
        };
      }

      baseQuery = baseQuery.whereIn('company_id', companyIds);
    } else if (userRole === 'agent') {
      const userTeams = await User.getUserTeams(userId);
      const teamIds = userTeams.map((ut) => ut.teamId);

      if (teamIds.length > 0) {
        baseQuery = baseQuery.whereIn('team_id', teamIds);
      }
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [totalResult, monthResult, yearResult, oldestResult, newestResult] = await Promise.all([
      baseQuery.clone().count('* as count').first(),
      baseQuery.clone().where('archived_at', '>=', startOfMonth).count('* as count').first(),
      baseQuery.clone().where('archived_at', '>=', startOfYear).count('* as count').first(),
      baseQuery.clone().orderBy('archived_at', 'asc').select('archived_at').first(),
      baseQuery.clone().orderBy('archived_at', 'desc').select('archived_at').first(),
    ]);

    return {
      totalArchived: parseInt((totalResult?.count as string) || '0'),
      archivedThisMonth: parseInt((monthResult?.count as string) || '0'),
      archivedThisYear: parseInt((yearResult?.count as string) || '0'),
      oldestArchived: oldestResult?.archived_at || undefined,
      newestArchived: newestResult?.archived_at || undefined,
    };
  }

  /**
   * Check if a ticket can be archived
   */
  private static canArchiveTicket(ticket: TicketTable): boolean {
    // Only completed, resolved, or closed tickets can be archived
    const archivableStatuses = ['resolved', 'closed', 'completed'];
    return archivableStatuses.includes(ticket.status.toLowerCase());
  }

  /**
   * Validate user access for archival operations
   */
  private static async validateArchivalAccess(
    ticket: TicketTable,
    userId: string,
    userRole: string
  ): Promise<void> {
    if (userRole === 'customer') {
      // Customers can only archive tickets from their companies
      const userCompanies = await User.getUserCompanies(userId);
      const hasAccess = userCompanies.some((uc) => uc.companyId === ticket.company_id);

      if (!hasAccess) {
        throw new ForbiddenError('Access denied to ticket');
      }
    } else if (userRole === 'agent') {
      // Employees can archive tickets from their teams or assigned to them
      if (ticket.assigned_to_id === userId) {
        return; // Can archive assigned tickets
      }

      const userTeams = await User.getUserTeams(userId);
      const hasTeamAccess = userTeams.some((ut) => ut.teamId === ticket.team_id);

      if (!hasTeamAccess) {
        throw new ForbiddenError('Access denied to ticket');
      }
    }
    // Admins and team leads can archive all tickets
  }
}
