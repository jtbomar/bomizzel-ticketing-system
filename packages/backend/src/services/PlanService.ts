import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { STAFF_ROLES } from '@/utils/tenant';

/**
 * Plans (Settings > Billing): what each includes, which one a company is on,
 * and the limits that go with it.
 *
 * A company's plan, in order: one given free (comped_plan); a paid plan
 * that's active (or past due, for GRACE_DAYS after the first failed payment);
 * Professional while its trial lasts; otherwise Free. Going down a plan never
 * deletes anything - it only stops new things being added past the limits.
 */

export type PlanKey = 'free' | 'standard' | 'professional';
export type Interval = 'month' | 'year';

export interface Plan {
  key: PlanKey;
  name: string;
  // Per agent, in dollars
  monthly: number;
  yearly: number; // per agent per month, billed yearly
  limits: {
    agents: number | null; // null = no limit
    ticketsPerMonth: number | null;
    departments: number | null;
    macros: number | null;
    ticketFields: number | null;
    assignmentRules: boolean;
    roundRobin: boolean;
    recordFields: boolean; // custom fields on accounts and contacts
    customModules: boolean;
  };
}

export const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    limits: {
      agents: 2,
      ticketsPerMonth: 50,
      departments: 1,
      macros: 5,
      ticketFields: 5,
      assignmentRules: false,
      roundRobin: false,
      recordFields: false,
      customModules: false,
    },
  },
  {
    key: 'standard',
    name: 'Standard',
    monthly: 12,
    yearly: 10,
    limits: {
      agents: null,
      ticketsPerMonth: 100,
      departments: 2,
      macros: 10,
      ticketFields: 10,
      assignmentRules: true,
      roundRobin: false,
      recordFields: false,
      customModules: false,
    },
  },
  {
    key: 'professional',
    name: 'Professional',
    monthly: 25,
    yearly: 20,
    limits: {
      agents: null,
      ticketsPerMonth: null,
      departments: null,
      macros: null,
      ticketFields: null,
      assignmentRules: true,
      roundRobin: true,
      recordFields: true,
      customModules: true,
    },
  },
];

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
const PAID_STATUSES = ['active', 'trialing'];

/** One line per thing a plan includes (the welcome email; the plan cards say the same). */
export const planFeatureLines = (p: Plan): string[] => {
  const l = p.limits;
  const n = (v: number | null, one: string, many: string) =>
    v === null ? `Unlimited ${many}` : `${v} ${v === 1 ? one : many}`;
  return [
    l.agents === null ? 'Add as many agents as you need' : `Up to ${l.agents} agents, free`,
    l.ticketsPerMonth === null ? 'Unlimited tickets' : `${l.ticketsPerMonth} tickets a month`,
    'Email to ticket, board, attachments',
    n(l.departments, 'department', 'departments'),
    n(l.macros, 'macro', 'macros'),
    l.ticketFields === null ? 'Custom ticket fields' : `${l.ticketFields} custom ticket fields`,
    ...(l.assignmentRules
      ? [l.roundRobin ? 'Assignment rules, with round-robin' : 'Assignment rules']
      : []),
    ...(l.recordFields ? ['Account and contact custom fields'] : []),
    ...(l.customModules ? ['Custom modules and lookups'] : []),
  ];
};

export const planByKey = (key: string | null | undefined): Plan =>
  PLANS.find((p) => p.key === key) || PLANS[0]!;

export type PlanSource = 'comped' | 'paid' | 'grace' | 'trial' | 'free';

/** Which plan a company row is on, and why. */
export const effectivePlan = (
  company: any,
  now = new Date()
): { plan: Plan; source: PlanSource } => {
  if (company?.comped_plan) return { plan: planByKey(company.comped_plan), source: 'comped' };
  const paid = company?.plan && company.plan !== 'free';
  if (paid && PAID_STATUSES.includes(company.subscription_status)) {
    return { plan: planByKey(company.plan), source: 'paid' };
  }
  if (paid && company.subscription_status === 'past_due' && company.past_due_since) {
    const graceEnds = new Date(company.past_due_since).getTime() + GRACE_DAYS * 86400000;
    if (now.getTime() < graceEnds) return { plan: planByKey(company.plan), source: 'grace' };
  }
  if (company?.trial_ends_at && new Date(company.trial_ends_at) > now) {
    return { plan: planByKey('professional'), source: 'trial' };
  }
  return { plan: planByKey('free'), source: 'free' };
};

