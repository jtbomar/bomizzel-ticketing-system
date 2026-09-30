import { db } from '@/config/database';
import { logger } from '@/utils/logger';

/**
 * Resolved tickets close by themselves: a ticket resolved more than
 * AUTO_CLOSE_RESOLVED_DAYS days ago (default 7) with no reply since is
 * closed, keeping its resolution (fixed, won't do, ...). A customer reply
 * before then reopens it; after it's closed, a reply opens a new ticket.
 */

const DAYS = () => Math.max(1, Number(process.env['AUTO_CLOSE_RESOLVED_DAYS']) || 7);
const EVERY_MS = 60 * 60 * 1000; // hourly

export class TicketAutoCloseJob {
  private static timer: NodeJS.Timeout | null = null;

  static start(): void {
    if (this.timer) return;
    this.run().catch(() => undefined);
    this.timer = setInterval(() => this.run().catch(() => undefined), EVERY_MS);
    this.timer.unref?.();
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Close tickets resolved more than `days` days ago. Returns how many. */
  static async run(days: number = DAYS()): Promise<number> {
    try {
      const closed = await db('tickets')
        .where('status', 'resolved')
        .where('resolved_at', '<', db.raw(`now() - (? || ' days')::interval`, [String(days)]))
        .update({
          status: 'closed',
          closed_at: db.fn.now(),
          resolution: db.raw(`coalesce(resolution, 'fixed')`),
          updated_at: db.fn.now(),
        })
        .returning(['id', 'assigned_to_id', 'submitter_id']);

      for (const ticket of closed) {
        // History needs a user: the assignee, else the customer.
        const who = ticket.assigned_to_id || ticket.submitter_id;
        await db('ticket_history').insert({
          ticket_id: ticket.id,
          user_id: who,
          action: 'closed',
          field_name: 'status',
          old_value: 'resolved',
          new_value: 'closed',
          metadata: JSON.stringify({ automatic: true, afterDays: days }),
        });
      }
      if (closed.length) logger.info(`Auto-closed ${closed.length} resolved ticket(s)`, { days });
      return closed.length;
    } catch (error) {
      logger.error('Auto-close job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
