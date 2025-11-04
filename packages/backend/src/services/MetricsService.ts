import { Queue } from '../models/Queue';
import { Ticket } from '../models/Ticket';
import { QueueMetrics } from '../types/models';
import { notificationService } from './NotificationService';
import { logger } from '../utils/logger';

export class MetricsService {
  /**
   * Calculate and broadcast queue metrics
   */
  static async updateQueueMetrics(queueId: string): Promise<QueueMetrics | null> {
    try {
      const queue = await Queue.findById(queueId);
      if (!queue) {
        logger.warn(`Queue not found for metrics update: ${queueId}`);
        return null;
      }

      const metrics = await this.calculateQueueMetrics(queueId);

      // Broadcast the updated metrics
      notificationService.notifyQueueMetricsUpdated(Queue.toModel(queue), metrics);

      return metrics;
    } catch (error) {
      logger.error('Error updating queue metrics:', error);
      return null;
    }
  }

  /**
   * Calculate metrics for a specific queue
   */
  static async calculateQueueMetrics(queueId: string): Promise<QueueMetrics> {
    const queue = await Queue.findById(queueId);
    if (!queue) {
      throw new Error('Queue not found');
    }

    // Get all tickets in the queue
    const allTickets = await Ticket.findByQueue(queueId);

    // Calculate basic counts
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter((t) => t.status === 'open').length;
    const assignedTickets = allTickets.filter((t) => t.assigned_to_id !== null).length;
    const resolvedTickets = allTickets.filter((t) => t.resolved_at !== null).length;

    // Calculate status breakdown
    const statusBreakdown: Record<string, number> = {};
    allTickets.forEach((ticket) => {
      statusBreakdown[ticket.status] = (statusBreakdown[ticket.status] || 0) + 1;
    });

    // Calculate average resolution time (in hours)
    const resolvedTicketsWithTime = allTickets.filter((t) => t.resolved_at && t.created_at);
    let averageResolutionTime = 0;

    if (resolvedTicketsWithTime.length > 0) {
      const totalResolutionTime = resolvedTicketsWithTime.reduce((sum, ticket) => {
        const createdAt = new Date(ticket.created_at);
        const resolvedAt = new Date(ticket.resolved_at!);
        const resolutionTimeHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        return sum + resolutionTimeHours;
      }, 0);

      averageResolutionTime = totalResolutionTime / resolvedTicketsWithTime.length;
    }

    return {
      queueId: queue.id,
      queueName: queue.name,
      totalTickets,
      openTickets,
      assignedTickets,
      resolvedTickets,
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100, // Round to 2 decimal places
      statusBreakdown,
    };
  }

  /**
   * Calculate metrics for all queues in a team
   */
  static async calculateTeamMetrics(teamId: string): Promise<QueueMetrics[]> {
    const queues = await Queue.findByTeam(teamId);
    const metricsPromises = queues.map((queue) => this.calculateQueueMetrics(queue.id));
    return Promise.all(metricsPromises);
  }

  /**
   * Update metrics for all queues (can be called periodically)
   */
  static async updateAllQueueMetrics(): Promise<void> {
    try {
      const allQueues = await Queue.findAll();
      const updatePromises = allQueues.map((queue) => this.updateQueueMetrics(queue.id));
      await Promise.all(updatePromises);
      logger.info(`Updated metrics for ${allQueues.length} queues`);
    } catch (error) {
      logger.error('Error updating all queue metrics:', error);
    }
  }

  /**
   * Schedule periodic metrics updates
   */
  static startPeriodicMetricsUpdate(intervalMinutes: number = 5): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;

    logger.info(`Starting periodic metrics updates every ${intervalMinutes} minutes`);

    return setInterval(() => {
      this.updateAllQueueMetrics();
    }, intervalMs);
  }
}

export default MetricsService;
