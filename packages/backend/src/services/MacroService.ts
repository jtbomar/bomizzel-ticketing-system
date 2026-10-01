import { db } from '@/config/database';
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors';
import { STAFF_ROLES, tenantUserIds } from '@/utils/tenant';
import { sanitizeNoteHtml, noteHtmlToText } from '@/utils/richText';
import { TicketService } from './TicketService';
import { FieldService } from './FieldService';
import { PlanService } from './PlanService';

/**
 * Macros: a saved reply plus ticket changes, applied to a ticket in one go.
 *
 * Applying one makes the field changes straight away (as the agent applying
 * it, through the normal update, so permissions and history are the same as
 * doing it by hand) and returns the reply with its placeholders filled in.
 * The reply is not sent: it goes in the agent's note box to check first.
 *
 * Shared macros (owner_id null) are made by admins and everyone at the
 * subscriber can use them. Any agent can make personal ones only they see.
 */

export const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
// 'no_response' is only ever set by the server
const RESOLUTIONS = ['fixed', 'wont_do', 'duplicate'];

export interface MacroActions {
  status?: string;
  resolution?: string;
  priority?: number;
  assignTo?: string; // 'me' | 'unassigned' | user id
  departmentId?: number;
  productId?: number | null; // null clears it
  // Custom fields to set (null clears one), by key
  fields?: Record<string, unknown>;
}

export interface MacroInput {
  name: string;
  shared?: boolean;
  replyHtml?: string | null;
  replyInternal?: boolean;
  actions?: MacroActions;
}

