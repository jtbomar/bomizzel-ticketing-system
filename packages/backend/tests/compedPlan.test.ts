import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { resetDatabase } from './helpers/db';
import { CustomerSubscription } from '../src/models/CustomerSubscription';

/**
 * BSI "Give free plan": a platform admin gives a subscriber a plan at no
 * charge, changes it, or takes it away, and the subscriber list shows the
 * plan the company is really on.
 */
describe('give a subscriber a free plan', () => {
  const SUB = '00000000-0000-4000-8000-0000000cc001';
  const ACME = '00000000-0000-4000-8000-0000000cc002';
  const OWNER = '00000000-0000-4000-8000-0000000cc003';
  const PLATFORM = '00000000-0000-4000-8000-0000000cc004';
  const OWN = '00000000-0000-4000-8000-0000000cc005';
  let platformToken: string;
  let ownerToken: string;

  const put = (companyId: string, body: any, token = platformToken) =>
    request(app)
      .put(`/api/admin/provisioning/companies/${companyId}/comped-plan`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const listed = async () => {
    const res = await request(app)
      .get('/api/admin/provisioning/customers')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(res.status).toBe(200);
    return res.body.data.customers.find((c: any) => c.company.id === SUB);
  };

  beforeAll(async () => {
    await resetDatabase();
    const trialEnds = new Date(Date.now() + 10 * 86400000);
    await db('companies').insert([
      {
        id: SUB,
        name: 'Gleason CP',
        domain: 'gleason-cp.example.com',
        is_trial: true,
        trial_ends_at: trialEnds,
      },
      { id: ACME, name: 'Acme CP', domain: 'acme-cp.example.com', subscriber_id: SUB },
      {
        id: OWN,
        name: 'Bomizzel CP',
        domain: 'bomizzel-cp.example.com',
        comped_plan: 'professional',
      },
    ]);
    const user = (id: string, email: string) => ({
      id,
      email,
      password_hash: 'x',
      first_name: 'Test',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      email_verified: true,
    });
    await db('users').insert([
      { ...user(OWNER, 'owner@gleason-cp.example.com'), current_org_id: SUB },
      user(PLATFORM, 'jeff@bomizzel.com'),
    ]);
    await db('user_company_associations').insert([
      { user_id: OWNER, company_id: SUB, role: 'owner' },
      { user_id: PLATFORM, company_id: OWN, role: 'owner' },
    ]);
    platformToken = JWTUtils.generateAccessToken({
      userId: PLATFORM,
      email: 'jeff@bomizzel.com',
      role: 'admin',
    });
    ownerToken = JWTUtils.generateAccessToken({
      userId: OWNER,
      email: 'owner@gleason-cp.example.com',
      role: 'admin',
    });
  });

  it('lists a sign-up on its trial before anything is given', async () => {
    const row = await listed();
    expect(row.plan).toEqual({ key: 'professional', name: 'Professional', source: 'trial' });
    expect(row.compedPlan).toBeNull();
    expect(row.status).toBe('trial');
    expect(row.currentPeriod.end).not.toBeNull();
  });

  it('gives Professional free, and the list shows it', async () => {
    const res = await put(SUB, { plan: 'professional' });
    expect(res.status).toBe(200);
    expect(res.body.data.plan.source).toBe('comped');
    expect((await db('companies').where('id', SUB).first()).comped_plan).toBe('professional');

    const row = await listed();
    expect(row.plan).toEqual({ key: 'professional', name: 'Professional', source: 'comped' });
    expect(row.compedPlan).toBe('professional');
    // Not "trial" any more, and no trial end date
    expect(row.status).toBe('active');
    expect(row.currentPeriod.end).toBeNull();
  });

  it('changes it to Standard', async () => {
    const res = await put(SUB, { plan: 'standard' });
    expect(res.status).toBe(200);
    expect((await listed()).plan).toEqual({ key: 'standard', name: 'Standard', source: 'comped' });
  });

  it('takes it away, back to the trial', async () => {
    const res = await put(SUB, { plan: null });
    expect(res.status).toBe(200);
    const row = await listed();
    expect(row.compedPlan).toBeNull();
    expect(row.plan.source).toBe('trial');
    expect(row.status).toBe('trial');
  });

  it('takes it away and ends the trial: straight to Free', async () => {
    const before = await db('companies').where('id', SUB).first('trial_ends_at');
    expect((await put(SUB, { plan: 'professional' })).status).toBe(200);
    expect((await listed()).trialEndsAt).not.toBeNull();

    const res = await put(SUB, { plan: null, endTrial: true });
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toEqual({ key: 'free', name: 'Free', source: 'free' });
    const row = await listed();
    expect(row.plan.source).toBe('free');
    expect(row.trialEndsAt).toBeNull();
    expect((await db('companies').where('id', SUB).first()).is_trial).toBe(false);

    // endTrial does nothing when giving a plan
    await db('companies').where('id', SUB).update(before);
    expect((await put(SUB, { plan: 'standard', endTrial: true })).status).toBe(200);
    expect((await listed()).trialEndsAt).not.toBeNull();
    await put(SUB, { plan: null });
    expect((await listed()).plan.source).toBe('trial');
  });

  it('refuses the Free tier and made-up plans', async () => {
    expect((await put(SUB, { plan: 'free' })).status).toBe(400);
    expect((await put(SUB, { plan: 'enterprise' })).status).toBe(400);
    expect((await put(SUB, {})).status).toBe(400);
  });

  it("refuses a subscriber's account and unknown companies", async () => {
    expect((await put(ACME, { plan: 'professional' })).status).toBe(404);
    expect(
      (await put('00000000-0000-4000-8000-0000000cc999', { plan: 'professional' })).status
    ).toBe(404);
    expect((await db('companies').where('id', ACME).first()).comped_plan).toBeNull();
  });

  it('marks your own company and leaves it alone', async () => {
    const res = await request(app)
      .get('/api/admin/provisioning/customers')
      .set('Authorization', `Bearer ${platformToken}`);
    const own = res.body.data.customers.find((c: any) => c.company.id === OWN);
    expect(own.isOwnAccount).toBe(true);
    expect((await listed()).isOwnAccount).toBe(false);

    expect((await put(OWN, { plan: null })).status).toBe(400);
    expect((await put(OWN, { plan: 'standard' })).status).toBe(400);
    expect((await db('companies').where('id', OWN).first()).comped_plan).toBe('professional');

    // Disable and delete look the company up from its subscription row
    const find = jest
      .spyOn(CustomerSubscription, 'findById')
      .mockResolvedValue({ id: 'sub-own', company_id: OWN } as any);
    try {
      const disable = await request(app)
        .post('/api/admin/provisioning/subscriptions/sub-own/disable')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ reason: 'test' });
      expect(disable.status).toBe(400);
      const del = await request(app)
        .delete('/api/admin/provisioning/subscriptions/sub-own')
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ reason: 'test' });
      expect(del.status).toBe(400);
    } finally {
      find.mockRestore();
    }
    expect(await db('companies').where('id', OWN).first()).toMatchObject({ is_active: true });
  });

  describe('limits for one company', () => {
    const putLimits = (companyId: string, body: any, token = platformToken) =>
      request(app)
        .put(`/api/admin/provisioning/companies/${companyId}/limits`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    it('lists the plan limits until some are set', async () => {
      await db('companies').where('id', SUB).update({ comped_plan: 'standard' });
      const row = await listed();
      expect(row.limitOverrides).toEqual({});
      expect(row.limits).toMatchObject({ ticketsPerMonth: 100, departments: 2, macros: 10 });
      expect(row.planLimits).toEqual(row.limits);
    });

    it('sets them, and the list shows them on top of the plan', async () => {
      const res = await putLimits(SUB, {
        overrides: { agents: 10, ticketsPerMonth: null, customModules: true },
      });
      expect(res.status).toBe(200);
      expect(res.body.data.limits).toMatchObject({
        agents: 10,
        ticketsPerMonth: null,
        departments: 2,
        customModules: true,
      });
      const row = await listed();
      expect(row.limitOverrides).toEqual({
        agents: 10,
        ticketsPerMonth: null,
        customModules: true,
      });
      expect(row.limits).toMatchObject({ agents: 10, ticketsPerMonth: null, macros: 10 });
      expect(row.planLimits.ticketsPerMonth).toBe(100);
    });

    it('clears them with {}', async () => {
      expect((await putLimits(SUB, { overrides: {} })).status).toBe(200);
      expect((await db('companies').where('id', SUB).first()).limit_overrides).toBeNull();
      expect((await listed()).limitOverrides).toEqual({});
    });

    it('refuses bad values, accounts, your own company and non-platform admins', async () => {
      expect((await putLimits(SUB, { overrides: { agents: -1 } })).status).toBe(400);
      expect((await putLimits(SUB, { overrides: { agents: 2.5 } })).status).toBe(400);
      expect((await putLimits(SUB, { overrides: { roundRobin: 'yes' } })).status).toBe(400);
      expect((await putLimits(SUB, {})).status).toBe(400);
      expect((await putLimits(ACME, { overrides: { agents: 5 } })).status).toBe(404);
      expect((await putLimits(OWN, { overrides: { agents: 5 } })).status).toBe(400);
      expect((await putLimits(SUB, { overrides: { agents: 99 } }, ownerToken)).status).toBe(403);
      expect((await db('companies').where('id', SUB).first()).limit_overrides).toBeNull();

      // Unknown limits are dropped, like any unknown field
      expect((await putLimits(SUB, { overrides: { agents: 5, storage: 5 } })).status).toBe(200);
      expect((await db('companies').where('id', SUB).first()).limit_overrides).toEqual({
        agents: 5,
      });
      await db('companies').where('id', SUB).update({ comped_plan: null, limit_overrides: null });
    });
  });

  it('searches, filters by status and pages the list, with counts over everything', async () => {
    const get = (query: string) =>
      request(app)
        .get(`/api/admin/provisioning/customers?${query}`)
        .set('Authorization', `Bearer ${platformToken}`);
    const names = (res: any) => res.body.data.customers.map((c: any) => c.company.name).sort();

    const all = await get('');
    expect(all.status).toBe(200);
    expect(all.body.data.counts.total).toBe(2);
    expect(all.body.data.pagination.total).toBe(2);

    // By company name, domain or admin email; case doesn't matter
    expect(names(await get('search=GLEASON'))).toEqual(['Gleason CP']);
    expect(names(await get('search=bomizzel-cp.example'))).toEqual(['Bomizzel CP']);
    expect(names(await get('search=owner@gleason'))).toEqual(['Gleason CP']);
    const none = await get('search=nothing-like-this');
    expect(none.body.data.customers).toEqual([]);
    expect(none.body.data.counts.total).toBe(2);

    // Gleason is on its trial, your own company is active
    expect(names(await get('status=trial'))).toEqual(['Gleason CP']);
    expect(names(await get('status=active'))).toEqual(['Bomizzel CP']);

    const first = await get('limit=1&offset=0');
    const second = await get('limit=1&offset=1');
    expect(first.body.data.customers).toHaveLength(1);
    expect(first.body.data.pagination).toEqual({ limit: 1, offset: 0, total: 2 });
    expect(names(first)).not.toEqual(names(second));
  });

  it("won't let a customer's own admin give themselves a free plan", async () => {
    const res = await put(SUB, { plan: 'professional' }, ownerToken);
    expect(res.status).toBe(403);
    expect((await db('companies').where('id', SUB).first()).comped_plan).toBeNull();
  });
});
