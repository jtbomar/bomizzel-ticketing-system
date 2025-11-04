import { BaseModel } from './BaseModel';
import { TicketTable } from '@/types/database';
import { Ticket as TicketModel, TicketAction } from '@/types/models';

export class Ticket extends BaseModel {
  protected static tableName = 'tickets';

  static async createTicket(ticketData: {
    title: string;
    description: string;
    submitterId: string;
    companyId: string;
    queueId: string;
    teamId: string;
    customFieldValues?: Record<string, any>;
  }): Promise<TicketTable> {
    return this.create({
      title: ticketData.title,
      description: ticketData.description,
      submitter_id: ticketData.submitterId,
      company_id: ticketData.companyId,
      queue_id: ticketData.queueId,
      team_id: ticketData.teamId,
      custom_field_values: ticketData.customFieldValues || {},
      status: 'open',
      priority: 0,
    });
  }

  static async findByCompany(
    companyId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      assignedToId?: string;
    } = {}
  ): Promise<TicketTable[]> {
    let query = this.query.where('company_id', companyId);

    if (options.status) {
      query = query.where('status', options.status);
    }

    if (options.assignedToId) {
      query = query.where('assigned_to_id', options.assignedToId);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('created_at', 'desc');
  }

  static async findByQueue(
    queueId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ): Promise<TicketTable[]> {
    let query = this.query.where('queue_id', queueId);

    if (options.status) {
      query = query.where('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('priority', 'desc').orderBy('created_at', 'asc');
  }

  static async findByAssignee(
    assignedToId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ): Promise<TicketTable[]> {
    let query = this.query.where('assigned_to_id', assignedToId);

    if (options.status) {
      query = query.where('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('priority', 'desc').orderBy('created_at', 'asc');
  }

  static async assignTicket(
    ticketId: string,
    assignedToId: string,
    assignedById: string
  ): Promise<TicketTable | null> {
    const ticket = await this.update(ticketId, { assigned_to_id: assignedToId });

    if (ticket) {
      await this.addHistory(
        ticketId,
        assignedById,
        'assigned',
        'assigned_to_id',
        undefined,
        assignedToId
      );
    }

    return ticket;
  }

  static async unassignTicket(
    ticketId: string,
    unassignedById: string
  ): Promise<TicketTable | null> {
    const currentTicket = await this.findById(ticketId);
    const ticket = await this.update(ticketId, { assigned_to_id: null });

    if (ticket && currentTicket) {
      await this.addHistory(
        ticketId,
        unassignedById,
        'unassigned',
        'assigned_to_id',
        currentTicket.assigned_to_id,
        undefined
      );
    }

    return ticket;
  }

  static async updateStatus(
    ticketId: string,
    status: string,
    updatedById: string
  ): Promise<TicketTable | null> {
    const currentTicket = await this.findById(ticketId);
    const updateData: any = { status };

    // Set resolved_at or closed_at based on status
    if (status === 'resolved' && currentTicket?.status !== 'resolved') {
      updateData.resolved_at = new Date();
    } else if (status === 'closed' && currentTicket?.status !== 'closed') {
      updateData.closed_at = new Date();
    }

    const ticket = await this.update(ticketId, updateData);

    if (ticket && currentTicket) {
      await this.addHistory(
        ticketId,
        updatedById,
        'status_changed',
        'status',
        currentTicket.status,
        status
      );
    }

    return ticket;
  }

  static async updatePriority(
    ticketId: string,
    priority: number,
    updatedById: string
  ): Promise<TicketTable | null> {
    const currentTicket = await this.findById(ticketId);
    const ticket = await this.update(ticketId, { priority });

    if (ticket && currentTicket) {
      await this.addHistory(
        ticketId,
        updatedById,
        'priority_changed',
        'priority',
        currentTicket.priority.toString(),
        priority.toString()
      );
    }

    return ticket;
  }

  static async updateCustomFields(
    ticketId: string,
    customFieldValues: Record<string, any>,
    updatedById: string
  ): Promise<TicketTable | null> {
    const ticket = await this.update(ticketId, { custom_field_values: customFieldValues });

    if (ticket) {
      await this.addHistory(ticketId, updatedById, 'updated', 'custom_field_values', undefined, undefined, {
        customFieldValues,
      });
    }

    return ticket;
  }

  static async addHistory(
    ticketId: string,
    userId: string,
    action: TicketAction,
    fieldName?: string,
    oldValue?: string,
    newValue?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.db('ticket_history').insert({
      ticket_id: ticketId,
      user_id: userId,
      action,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      metadata,
    });
  }

  static async getTicketHistory(ticketId: string): Promise<any[]> {
    return this.db('ticket_history as th')
      .join('users as u', 'th.user_id', 'u.id')
      .where('th.ticket_id', ticketId)
      .select('th.*', 'u.first_name', 'u.last_name', 'u.email')
      .orderBy('th.created_at', 'desc');
  }

  static async searchTickets(options: {
    query?: string;
    companyIds?: string[];
    teamIds?: string[];
    status?: string[];
    assignedToId?: string;
    submitterId?: string;
    limit?: number;
    offset?: number;
  }): Promise<TicketTable[]> {
    let query = this.query;

    if (options.query) {
      query = query.where(function () {
        this.where('title', 'ilike', `%${options.query}%`).orWhere(
          'description',
          'ilike',
          `%${options.query}%`
        );
      });
    }

    if (options.companyIds && options.companyIds.length > 0) {
      query = query.whereIn('company_id', options.companyIds);
    }

    if (options.teamIds && options.teamIds.length > 0) {
      query = query.whereIn('team_id', options.teamIds);
    }

    if (options.status && options.status.length > 0) {
      query = query.whereIn('status', options.status);
    }

    if (options.assignedToId) {
      query = query.where('assigned_to_id', options.assignedToId);
    }

    if (options.submitterId) {
      query = query.where('submitter_id', options.submitterId);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('created_at', 'desc');
  }

  static async findArchived(
    options: {
      limit?: number;
      offset?: number;
      companyIds?: string[];
      teamIds?: string[];
      query?: string;
    } = {}
  ): Promise<TicketTable[]> {
    let query = this.query.whereNotNull('archived_at');

    if (options.companyIds && options.companyIds.length > 0) {
      query = query.whereIn('company_id', options.companyIds);
    }

    if (options.teamIds && options.teamIds.length > 0) {
      query = query.whereIn('team_id', options.teamIds);
    }

    if (options.query) {
      query = query.where(function () {
        this.where('title', 'ilike', `%${options.query}%`).orWhere(
          'description',
          'ilike',
          `%${options.query}%`
        );
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('archived_at', 'desc');
  }

  static async findArchivable(
    options: {
      limit?: number;
      companyIds?: string[];
      teamIds?: string[];
      olderThanDays?: number;
    } = {}
  ): Promise<TicketTable[]> {
    let query = this.query
      .whereIn('status', ['resolved', 'closed', 'completed'])
      .whereNull('archived_at');

    if (options.companyIds && options.companyIds.length > 0) {
      query = query.whereIn('company_id', options.companyIds);
    }

    if (options.teamIds && options.teamIds.length > 0) {
      query = query.whereIn('team_id', options.teamIds);
    }

    if (options.olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);
      query = query.where(function () {
        this.where('resolved_at', '<', cutoffDate)
          .orWhere('closed_at', '<', cutoffDate)
          .orWhere('updated_at', '<', cutoffDate);
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return query.orderBy('updated_at', 'asc');
  }

  // Convert database record to API model
  static toModel(ticket: TicketTable): TicketModel {
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      submitterId: ticket.submitter_id,
      companyId: ticket.company_id,
      assignedToId: ticket.assigned_to_id,
      queueId: ticket.queue_id,
      teamId: ticket.team_id,
      customFieldValues: ticket.custom_field_values,
      resolvedAt: ticket.resolved_at,
      closedAt: ticket.closed_at,
      archivedAt: ticket.archived_at,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  }
}
