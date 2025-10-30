import { Queue } from '@/models/Queue';
import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { QueueMetrics, Queue as QueueModel } from '@/types/models';
import { QueueTable } from '@/types/database';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';

export class QueueService {
  /**
   * Create a new queue for a team
   */
  static async createQueue(
    queueData: {
      name: string;
      description?: string;
      type: 'unassigned' | 'employee';
      assignedToId?: string;
      teamId: string;
    },
    createdById: string,
    userRole: string
  ): Promise<QueueModel> {
    // Validate permissions - only team leads and admins can create queues
    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot create queues');
    }

    if (userRole === 'employee') {
      // Check if user is a team lead for this team
      const userTeams = await User.getUserTeams(createdById);
      const teamMembership = userTeams.find(ut => ut.teamId === queueData.teamId);
      
      if (!teamMembership || teamMembership.role !== 'lead') {
        throw new ForbiddenError('Only team leads can create queues for their teams');
      }
    }

    // Validate team exists
    const team = await Team.findById(queueData.teamId);
    if (!team) {
      throw new NotFoundError('Team not found');
    }

    // Validate assignee if provided
    if (queueData.assignedToId) {
      const assignee = await User.findById(queueData.assignedToId);
      if (!assignee || assignee.role === 'customer') {
        throw new ValidationError('Invalid assignee - must be an employee');
      }

      // Check if assignee is in the team
      const assigneeTeams = await User.getUserTeams(queueData.assignedToId);
      const hasTeamAccess = assigneeTeams.some(ut => ut.teamId === queueData.teamId);
      
      if (!hasTeamAccess) {
        throw new ValidationError('Assignee must be a member of the team');
      }

      // If assigning to employee, type must be 'employee'
      if (queueData.type !== 'employee') {
        throw new ValidationError('Queue type must be "employee" when assigning to a user');
      }
    }

    // Validate queue name is unique within team
    const existingQueues = await Queue.findByTeam(queueData.teamId);
    const nameExists = existingQueues.some(q => 
      q.name.toLowerCase() === queueData.name.toLowerCase()
    );
    
    if (nameExists) {
      throw new ValidationError('Queue name already exists in this team');
    }

