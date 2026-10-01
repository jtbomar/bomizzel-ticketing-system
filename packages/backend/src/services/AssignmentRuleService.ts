import { db } from '@/config/database';
import { logger } from '@/utils/logger';
import { ValidationError, NotFoundError } from '@/utils/errors';
import { STAFF_ROLES, tenantUserIds } from '@/utils/tenant';

/**
 * Assignment rules (Settings > Assignment Rules): who gets a new ticket.
 *
 * Rules run in order when a ticket comes in (web or email), and again when
 * an unassigned ticket's priority or department changes - tickets start at
 * Low, so a priority rule would otherwise never fire. The first rule that
 * matches and has an agent available assigns it. A ticket that already has
 * an agent, or is resolved/closed, is never touched.
 */

export const METHODS = ['specific', 'round_robin'] as const;
export const CHANNELS = ['email', 'web'] as const;
export const PRIORITIES = [0, 1, 2, 3];

export interface RuleConditions {
  departmentIds?: number[];
  companyIds?: string[];
  priorities?: number[];
  channels?: string[];
  keywords?: string[];
}

export interface RuleInput {
  name: string;
  isActive?: boolean;
  conditions?: RuleConditions;
  method: string;
  agentIds: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parse = <T>(value: unknown, fallback: T): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : ((value as T) ?? fallback);

const toModel = (row: any) => ({
  id: row.id,
  name: row.name,
  isActive: row.is_active,
  position: row.position,
  conditions: parse<RuleConditions>(row.conditions, {}),
  method: row.method,
  agentIds: parse<string[]>(row.agent_ids, []),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Active staff of the subscriber among these ids, in the order given. */
const availableAgents = async (tenantId: string, ids: string[]): Promise<string[]> => {
  if (ids.length === 0) return [];
  const rows = await db('users')
    .whereIn('id', ids)
    .where('is_active', true)
    .whereIn('role', STAFF_ROLES)
    .whereIn('id', tenantUserIds(tenantId))
    .select('id');
  const found = new Set(rows.map((r: any) => r.id));
  return ids.filter((id) => found.has(id));
};

const plainText = (value: string | null | undefined): string =>
  (value || '').replace(/<[^>]*>/g, ' ').toLowerCase();

export const ruleMatches = (conditions: RuleConditions, ticket: any): boolean => {
  const c = conditions || {};
  if (c.departmentIds?.length && !c.departmentIds.includes(ticket.department_id)) return false;
  if (c.companyIds?.length && !c.companyIds.includes(ticket.company_id)) return false;
  if (c.priorities?.length && !c.priorities.includes(Number(ticket.priority))) return false;
  if (c.channels?.length && !c.channels.includes(ticket.source || 'web')) return false;
  if (c.keywords?.length) {
    const text = `${plainText(ticket.title)} ${plainText(ticket.description)}`;
    if (!c.keywords.some((k) => text.includes(k.toLowerCase()))) return false;
  }
  return true;
};

export class AssignmentRuleService {
  static async list(tenantId: string) {
    const rows = await db('assignment_rules')
      .where('org_id', tenantId)
      .orderBy([{ column: 'position' }, { column: 'created_at' }]);
    return rows.map(toModel);
  }

  /** What a rule can pick from: the subscriber's agents, accounts and departments. */
  static async options(tenantId: string) {
    const [agents, accounts, departments] = await Promise.all([
      db('users')
        .whereIn('id', tenantUserIds(tenantId))
        .whereIn('role', STAFF_ROLES)
        .orderBy(['first_name', 'last_name'])
        .select('id', 'first_name', 'last_name', 'email', 'is_active'),
      db('companies').where('subscriber_id', tenantId).orderBy('name').select('id', 'name'),
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
        email: a.email,
        isActive: a.is_active,
      })),
      accounts,
      departments,
    };
  }

  /** Check a rule against the subscriber's own data; returns what to store. */
  private static async validate(tenantId: string, input: RuleInput) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 120) throw new ValidationError('Give the rule a name');
    if (!METHODS.includes(input.method as any)) throw new ValidationError('Unknown method');

    const agentIds = Array.isArray(input.agentIds) ? [...new Set(input.agentIds)] : [];
    if (agentIds.length === 0 || agentIds.length > 50 || !agentIds.every((id) => UUID.test(id))) {
      throw new ValidationError('Choose at least one agent');
    }
    if (input.method === 'specific' && agentIds.length !== 1) {
      throw new ValidationError('Choose one agent, or use round-robin for several');
    }
    const known = await db('users')
      .whereIn('id', agentIds)
      .whereIn('role', STAFF_ROLES)
      .whereIn('id', tenantUserIds(tenantId))
      .select('id');
    if (known.length !== agentIds.length) throw new ValidationError('Unknown agent');

    const c = input.conditions || {};
    const list = <T>(v: unknown): T[] => (Array.isArray(v) ? [...new Set(v as T[])] : []);
    const conditions: RuleConditions = {};

