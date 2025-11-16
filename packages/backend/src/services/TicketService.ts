import { Ticket } from '@/models/Ticket';
import { Queue } from '@/models/Queue';
import { CustomField } from '@/models/CustomField';
import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { Company } from '@/models/Company';
import {
  CreateTicketRequest,
  UpdateTicketRequest,
  Ticket as TicketModel,
  PaginatedResponse,
} from '@/types/models';
import { TicketTable } from '@/types/database';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { notificationService } from './NotificationService';
import { MetricsService } from './MetricsService';
import { EmailService } from './EmailService';
import { QueryPerformanceMonitor } from '@/middleware/performanceMonitoring';
import { CacheService, CacheKeys, CacheConfigs } from '@/utils/cache';
import { UsageTrackingService } from './UsageTrackingService';
import { logger } from '@/utils/logger';

export class TicketService {
  /**
   * Create a new ticket with custom field validation
   */
  static async createTicket(
    ticketData: CreateTicketRequest,
    submitterId: string
  ): Promise<TicketModel> {
    // Get submitter info
    const submitterUser = await User.findById(submitterId);
    if (!submitterUser) {
      throw new NotFoundError('Submitter not found');
    }

    // Validate company association (only for customers)
    if (submitterUser.role === 'customer') {
      const userCompanies = await User.getUserCompanies(submitterId);
      const hasCompanyAccess = userCompanies.some((uc) => uc.companyId === ticketData.companyId);

      if (!hasCompanyAccess) {
        throw new ForbiddenError('User does not have access to this company');
      }
    }
    // Admins, team leads, and employees can create tickets for any company

    // Validate team exists
    const team = await Team.findById(ticketData.teamId);
    if (!team) {
      throw new NotFoundError('Team not found');
    }

    // Get team's default queue (unassigned queue)
    const queues = await Queue.findByTeam(ticketData.teamId);
    const defaultQueue = queues.find((q) => q.type === 'unassigned') || queues[0];

    if (!defaultQueue) {
      throw new ValidationError('No available queue found for team');
    }

    // Validate custom fields if provided
    if (ticketData.customFieldValues) {
      await this.validateCustomFields(ticketData.teamId, ticketData.customFieldValues);
    }

    // Create the ticket
    const ticket = await Ticket.createTicket({
      title: ticketData.title,
      description: ticketData.description,
      submitterId,
      companyId: ticketData.companyId,
      queueId: defaultQueue.id,
      teamId: ticketData.teamId,
      customFieldValues: ticketData.customFieldValues || {},
    });

    // Add creation history
    await Ticket.addHistory(ticket.id, submitterId, 'created');

    const createdTicket = await this.getTicketWithRelations(ticket.id);

    // Emit real-time notification
    const submitter = await User.findById(submitterId);
    notificationService.notifyTicketCreated(
      createdTicket,
      submitter ? User.toModel(submitter) : undefined
    );

    // Send email notification to customer
    if (EmailService.isInitialized() && submitter) {
      try {
        await EmailService.sendTicketNotification(createdTicket.id, 'created', [submitter.email], {
          customerName: `${submitter.first_name} ${submitter.last_name}`,
        });
      } catch (error) {
        console.error('Failed to send ticket creation email:', error);
        // Don't fail the ticket creation if email fails
      }
    }

    // Update queue metrics
    MetricsService.updateQueueMetrics(createdTicket.queueId);

    // Track ticket creation for subscription usage
    try {
      await UsageTrackingService.recordTicketCreation(submitterId, createdTicket.id, {
        title: createdTicket.title,
        companyId: createdTicket.companyId,
        teamId: createdTicket.teamId,
        queueId: createdTicket.queueId,
      });
    } catch (error) {
      logger.error('Failed to track ticket creation for subscription usage', {
        ticketId: createdTicket.id,
        submitterId,
        error,
      });
      // Don't fail ticket creation if usage tracking fails
    }

    return createdTicket;
  }

