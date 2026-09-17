import { BaseModel } from './BaseModel';
import { TicketStatusTable } from '@/types/database';
import { TicketStatus as TicketStatusModel } from '@/types/models';

export class TicketStatus extends BaseModel {
  protected static tableName = 'ticket_statuses';

  static async createStatus(statusData: {
    teamId: string;
    name: string;
    label: string;
    color?: string;
    order?: number;
    isDefault?: boolean;
    isClosed?: boolean;
  }): Promise<TicketStatusTable> {
    return this.create({
      team_id: statusData.teamId,
      name: statusData.name,
      label: statusData.label,
      color: statusData.color || '#6B7280',
      order: statusData.order || 0,
      is_default: statusData.isDefault || false,
      is_closed: statusData.isClosed || false,
    });
  }

  /**
   * The default status set, matching migration
   * 20251120000000_seed_default_ticket_statuses.
   *
   * `name` is the key compared against a ticket's `status` value, so it must be
   * the snake_case form; `label` is the display text. Keeping one definition
   * here avoids the drift that broke status changes for newly registered
   * companies, where the registration flow seeded name: 'In Progress'.
   */
  static readonly DEFAULT_STATUSES = [
    { name: 'open', label: 'Open', color: '#3B82F6', order: 1, isDefault: true, isClosed: false },
    {
      name: 'in_progress',
      label: 'In Progress',
      color: '#F59E0B',
      order: 2,
      isDefault: false,
      isClosed: false,
    },
    {
      name: 'waiting',
      label: 'Waiting',
      color: '#8B5CF6',
      order: 3,
      isDefault: false,
      isClosed: false,
    },
    {
      name: 'resolved',
      label: 'Resolved',
      color: '#10B981',
      order: 4,
      isDefault: false,
      isClosed: false,
    },
    {
      name: 'closed',
      label: 'Closed',
      color: '#6B7280',
      order: 5,
      isDefault: false,
      isClosed: true,
    },
  ];

  /** Give a newly created team the default statuses. Safe to call twice. */
  static async seedDefaultStatuses(teamId: string): Promise<void> {
    const existing = await this.findByTeam(teamId);
    if (existing.length > 0) return;

    for (const status of this.DEFAULT_STATUSES) {
      await this.createStatus({ teamId, ...status });
    }
  }

  static async findByTeam(teamId: string): Promise<TicketStatusTable[]> {
    return this.query.where('team_id', teamId).where('is_active', true).orderBy('order', 'asc');
  }

  static async findByTeamAndName(teamId: string, name: string): Promise<TicketStatusTable | null> {
    const result = await this.query.where('team_id', teamId).where('name', name).first();
    return result || null;
  }

  static async getDefaultStatus(teamId: string): Promise<TicketStatusTable | null> {
    const result = await this.query
      .where('team_id', teamId)
      .where('is_default', true)
      .where('is_active', true)
      .first();
    return result || null;
  }

  static async updateOrder(
    teamId: string,
    statusOrders: { id: string; order: number }[]
  ): Promise<void> {
    const trx = await this.db.transaction();

    try {
      for (const { id, order } of statusOrders) {
        await trx('ticket_statuses')
          .where('id', id)
          .where('team_id', teamId)
          .update({ order, updated_at: new Date() });
      }

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  static async setDefaultStatus(teamId: string, statusId: string): Promise<void> {
    const trx = await this.db.transaction();

    try {
      // Remove default from all statuses in team
      await trx('ticket_statuses')
        .where('team_id', teamId)
        .update({ is_default: false, updated_at: new Date() });

      // Set new default
      await trx('ticket_statuses')
        .where('id', statusId)
        .where('team_id', teamId)
        .update({ is_default: true, updated_at: new Date() });

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  static async getStatusStats(
    teamId: string
  ): Promise<{ statusId: string; name: string; label: string; ticketCount: number }[]> {
    return this.db('ticket_statuses as ts')
      .leftJoin('tickets as t', function () {
        this.on('ts.name', '=', 't.status').andOn('ts.team_id', '=', 't.team_id');
      })
      .where('ts.team_id', teamId)
      .where('ts.is_active', true)
      .groupBy('ts.id', 'ts.name', 'ts.label', 'ts.order')
      .select('ts.id as statusId', 'ts.name', 'ts.label', this.db.raw('COUNT(t.id) as ticketCount'))
      .orderBy('ts.order', 'asc');
  }

  // Convert database record to API model
  static toModel(status: TicketStatusTable): TicketStatusModel {
    return {
      id: status.id,
      teamId: status.team_id,
      name: status.name,
      label: status.label,
      color: status.color,
      order: status.order,
      isDefault: status.is_default,
      isClosed: status.is_closed,
      isActive: status.is_active,
      createdAt: status.created_at,
      updatedAt: status.updated_at,
    };
  }
}