interface Caller {
  id: string;
  role: string;
  tenantId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parse = <T>(value: unknown, fallback: T): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : ((value as T) ?? fallback);

const toModel = (row: any) => ({
  id: row.id,
  name: row.name,
  shared: row.owner_id === null,
  ownerId: row.owner_id,
  replyHtml: row.reply_html,
  replyInternal: row.reply_internal,
  actions: parse<MacroActions>(row.actions, {}),
  updatedAt: row.updated_at,
});

/** The placeholders a reply can use, shown in the editor. */
export const PLACEHOLDERS = [
  { key: 'customer.firstName', label: "Customer's first name" },
  { key: 'customer.name', label: "Customer's full name" },
  { key: 'account.name', label: "Customer's account" },
  { key: 'ticket.number', label: 'Ticket number' },
  { key: 'ticket.subject', label: 'Ticket subject' },
  { key: 'agent.firstName', label: 'Your first name' },
  { key: 'agent.name', label: 'Your full name' },
  { key: 'company.name', label: 'Your company' },
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Fill {{placeholders}}; values are escaped, unknown ones are left as typed. */
export const fillPlaceholders = (html: string, values: Record<string, string>): string =>
  html.replace(/\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/g, (match, key: string) =>
    key in values ? escapeHtml(values[key] ?? '') : match
  );

const visibleTo = (caller: Caller) =>
  db('macros')
    .where('org_id', caller.tenantId)
    .where((q) => q.whereNull('owner_id').orWhere('owner_id', caller.id));

export class MacroService {
  /** The caller's macros: shared ones, then their own. */
  static async list(caller: Caller) {
    const rows = await visibleTo(caller).orderByRaw('owner_id IS NOT NULL').orderBy('name');
    return rows.map(toModel);
  }

  static async options(tenantId: string) {
    const [agents, departments] = await Promise.all([
      db('users')
        .whereIn('id', tenantUserIds(tenantId))
        .whereIn('role', STAFF_ROLES)
        .where('is_active', true)
        .orderBy(['first_name', 'last_name'])
        .select('id', 'first_name', 'last_name', 'email'),
      db('departments')
        .where((q) => q.where('org_id', tenantId).orWhere('company_id', tenantId))
        .where((q) => q.where('is_active', true).orWhereNull('is_active'))
        .orderBy('name')
        .select('id', 'name'),
    ]);
    return {
      agents: agents.map((a: any) => ({
        id: a.id,
        name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email,
      })),
      departments,
      placeholders: PLACEHOLDERS,
    };
  }

  private static async validate(caller: Caller, input: MacroInput) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 120) throw new ValidationError('Give the macro a name');

    const replyHtml = input.replyHtml ? sanitizeNoteHtml(input.replyHtml) : '';
    const hasReply = !!noteHtmlToText(replyHtml);

    const a = input.actions || {};
    const actions: MacroActions = {};
    if (a.status) {
      if (!STATUSES.includes(a.status)) throw new ValidationError('Unknown status');
      actions.status = a.status;
      if (['resolved', 'closed'].includes(a.status)) {
        const resolution = a.resolution || 'fixed';
        if (!RESOLUTIONS.includes(resolution)) {
          throw new ValidationError('Unknown resolution');
        }
        actions.resolution = resolution;
      }
    }
    if (a.priority !== undefined && a.priority !== null && (a.priority as any) !== '') {
      const priority = Number(a.priority);
      if (![0, 1, 2, 3].includes(priority)) throw new ValidationError('Unknown priority');
      actions.priority = priority;
    }
    if (a.assignTo) {
      if (a.assignTo !== 'me' && a.assignTo !== 'unassigned') {
        const agent =
          UUID.test(a.assignTo) &&
          (await db('users')
            .where('id', a.assignTo)
            .whereIn('role', STAFF_ROLES)
            .whereIn('id', tenantUserIds(caller.tenantId))
            .first('id'));
        if (!agent) throw new ValidationError('Unknown agent');
      }
      actions.assignTo = a.assignTo;
    }
    if (a.departmentId) {
      const department = await db('departments')
        .where('id', Number(a.departmentId))
        .where((q) => q.where('org_id', caller.tenantId).orWhere('company_id', caller.tenantId))
        .first('id');
      if (!department) throw new ValidationError('Unknown department');
      actions.departmentId = department.id;
    }

    if (a.productId !== undefined) {
      if (a.productId === null) {
        actions.productId = null;
      } else {
        const product = await db('products')
          .where('id', Number(a.productId))
          .where((q) => q.where('company_id', caller.tenantId).orWhere('org_id', caller.tenantId))
          .where('is_active', true)
          .first('id');
        if (!product) throw new ValidationError('Unknown product');
        actions.productId = product.id;
      }
    }
    if (a.fields && typeof a.fields === 'object' && !Array.isArray(a.fields)) {
      const entries = Object.entries(a.fields);
      if (entries.length > 50) throw new ValidationError('Up to 50 fields');
      // Values are checked like on a ticket; null (or empty) means "clear it"
      const toSet = Object.fromEntries(
        entries.filter(([, v]) => !(v === null || v === '' || (Array.isArray(v) && v.length === 0)))
      );
      const checked = await FieldService.validateValues(caller.tenantId, 'tickets', toSet);
      const known = new Set(
        (await FieldService.customFields(caller.tenantId, 'tickets')).map((f) => f.key)
      );
      const fields: Record<string, unknown> = {};
      for (const [key] of entries) {
        if (!known.has(key)) throw new ValidationError('Unknown field');
        fields[key] = key in checked ? checked[key] : null;
      }
      if (entries.length) actions.fields = fields;
    }

    if (!hasReply && Object.keys(actions).length === 0) {
      throw new ValidationError('A macro needs a reply or at least one change');
    }

    return {
      name,
      reply_html: hasReply ? replyHtml : null,
      reply_internal: !!input.replyInternal,
      actions: JSON.stringify(actions),
    };
  }

  /** Shared macros are the admins'; a personal one is its owner's. */
  private static assertCanEdit(caller: Caller, shared: boolean, ownerId: string | null) {
    if (shared && caller.role !== 'admin') {
      throw new ForbiddenError('Only admins can change shared macros');
    }
    if (!shared && ownerId !== caller.id) throw new NotFoundError('Macro not found');
  }

  static async create(caller: Caller, input: MacroInput) {
    await PlanService.assertCan(caller.tenantId, 'macro');
    const shared = !!input.shared;
    this.assertCanEdit(caller, shared, shared ? null : caller.id);
    const data = await this.validate(caller, input);
    const [row] = await db('macros')
      .insert({
        ...data,
        org_id: caller.tenantId,
        owner_id: shared ? null : caller.id,
        created_by: caller.id,
      })
      .returning('*');
    return toModel(row);
  }

