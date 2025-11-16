import { BaseModel } from './BaseModel';
import { QueueTable } from '@/types/database';
import { Queue as QueueModel } from '@/types/models';

export class Queue extends BaseModel {
  protected static override tableName = 'queues';

  static async createQueue(queueData: {
    name: string;
    description?: string;
    type: 'unassigned' | 'agent';
    assignedToId?: string;
    teamId: string;
  }): Promise<QueueTable> {
    return this.create({
      name: queueData.name,
      description: queueData.description,
      type: queueData.type,
      assigned_to_id: queueData.assignedToId,
      team_id: queueData.teamId,
    });
  }

  static async findByTeam(teamId: string): Promise<QueueTable[]> {
    return this.query.where('team_id', teamId).where('is_active', true).orderBy('name', 'asc');
  }

  static async findByAssignee(assignedToId: string): Promise<QueueTable[]> {
    return this.query
      .where('assigned_to_id', assignedToId)
      .where('is_active', true)
      .orderBy('name', 'asc');
  }

  static async getQueueWithTicketCount(queueId: string): Promise<any> {
    const queue = await this.findById(queueId);
    if (!queue) return null;

    const ticketCount = await this.db('tickets')
      .where('queue_id', queueId)
      .count('* as count')
      .first();

    return {
      ...queue,
      ticketCount: parseInt(String(ticketCount?.count || '0'), 10),
    };
  }

  static async getTeamQueuesWithMetrics(teamId: string): Promise<any[]> {
    const queues = await this.findByTeam(teamId);

    const queuesWithMetrics = await Promise.all(
      queues.map(async (queue) => {
        const metrics = await this.db('tickets')
          .where('queue_id', queue.id)
          .select(
            this.db.raw('COUNT(*) as total_tickets'),
            this.db.raw("COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets"),
            this.db.raw(
              'COUNT(CASE WHEN assigned_to_id IS NOT NULL THEN 1 END) as assigned_tickets'
            ),
            this.db.raw(
              "COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_tickets"
            )
          )
          .first();

        return {
          ...queue,
          metrics: {
            totalTickets: parseInt(metrics?.total_tickets || '0', 10),
            openTickets: parseInt(metrics?.open_tickets || '0', 10),
            assignedTickets: parseInt(metrics?.assigned_tickets || '0', 10),
            resolvedTickets: parseInt(metrics?.resolved_tickets || '0', 10),
          },
        };
      })
    );

    return queuesWithMetrics;
  }

  static async assignToEmployee(queueId: string, employeeId: string): Promise<QueueTable | null> {
    return this.update(queueId, {
      assigned_to_id: employeeId,
      type: 'agent',
    });
  }

  static async unassignFromEmployee(queueId: string): Promise<QueueTable | null> {
    return this.update(queueId, {
      assigned_to_id: null,
      type: 'unassigned',
    });
  }

  // Convert database record to API model
  static toModel(queue: QueueTable & { ticketCount?: number }): QueueModel {
    return {
      id: queue.id,
      name: queue.name,
      description: queue.description || undefined,
      type: queue.type,
      assignedToId: queue.assigned_to_id || undefined,
      teamId: queue.team_id,
      isActive: queue.is_active,
      createdAt: queue.created_at,
      updatedAt: queue.updated_at,
      ticketCount: queue.ticketCount,
    };
  }
}
