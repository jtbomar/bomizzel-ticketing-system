import { Ticket, RESOLUTIONS } from '@/models/Ticket';
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
import { AssignmentRuleService } from './AssignmentRuleService';
import { notificationService } from './NotificationService';
import { MetricsService } from './MetricsService';
import { EmailService } from './EmailService';
import { QueryPerformanceMonitor } from '@/middleware/performanceMonitoring';
import { CacheService, CacheKeys, CacheConfigs } from '@/utils/cache';
import { UsageTrackingService } from './UsageTrackingService';
import { logger } from '@/utils/logger';
import { isCompanyInTenant, isUserInTenant, tenantContextFor } from '@/utils/tenant';

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

    // The company (account) and team must belong to the submitter's
    // subscriber. Staff could raise tickets against any company or team on
    // the platform before.
    const submitterTenant = await tenantContextFor(submitterId);
    if (
      !submitterTenant.tenantId ||
      !(await isCompanyInTenant(ticketData.companyId, submitterTenant.tenantId))
    ) {
      throw new ForbiddenError('User does not have access to this company');
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
    if (!team || (team as any).org_id !== submitterTenant.tenantId) {
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
    // Every ticket belongs to a department of its subscriber: the one asked
    // for, or the subscriber's default. Tickets were created with none, so
    // the department views all showed every ticket.
    const departmentId = await this.resolveDepartment(
      submitterTenant.tenantId,
      ticketData.departmentId
    );

    const ticket = await Ticket.createTicket({
      title: ticketData.title,
      description: ticketData.description,
      submitterId,
      companyId: ticketData.companyId,
      queueId: defaultQueue.id,
      teamId: ticketData.teamId,
      departmentId,
      customFieldValues: ticketData.customFieldValues || {},
    });

    // Add creation history
    await Ticket.addHistory(ticket.id, submitterId, 'created');

    // Settings > Assignment Rules
    await AssignmentRuleService.apply(ticket.id);

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
      departmentId?: number;
      finishedWithinDays?: number;
      status?: string;
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Promise<PaginatedResponse<TicketModel>> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    // Only the caller's own subscriber's tickets, whatever their role. Admins
    // and team leads saw every ticket on the platform before.
    const tenant = await tenantContextFor(userId);
    if (!tenant.tenantId) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    let searchOptions: any = {
      limit,
      offset,
      orgId: tenant.tenantId,
    };

    if (options.departmentId) {
      searchOptions.departmentId = options.departmentId;
    }
    if (options.finishedWithinDays) {
      searchOptions.finishedWithinDays = options.finishedWithinDays;
    }

    // Apply permission filtering based on user role
    if (userRole === 'customer') {
      // Customers can only see tickets from their companies
      const companyIds = tenant.companies;

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
    } else if (userRole === 'employee') {
      // Employees can see tickets from their teams or assigned to them
      const userTeams = await User.getUserTeams(userId);
      const teamIds = userTeams.map((ut) => ut.teamId);

      if (options.assignedToId === userId) {
        searchOptions.assignedToId = userId;
      } else if (options.assignedToId) {
        // Another agent's tickets: only within this agent's own teams.
        searchOptions.assignedToId = options.assignedToId;
        if (teamIds.length > 0) searchOptions.teamIds = teamIds;
      } else if (teamIds.length > 0) {
        searchOptions.teamIds = teamIds;
      }

      // If specific company requested, no additional filtering needed for employees
      if (options.companyId) {
        searchOptions.companyIds = [options.companyId];
      }
    }
    // Admins and team leads see all of their subscriber's tickets, and can
    // narrow to one assignee ("My tickets" was ignored for them).
    else if (options.assignedToId) {
      searchOptions.assignedToId = options.assignedToId;
    }

    // Contacts can filter by queue, but stay limited to their own accounts'
    // tickets; the queue branch below is for staff.
    if (options.queueId && userRole === 'customer') {
      searchOptions.queueId = options.queueId;
    }

    // Apply other filters
    if (options.queueId && userRole !== 'customer') {
      const queueRow = await Queue.findById(options.queueId);
      if (!queueRow || (queueRow as any).org_id !== tenant.tenantId) {
        throw new NotFoundError('Queue not found');
      }

      // Validate queue access for employees
      if (userRole === 'employee') {
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
        orgId: tenant.tenantId,
      });

      const total = await Ticket.countByQueue(options.queueId, options.status, tenant.tenantId);
      const tickets = await this.enrichTickets(queueTickets);

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

    const enrichedTickets = await this.enrichTickets(tickets);

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

    // The ticket must be in the caller's subscriber.
    await this.validateTicketAccess(ticketData, assignedById, userRole);

    // Validate assignment permissions
    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot assign tickets');
    }

    // Validate assignee is an employee in the same team
    // ...and in the ticket's subscriber; someone from another subscriber is
    // just as invalid as someone who doesn't exist.
    const assignee = await User.findById(assignedToId);
    if (
      !assignee ||
      assignee.role === 'customer' ||
      !(await isUserInTenant(assignedToId, ticketData.org_id as string))
    ) {
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
    await this.validateTicketAccess(ticketData, unassignedById, userRole);

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
    userRole: string,
    resolution?: string
  ): Promise<TicketModel> {
    if (resolution && !RESOLUTIONS.includes(resolution)) {
      throw new ValidationError(`Invalid resolution: ${resolution}`);
    }
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const ticketData = ticket as NonNullable<typeof ticket>;

    // The ticket must be one the caller may see (their subscriber's).
    await this.validateTicketAccess(ticketData, updatedById, userRole);

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
    await Ticket.updateStatus(ticketId, status, updatedById, resolution);

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
    userRole: string,
    runAssignmentRules = true
  ): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot update ticket priority');
    }
    await this.validateTicketAccess(ticket as any, updatedById, userRole);

    if (priority < 0 || priority > 100) {
      throw new ValidationError('Priority must be between 0 and 100');
    }

    const oldPriority = ticket.priority;
    await Ticket.updatePriority(ticketId, priority, updatedById);
    // An unassigned ticket may now match a priority rule
    if (runAssignmentRules && oldPriority !== priority) {
      await AssignmentRuleService.apply(ticketId);
    }

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

    // Moving to another department: it must be one of the ticket's own
    // subscriber's departments. (Customers can't get here - see above.)
    let departmentMove: { from: number | null; to: number } | undefined;
    if (updateData.departmentId !== undefined) {
      const to = (await this.resolveDepartment(
        ticketData.org_id ?? undefined,
        updateData.departmentId
      )) as number;
      if (to !== ticketData.department_id) {
        updates.department_id = to;
        departmentMove = { from: ticketData.department_id ?? null, to };
      }
    }

    // Update the ticket
    if (Object.keys(updates).length > 0) {
      await Ticket.update(ticketId, updates);
      if (departmentMove) {
        await Ticket.addHistory(
          ticketId,
          updatedById,
          'moved',
          'department_id',
          departmentMove.from === null ? undefined : String(departmentMove.from),
          String(departmentMove.to)
        );
      }
      if (Object.keys(updates).some((k) => k !== 'department_id')) {
        await Ticket.addHistory(ticketId, updatedById, 'updated');
      }
    }

    // Handle status update separately
    if (updateData.status !== undefined) {
      await this.updateTicketStatus(
        ticketId,
        updateData.status,
        updatedById,
        userRole,
        updateData.resolution
      );
    }

    // Handle priority update separately
    if (updateData.priority !== undefined) {
      await this.updateTicketPriority(ticketId, updateData.priority, updatedById, userRole, false);
    }

    // An unassigned ticket moved to another department or priority may now
    // match an assignment rule - unless this same change assigns it.
    if (
      updateData.assignedToId === undefined &&
      (departmentMove ||
        (updateData.priority !== undefined && updateData.priority !== ticketData.priority))
    ) {
      await AssignmentRuleService.apply(ticketId);
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
    // Validate queue access: staff of the queue's subscriber only
    const queue = await Queue.findById(queueId);
    const tenant = await tenantContextFor(userId);
    if (!queue || userRole === 'customer' || (queue as any).org_id !== tenant.tenantId) {
      throw new NotFoundError('Queue not found');
    }

    // Check permissions for employee queues
    if (userRole === 'employee' && queue.type === 'employee' && queue.assigned_to_id !== userId) {
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
      orgId: tenant.tenantId,
    });

    const total = await Ticket.countByQueue(queueId, options.status, tenant.tenantId);

    const enrichedTickets = await this.enrichTickets(tickets);

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

  /**
   * The department a new ticket goes to: the requested one if it belongs to
   * the subscriber, otherwise the subscriber's default (or first) department.
   */
  static async resolveDepartment(
    tenantId: string | undefined,
    requested?: number
  ): Promise<number | null> {
    if (!tenantId) return null;
    const ownDepartments = () =>
      Ticket.db('departments')
        .where((q) => q.where('org_id', tenantId).orWhere('company_id', tenantId))
        .where((q) => q.where('is_active', true).orWhereNull('is_active'));

    if (requested) {
      const row = await ownDepartments().where('id', requested).first('id');
      if (!row) throw new ValidationError('Department not found');
      return row.id;
    }
    const fallback = await ownDepartments()
      .orderByRaw('is_default DESC NULLS LAST')
      .orderBy('id', 'asc')
      .first('id');
    return fallback?.id ?? null;
  }

  private static async validateTicketAccess(
    ticket: TicketTable,
    userId: string,
    userRole: string
  ): Promise<void> {
    // First, the ticket must be in the caller's subscriber - for every role.
    const tenant = await tenantContextFor(userId);
    if (!tenant.tenantId || ticket.org_id !== tenant.tenantId) {
      throw new NotFoundError('Ticket not found');
    }

    if (userRole === 'customer') {
      // Customers can only access tickets from their companies
      const hasAccess = tenant.companies.includes(ticket.company_id);

      if (!hasAccess) {
        throw new ForbiddenError('Access denied to ticket');
      }
    } else if (userRole === 'employee') {
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

  /**
   * Attach submitter, company, assignee, queue and team to a page of tickets.
   *
   * This used to be done one ticket at a time, five queries each, run through
   * Promise.all - so a fifty-row page issued two hundred and fifty round-trips,
   * all queued behind a ten-connection pool. That page took 24 seconds.
   *
   * The related rows repeat heavily across a page: the same company, the same
   * handful of assignees. So collect the distinct ids, fetch each table once,
   * and join in memory. Five queries for the page, whatever its size.
   */
  private static async enrichTickets(tickets: TicketTable[]): Promise<TicketModel[]> {
    if (tickets.length === 0) {
      return [];
    }

    const distinct = (values: (string | null | undefined)[]): string[] => [
      ...new Set(values.filter((value): value is string => Boolean(value))),
    ];

    const [users, companies, queues, teams] = await Promise.all([
      User.findByIds(
        distinct([
          ...tickets.map((ticket) => ticket.submitter_id),
          ...tickets.map((ticket) => ticket.assigned_to_id),
        ])
      ),
      Company.findByIds(distinct(tickets.map((ticket) => ticket.company_id))),
      Queue.findByIds(distinct(tickets.map((ticket) => ticket.queue_id))),
      Team.findByIds(distinct(tickets.map((ticket) => ticket.team_id))),
    ]);

    const index = (rows: { id: string }[]): Map<string, any> =>
      new Map(rows.map((row) => [row.id, row]));

    const usersById = index(users);
    const companiesById = index(companies);
    const queuesById = index(queues);
    const teamsById = index(teams);

    return tickets.map((ticket) => {
      const enrichedTicket: any = { ...Ticket.toModel(ticket) };

      const submitter = usersById.get(ticket.submitter_id);
      const company = companiesById.get(ticket.company_id);
      const assignedTo = ticket.assigned_to_id ? usersById.get(ticket.assigned_to_id) : null;
      const queue = queuesById.get(ticket.queue_id);
      const team = teamsById.get(ticket.team_id);

      if (submitter) enrichedTicket.submitter = User.toModel(submitter);
      if (company) enrichedTicket.company = Company.toModel(company);
      if (assignedTo) enrichedTicket.assignedTo = User.toModel(assignedTo);
      if (queue) enrichedTicket.queue = Queue.toModel(queue);
      if (team) enrichedTicket.team = Team.toModel(team);

      return enrichedTicket as TicketModel;
    });
  }

  private static async enrichTicketData(ticket: TicketTable): Promise<TicketModel> {
    const [enriched] = await this.enrichTickets([ticket]);
    return enriched as TicketModel;
  }

  private static async getTicketWithRelations(ticketId: string): Promise<TicketModel> {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    return this.enrichTicketData(ticket);
  }

  private static async getTicketCount(searchOptions: any): Promise<number> {
    return Ticket.countTickets(searchOptions);
  }

  private static async getQueueTicketCount(queueId: string, status?: string): Promise<number> {
    return Ticket.countByQueue(queueId, status);
  }
}
