import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { resetDatabase } from './helpers/db';

/**
 * Every ticket belongs to a department of its subscriber, and the ticket list
 * can be narrowed to one. Tickets used to be created with no department, so
 * every department view showed every ticket.
 */
describe('ticket departments', () => {
  const SUB = '00000000-0000-4000-8000-00000000a001';
  const OTHER_SUB = '00000000-0000-4000-8000-00000000a002';
  const ACCOUNT = '00000000-0000-4000-8000-00000000a003';
  const ADMIN = '00000000-0000-4000-8000-00000000a004';
  const AGENT = '00000000-0000-4000-8000-00000000a005';
  const CONTACT = '00000000-0000-4000-8000-00000000a006';
  const TEAM = '00000000-0000-4000-8000-00000000a007';
  const QUEUE = '00000000-0000-4000-8000-00000000a008';

  let general: number;
  let billing: number;
  let otherSubsDept: number;
  let adminToken: string;

  const create = (body: Record<string, unknown>) =>
    request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'd', companyId: ACCOUNT, teamId: TEAM, submitterId: CONTACT, ...body });

  const list = (query: string) =>
    request(app)
      .get(`/api/tickets?limit=100&${query}`)
      .set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub.test' },
      { id: OTHER_SUB, name: 'Other Sub', domain: 'other.test' },
      { id: ACCOUNT, name: 'Account', domain: 'acct.test', subscriber_id: SUB },
    ]);
    const user = (id: string, email: string, role: string) => ({
      id,
      email,
      password_hash: 'x',
      first_name: role,
      last_name: 'Test',
      role,
      is_active: true,
      current_org_id: SUB,
    });
    await db('users').insert([
      user(ADMIN, 'admin@sub.test', 'admin'),
      user(AGENT, 'agent@sub.test', 'employee'),
      user(CONTACT, 'contact@acct.test', 'customer'),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACCOUNT, role: 'member' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await db('team_memberships').insert([
      { user_id: ADMIN, team_id: TEAM, role: 'admin' },
      { user_id: AGENT, team_id: TEAM, role: 'member' },
    ]);
    await db('queues').insert({
      id: QUEUE,
      name: 'General',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });

    [{ id: general }, { id: billing }, { id: otherSubsDept }] = await db('departments')
      .insert([
        { name: 'General', company_id: SUB, org_id: SUB, is_default: true },
        { name: 'Billing', company_id: SUB, org_id: SUB, is_default: false },
        { name: 'Theirs', company_id: OTHER_SUB, org_id: OTHER_SUB, is_default: true },
      ])
      .returning('id');

    adminToken = JWTUtils.generateAccessToken({
      userId: ADMIN,
      email: 'admin@sub.test',
      role: 'admin',
    });
  });

  it("puts a ticket with no department in the subscriber's default department", async () => {
    const res = await create({ title: 'no department given' });
    expect(res.status).toBe(201);
    expect(res.body.data.departmentId).toBe(general);
  });

  it('uses the department asked for', async () => {
    const res = await create({ title: 'billing question', departmentId: billing });
    expect(res.status).toBe(201);
    expect(res.body.data.departmentId).toBe(billing);
  });

  it("refuses another subscriber's department", async () => {
    const res = await create({ title: 'wrong department', departmentId: otherSubsDept });
    expect(res.status).toBe(400);
  });

  it('lists only the chosen department', async () => {
    const onlyBilling = await list(`departmentId=${billing}`);
    expect(onlyBilling.status).toBe(200);
    expect(onlyBilling.body.data.map((t: any) => t.title)).toEqual(['billing question']);

    const onlyGeneral = await list(`departmentId=${general}`);
    expect(onlyGeneral.body.data.map((t: any) => t.title)).toEqual(['no department given']);

    const everything = await list('');
    expect(everything.body.data).toHaveLength(2);
  });

  it('"My tickets" works for an admin', async () => {
    const [ticket] = await db('tickets').where('title', 'billing question');
    await db('tickets').where('id', ticket.id).update({ assigned_to_id: ADMIN });

    const mine = await list(`assignedToId=${ADMIN}`);
    expect(mine.body.data.map((t: any) => t.title)).toEqual(['billing question']);
  });
});
