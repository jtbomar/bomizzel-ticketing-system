import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';

/**
 * Organization-scoped Queue Service
 * All methods require orgId to ensure proper tenant isolation
 */
export class OrgScopedQueueService {
  /**
   * Get all queues for an organization
   */
  static async getQueues(orgId: string) {
    const queues = await db('queues')
      .where('org_id', orgId)
      .where('is_active', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');

    return queues;
  }

  /**
   * Get single queue (with org verification)
   */
  static async getQueue(orgId: string, queueId: string) {
    const queue = await db('queues').where('id', queueId).where('org_id', orgId).first();

    if (!queue) {
      throw new AppError('Queue not found', 404, 'QUEUE_NOT_FOUND');
    }

    return queue;
  }

  /**
   * Create queue (org-scoped)
   */
  static async createQueue(orgId: string, data: any) {
    const [queue] = await db('queues')
      .insert({
        ...data,
        org_id: orgId,
        is_active: true,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return queue;
  }

  /**
   * Update queue (with org verification)
   */
  static async updateQueue(orgId: string, queueId: string, updates: any) {
    // Verify queue belongs to org
    await this.getQueue(orgId, queueId);

    const [updatedQueue] = await db('queues')
      .where('id', queueId)
      .where('org_id', orgId)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return updatedQueue;
  }

  /**
   * Delete queue (with org verification)
   */
  static async deleteQueue(orgId: string, queueId: string) {
    // Check if queue has tickets
    const ticketCount = await db('tickets')
      .where('queue_id', queueId)
      .where('org_id', orgId)
      .count('* as count')
      .first();

    if (ticketCount && parseInt(ticketCount.count as string) > 0) {
      throw new AppError('Cannot delete queue with existing tickets', 400, 'QUEUE_HAS_TICKETS');
    }

    const deleted = await db('queues').where('id', queueId).where('org_id', orgId).del();

    if (deleted === 0) {
      throw new AppError('Queue not found', 404, 'QUEUE_NOT_FOUND');
    }

    return { success: true };
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(orgId: string, queueId: string) {
    // Verify queue belongs to org
    await this.getQueue(orgId, queueId);

    const stats = await db('tickets')
      .where('queue_id', queueId)
      .where('org_id', orgId)
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN status = 'open' THEN 1 END) as open"),
        db.raw("COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress"),
        db.raw("COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting"),
        db.raw("COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved")
      )
      .first();

    return stats;
  }
}