export type Limits = Plan['limits'];
export type LimitOverrides = Partial<Limits>;
export const NUMBER_LIMITS = [
  'agents',
  'ticketsPerMonth',
  'departments',
  'macros',
  'ticketFields',
] as const;
export const FEATURE_LIMITS = [
  'assignmentRules',
  'roundRobin',
  'recordFields',
  'customModules',
] as const;

/**
 * A company's own limits (companies.limit_overrides), keeping only known keys
 * of the right type: a whole number or null (no limit) for counts, true/false
 * for features.
 */
export const cleanOverrides = (raw: unknown): LimitOverrides => {
  let src: unknown = raw;
  if (typeof src === 'string') {
    try {
      src = JSON.parse(src);
    } catch {
      return {};
    }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
  const o = src as Record<string, unknown>;
  const out: Record<string, number | boolean | null> = {};
  for (const key of NUMBER_LIMITS) {
    if (!(key in o)) continue;
    const v = o[key];
    if (v === null || (Number.isInteger(v) && (v as number) >= 0)) out[key] = v as number | null;
  }
  for (const key of FEATURE_LIMITS) {
    if (typeof o[key] === 'boolean') out[key] = o[key] as boolean;
  }
  return out as LimitOverrides;
};

/** The limits a company really has: its plan's, with its own limits on top. */
export const effectiveLimits = (company: any, plan: Plan): Limits => ({
  ...plan.limits,
  ...cleanOverrides(company?.limit_overrides),
});

/** Active agents (staff) of a subscriber - what it pays for. */
export const agentCount = async (orgId: string): Promise<number> => {
  const row = await db('users as u')
    .join('user_company_associations as a', 'a.user_id', 'u.id')
    .where('a.company_id', orgId)
    .whereIn('u.role', STAFF_ROLES)
    .where('u.is_active', true)
    .countDistinct('u.id as n')
    .first();
  return Number(row?.n) || 0;
};

const ticketsThisMonth = async (orgId: string): Promise<number> => {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const row = await db('tickets')
    .where('org_id', orgId)
    .where('created_at', '>=', start)
    .count('* as n')
    .first();
  return Number(row?.n) || 0;
};

export type Check =
  | 'agent'
  | 'ticket'
  | 'department'
  | 'macro'
  | 'ticketField'
  | 'recordField'
  | 'customModule'
  | 'assignmentRule'
  | 'roundRobin';

const upgrade = (message: string) =>
  new AppError(
    `${message} Upgrade your plan in Settings > Billing to add more.`,
    402,
    'PLAN_LIMIT'
  );

/** Limits are on unless PLAN_LIMITS=off (the test suite turns them off). */
const enforcing = () => process.env['PLAN_LIMITS'] !== 'off';

export class PlanService {
  static async companyPlan(orgId: string) {
    const company = await db('companies').where('id', orgId).first();
    const current = effectivePlan(company);
    const overrides = cleanOverrides(company?.limit_overrides);
    return { company, ...current, limits: effectiveLimits(company, current.plan), overrides };
  }

  /** Does the company's plan include this feature (for things that run, like rules)? */
  static async allows(orgId: string, feature: 'assignmentRules' | 'roundRobin'): Promise<boolean> {
    if (!enforcing()) return true;
    const { limits } = await this.companyPlan(orgId);
    return limits[feature];
  }

  /** Refuse (402 PLAN_LIMIT) adding one more of something past the company's limit. */
  static async assertCan(orgId: string, check: Check): Promise<void> {
    if (!enforcing() || !orgId) return;
    const { plan, limits: l, overrides } = await this.companyPlan(orgId);
    // A limit set for this company alone isn't the plan's
    const includes = (key: keyof Limits) =>
      key in overrides ? 'Your account includes' : `The ${plan.name} plan includes`;
    const notIncluded = (key: keyof Limits, what: string, planText: string) =>
      upgrade(key in overrides ? `${what} aren't included in your account.` : planText);
    const count = async (table: string, where: Record<string, unknown>) =>
      Number((await db(table).where(where).count('* as n').first())?.n) || 0;

    switch (check) {
      case 'agent':
        if (l.agents !== null && (await agentCount(orgId)) >= l.agents)
          throw upgrade(`${includes('agents')} up to ${l.agents} agents.`);
        return;
      case 'ticket':
        if (l.ticketsPerMonth !== null && (await ticketsThisMonth(orgId)) >= l.ticketsPerMonth)
          throw upgrade(`${includes('ticketsPerMonth')} ${l.ticketsPerMonth} tickets a month.`);
        return;
      case 'department': {
        if (l.departments === null) return;
        const n = Number(
          (
            await db('departments')
              .where((q) => q.where('org_id', orgId).orWhere('company_id', orgId))
              .where((q) => q.where('is_active', true).orWhereNull('is_active'))
              .count('* as n')
              .first()
          )?.n
        );
        if (n >= l.departments)
          throw upgrade(
            `${includes('departments')} ${l.departments} department${l.departments === 1 ? '' : 's'}.`
          );
        return;
      }
      case 'macro':
        if (l.macros !== null && (await count('macros', { org_id: orgId })) >= l.macros)
          throw upgrade(`${includes('macros')} ${l.macros} macros.`);
        return;
      case 'ticketField':
        if (
          l.ticketFields !== null &&
          (await count('module_fields', { org_id: orgId, module: 'tickets' })) >= l.ticketFields
        )
          throw upgrade(`${includes('ticketFields')} ${l.ticketFields} custom ticket fields.`);
        return;
      case 'recordField':
        if (!l.recordFields)
          throw notIncluded(
            'recordFields',
            'Custom fields on accounts and contacts',
            'Custom fields on accounts and contacts are part of Professional.'
          );
        return;
      case 'customModule':
        if (!l.customModules)
          throw notIncluded(
            'customModules',
            'Custom modules',
            'Custom modules are part of Professional.'
          );
        return;
      case 'assignmentRule':
        if (!l.assignmentRules)
          throw notIncluded(
            'assignmentRules',
            'Assignment rules',
            'Assignment rules start with Standard.'
          );
        return;
      case 'roundRobin':
        if (!l.roundRobin)
          throw notIncluded(
            'roundRobin',
            'Round-robin rules',
            'Round-robin assignment is part of Professional.'
          );
        return;
    }
  }

  /** What Settings > Billing shows: the plan, why, the trial, and usage against limits. */
  static async summary(orgId: string) {
    const { company, plan, source, limits, overrides } = await this.companyPlan(orgId);
    const [agents, tickets, departments, macros, ticketFields] = await Promise.all([
      agentCount(orgId),
      ticketsThisMonth(orgId),
      db('departments')
        .where((q) => q.where('org_id', orgId).orWhere('company_id', orgId))
        .where((q) => q.where('is_active', true).orWhereNull('is_active'))
        .count('* as n')
        .first(),
      db('macros').where('org_id', orgId).count('* as n').first(),
      db('module_fields').where({ org_id: orgId, module: 'tickets' }).count('* as n').first(),
    ]);
    const trialEnds = company?.trial_ends_at ? new Date(company.trial_ends_at) : null;
    return {
      plan: plan.key,
      source,
      paidPlan: company?.plan || 'free',
      interval: company?.billing_interval || null,
      status: company?.subscription_status || null,
      seats: company?.seats ?? null,
      currentPeriodEnd: company?.current_period_end || null,
      trialEndsAt: trialEnds,
      trialDaysLeft:
        source === 'trial' && trialEnds
          ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000))
          : null,
      graceEndsAt:
        source === 'grace' && company?.past_due_since
          ? new Date(new Date(company.past_due_since).getTime() + GRACE_DAYS * 86400000)
          : null,
      hasStripeCustomer: !!company?.stripe_customer_id,
      // What the company really gets: the plan's limits, or ones set for it
      limits,
      customLimits: Object.keys(overrides),
      usage: {
        agents,
        ticketsThisMonth: tickets,
        departments: Number(departments?.n) || 0,
        macros: Number(macros?.n) || 0,
        ticketFields: Number(ticketFields?.n) || 0,
      },
    };
  }
}