  /**
   * Get tickets with proper permission filtering
   */
  static async getTickets(
    userId: string,
    userRole: string,
    options: {
      companyId?: string;
      queueId?: string;
      assignedToId?: string;
      status?: string;
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Promise<PaginatedResponse<TicketModel>> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    let searchOptions: any = {
      limit,
      offset,
    };

    // Apply permission filtering based on user role
    if (userRole === 'customer') {
      // Customers can only see tickets from their companies
      const userCompanies = await User.getUserCompanies(userId);
      const companyIds = userCompanies.map((uc) => uc.companyId);

      if (companyIds.length === 0) {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      searchOptions.companyIds = companyIds;

      // If specific company requested, validate access
      if (options.companyId) {
        if (!companyIds.includes(options.companyId)) {
          throw new ForbiddenError('Access denied to company tickets');
        }
        searchOptions.companyIds = [options.companyId];
      }
    } else if (userRole === 'agent') {
      // Employees can see tickets from their teams or assigned to them
      const userTeams = await User.getUserTeams(userId);
      const teamIds = userTeams.map((ut) => ut.teamId);

      if (options.assignedToId === userId) {
        searchOptions.assignedToId = userId;
      } else if (teamIds.length > 0) {
        searchOptions.teamIds = teamIds;
      }

      // If specific company requested, no additional filtering needed for employees
      if (options.companyId) {
        searchOptions.companyIds = [options.companyId];
      }
    }
    // Admins and team leads can see all tickets (no additional filtering)

    // Apply other filters
    if (options.queueId) {
      // Validate queue access for employees
      if (userRole === 'agent') {
        const queue = await Queue.findById(options.queueId);
        if (queue && queue.assigned_to_id && queue.assigned_to_id !== userId) {
          const userTeams = await User.getUserTeams(userId);
          const hasTeamAccess = userTeams.some((ut) => ut.teamId === queue.team_id);
          if (!hasTeamAccess) {
            throw new ForbiddenError('Access denied to queue');
          }
        }
      }

      const queueTickets = await Ticket.findByQueue(options.queueId, {
        ...(options.status && { status: options.status }),
        limit,
        offset,
      });

      const total = await this.getQueueTicketCount(options.queueId, options.status);
      const tickets = await Promise.all(
        queueTickets.map((ticket) => this.enrichTicketData(ticket))
      );

      return {
        data: tickets,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    if (options.status) {
      searchOptions.status = [options.status];
    }

    if (options.search) {
      searchOptions.query = options.search;
    }

    // Get tickets and total count
    const tickets = await Ticket.searchTickets(searchOptions);
    const totalCount = await this.getTicketCount(searchOptions);

    const enrichedTickets = await Promise.all(
      tickets.map((ticket) => this.enrichTicketData(ticket))
    );

    return {
      data: enrichedTickets,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Get a single ticket with permission check
   */
  static async getTicket(ticketId: string, userId: string, userRole: string): Promise<TicketModel> {
    return QueryPerformanceMonitor.monitorQuery(
      'getTicket',
      async () => {
        // Try to get from cache first
        const cacheKey = CacheKeys.ticket(ticketId);
        const cached = await CacheService.get<TicketModel>(cacheKey, CacheConfigs.SHORT);

        if (cached) {
          // Still need to validate access for cached tickets
          await this.validateTicketAccess(cached as any, userId, userRole);
          return cached;
        }

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          throw new NotFoundError('Ticket not found');
        }

        // Check permissions
        await this.validateTicketAccess(ticket, userId, userRole);

        const enrichedTicket = await this.getTicketWithRelations(ticketId);

        // Cache the enriched ticket
        await CacheService.set(cacheKey, enrichedTicket, CacheConfigs.SHORT);

        return enrichedTicket;
      },
      { userId, requestId: `ticket-${ticketId}` }
    );
  }

  /**
   * Assign ticket to an employee
   */
  static async assignTicket(
    ticketId: string,
    assignedToId: string,
    assignedById: string,
    userRole: string
  ): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // TypeScript assertion - we know ticket is not null after the check above
    const ticketData = ticket as NonNullable<typeof ticket>;

    // Validate assignment permissions
    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot assign tickets');
    }

    // Validate assignee is an employee in the same team
    const assignee = await User.findById(assignedToId);
    if (!assignee || assignee.role === 'customer') {
      throw new ValidationError('Invalid assignee');
    }

    const assigneeTeams = await User.getUserTeams(assignedToId);
    const hasTeamAccess = assigneeTeams.some((ut) => ut.teamId === ticketData.team_id);

    if (!hasTeamAccess) {
      throw new ValidationError('Assignee does not belong to ticket team');
    }

    // Update ticket assignment
    await Ticket.assignTicket(ticketId, assignedToId, assignedById);

    // Move to assignee's personal queue if they have one
    const assigneeQueues = await Queue.findByAssignee(assignedToId);
    if (assigneeQueues.length > 0 && assigneeQueues[0]) {
      await Ticket.update(ticketId, { queue_id: assigneeQueues[0].id });
    }

    const updatedTicket = await this.getTicketWithRelations(ticketId);

    // Emit real-time notifications
    const [assignedBy, assignedToUser] = await Promise.all([
      User.findById(assignedById),
      User.findById(assignedToId),
    ]);

    if (assignedToUser) {
      notificationService.notifyTicketAssigned(
        updatedTicket,
        User.toModel(assignedToUser),
        assignedBy ? User.toModel(assignedBy) : undefined
      );
    }

    // Send email notification to customer about assignment
    if (EmailService.isInitialized()) {
      try {
        const submitter = await User.findById(updatedTicket.submitterId);
        if (submitter && assignedToUser) {
          await EmailService.sendTicketNotification(
            updatedTicket.id,
            'assigned',
            [submitter.email],
            {
              assigneeName: `${assignedToUser.first_name} ${assignedToUser.last_name}`,
              customerName: `${submitter.first_name} ${submitter.last_name}`,
            }
          );
        }
      } catch (error) {
        console.error('Failed to send ticket assignment email:', error);
        // Don't fail the assignment if email fails
      }
    }

    // Update queue metrics for both old and new queues
    MetricsService.updateQueueMetrics(updatedTicket.queueId);
    if (ticketData.queue_id !== updatedTicket.queueId) {
      MetricsService.updateQueueMetrics(ticketData.queue_id);
    }

    return updatedTicket;
  }

  /**
   * Unassign ticket
   */
  static async unassignTicket(
    ticketId: string,
    unassignedById: string,
    userRole: string
  ): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const ticketData = ticket as NonNullable<typeof ticket>;

    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot unassign tickets');
    }

    // Move back to team's unassigned queue
    const teamQueues = await Queue.findByTeam(ticketData.team_id);
    const unassignedQueue = teamQueues.find((q) => q.type === 'unassigned');

    if (unassignedQueue) {
      await Ticket.update(ticketId, { queue_id: unassignedQueue.id });
    }

    await Ticket.unassignTicket(ticketId, unassignedById);

    return this.getTicketWithRelations(ticketId);
  }

  /**
   * Update ticket status
   */
  static async updateTicketStatus(
    ticketId: string,
    status: string,
    updatedById: string,
    userRole: string
  ): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const ticketData = ticket as NonNullable<typeof ticket>;

    // Validate status exists for team
    const validStatuses = await this.getValidStatusesForTeam(ticketData.team_id);
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status: ${status}`);
    }

    // Customers can only update their own tickets to limited statuses
    if (userRole === 'customer') {
      if (ticketData.submitter_id !== updatedById) {
        throw new ForbiddenError("Cannot update other users' tickets");
      }

      // Customers can only close their tickets or reopen them
      const allowedCustomerStatuses = ['open', 'closed'];
      if (!allowedCustomerStatuses.includes(status)) {
        throw new ForbiddenError('Invalid status for customer');
      }
    }

    const oldStatus = ticketData.status;
    await Ticket.updateStatus(ticketId, status, updatedById);

    const updatedTicket = await this.getTicketWithRelations(ticketId);

    // Track status change for subscription usage
    try {
      await UsageTrackingService.recordTicketStatusChange(
        ticketData.submitter_id, // Track for the ticket submitter, not the updater
        ticketId,
        oldStatus,
        status,
        {
          updatedBy: updatedById,
          userRole,
          teamId: ticketData.team_id,
        }
      );
    } catch (error) {
      logger.error('Failed to track ticket status change for subscription usage', {
        ticketId,
        submitterId: ticketData.submitter_id,
        oldStatus,
        newStatus: status,
        error,
      });
      // Don't fail status update if usage tracking fails
    }

    // Emit real-time notification
    const updatedBy = await User.findById(updatedById);
    notificationService.notifyTicketStatusChanged(
      updatedTicket,
      oldStatus,
      status,
      updatedBy ? User.toModel(updatedBy) : undefined
    );

    // Send email notification for significant status changes
    if (EmailService.isInitialized() && oldStatus !== status) {
      try {
        const submitter = await User.findById(updatedTicket.submitterId);
        if (submitter) {
          let notificationType: 'updated' | 'resolved' | 'closed' = 'updated';

          // Determine notification type based on status
          if (status.toLowerCase() === 'resolved') {
            notificationType = 'resolved';
          } else if (status.toLowerCase() === 'closed') {
            notificationType = 'closed';
          }

          await EmailService.sendTicketNotification(
            updatedTicket.id,
            notificationType,
            [submitter.email],
            {
              oldStatus,
              newStatus: status,
              customerName: `${submitter.first_name} ${submitter.last_name}`,
              updatedBy: updatedBy ? `${updatedBy.first_name} ${updatedBy.last_name}` : 'System',
            }
          );
        }
      } catch (error) {
        console.error('Failed to send ticket status update email:', error);
        // Don't fail the status update if email fails
      }
    }

    // Update queue metrics
    MetricsService.updateQueueMetrics(updatedTicket.queueId);

    return updatedTicket;
  }

  /**
   * Update ticket priority
   */
  static async updateTicketPriority(
    ticketId: string,
    priority: number,
    updatedById: string,
    userRole: string
  ): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot update ticket priority');
    }

    if (priority < 0 || priority > 100) {
      throw new ValidationError('Priority must be between 0 and 100');
    }

    const oldPriority = ticket.priority;
    await Ticket.updatePriority(ticketId, priority, updatedById);

    const updatedTicket = await this.getTicketWithRelations(ticketId);

    // Emit real-time notification
    const updatedBy = await User.findById(updatedById);
    notificationService.notifyTicketPriorityChanged(
      updatedTicket,
      oldPriority,
      priority,
      updatedBy ? User.toModel(updatedBy) : undefined
    );

    // Update queue metrics
    MetricsService.updateQueueMetrics(updatedTicket.queueId);

    return updatedTicket;
  }

  /**
   * Update ticket details
   */
  static async updateTicket(
    ticketId: string,
    updateData: UpdateTicketRequest,
    updatedById: string,
    userRole: string
  ): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const ticketData = ticket as NonNullable<typeof ticket>;

    // Validate permissions
    await this.validateTicketAccess(ticketData, updatedById, userRole);

    // Customers can only update title and description of their own tickets
    if (userRole === 'customer') {
      if (ticketData.submitter_id !== updatedById) {
        throw new ForbiddenError("Cannot update other users' tickets");
      }

      const allowedFields = ['title', 'description', 'customFieldValues'];
      const hasDisallowedFields = Object.keys(updateData).some(
        (field) => !allowedFields.includes(field)
      );

      if (hasDisallowedFields) {
        throw new ForbiddenError('Customers can only update title, description, and custom fields');
      }
    }

    // Validate custom fields if being updated
    if (updateData.customFieldValues) {
      await this.validateCustomFields(ticketData.team_id, updateData.customFieldValues);
    }

    // Handle different update types
    const updates: any = {};

    if (updateData.title !== undefined) {
      updates.title = updateData.title;
    }

    if (updateData.description !== undefined) {
      updates.description = updateData.description;
    }

    if (updateData.customFieldValues !== undefined) {
      updates.custom_field_values = updateData.customFieldValues;
    }

    // Update the ticket
    if (Object.keys(updates).length > 0) {
      await Ticket.update(ticketId, updates);
      await Ticket.addHistory(ticketId, updatedById, 'updated');
    }

    // Handle status update separately
    if (updateData.status !== undefined) {
      await this.updateTicketStatus(ticketId, updateData.status, updatedById, userRole);
    }

    // Handle priority update separately
    if (updateData.priority !== undefined) {
      await this.updateTicketPriority(ticketId, updateData.priority, updatedById, userRole);
    }

    // Handle assignment update separately
    if (updateData.assignedToId !== undefined) {
      if (updateData.assignedToId === null) {
        await this.unassignTicket(ticketId, updatedById, userRole);
      } else {
        await this.assignTicket(ticketId, updateData.assignedToId, updatedById, userRole);
      }
    }

    return this.getTicketWithRelations(ticketId);
  }

  /**
   * Get queue tickets with metrics
   */
  static async getQueueTickets(
    queueId: string,
    userId: string,
    userRole: string,
    options: {
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResponse<TicketModel>> {
    // Validate queue access
    const queue = await Queue.findById(queueId);
    if (!queue) {
      throw new NotFoundError('Queue not found');
    }

    // Check permissions for employee queues
    if (userRole === 'agent' && queue.type === 'agent' && queue.assigned_to_id !== userId) {
      const userTeams = await User.getUserTeams(userId);
      const hasTeamAccess = userTeams.some((ut) => ut.teamId === queue.team_id);
      if (!hasTeamAccess) {
        throw new ForbiddenError('Access denied to queue');
      }
    }

    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    const tickets = await Ticket.findByQueue(queueId, {
      ...(options.status && { status: options.status }),
      limit,
      offset,
    });

    const total = await this.getQueueTicketCount(queueId, options.status);

    const enrichedTickets = await Promise.all(
      tickets.map((ticket) => this.enrichTicketData(ticket))
    );

    return {
      data: enrichedTickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Private helper methods

  private static async validateCustomFields(
    teamId: string,
    customFieldValues: Record<string, any>
  ): Promise<void> {
    const customFields = await CustomField.findByTeam(teamId);

    for (const field of customFields) {
      const value = customFieldValues[field.name];

      // Check required fields
      if (field.is_required && (value === undefined || value === null || value === '')) {
        throw new ValidationError(`Field '${field.label}' is required`);
      }

      // Skip validation if field is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type-specific validation
      switch (field.type) {
        case 'integer':
          if (!Number.isInteger(Number(value))) {
            throw new ValidationError(`Field '${field.label}' must be an integer`);
          }
          break;

        case 'number':
        case 'decimal':
          if (isNaN(Number(value))) {
            throw new ValidationError(`Field '${field.label}' must be a number`);
          }
          break;

        case 'picklist':
          if (field.options && !field.options.includes(value)) {
            throw new ValidationError(
              `Field '${field.label}' must be one of: ${field.options.join(', ')}`
            );
          }
          break;

        case 'string':
          if (typeof value !== 'string') {
            throw new ValidationError(`Field '${field.label}' must be a string`);
          }
          break;
      }

      // Additional validation rules
      if (field.validation) {
        if (field.validation['min'] !== undefined && Number(value) < field.validation['min']) {
          throw new ValidationError(
            `Field '${field.label}' must be at least ${field.validation['min']}`
          );
        }

        if (field.validation['max'] !== undefined && Number(value) > field.validation['max']) {
          throw new ValidationError(
            `Field '${field.label}' must be at most ${field.validation['max']}`
          );
        }

        if (field.validation['pattern'] && typeof value === 'string') {
          const regex = new RegExp(field.validation['pattern']);
          if (!regex.test(value)) {
            throw new ValidationError(
              field.validation['message'] || `Field '${field.label}' format is invalid`
            );
          }
        }
      }
    }
  }

  private static async validateTicketAccess(
    ticket: TicketTable,
    userId: string,
    userRole: string
  ): Promise<void> {
    if (userRole === 'customer') {
      // Customers can only access tickets from their companies
      const userCompanies = await User.getUserCompanies(userId);
      const hasAccess = userCompanies.some((uc) => uc.companyId === ticket.company_id);

      if (!hasAccess) {
        throw new ForbiddenError('Access denied to ticket');
      }
    } else if (userRole === 'agent') {
      // Employees can access tickets from their teams or assigned to them
      if (ticket.assigned_to_id === userId) {
        return; // Can access assigned tickets
      }

      const userTeams = await User.getUserTeams(userId);
      const hasTeamAccess = userTeams.some((ut) => ut.teamId === ticket.team_id);

      if (!hasTeamAccess) {
        throw new ForbiddenError('Access denied to ticket');
      }
    }
    // Admins and team leads can access all tickets
  }

  private static async getValidStatusesForTeam(teamId: string): Promise<string[]> {
    // Get custom statuses for team
    const customStatuses = await Team.getCustomStatuses(teamId);
    const statusNames = customStatuses.map((s) => s.name);

    // Always include default 'open' status
    if (!statusNames.includes('open')) {
      statusNames.unshift('open');
    }

    return statusNames;
  }

  private static async enrichTicketData(ticket: TicketTable): Promise<TicketModel> {
    const ticketModel = Ticket.toModel(ticket);

    // Add related data
    const [submitter, company, assignedTo, queue, team] = await Promise.all([
      User.findById(ticket.submitter_id),
      Company.findById(ticket.company_id),
      ticket.assigned_to_id ? User.findById(ticket.assigned_to_id) : null,
      Queue.findById(ticket.queue_id),
      Team.findById(ticket.team_id),
    ]);

    const enrichedTicket: any = {
      ...ticketModel,
    };

    if (submitter) enrichedTicket.submitter = User.toModel(submitter);
    if (company) enrichedTicket.company = Company.toModel(company);
    if (assignedTo) enrichedTicket.assignedTo = User.toModel(assignedTo);
    if (queue) enrichedTicket.queue = Queue.toModel(queue);
    if (team) enrichedTicket.team = Team.toModel(team);

    return enrichedTicket as TicketModel;
  }

  private static async getTicketWithRelations(ticketId: string): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    return this.enrichTicketData(ticket);
  }

  private static async getTicketCount(searchOptions: any): Promise<number> {
    // This is a simplified count - in production you'd want to optimize this
    const tickets = await Ticket.searchTickets({
      ...searchOptions,
      limit: undefined,
      offset: undefined,
    });
    return tickets.length;
  }

  private static async getQueueTicketCount(queueId: string, status?: string): Promise<number> {
    const tickets = await Ticket.findByQueue(queueId, status ? { status } : {});
    return tickets.length;
  }
}
