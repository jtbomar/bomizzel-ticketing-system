import { User } from '@/models/User';
import { Team } from '@/models/Team';
import { Ticket } from '@/models/Ticket';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  teamId?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
}

export interface TicketReport {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  averageResolutionTime: number;
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByTeam: { teamId: string; teamName: string; count: number }[];
  ticketsByAssignee: { userId: string; userName: string; count: number }[];
}

export interface UserReport {
  totalUsers: number;
  activeUsers: number;
  usersByRole: { role: string; count: number }[];
  recentRegistrations: { date: string; count: number }[];
}

export interface TeamReport {
  totalTeams: number;
  activeTeams: number;
  teamMembershipStats: { teamId: string; teamName: string; memberCount: number }[];
  customFieldUsage: { teamId: string; teamName: string; fieldCount: number }[];
}

export class ReportingService {
  /**
   * Generate ticket analytics report
   */
  static async generateTicketReport(
    filters: ReportFilters = {},
    requestedById: string
  ): Promise<TicketReport> {
    try {
      // Check if user has permission to view reports
      const user = await User.findById(requestedById);
      if (!user || (user.role !== 'admin' && user.role !== 'employee')) {
        throw new AppError(
          'Only employees and administrators can view reports',
          403,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      let query = Ticket.query;

      // Apply filters
      if (filters.startDate) {
        query = query.where('created_at', '>=', filters.startDate);
      }

      if (filters.endDate) {
        query = query.where('created_at', '<=', filters.endDate);
      }

      if (filters.teamId) {
        query = query.where('team_id', filters.teamId);
      }

      if (filters.status) {
        query = query.where('status', filters.status);
      }

      if (filters.assignedToId) {
        query = query.where('assigned_to_id', filters.assignedToId);
      }

      // Get total tickets
      const totalTickets = await query.clone().count('* as count').first();
      const totalCount = parseInt(totalTickets?.count || '0', 10);

      // Get open/closed tickets
      const openTickets = await query
        .clone()
        .where('status', '!=', 'closed')
        .count('* as count')
        .first();
      const openCount = parseInt(openTickets?.count || '0', 10);
      const closedCount = totalCount - openCount;

      // Get tickets by status
      const ticketsByStatus = await query
        .clone()
        .select('status')
        .count('* as count')
        .groupBy('status')
        .orderBy('count', 'desc');

      // Get tickets by priority
      const ticketsByPriority = await query
        .clone()
        .select('priority')
        .count('* as count')
        .groupBy('priority')
        .orderBy('priority', 'asc');

      // Get tickets by team
      const ticketsByTeam = await query
        .clone()
        .join('teams', 'tickets.team_id', 'teams.id')
        .select('teams.id as teamId', 'teams.name as teamName')
        .count('tickets.id as count')
        .groupBy('teams.id', 'teams.name')
        .orderBy('count', 'desc');

      // Get tickets by assignee
      const ticketsByAssignee = await query
        .clone()
        .join('users', 'tickets.assigned_to_id', 'users.id')
        .select('users.id as userId')
        .select(Ticket.db.raw("CONCAT(users.first_name, ' ', users.last_name) as userName"))
        .count('tickets.id as count')
        .groupBy('users.id', 'users.first_name', 'users.last_name')
        .orderBy('count', 'desc');

      // Calculate average resolution time (for closed tickets)
      const resolutionTimes = await query
        .clone()
        .join('ticket_statuses', function () {
          this.on('tickets.status', '=', 'ticket_statuses.name').andOn(
            'tickets.team_id',
            '=',
            'ticket_statuses.team_id'
          );
        })
        .where('ticket_statuses.is_closed', true)
        .select('tickets.created_at', 'tickets.updated_at');

      let averageResolutionTime = 0;
      if (resolutionTimes.length > 0) {
        const totalResolutionTime = resolutionTimes.reduce((sum, ticket) => {
          const created = new Date(ticket.created_at);
          const resolved = new Date(ticket.updated_at);
          return sum + (resolved.getTime() - created.getTime());
        }, 0);
        averageResolutionTime = totalResolutionTime / resolutionTimes.length / (1000 * 60 * 60); // Convert to hours
      }

      return {
        totalTickets: totalCount,
        openTickets: openCount,
        closedTickets: closedCount,
        averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
        ticketsByStatus: ticketsByStatus.map((s) => ({
          status: s.status,
          count: parseInt(s.count, 10),
        })),
        ticketsByPriority: ticketsByPriority.map((p) => ({
          priority: p.priority?.toString() || 'unset',
          count: parseInt(p.count, 10),
        })),
        ticketsByTeam: ticketsByTeam.map((t) => ({
          teamId: t.teamId,
          teamName: t.teamName,
          count: parseInt(t.count, 10),
        })),
        ticketsByAssignee: ticketsByAssignee.map((a) => ({
          userId: a.userId,
          userName: a.userName,
          count: parseInt(a.count, 10),
        })),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Generate ticket report error:', error);
      throw new AppError('Failed to generate ticket report', 500, 'GENERATE_TICKET_REPORT_FAILED');
    }
  }

  /**
   * Generate user analytics report
   */
  static async generateUserReport(requestedById: string): Promise<UserReport> {
    try {
      // Check if user has permission to view reports
      const user = await User.findById(requestedById);
      if (!user || user.role !== 'admin') {
        throw new AppError('Only administrators can view user reports', 403, 'ADMIN_REQUIRED');
      }

      // Get total users
      const totalUsers = await User.query.count('* as count').first();
      const totalCount = parseInt(totalUsers?.count || '0', 10);

      // Get active users
      const activeUsers = await User.query.where('is_active', true).count('* as count').first();
      const activeCount = parseInt(activeUsers?.count || '0', 10);

      // Get users by role
      const usersByRole = await User.query
        .select('role')
        .count('* as count')
        .groupBy('role')
        .orderBy('role');

      // Get recent registrations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentRegistrations = await User.query
        .where('created_at', '>=', thirtyDaysAgo)
        .select(User.db.raw('DATE(created_at) as date'))
        .count('* as count')
        .groupBy(User.db.raw('DATE(created_at)'))
        .orderBy('date', 'asc');

      return {
        totalUsers: totalCount,
        activeUsers: activeCount,
        usersByRole: usersByRole.map((r) => ({
          role: r.role,
          count: parseInt(r.count, 10),
        })),
        recentRegistrations: recentRegistrations.map((r) => ({
          date: r.date,
          count: parseInt(r.count, 10),
        })),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Generate user report error:', error);
      throw new AppError('Failed to generate user report', 500, 'GENERATE_USER_REPORT_FAILED');
    }
  }

  /**
   * Generate team analytics report
   */
  static async generateTeamReport(requestedById: string): Promise<TeamReport> {
    try {
      // Check if user has permission to view reports
      const user = await User.findById(requestedById);
      if (!user || (user.role !== 'admin' && user.role !== 'employee')) {
        throw new AppError(
          'Only employees and administrators can view team reports',
          403,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      // Get total teams
      const totalTeams = await Team.query.count('* as count').first();
      const totalCount = parseInt(totalTeams?.count || '0', 10);

      // Get active teams
      const activeTeams = await Team.query.where('is_active', true).count('* as count').first();
      const activeCount = parseInt(activeTeams?.count || '0', 10);

      // Get team membership stats
      const teamMembershipStats = await Team.query
        .leftJoin('team_memberships', 'teams.id', 'team_memberships.team_id')
        .select('teams.id as teamId', 'teams.name as teamName')
        .count('team_memberships.user_id as memberCount')
        .groupBy('teams.id', 'teams.name')
        .orderBy('memberCount', 'desc');

      // Get custom field usage
      const customFieldUsage = await Team.query
        .leftJoin('custom_fields', 'teams.id', 'custom_fields.team_id')
        .select('teams.id as teamId', 'teams.name as teamName')
        .count('custom_fields.id as fieldCount')
        .groupBy('teams.id', 'teams.name')
        .orderBy('fieldCount', 'desc');

      return {
        totalTeams: totalCount,
        activeTeams: activeCount,
        teamMembershipStats: teamMembershipStats.map((t) => ({
          teamId: t.teamId,
          teamName: t.teamName,
          memberCount: parseInt(t.memberCount, 10),
        })),
        customFieldUsage: customFieldUsage.map((t) => ({
          teamId: t.teamId,
          teamName: t.teamName,
          fieldCount: parseInt(t.fieldCount, 10),
        })),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Generate team report error:', error);
      throw new AppError('Failed to generate team report', 500, 'GENERATE_TEAM_REPORT_FAILED');
    }
  }

  /**
   * Export data to CSV format
   */
  static async exportToCSV(
    dataType: 'tickets' | 'users' | 'teams',
    filters: ReportFilters = {},
    requestedById: string
  ): Promise<string> {
    try {
      // Check if user has permission to export data
      const user = await User.findById(requestedById);
      if (!user || user.role !== 'admin') {
        throw new AppError('Only administrators can export data', 403, 'ADMIN_REQUIRED');
      }

      let csvData = '';

      switch (dataType) {
        case 'tickets':
          csvData = await this.exportTicketsToCSV(filters);
          break;
        case 'users':
          csvData = await this.exportUsersToCSV();
          break;
        case 'teams':
          csvData = await this.exportTeamsToCSV();
          break;
        default:
          throw new AppError('Invalid data type for export', 400, 'INVALID_DATA_TYPE');
      }

      logger.info(`Data export completed: ${dataType} by ${requestedById}`);

      return csvData;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Export to CSV error:', error);
      throw new AppError('Failed to export data', 500, 'EXPORT_DATA_FAILED');
    }
  }

  /**
   * Export tickets to CSV
   */
  private static async exportTicketsToCSV(filters: ReportFilters): Promise<string> {
    let query = Ticket.query
      .join('teams', 'tickets.team_id', 'teams.id')
      .leftJoin('users as submitters', 'tickets.submitter_id', 'submitters.id')
      .leftJoin('users as assignees', 'tickets.assigned_to_id', 'assignees.id')
      .leftJoin('companies', 'tickets.company_id', 'companies.id')
      .select(
        'tickets.id',
        'tickets.title',
        'tickets.description',
        'tickets.status',
        'tickets.priority',
        'tickets.created_at',
        'tickets.updated_at',
        'teams.name as team_name',
        'companies.name as company_name',
        Ticket.db.raw("CONCAT(submitters.first_name, ' ', submitters.last_name) as submitter_name"),
        Ticket.db.raw("CONCAT(assignees.first_name, ' ', assignees.last_name) as assignee_name")
      );

    // Apply filters
    if (filters.startDate) {
      query = query.where('tickets.created_at', '>=', filters.startDate);
    }

    if (filters.endDate) {
      query = query.where('tickets.created_at', '<=', filters.endDate);
    }

    if (filters.teamId) {
      query = query.where('tickets.team_id', filters.teamId);
    }

    if (filters.status) {
      query = query.where('tickets.status', filters.status);
    }

    const tickets = await query.orderBy('tickets.created_at', 'desc');

    // Generate CSV
    const headers = [
      'ID',
      'Title',
      'Description',
      'Status',
      'Priority',
      'Team',
      'Company',
      'Submitter',
      'Assignee',
      'Created At',
      'Updated At',
    ];

    let csv = headers.join(',') + '\n';

    tickets.forEach((ticket) => {
      const row = [
        ticket.id,
        `"${ticket.title?.replace(/"/g, '""') || ''}"`,
        `"${ticket.description?.replace(/"/g, '""') || ''}"`,
        ticket.status || '',
        ticket.priority || '',
        `"${ticket.team_name?.replace(/"/g, '""') || ''}"`,
        `"${ticket.company_name?.replace(/"/g, '""') || ''}"`,
        `"${ticket.submitter_name?.replace(/"/g, '""') || ''}"`,
        `"${ticket.assignee_name?.replace(/"/g, '""') || ''}"`,
        ticket.created_at,
        ticket.updated_at,
      ];
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Export users to CSV
   */
  private static async exportUsersToCSV(): Promise<string> {
    const users = await User.query
      .select(
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'email_verified',
        'created_at'
      )
      .orderBy('created_at', 'desc');

    const headers = [
      'ID',
      'Email',
      'First Name',
      'Last Name',
      'Role',
      'Active',
      'Email Verified',
      'Created At',
    ];

    let csv = headers.join(',') + '\n';

    users.forEach((user) => {
      const row = [
        user.id,
        user.email,
        `"${user.first_name?.replace(/"/g, '""') || ''}"`,
        `"${user.last_name?.replace(/"/g, '""') || ''}"`,
        user.role,
        user.is_active,
        user.email_verified,
        user.created_at,
      ];
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Export teams to CSV
   */
  private static async exportTeamsToCSV(): Promise<string> {
    const teams = await Team.query
      .leftJoin('team_memberships', 'teams.id', 'team_memberships.team_id')
      .select('teams.id', 'teams.name', 'teams.description', 'teams.is_active', 'teams.created_at')
      .count('team_memberships.user_id as member_count')
      .groupBy('teams.id', 'teams.name', 'teams.description', 'teams.is_active', 'teams.created_at')
      .orderBy('teams.created_at', 'desc');

    const headers = ['ID', 'Name', 'Description', 'Active', 'Member Count', 'Created At'];

    let csv = headers.join(',') + '\n';

    teams.forEach((team) => {
      const row = [
        team.id,
        `"${team.name?.replace(/"/g, '""') || ''}"`,
        `"${team.description?.replace(/"/g, '""') || ''}"`,
        team.is_active,
        team.member_count,
        team.created_at,
      ];
      csv += row.join(',') + '\n';
    });

    return csv;
  }
}