  private static async findVisible(caller: Caller, macroId: string) {
    const row = UUID.test(macroId) && (await visibleTo(caller).where('id', macroId).first());
    if (!row) throw new NotFoundError('Macro not found');
    return row;
  }

  static async update(caller: Caller, macroId: string, input: MacroInput) {
    const row = await this.findVisible(caller, macroId);
    this.assertCanEdit(caller, row.owner_id === null, row.owner_id);
    const data = await this.validate(caller, input);
    const [updated] = await db('macros')
      .where('id', macroId)
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return toModel(updated);
  }

  static async remove(caller: Caller, macroId: string) {
    const row = await this.findVisible(caller, macroId);
    this.assertCanEdit(caller, row.owner_id === null, row.owner_id);
    await db('macros').where('id', macroId).del();
  }

  /**
   * Apply a macro to a ticket: make its changes, and return the ticket and
   * the reply to put in the note box (not sent).
   */
  static async apply(caller: Caller, macroId: string, ticketId: string) {
    const macro = await this.findVisible(caller, macroId);
    const ticket = UUID.test(ticketId)
      ? await db('tickets').where({ id: ticketId, org_id: caller.tenantId }).first()
      : null;
    if (!ticket) throw new NotFoundError('Ticket not found');

    const actions = parse<MacroActions>(macro.actions, {});
    const update: Record<string, any> = {};
    if (actions.status && actions.status !== ticket.status) {
      update.status = actions.status;
      if (actions.resolution) update.resolution = actions.resolution;
    }
    if (actions.priority !== undefined && actions.priority !== ticket.priority) {
      update.priority = actions.priority;
    }
    if (actions.departmentId && actions.departmentId !== ticket.department_id) {
      update.departmentId = actions.departmentId;
    }
    if (actions.productId !== undefined && actions.productId !== ticket.product_id) {
      update.productId = actions.productId;
    }
    if (actions.fields) {
      // Fields deleted since the macro was saved are skipped
      const known = new Set(
        (await FieldService.customFields(caller.tenantId, 'tickets')).map((f) => f.key)
      );
      const current = ticket.custom_field_values || {};
      const changes = Object.fromEntries(
        Object.entries(actions.fields)
          .filter(([key]) => known.has(key))
          .filter(([key, v]) => JSON.stringify(current[key] ?? null) !== JSON.stringify(v ?? null))
          .map(([key, v]) => [key, v === null ? '' : v])
      );
      if (Object.keys(changes).length) update.customFieldValues = changes;
    }
    if (actions.assignTo) {
      const to =
        actions.assignTo === 'me'
          ? caller.id
          : actions.assignTo === 'unassigned'
            ? null
            : actions.assignTo;
      if (to !== ticket.assigned_to_id) update.assignedToId = to;
    }

    const updated =
      Object.keys(update).length > 0
        ? await TicketService.updateTicket(ticketId, update as any, caller.id, caller.role)
        : await TicketService.getTicket(ticketId, caller.id, caller.role);

    let reply: { html: string; text: string; isInternal: boolean } | null = null;
    if (macro.reply_html) {
      const [customer, account, agent, company] = await Promise.all([
        db('users').where('id', ticket.submitter_id).first('first_name', 'last_name'),
        db('companies').where('id', ticket.company_id).first('name'),
        db('users').where('id', caller.id).first('first_name', 'last_name'),
        db('companies').where('id', caller.tenantId).first('name'),
      ]);
      const full = (u: any) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim();
      const html = fillPlaceholders(macro.reply_html, {
        'customer.firstName': customer?.first_name || '',
        'customer.name': full(customer),
        'account.name': account?.name || '',
        'ticket.number': ticket.ticket_number ? `#${ticket.ticket_number}` : '',
        'ticket.subject': ticket.title || '',
        'agent.firstName': agent?.first_name || '',
        'agent.name': full(agent),
        'company.name': company?.name || '',
      });
      reply = { html, text: noteHtmlToText(html), isInternal: macro.reply_internal };
    }

    return { ticket: updated, reply, changed: Object.keys(update) };
  }
}
