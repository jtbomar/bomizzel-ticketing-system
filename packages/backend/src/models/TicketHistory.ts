import { BaseModel } from './BaseModel';
import { TicketHistoryTable } from '../types/database';
import { TicketHistory as TicketHistoryModel, TicketAction } from '../types/models';

export class TicketHistory extends BaseModel {
  static tableName = 'ticket_history';

  /**
   * Create a new history entry
   */
  static async create(data: {
    ticketId: string;
    userId: string;
    action: TicketAction;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    metadata?: Record<string, any>;
  }): Promise<TicketHistoryTable> {
    const [history] = await this.db(this.tableName)
      .insert({
        ticket_id: data.ticketId,
        user_id: data.userId,
        action: data.action,
        field_name: data.fieldName,
        old_value: data.oldValue,
        new_value: data.newValue,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      })
      .returning('*');

    return history;
  }

  /**
   * Get history for a specific ticket
   */
  static async findByTicket(
    ticketId: string,
    options: {
      limit?: number;
      offset?: number;
      includeUser?: boolean;
    } = {}
  ): Promise<TicketHistoryTable[]> {
    const { limit = 50, offset = 0, includeUser = false } = options;

    let query = this.db(this.tableName)
      .where('ticket_id', ticketId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (includeUser) {
      query = query
        .leftJoin('users', 'ticket_history.user_id', 'users.id')
        .select(
          'ticket_history.*',
          'users.first_name as user_first_name',
          'users.last_name as user_last_name',
          'users.email as user_email'
        );
    }

    return query;
  }

  /**
   * Get history for multiple tickets
   */
  static async findByTickets(
    ticketIds: string[],
    options: {
      limit?: number;
      includeUser?: boolean;
    } = {}
  ): Promise<TicketHistoryTable[]> {
    const { limit = 100, includeUser = false } = options;

    let query = this.db(this.tableName)
      .whereIn('ticket_id', ticketIds)
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (includeUser) {
      query = query
        .leftJoin('users', 'ticket_history.user_id', 'users.id')
        .select(
          'ticket_history.*',
          'users.first_name as user_first_name',
          'users.last_name as user_last_name',
          'users.email as user_email'
        );
    }

    return query;
  }

  /**
   * Get history by user
   */
  static async findByUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      action?: TicketAction;
    } = {}
  ): Promise<TicketHistoryTable[]> {
    const { limit = 50, offset = 0, action } = options;

    let query = this.db(this.tableName)
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (action) {
      query = query.where('action', action);
    }

    return query;
  }

  /**
   * Get recent activity across all tickets
   */
  static async getRecentActivity(
    options: {
      limit?: number;
      teamId?: string;
      includeUser?: boolean;
      includeTicket?: boolean;
    } = {}
  ): Promise<TicketHistoryTable[]> {
    const { limit = 20, teamId, includeUser = false, includeTicket = false } = options;

    let query = this.db(this.tableName).orderBy('created_at', 'desc').limit(limit);

    if (teamId) {
      query = query
        .join('tickets', 'ticket_history.ticket_id', 'tickets.id')
        .where('tickets.team_id', teamId);
    }

    if (includeUser) {
      query = query
        .leftJoin('users', 'ticket_history.user_id', 'users.id')
        .select(
          'ticket_history.*',
          'users.first_name as user_first_name',
          'users.last_name as user_last_name',
          'users.email as user_email'
        );
    }

    if (includeTicket) {
      if (!teamId) {
        query = query.join('tickets', 'ticket_history.ticket_id', 'tickets.id');
      }
      query = query.select(
        'ticket_history.*',
        'tickets.title as ticket_title',
        'tickets.status as ticket_status'
      );
    }

    return query;
  }

  /**
   * Delete history entries older than specified days
   */
  static async cleanup(daysOld: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deletedCount = await this.db(this.tableName).where('created_at', '<', cutoffDate).del();

    return deletedCount;
  }

  /**
   * Convert database row to model
   */
  static toModel(row: TicketHistoryTable & { 
    user_first_name?: string; 
    user_last_name?: string; 
    user_email?: string; 
  }): TicketHistoryModel {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      action: row.action as TicketAction,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: row.user_first_name
        ? {
            id: row.user_id,
            firstName: row.user_first_name,
            lastName: row.user_last_name || '',
            email: row.user_email || '',
            role: 'customer' as const,
            isActive: true,
            emailVerified: false,
            preferences: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : undefined,
    };
  }
}
