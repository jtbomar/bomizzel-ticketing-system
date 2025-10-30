import { BaseModel } from './BaseModel';
import { UsageTrackingTable, UsageSummaryTable } from '@/types/database';
import { UsageRecord, UsageStats } from '@/types/models';

export class UsageTracking extends BaseModel {
  protected static tableName = 'usage_tracking';

  static async recordTicketAction(actionData: {
    subscriptionId: string;
    ticketId: string;
    action: 'created' | 'completed' | 'archived' | 'deleted';
    previousStatus?: string;
    newStatus?: string;
    metadata?: Record<string, any>;
  }): Promise<UsageTrackingTable> {
    return this.create({
      subscription_id: actionData.subscriptionId,
      ticket_id: actionData.ticketId,
      action: actionData.action,
      previous_status: actionData.previousStatus,
      new_status: actionData.newStatus,
      action_timestamp: new Date(),
      metadata: JSON.stringify(actionData.metadata || {}),
    });
  }

  static async getUsageForSubscription(
    subscriptionId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageTrackingTable[]> {
    let query = this.query.where('subscription_id', subscriptionId);

    if (startDate) {
      query = query.where('action_timestamp', '>=', startDate);
    }

    if (endDate) {
      query = query.where('action_timestamp', '<=', endDate);
    }

    return query.orderBy('action_timestamp', 'desc');
  }

  static async getCurrentUsageStats(subscriptionId: string): Promise<UsageStats> {
    // Get current active tickets count
    const activeTicketsResult = await this.db.raw(`
      SELECT COUNT(DISTINCT ticket_id) as count
      FROM usage_tracking ut1
      WHERE ut1.subscription_id = ?
      AND ut1.action_timestamp = (
        SELECT MAX(ut2.action_timestamp)
        FROM usage_tracking ut2
        WHERE ut2.subscription_id = ut1.subscription_id
        AND ut2.ticket_id = ut1.ticket_id
      )
      AND ut1.action IN ('created')
      AND ut1.ticket_id NOT IN (
        SELECT DISTINCT ticket_id
        FROM usage_tracking ut3
        WHERE ut3.subscription_id = ?
        AND ut3.action IN ('completed', 'archived', 'deleted')
        AND ut3.action_timestamp > ut1.action_timestamp
      )
    `, [subscriptionId, subscriptionId]);

    // Get completed tickets count (not archived)
    const completedTicketsResult = await this.db.raw(`
      SELECT COUNT(DISTINCT ticket_id) as count
      FROM usage_tracking ut1
      WHERE ut1.subscription_id = ?
      AND ut1.action_timestamp = (
        SELECT MAX(ut2.action_timestamp)
        FROM usage_tracking ut2
        WHERE ut2.subscription_id = ut1.subscription_id
        AND ut2.ticket_id = ut1.ticket_id
      )
      AND ut1.action = 'completed'
      AND ut1.ticket_id NOT IN (
        SELECT DISTINCT ticket_id
        FROM usage_tracking ut3
        WHERE ut3.subscription_id = ?
        AND ut3.action IN ('archived', 'deleted')
        AND ut3.action_timestamp > ut1.action_timestamp
      )
    `, [subscriptionId, subscriptionId]);

    // Get total tickets count (active + completed, excluding archived/deleted)
    const totalTicketsResult = await this.db.raw(`
      SELECT COUNT(DISTINCT ticket_id) as count
      FROM usage_tracking ut1
      WHERE ut1.subscription_id = ?
      AND ut1.action_timestamp = (
        SELECT MAX(ut2.action_timestamp)
        FROM usage_tracking ut2
        WHERE ut2.subscription_id = ut1.subscription_id
        AND ut2.ticket_id = ut1.ticket_id
      )
      AND ut1.action IN ('created', 'completed')
      AND ut1.ticket_id NOT IN (
        SELECT DISTINCT ticket_id
        FROM usage_tracking ut3
        WHERE ut3.subscription_id = ?
        AND ut3.action IN ('archived', 'deleted')
        AND ut3.action_timestamp > ut1.action_timestamp
      )
    `, [subscriptionId, subscriptionId]);

    const activeTickets = parseInt(activeTicketsResult.rows[0]?.count || '0');
    const completedTickets = parseInt(completedTicketsResult.rows[0]?.count || '0');
    const totalTickets = parseInt(totalTicketsResult.rows[0]?.count || '0');

    return {
      activeTickets,
      completedTickets,
      totalTickets,
      archivedTickets: 0, // Will be calculated separately if needed
    };
  }

  static async getUsageByPeriod(
    subscriptionId: string,
    period: string // YYYY-MM format
  ): Promise<UsageStats> {
    const startDate = new Date(`${period}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const usage = await this.getUsageForSubscription(subscriptionId, startDate, endDate);

    let activeTickets = 0;
    let completedTickets = 0;
    let archivedTickets = 0;
    const ticketActions = new Map<string, string>();

    // Process actions chronologically to get final state
    usage.reverse().forEach(record => {
      ticketActions.set(record.ticket_id, record.action);
    });

    // Count tickets by their final action in the period
    ticketActions.forEach(action => {
      switch (action) {
        case 'created':
          activeTickets++;
          break;
        case 'completed':
          completedTickets++;
          break;
        case 'archived':
          archivedTickets++;
          break;
      }
    });

    const totalTickets = activeTickets + completedTickets;

    return {
      activeTickets,
      completedTickets,
      totalTickets,
      archivedTickets,
    };
  }

  static async getTicketHistory(ticketId: string): Promise<UsageTrackingTable[]> {
    return this.query
      .where('ticket_id', ticketId)
      .orderBy('action_timestamp', 'asc');
  }

  static async getRecentActivity(
    subscriptionId: string,
    limit: number = 50
  ): Promise<UsageTrackingTable[]> {
    return this.query
      .where('subscription_id', subscriptionId)
      .orderBy('action_timestamp', 'desc')
      .limit(limit);
  }

  static async deleteTicketUsage(ticketId: string): Promise<void> {
    await this.query.where('ticket_id', ticketId).del();
  }

  static async getUsageCountsByAction(
    subscriptionId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    let query = this.query
      .where('subscription_id', subscriptionId)
      .select('action')
      .count('* as count')
      .groupBy('action');

    if (startDate) {
      query = query.where('action_timestamp', '>=', startDate);
    }

    if (endDate) {
      query = query.where('action_timestamp', '<=', endDate);
    }

    const results = await query;
    const counts: Record<string, number> = {};

    results.forEach(result => {
      counts[result.action] = parseInt(result.count.toString());
    });

    return counts;
  }

  // Convert database record to API model
  static toModel(record: UsageTrackingTable): UsageRecord {
    return {
      id: record.id,
      subscriptionId: record.subscription_id,
      ticketId: record.ticket_id,
      action: record.action,
      previousStatus: record.previous_status,
      newStatus: record.new_status,
      actionTimestamp: record.action_timestamp,
      metadata: typeof record.metadata === 'string' ? 
        JSON.parse(record.metadata) : record.metadata,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}

// Usage Summary Model for optimized queries
export class UsageSummary extends BaseModel {
  protected static tableName = 'usage_summaries';

  static async updateSummary(
    subscriptionId: string,
    period: string,
    stats: UsageStats
  ): Promise<UsageSummaryTable> {
    const existing = await this.query
      .where('subscription_id', subscriptionId)
      .where('period', period)
      .first();

    const summaryData = {
      subscription_id: subscriptionId,
      period,
      active_tickets_count: stats.activeTickets,
      completed_tickets_count: stats.completedTickets,
      total_tickets_count: stats.totalTickets,
      archived_tickets_count: stats.archivedTickets || 0,
      last_updated: new Date(),
    };

    if (existing) {
      const [updated] = await this.query
        .where('id', existing.id)
        .update(summaryData)
        .returning('*');
      return updated;
    } else {
      return this.create(summaryData);
    }
  }

  static async getSummary(
    subscriptionId: string,
    period: string
  ): Promise<UsageSummaryTable | null> {
    const result = await this.query
      .where('subscription_id', subscriptionId)
      .where('period', period)
      .first();
    return result || null;
  }

  static async getSummariesForSubscription(
    subscriptionId: string,
    limit: number = 12
  ): Promise<UsageSummaryTable[]> {
    return this.query
      .where('subscription_id', subscriptionId)
      .orderBy('period', 'desc')
      .limit(limit);
  }

  static async getCurrentPeriodSummary(subscriptionId: string): Promise<UsageSummaryTable | null> {
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    return this.getSummary(subscriptionId, currentPeriod);
  }
}