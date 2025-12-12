import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';

/**
 * Organization-scoped Ticket Service
 * All methods require orgId to ensure proper tenant isolation
 */
export class OrgScopedTicketService {
  /**
   * Get all tickets for an organization
   */
  static async getTickets(orgId: string, filters: any = {}) {
    const query = db('tickets').where('tickets.org_id', orgId);

    // Apply filters
    if (filters.status) {
      query.where('tickets.status', filters.status);
    }
    if (filters.priority) {
      query.where('tickets.priority', filters.priority);
    }
    if (filters.assignedTo) {
      query.where('tickets.assigned_to', filters.assignedTo);
    }
    if (filters.queueId) {
      query.where('tickets.queue_id', filters.queueId);
    }
    if (filters.customerId) {
      query.where('tickets.customer_id', filters.customerId);
    }

    const tickets = await query.select('tickets.*').orderBy('tickets.created_at', 'desc');

    return tickets;
  }

  /**
   * Get single ticket (with org verification)
   */
  static async getTicket(orgId: string, ticketId: string) {
    const ticket = await db('tickets').where('id', ticketId).where('org_id', orgId).first();

    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    return ticket;
  }

  /**
   * Create ticket (org-scoped)
   */
  static async createTicket(orgId: string, data: any) {
    // Verify queue belongs to org
    if (data.queue_id) {
      const queue = await db('queues').where('id', data.queue_id).where('org_id', orgId).first();

      if (!queue) {
        throw new AppError('Queue not found in this organization', 404, 'QUEUE_NOT_FOUND');
      }
    }

    const [ticket] = await db('tickets')
      .insert({
        ...data,
        org_id: orgId,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return ticket;
  }

  /**
   * Update ticket (with org verification)
   */
  static async updateTicket(orgId: string, ticketId: string, updates: any) {
    // Verify ticket belongs to org
    const ticket = await this.getTicket(orgId, ticketId);

    // If updating queue, verify new queue belongs to org
    if (updates.queue_id) {
      const queue = await db('queues').where('id', updates.queue_id).where('org_id', orgId).first();

      if (!queue) {
        throw new AppError('Queue not found in this organization', 404, 'QUEUE_NOT_FOUND');
      }
    }

    const [updatedTicket] = await db('tickets')
      .where('id', ticketId)
      .where('org_id', orgId)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return updatedTicket;
  }

  /**
   * Delete ticket (with org verification)
   */
  static async deleteTicket(orgId: string, ticketId: string) {
    const deleted = await db('tickets').where('id', ticketId).where('org_id', orgId).del();

    if (deleted === 0) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    return { success: true };
  }

  /**
   * Get ticket notes (org-scoped)
   */
  static async getTicketNotes(orgId: string, ticketId: string) {
    // Verify ticket belongs to org
    await this.getTicket(orgId, ticketId);

    const notes = await db('ticket_notes')
      .where('ticket_id', ticketId)
      .where('org_id', orgId)
      .orderBy('created_at', 'desc');

    return notes;
  }

  /**
   * Add ticket note (org-scoped)
   */
  static async addTicketNote(orgId: string, ticketId: string, noteData: any) {
    // Verify ticket belongs to org
    await this.getTicket(orgId, ticketId);

    const [note] = await db('ticket_notes')
      .insert({
        ...noteData,
        ticket_id: ticketId,
        org_id: orgId,
        created_at: db.fn.now(),
      })
      .returning('*');

    return note;
  }

  /**
   * Get ticket statistics for org
   */
  static async getTicketStats(orgId: string) {
    const stats = await db('tickets')
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