    const departmentIds = list<number>(c.departmentIds).map(Number);
    if (departmentIds.length) {
      const rows = await db('departments')
        .whereIn('id', departmentIds.filter(Number.isInteger))
        .where((q) => q.where('org_id', tenantId).orWhere('company_id', tenantId))
        .select('id');
      if (rows.length !== departmentIds.length) throw new ValidationError('Unknown department');
      conditions.departmentIds = departmentIds;
    }
    const companyIds = list<string>(c.companyIds);
    if (companyIds.length) {
      const rows = await db('companies')
        .whereIn(
          'id',
          companyIds.filter((id) => UUID.test(String(id)))
        )
        .where('subscriber_id', tenantId)
        .select('id');
      if (rows.length !== companyIds.length) throw new ValidationError('Unknown account');
      conditions.companyIds = companyIds;
    }
    const priorities = list<number>(c.priorities).map(Number);
    if (priorities.length) {
      if (!priorities.every((p) => PRIORITIES.includes(p))) {
        throw new ValidationError('Unknown priority');
      }
      conditions.priorities = priorities;
    }
    const channels = list<string>(c.channels);
    if (channels.length) {
      if (!channels.every((ch) => (CHANNELS as readonly string[]).includes(ch))) {
        throw new ValidationError('Unknown channel');
      }
      conditions.channels = channels;
    }
    const keywords = list<string>(c.keywords)
      .map((k) => String(k).trim())
      .filter(Boolean);
    if (keywords.length) {
      if (keywords.length > 50 || keywords.some((k) => k.length > 100)) {
        throw new ValidationError('Too many or too long keywords');
      }
      conditions.keywords = keywords;
    }

    return {
      name,
      is_active: input.isActive !== false,
      method: input.method,
      agent_ids: JSON.stringify(agentIds),
      conditions: JSON.stringify(conditions),
    };
  }

  static async create(tenantId: string, userId: string, input: RuleInput) {
    const data = await this.validate(tenantId, input);
    const last = await db('assignment_rules')
      .where('org_id', tenantId)
      .max('position as max')
      .first();
    const [row] = await db('assignment_rules')
      .insert({
        ...data,
        org_id: tenantId,
        created_by: userId,
        position: (Number(last?.max) || 0) + 1,
      })
      .returning('*');
    return toModel(row);
  }

  static async update(tenantId: string, ruleId: string, input: RuleInput) {
    const data = await this.validate(tenantId, input);
    const [row] = await db('assignment_rules')
      .where({ id: ruleId, org_id: tenantId })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    if (!row) throw new NotFoundError('Rule not found');
    return toModel(row);
  }

  static async remove(tenantId: string, ruleId: string) {
    const deleted = await db('assignment_rules').where({ id: ruleId, org_id: tenantId }).del();
    if (!deleted) throw new NotFoundError('Rule not found');
  }

  /** New order, first to last. Ids of other subscribers' rules are ignored. */
  static async reorder(tenantId: string, ruleIds: string[]) {
    await db.transaction(async (trx) => {
      for (const [index, id] of ruleIds.entries()) {
        await trx('assignment_rules')
          .where({ id, org_id: tenantId })
          .update({ position: index + 1 });
      }
    });
    return this.list(tenantId);
  }

  /**
   * Run the rules on a ticket. Returns who it was given to, or null. Never
   * throws: a failure here must not stop a ticket from being created.
   */
  static async apply(ticketId: string): Promise<{ agentId: string; ruleId: string } | null> {
    try {
      const ticket = await db('tickets').where('id', ticketId).first();
      if (!ticket || ticket.assigned_to_id || !ticket.org_id) return null;
      if (['resolved', 'closed'].includes(ticket.status)) return null;

      const rules = await db('assignment_rules')
        .where({ org_id: ticket.org_id, is_active: true })
        .orderBy([{ column: 'position' }, { column: 'created_at' }]);

      for (const rule of rules) {
        if (!ruleMatches(parse<RuleConditions>(rule.conditions, {}), ticket)) continue;
        const agentId = await this.pickAgent(ticket.org_id, rule.id);
        if (!agentId) continue; // nobody available: try the next rule

        // Only if nobody assigned it in the meantime
        const updated = await db('tickets')
          .where({ id: ticketId })
          .whereNull('assigned_to_id')
          .update({ assigned_to_id: agentId, updated_at: db.fn.now() });
        if (!updated) return null;

        const queue = await db('queues')
          .where({ assigned_to_id: agentId, is_active: true })
          .orderBy('name')
          .first('id');
        if (queue) await db('tickets').where('id', ticketId).update({ queue_id: queue.id });

        await db('ticket_history').insert({
          ticket_id: ticketId,
          user_id: rule.created_by || ticket.submitter_id,
          action: 'assigned',
          field_name: 'assigned_to_id',
          new_value: agentId,
          metadata: JSON.stringify({ automatic: true, ruleId: rule.id, ruleName: rule.name }),
        });
        return { agentId, ruleId: rule.id };
      }
      return null;
    } catch (error) {
      logger.error('Assignment rules failed', {
        ticketId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** The rule's agent, or for round-robin the next available one in turn. */
  private static async pickAgent(tenantId: string, ruleId: string): Promise<string | null> {
    return db.transaction(async (trx) => {
      // Locked, so two tickets at once don't both go to the same agent
      const rule = await trx('assignment_rules').where('id', ruleId).forUpdate().first();
      if (!rule) return null;
      const configured = parse<string[]>(rule.agent_ids, []);
      const available = await availableAgents(tenantId, configured);
      if (available.length === 0) return null;
      if (rule.method !== 'round_robin') return available[0] ?? null;

      // The next agent after whoever had the last one, in the configured order
      const lastIndex = rule.last_agent_id ? configured.indexOf(rule.last_agent_id) : -1;
      const next =
        configured
          .slice(lastIndex + 1)
          .concat(configured.slice(0, lastIndex + 1))
          .find((id) => available.includes(id)) ?? null;
      if (next) await trx('assignment_rules').where('id', ruleId).update({ last_agent_id: next });
      return next;
    });
  }
}
