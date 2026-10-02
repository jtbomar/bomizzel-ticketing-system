import { db } from '@/config/database';
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors';
import { FieldService } from './FieldService';

/**
 * Saved views of the ticket board (the sidebar's Views). A view is a name and
 * conditions a ticket must all match; the board applies them to the tickets
 * it has loaded. Shared views are the admins' to change; personal ones are
 * their owner's.
 */

export const VIEW_FIELDS = [
  'status',
  'priority',
  'assignee',
  'department',
  'account',
  'channel',
  'product',
  'created',
  'keywords',
] as const;
const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const CREATED = ['today', '7d', '30d'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VIEWS = 100;

export interface ViewCondition {
  field: string;
  values: string[];
}

interface Caller {
  id: string;
  role: string;
  tenantId: string;
}

const parse = <T>(value: unknown, fallback: T): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : ((value as T) ?? fallback);

const toModel = (row: any) => ({
  id: row.id,
  name: row.name,
  shared: row.owner_id === null,
  conditions: parse<ViewCondition[]>(row.conditions, []),
  position: row.position,
});

const visibleTo = (caller: Caller) =>
  db('ticket_views')
    .where('org_id', caller.tenantId)
    .where((q) => q.whereNull('owner_id').orWhere('owner_id', caller.id));

export class ViewService {
  static async list(caller: Caller) {
    const rows = await visibleTo(caller)
      .orderByRaw('owner_id IS NOT NULL')
      .orderBy([{ column: 'position' }, { column: 'name' }]);
    return rows.map(toModel);
  }

  /** Check a view's conditions; returns what to store. */
  private static async clean(caller: Caller, input: any) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 80) throw new ValidationError('Give the view a name');
    const raw = Array.isArray(input?.conditions) ? input.conditions : [];
    if (raw.length > 20) throw new ValidationError('Up to 20 conditions');
    const customKeys = new Set(
      (await FieldService.customFields(caller.tenantId, 'tickets')).map((f) => f.key)
    );
    const seen = new Set<string>();
    const conditions: ViewCondition[] = raw.map((c: any) => {
      const field = String(c?.field || '');
      const isCustom = field.startsWith('cf:') && customKeys.has(field.slice(3));
      if (!(VIEW_FIELDS as readonly string[]).includes(field) && !isCustom) {
        throw new ValidationError('Unknown condition');
      }
      if (seen.has(field)) throw new ValidationError('Each condition can be used once');
      seen.add(field);
      const values = [
        ...new Set((Array.isArray(c.values) ? c.values : []).map((v: unknown) => String(v).trim())),
      ].filter(Boolean) as string[];
      if (values.length === 0 || values.length > 100 || values.some((v) => v.length > 200)) {
        throw new ValidationError('Every condition needs something to match');
      }
      const bad = (what: string) => new ValidationError(`Unknown ${what} in a condition`);
      if (field === 'status' && !values.every((v) => STATUSES.includes(v))) throw bad('status');
      if (field === 'priority' && !values.every((v) => ['0', '1', '2', '3'].includes(v)))
        throw bad('priority');
      if (field === 'channel' && !values.every((v) => ['email', 'web'].includes(v)))
        throw bad('channel');
      if (field === 'created' && (values.length !== 1 || !CREATED.includes(values[0]!)))
        throw bad('date range');
      if (
        field === 'assignee' &&
        !values.every((v) => v === 'me' || v === 'unassigned' || UUID.test(v))
      )
        throw bad('agent');
      if (field === 'account' && !values.every((v) => UUID.test(v))) throw bad('account');
      if ((field === 'department' || field === 'product') && !values.every((v) => /^\d+$/.test(v)))
        throw bad(field);
      return { field, values };
    });
    return { name, conditions: JSON.stringify(conditions) };
  }

  private static assertCanEdit(caller: Caller, shared: boolean, ownerId: string | null) {
    if (shared && caller.role !== 'admin')
      throw new ForbiddenError('Only admins can change shared views');
    if (!shared && ownerId !== caller.id) throw new NotFoundError('View not found');
  }

  static async create(caller: Caller, input: any) {
    const shared = !!input?.shared;
    this.assertCanEdit(caller, shared, shared ? null : caller.id);
    const count = await db('ticket_views').where('org_id', caller.tenantId).count('* as n').first();
    if (Number(count?.n) >= MAX_VIEWS) throw new ValidationError(`Up to ${MAX_VIEWS} views`);
    const data = await this.clean(caller, input);
    const [row] = await db('ticket_views')
      .insert({ ...data, org_id: caller.tenantId, owner_id: shared ? null : caller.id })
      .returning('*');
    return toModel(row);
  }

  private static async find(caller: Caller, id: string) {
    const row = UUID.test(id) && (await visibleTo(caller).where('id', id).first());
    if (!row) throw new NotFoundError('View not found');
    return row;
  }

  static async update(caller: Caller, id: string, input: any) {
    const row = await this.find(caller, id);
    this.assertCanEdit(caller, row.owner_id === null, row.owner_id);
    const data = await this.clean(caller, input);
    const [updated] = await db('ticket_views')
      .where('id', id)
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return toModel(updated);
  }

  static async remove(caller: Caller, id: string) {
    const row = await this.find(caller, id);
    this.assertCanEdit(caller, row.owner_id === null, row.owner_id);
    await db('ticket_views').where('id', id).del();
  }
}
