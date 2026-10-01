import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { effectivePlan } from '../src/services/PlanService';
import { AssignmentRuleService } from '../src/services/AssignmentRuleService';
import { setStripeClient } from '../src/services/OrgBillingService';
import { resetDatabase } from './helpers/db';

/**
 * Plans and billing: which plan a company is on (given free, paid, grace,
 * trial, Free), the limits of each, and Stripe keeping it in step - Checkout,
 * the webhook, and the seat count following the number of agents.
 */
describe('plans and billing', () => {
  const SUB = '00000000-0000-4000-8000-0000000bb001';
  const ACME = '00000000-0000-4000-8000-0000000bb002';
  const ADMIN = '00000000-0000-4000-8000-0000000bb003';
  const CONTACT = '00000000-0000-4000-8000-0000000bb004';
  const TEAM = '00000000-0000-4000-8000-0000000bb005';
  const QUEUE = '00000000-0000-4000-8000-0000000bb006';
  let token: string;
  let agentSeq = 0;

  // A fake Stripe: records what was asked, returns plausible objects
  const calls: Record<string, any[]> = {};
  const record = (name: string, value: any) => ((calls[name] ||= []).push(value), value);
  const fakeSub = (overrides: any = {}) => ({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    metadata: { org_id: SUB },
    items: {
      data: [
        {
          id: 'si_1',
          quantity: 2,
          current_period_end: 1893456000,
          price: { id: 'price_std_m', lookup_key: 'bomizzel_standard_month' },
        },
      ],
    },
    ...overrides,
  });
  const stripe = {
    prices: {
      list: async (args: any) => ({ data: [{ id: `price_for_${args.lookup_keys[0]}` }] }),
    },
    products: { retrieve: async () => ({}), create: async () => ({}) },
    customers: {
      create: async (args: any) => record('customers.create', { id: 'cus_1', ...args }),
    },
    checkout: {
      sessions: {
        create: async (args: any) =>
          record('checkout.create', { url: 'https://checkout.stripe.test/s', ...args }),
      },
    },
    billingPortal: {
      sessions: {
        create: async (args: any) =>
          record('portal.create', { url: 'https://billing.stripe.test/p', ...args }),
      },
    },
    subscriptions: {
      retrieve: async () => fakeSub(),
      update: async (id: string, args: any) =>
        record(
          'subscriptions.update',
          fakeSub({
            items: { data: [{ ...fakeSub().items.data[0], quantity: args.items[0].quantity }] },
          })
        ),
    },
    webhooks: {
      constructEvent: (raw: Buffer, signature: string) => {
        if (signature !== 'good') throw new Error('bad signature');
        return JSON.parse(raw.toString());
      },
    },
  };

  const setCompany = (values: Record<string, unknown>) =>
    db('companies')
      .where('id', SUB)
      .update({
        plan: 'free',
        comped_plan: null,
        subscription_status: null,
        trial_ends_at: null,
        past_due_since: null,
        stripe_subscription_id: null,
        ...values,
      });
  const api = () => ({
    get: (path: string) => request(app).get(`/api${path}`).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object) =>
      request(app).post(`/api${path}`).set('Authorization', `Bearer ${token}`).send(body),
  });
  const addAgent = () =>
    api().post('/admin/users', {
      firstName: 'Agent',
      lastName: String(++agentSeq),
      email: `agent${agentSeq}@sub-pl.example.com`,
      password: 'Str0ng!Passw0rd',
      role: 'employee',
    });

  beforeAll(async () => {
    process.env['PLAN_LIMITS'] = 'on';
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_fake';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_fake';
    setStripeClient(stripe);
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub PL', domain: 'sub-pl.example.com' },
      { id: ACME, name: 'Acme PL', domain: 'acme-pl.example.com', subscriber_id: SUB },
    ]);
    await db('users').insert([
      {
        id: ADMIN,
        email: 'admin@sub-pl.example.com',
        password_hash: 'x',
        first_name: 'Ada',
        last_name: 'Admin',
        role: 'admin',
        is_active: true,
        email_verified: true,
        current_org_id: SUB,
      },
      {
        id: CONTACT,
        email: 'pat@acme-pl.example.com',
        password_hash: 'x',
        first_name: 'Pat',
        last_name: 'Lee',
        role: 'customer',
        is_active: true,
        email_verified: true,
        current_org_id: SUB,
      },
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await db('team_memberships').insert({ user_id: ADMIN, team_id: TEAM, role: 'admin' });
    await TicketStatus.seedDefaultStatuses(TEAM);
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });
    await db('departments').insert({ company_id: SUB, name: 'General', is_default: true });
    token = JWTUtils.generateAccessToken({
      userId: ADMIN,
      email: 'admin@sub-pl.example.com',
      role: 'admin',
    });
  });

  afterAll(() => {
    process.env['PLAN_LIMITS'] = 'off';
    delete process.env['STRIPE_SECRET_KEY'];
    delete process.env['STRIPE_WEBHOOK_SECRET'];
  });

  it('works out the plan: given free, paid, grace, trial, else Free', () => {
    const now = new Date('2026-10-02T00:00:00Z');
    const days = (n: number) => new Date(now.getTime() + n * 86400000);
    const plan = (c: any) => {
      const r = effectivePlan(c, now);
      return `${r.plan.key}/${r.source}`;
    };
    expect(plan({ comped_plan: 'professional', plan: 'free' })).toBe('professional/comped');
    expect(plan({ plan: 'standard', subscription_status: 'active' })).toBe('standard/paid');
    expect(
      plan({ plan: 'standard', subscription_status: 'past_due', past_due_since: days(-3) })
    ).toBe('standard/grace');
    expect(
      plan({ plan: 'standard', subscription_status: 'past_due', past_due_since: days(-8) })
    ).toBe('free/free');
    expect(plan({ plan: 'standard', subscription_status: 'canceled' })).toBe('free/free');
    expect(plan({ plan: 'free', trial_ends_at: days(5) })).toBe('professional/trial');
    expect(plan({ plan: 'free', trial_ends_at: days(-1) })).toBe('free/free');
  });

  it('Free: 2 agents, 1 department, 5 macros and ticket fields, no rules or Professional extras', async () => {
    await setCompany({});
    expect((await addAgent()).status).toBe(201); // admin + 1 = 2
    const third = await addAgent();
    expect(third.status).toBe(402);
    expect(third.body.error.code).toBe('PLAN_LIMIT');

    expect((await api().post('/departments', { name: 'Second' })).status).toBe(402);
    for (let i = 0; i < 5; i++) {
      expect((await api().post('/macros', { name: `M${i}`, replyHtml: '<p>x</p>' })).status).toBe(
        201
      );
    }
    expect((await api().post('/macros', { name: 'M6', replyHtml: '<p>x</p>' })).status).toBe(402);
    for (let i = 0; i < 5; i++) {
      expect((await api().post('/fields/tickets', { label: `F${i}`, type: 'text' })).status).toBe(
        201
      );
    }
    expect((await api().post('/fields/tickets', { label: 'F6', type: 'text' })).status).toBe(402);
    expect((await api().post('/fields/accounts', { label: 'Tier', type: 'text' })).status).toBe(
      402
    );
    expect((await api().post('/modules', { name: 'Assets' })).status).toBe(402);
    expect(
      (await api().post('/assignment-rules', { name: 'R', method: 'specific', agentIds: [ADMIN] }))
        .status
    ).toBe(402);
  });

  it('Free: 100 tickets a month from the web', async () => {
    await setCompany({});
    await db('tickets').insert(
      Array.from({ length: 100 }, (_, i) => ({
        title: `T${i}`,
        description: 'd',
        submitter_id: CONTACT,
        company_id: ACME,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        status: 'open',
        priority: 0,
      }))
    );
    const res = await api().post('/tickets', {
      title: 'One too many',
      description: 'd',
      companyId: ACME,
      teamId: TEAM,
      submitterId: CONTACT,
    });
    expect(res.status).toBe(402);
    expect(res.body.error.message).toContain('100 tickets a month');
  });

  it('rules stop running on Free, and round-robin needs Professional', async () => {
    await setCompany({ plan: 'standard', subscription_status: 'active' });
    const rule = await api().post('/assignment-rules', {
      name: 'All',
      method: 'specific',
      agentIds: [ADMIN],
    });
    expect(rule.status).toBe(201);
    expect(
      (
        await api().post('/assignment-rules', {
          name: 'RR',
          method: 'round_robin',
          agentIds: [ADMIN],
        })
      ).status
    ).toBe(402);

    const [t] = await db('tickets')
      .insert({
        title: 'x',
        description: 'd',
        submitter_id: CONTACT,
        company_id: ACME,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        status: 'open',
        priority: 0,
      })
      .returning('*');
    await setCompany({}); // dropped to Free
    expect(await AssignmentRuleService.apply(t.id)).toBeNull();
    await setCompany({ plan: 'standard', subscription_status: 'active' });
    expect((await AssignmentRuleService.apply(t.id))?.agentId).toBe(ADMIN);
  });

  it('a trial is Professional', async () => {
    await setCompany({ trial_ends_at: new Date(Date.now() + 5 * 86400000) });
    expect((await api().post('/modules', { name: 'Assets' })).status).toBe(201);
    const summary = (await api().get('/org-billing')).body;
    expect(summary).toMatchObject({
      plan: 'professional',
      source: 'trial',
      trialDaysLeft: 5,
      billingEnabled: true,
    });
    expect(summary.plans.map((p: any) => `${p.key}:${p.monthly}`)).toEqual([
      'free:0',
      'standard:12',
      'professional:25',
    ]);
    expect((await request(app).get('/api/plans')).body.plans).toHaveLength(3);
  });

  it('checks out per agent, and Stripe’s webhook puts the company on the plan', async () => {
    await setCompany({});
    const res = await api().post('/org-billing/checkout', { plan: 'standard', interval: 'year' });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.test/s');
    const session = calls['checkout.create']!.at(-1);
    expect(session).toMatchObject({
      mode: 'subscription',
      customer: 'cus_1',
      client_reference_id: SUB,
      line_items: [{ price: 'price_for_bomizzel_standard_year', quantity: 2 }],
    });
    expect(
      (await api().post('/org-billing/checkout', { plan: 'gold', interval: 'month' })).status
    ).toBe(400);

    // Unsigned or badly signed: refused
    const bad = await request(app)
      .post('/api/org-billing/webhook')
      .set('stripe-signature', 'bad')
      .send({ type: 'checkout.session.completed' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post('/api/org-billing/webhook')
      .set('stripe-signature', 'good')
      .send({
        type: 'checkout.session.completed',
        data: { object: { mode: 'subscription', subscription: 'sub_1' } },
      });
    expect(ok.status).toBe(200);
    expect(await db('companies').where('id', SUB).first()).toMatchObject({
      plan: 'standard',
      subscription_status: 'active',
      stripe_subscription_id: 'sub_1',
      billing_interval: 'month',
      seats: 2,
    });
    expect((await api().get('/org-billing')).body).toMatchObject({
      plan: 'standard',
      source: 'paid',
    });

    // Cancelled: back to Free
    await request(app)
      .post('/api/org-billing/webhook')
      .set('stripe-signature', 'good')
      .send({
        type: 'customer.subscription.deleted',
        data: { object: fakeSub({ status: 'canceled' }) },
      });
    expect((await db('companies').where('id', SUB).first()).plan).toBe('free');
  });

  it('the paid seat count follows the number of agents', async () => {
    await setCompany({
      plan: 'standard',
      subscription_status: 'active',
      stripe_subscription_id: 'sub_1',
      seats: 2,
    });
    calls['subscriptions.update'] = [];
    expect((await addAgent()).status).toBe(201); // now 3 agents
    expect(calls['subscriptions.update']!.at(-1)).toBeDefined();
    expect((await db('companies').where('id', SUB).first()).seats).toBe(3);
  });

  it('opens Stripe’s billing page for an admin with a Stripe customer', async () => {
    await db('companies').where('id', SUB).update({ stripe_customer_id: 'cus_1' });
    const res = await api().post('/org-billing/portal', {});
    expect(res.body.url).toBe('https://billing.stripe.test/p');
  });
});