    const queue = await Queue.createQueue(queueData);
    return Queue.toModel(queue);
  }

  /**
   * Update queue details
   */
  static async updateQueue(
    queueId: string,
    updateData: {
      name?: string;
      description?: string;
    },
    updatedById: string,
    userRole: string
  ): Promise<QueueModel> {
    const queue = await Queue.findById(queueId);
    if (!queue) {
      throw new NotFoundError('Queue not found');
    }

    // Validate permissions
    await this.validateQueueAccess(queue, updatedById, userRole, 'update');

    // Validate name uniqueness if updating name
    if (updateData.name && updateData.name !== queue.name) {
      const existingQueues = await Queue.findByTeam(queue.team_id);
      const nameExists = existingQueues.some(q => 
        q.id !== queueId && q.name.toLowerCase() === updateData.name!.toLowerCase()
      );
      
      if (nameExists) {
        throw new ValidationError('Queue name already exists in this team');
      }
    }

    const updates: any = {};
    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.description !== undefined) updates.description = updateData.description;

    const updatedQueue = await Queue.update(queueId, updates);
    if (!updatedQueue) {
      throw new NotFoundError('Queue not found');
    }

    return Queue.toModel(updatedQueue);
  }

  /**
   * Delete/deactivate a queue
   */
  static async deleteQueue(
    queueId: string,
    deletedById: string,
    userRole: string
  ): Promise<void> {
    const queue = await Queue.findById(queueId);
    if (!queue) {
      throw new NotFoundError('Queue not found');
    }

    // Validate permissions
    await this.validateQueueAccess(queue, deletedById, userRole, 'delete');

    // Check if queue has tickets
    const ticketCount = await this.getQueueTicketCount(queueId);
    if (ticketCount > 0) {
      throw new ValidationError('Cannot delete queue with existing tickets. Move tickets to another queue first.');
    }

    // Soft delete by setting is_active to false
    await Queue.update(queueId, { is_active: false });
  }

  /**
   * Assign queue to an employee
   */
  static async assignQueue(
    queueId: string,
    assignedToId: string,
    assignedById: string,
    userRole: string
  ): Promise<QueueModel> {
    const queue = await Queue.findById(queueId);
    if (!queue) {
      throw new NotFoundError('Queue not found');
    }

    // Validate permissions
    await this.validateQueueAccess(queue, assignedById, userRole, 'assign');

    // Validate assignee
    const assignee = await User.findById(assignedToId);
    if (!assignee || assignee.role === 'customer') {
      throw new ValidationError('Invalid assignee - must be an employee');
    }

    // Check if assignee is in the team
    const assigneeTeams = await User.getUserTeams(assignedToId);
    const hasTeamAccess = assigneeTeams.some(ut => ut.teamId === queue.team_id);
    
    if (!hasTeamAccess) {
      throw new ValidationError('Assignee must be a member of the team');
    }

    const updatedQueue = await Queue.assignToEmployee(queueId, assignedToId);
    if (!updatedQueue) {
      throw new NotFoundError('Queue not found');
    }

    return Queue.toModel(updatedQueue);
  }

  /**
   * Unassign queue from employee
   */
  static async unassignQueue(
    queueId: string,
    unassignedById: string,
    userRole: string
  ): Promise<QueueModel> {
    const queue = await Queue.findById(queueId);
    if (!queue) {
      throw new NotFoundError('Queue not found');
    }

    // Validate permissions
    await this.validateQueueAccess(queue, unassignedById, userRole, 'assign');

    const updatedQueue = await Queue.unassignFromEmployee(queueId);
    if (!updatedQueue) {
      throw new NotFoundError('Queue not found');
    }

    return Queue.toModel(updatedQueue);
  }

  /**
   * Get queue with detailed metrics
   */
  static async getQueueMetrics(
    queueId: string,
    userId: string,
    userRole: string
  ): Promise<QueueMetrics> {
    const queue = await Queue.findById(queueId);
    if (!queue) {
      throw new NotFoundError('Queue not found');
    }

    // Validate access
    await this.validateQueueAccess(queue, userId, userRole, 'read');

    // Get comprehensive metrics
    const metrics = await this.calculateQueueMetrics(queueId);
    
    return {
      queueId: queue.id,
      queueName: queue.name,
      ...metrics,
    };
  }

  /**
   * Get all queues for a team with metrics
   */
  static async getTeamQueuesWithMetrics(
    teamId: string,
    userId: string,
    userRole: string
  ): Promise<QueueMetrics[]> {
    // Validate team access
    if (userRole === 'employee') {
      const userTeams = await User.getUserTeams(userId);
      const hasTeamAccess = userTeams.some(ut => ut.teamId === teamId);
      
      if (!hasTeamAccess) {
        throw new ForbiddenError('Access denied to team queues');
      }
    }

    const queues = await Queue.findByTeam(teamId);
    
    const queueMetrics = await Promise.all(
      queues.map(async (queue) => {
        const metrics = await this.calculateQueueMetrics(queue.id);
        return {
          queueId: queue.id,
          queueName: queue.name,
          ...metrics,
        };
      })
    );

    return queueMetrics;
  }

  /**
   * Get user's accessible queues with metrics
   */
  static async getUserQueuesWithMetrics(
    userId: string,
    userRole: string,
    options: {
      includeTeamQueues?: boolean;
      includePersonalQueues?: boolean;
    } = {}
  ): Promise<QueueMetrics[]> {
    const { includeTeamQueues = true, includePersonalQueues = true } = options;
    
    let allQueues: QueueTable[] = [];

    if (userRole === 'customer') {
      // Customers don't have access to queues
      return [];
    }

    // Get personal queues (assigned to user)
    if (includePersonalQueues) {
      const personalQueues = await Queue.findByAssignee(userId);
      allQueues.push(...personalQueues);
    }

    // Get team queues
    if (includeTeamQueues) {
      const userTeams = await User.getUserTeams(userId);
      
      for (const teamMembership of userTeams) {
        const teamQueues = await Queue.findByTeam(teamMembership.teamId);
        // Filter out personal queues to avoid duplicates
        const filteredTeamQueues = teamQueues.filter((q: QueueTable) => 
          q.assigned_to_id !== userId || !includePersonalQueues
        );
        allQueues.push(...filteredTeamQueues);
      }
    }

    // For admins, include all queues if no team filtering
    if (userRole === 'admin' && includeTeamQueues) {
      const allSystemQueues = await Queue.query.where('is_active', true);
      // Merge with existing queues, avoiding duplicates
      const existingIds = new Set(allQueues.map(q => q.id));
      const additionalQueues = allSystemQueues.filter((q: QueueTable) => !existingIds.has(q.id));
      allQueues.push(...additionalQueues);
    }

    // Remove duplicates and calculate metrics
    const uniqueQueues = Array.from(
      new Map(allQueues.map(q => [q.id, q])).values()
    );

    const queueMetrics = await Promise.all(
      uniqueQueues.map(async (queue) => {
        const metrics = await this.calculateQueueMetrics(queue.id);
        return {
          queueId: queue.id,
          queueName: queue.name,
          ...metrics,
        };
      })
    );

    return queueMetrics;
  }

  /**
   * Get filtered and sorted queues
   */
  static async getFilteredQueues(
    userId: string,
    userRole: string,
    filters: {
      teamId?: string;
      assignedToId?: string;
      type?: 'unassigned' | 'employee';
      search?: string;
      sortBy?: 'name' | 'ticketCount' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<QueueModel[]> {
    let queues: QueueTable[];

    if (filters.teamId) {
      // Validate team access
      if (userRole === 'employee') {
        const userTeams = await User.getUserTeams(userId);
        const hasTeamAccess = userTeams.some(ut => ut.teamId === filters.teamId);
        
        if (!hasTeamAccess) {
          throw new ForbiddenError('Access denied to team queues');
        }
      }
      
      queues = await Queue.findByTeam(filters.teamId);
    } else if (filters.assignedToId) {
      // Validate assignee access
      if (userRole === 'employee' && filters.assignedToId !== userId) {
        throw new ForbiddenError('Access denied to other user\'s queues');
      }
      
      queues = await Queue.findByAssignee(filters.assignedToId);
    } else {
      // Get user's accessible queues
      const userQueues = await this.getUserQueuesWithMetrics(userId, userRole);
      const queueIds = userQueues.map(q => q.queueId);
      
      if (queueIds.length === 0) {
        return [];
      }
      
      queues = await Queue.query.whereIn('id', queueIds).where('is_active', true);
    }

    // Apply filters
    if (filters.type) {
      queues = queues.filter(q => q.type === filters.type);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      queues = queues.filter((q: QueueTable) => 
        q.name.toLowerCase().includes(searchTerm) ||
        (q.description && q.description.toLowerCase().includes(searchTerm))
      );
    }

    // Get queues with ticket counts for sorting
    const queuesWithCounts = await Promise.all(
      queues.map(async (queue) => {
        const ticketCount = await this.getQueueTicketCount(queue.id);
        return { ...queue, ticketCount };
      })
    );

    // Apply sorting
    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'asc';
    
    queuesWithCounts.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'ticketCount':
          aValue = a.ticketCount;
          bValue = b.ticketCount;
          break;
        case 'createdAt':
          aValue = a.created_at;
          bValue = b.created_at;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    return queuesWithCounts.map(queue => Queue.toModel(queue));
  }

  // Private helper methods

  private static async validateQueueAccess(
    queue: QueueTable,
    userId: string,
    userRole: string,
    action: 'read' | 'update' | 'delete' | 'assign'
  ): Promise<void> {
    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot access queues');
    }

    if (userRole === 'admin') {
      return; // Admins have full access
    }

    if (userRole === 'employee') {
      // Check if user has access to the team
      const userTeams = await User.getUserTeams(userId);
      const teamMembership = userTeams.find(ut => ut.teamId === queue.team_id);
      
      if (!teamMembership) {
        throw new ForbiddenError('Access denied to queue');
      }

      // For modification actions, user must be team lead
      if (['update', 'delete', 'assign'].includes(action) && teamMembership.role !== 'lead') {
        throw new ForbiddenError('Only team leads can modify queues');
      }

      // For assigned queues, user can read if it's their queue
      if (action === 'read' && queue.assigned_to_id && queue.assigned_to_id !== userId) {
        // Allow if user is team lead
        if (teamMembership.role !== 'lead') {
          throw new ForbiddenError('Access denied to assigned queue');
        }
      }
    }
  }

  private static async calculateQueueMetrics(queueId: string): Promise<Omit<QueueMetrics, 'queueId' | 'queueName'>> {
    // Use the BaseModel's db property through Queue
    const db = (Queue as any).db;
    const baseQuery = db('tickets').where('queue_id', queueId);
    
    // Get basic counts
    const basicMetrics = await baseQuery
      .select(
        db.raw('COUNT(*) as total_tickets'),
        db.raw('COUNT(CASE WHEN status = \'open\' THEN 1 END) as open_tickets'),
        db.raw('COUNT(CASE WHEN assigned_to_id IS NOT NULL THEN 1 END) as assigned_tickets'),
        db.raw('COUNT(CASE WHEN status IN (\'resolved\', \'closed\') THEN 1 END) as resolved_tickets')
      )
      .first();

    // Get status breakdown
    const statusBreakdown = await db('tickets')
      .where('queue_id', queueId)
      .select('status')
      .count('* as count')
      .groupBy('status');

    // Calculate average resolution time for resolved tickets
    const resolutionTimeQuery = await db('tickets')
      .where('queue_id', queueId)
      .whereNotNull('resolved_at')
      .select(
        db.raw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_resolution_seconds')
      )
      .first();

    const statusBreakdownMap: Record<string, number> = {};
    statusBreakdown.forEach((item: any) => {
      statusBreakdownMap[item.status] = parseInt(item.count as string, 10);
    });

    const averageResolutionTime = resolutionTimeQuery?.avg_resolution_seconds 
      ? Math.round(parseFloat(resolutionTimeQuery.avg_resolution_seconds))
      : 0;

    return {
      totalTickets: parseInt(basicMetrics?.total_tickets || '0', 10),
      openTickets: parseInt(basicMetrics?.open_tickets || '0', 10),
      assignedTickets: parseInt(basicMetrics?.assigned_tickets || '0', 10),
      resolvedTickets: parseInt(basicMetrics?.resolved_tickets || '0', 10),
      averageResolutionTime,
      statusBreakdown: statusBreakdownMap,
    };
  }

  private static async getQueueTicketCount(queueId: string): Promise<number> {
    const db = (Queue as any).db;
    const result = await db('tickets')
      .where('queue_id', queueId)
      .count('* as count')
      .first();
    
    return parseInt(result?.count || '0', 10);
  }
}