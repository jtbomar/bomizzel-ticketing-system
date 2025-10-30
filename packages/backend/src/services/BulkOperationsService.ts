import { Ticket } from '../models/Ticket';
import { User } from '../models/User';
import { TicketService } from './TicketService';
import { notificationService } from './NotificationService';
import { MetricsService } from './MetricsService';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface BulkOperationResult {
  success: string[];
  failed: Array<{
    ticketId: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface BulkAssignRequest {
  ticketIds: string[];
  assignedToId: string;
  performedById: string;
}

export interface BulkStatusUpdateRequest {
  ticketIds: string[];
  status: string;
  performedById: string;
}

export interface BulkPriorityUpdateRequest {
  ticketIds: string[];
  priority: number;
  performedById: string;
}

export interface BulkDeleteRequest {
  ticketIds: string[];
  performedById: string;
}

export class BulkOperationsService {
  /**
   * Bulk assign tickets to an employee
   */
  static async bulkAssignTickets(
    request: BulkAssignRequest,
    userRole: string
  ): Promise<BulkOperationResult> {
    const { ticketIds, assignedToId, performedById } = request;
    const result: BulkOperationResult = {
      success: [],
      failed: [],
      summary: { total: ticketIds.length, successful: 0, failed: 0 }
    };

    // Validate permissions
    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot assign tickets');
    }

    // Validate assignee
    const assignee = await User.findById(assignedToId);
    if (!assignee || assignee.role === 'customer') {
      throw new ValidationError('Invalid assignee');
    }

    // Process each ticket
    for (const ticketId of ticketIds) {
      try {
        await TicketService.assignTicket(ticketId, assignedToId, performedById, userRole);
        result.success.push(ticketId);
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.summary.failed++;
        logger.warn(`Failed to assign ticket ${ticketId}:`, error);
      }
    }

    // Update metrics for affected queues
    this.updateAffectedQueueMetrics(ticketIds);

    logger.info(`Bulk assign completed: ${result.summary.successful}/${result.summary.total} successful`);
    return result;
  }

  /**
   * Bulk update ticket status
   */
  static async bulkUpdateStatus(
    request: BulkStatusUpdateRequest,
    userRole: string
  ): Promise<BulkOperationResult> {
    const { ticketIds, status, performedById } = request;
    const result: BulkOperationResult = {
      success: [],
      failed: [],
      summary: { total: ticketIds.length, successful: 0, failed: 0 }
    };

    // Process each ticket
    for (const ticketId of ticketIds) {
      try {
        await TicketService.updateTicketStatus(ticketId, status, performedById, userRole);
        result.success.push(ticketId);
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.summary.failed++;
        logger.warn(`Failed to update status for ticket ${ticketId}:`, error);
      }
    }

    // Update metrics for affected queues
    this.updateAffectedQueueMetrics(ticketIds);

    logger.info(`Bulk status update completed: ${result.summary.successful}/${result.summary.total} successful`);
    return result;
  }

  /**
   * Bulk update ticket priority
   */
  static async bulkUpdatePriority(
    request: BulkPriorityUpdateRequest,
    userRole: string
  ): Promise<BulkOperationResult> {
    const { ticketIds, priority, performedById } = request;
    const result: BulkOperationResult = {
      success: [],
      failed: [],
      summary: { total: ticketIds.length, successful: 0, failed: 0 }
    };

    // Validate priority
    if (priority < 0 || priority > 100) {
      throw new ValidationError('Priority must be between 0 and 100');
    }

    // Process each ticket
    for (const ticketId of ticketIds) {
      try {
        await TicketService.updateTicketPriority(ticketId, priority, performedById, userRole);
        result.success.push(ticketId);
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.summary.failed++;
        logger.warn(`Failed to update priority for ticket ${ticketId}:`, error);
      }
    }

    // Update metrics for affected queues
    this.updateAffectedQueueMetrics(ticketIds);

    logger.info(`Bulk priority update completed: ${result.summary.successful}/${result.summary.total} successful`);
    return result;
  }

  /**
   * Bulk delete tickets (soft delete by setting status to 'deleted')
   */
  static async bulkDeleteTickets(
    request: BulkDeleteRequest,
    userRole: string
  ): Promise<BulkOperationResult> {
    const { ticketIds, performedById } = request;
    const result: BulkOperationResult = {
      success: [],
      failed: [],
      summary: { total: ticketIds.length, successful: 0, failed: 0 }
    };

    // Only admins and team leads can delete tickets
    if (!['admin', 'team_lead'].includes(userRole)) {
      throw new ForbiddenError('Insufficient permissions to delete tickets');
    }

    // Process each ticket
    for (const ticketId of ticketIds) {
      try {
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          throw new NotFoundError('Ticket not found');
        }

        // Soft delete by updating status
        await Ticket.update(ticketId, { status: 'deleted' });
        await Ticket.addHistory(ticketId, performedById, 'deleted');

        result.success.push(ticketId);
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.summary.failed++;
        logger.warn(`Failed to delete ticket ${ticketId}:`, error);
      }
    }

    // Update metrics for affected queues
    this.updateAffectedQueueMetrics(ticketIds);

    logger.info(`Bulk delete completed: ${result.summary.successful}/${result.summary.total} successful`);
    return result;
  }

  /**
   * Bulk move tickets to a different queue
   */
  static async bulkMoveToQueue(
    ticketIds: string[],
    queueId: string,
    performedById: string,
    userRole: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: [],
      failed: [],
      summary: { total: ticketIds.length, successful: 0, failed: 0 }
    };

    // Validate permissions
    if (userRole === 'customer') {
      throw new ForbiddenError('Customers cannot move tickets');
    }

    // Process each ticket
    for (const ticketId of ticketIds) {
      try {
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          throw new NotFoundError('Ticket not found');
        }

        const oldQueueId = ticket.queue_id;
        await Ticket.update(ticketId, { queue_id: queueId });
        await Ticket.addHistory(ticketId, performedById, 'moved', 'queue_id', oldQueueId, queueId);

        result.success.push(ticketId);
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          ticketId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.summary.failed++;
        logger.warn(`Failed to move ticket ${ticketId}:`, error);
      }
    }

    // Update metrics for affected queues
    this.updateAffectedQueueMetrics(ticketIds);

    logger.info(`Bulk move completed: ${result.summary.successful}/${result.summary.total} successful`);
    return result;
  }

  /**
   * Get bulk operation history
   */
  static async getBulkOperationHistory(
    performedById: string,
    options: {
      limit?: number;
      offset?: number;
      action?: string;
    } = {}
  ): Promise<any[]> {
    const { limit = 50, offset = 0, action } = options;

    let query = Ticket.db('ticket_history as th')
      .join('tickets as t', 'th.ticket_id', 't.id')
      .join('users as u', 'th.user_id', 'u.id')
      .where('th.user_id', performedById)
      .select(
        'th.*',
        't.title as ticket_title',
        't.status as ticket_status',
        'u.first_name',
        'u.last_name'
      )
      .orderBy('th.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (action) {
      query = query.where('th.action', action);
    }

    return query;
  }

  /**
   * Validate ticket access for bulk operations
   */
  static async validateTicketAccess(
    ticketIds: string[],
    userId: string,
    userRole: string
  ): Promise<{ accessible: string[]; denied: string[] }> {
    const accessible: string[] = [];
    const denied: string[] = [];

    for (const ticketId of ticketIds) {
      try {
        await TicketService.getTicket(ticketId, userId, userRole);
        accessible.push(ticketId);
      } catch (error) {
        denied.push(ticketId);
      }
    }

    return { accessible, denied };
  }

  /**
   * Update metrics for queues affected by bulk operations
   */
  private static async updateAffectedQueueMetrics(ticketIds: string[]): Promise<void> {
    try {
      // Get unique queue IDs from affected tickets
      const tickets = await Ticket.db('tickets')
        .whereIn('id', ticketIds)
        .select('queue_id')
        .distinct();

      const queueIds = tickets.map(t => t.queue_id);

      // Update metrics for each affected queue
      for (const queueId of queueIds) {
        MetricsService.updateQueueMetrics(queueId);
      }
    } catch (error) {
      logger.warn('Failed to update queue metrics after bulk operation:', error);
    }
  }
}

export default BulkOperationsService;