import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { AssignmentRuleService } from '../src/services/AssignmentRuleService';
import { resetDatabase } from './helpers/db';

/**
 * Assignment rules: the first matching rule gives a new ticket to its agent,
 * or round-robin through several; tickets already assigned are left alone;
 * and admins only ever see or use their own subscriber's data.
 */
describe('assignment rules', () => {
  const SUB = '00000000-0000-4000-8000-0000000a0001';
  const ACME = '00000000-0000-4000-8000-0000000a0002';
  const GLOBEX = '00000000-0000-4000-8000-0000000a0003';
  const ADMIN = '00000000-0000-4000-8000-0000000a0004';
  const AGENT1 = '00000000-0000-4000-8000-0000000a0005';
  const AGENT2 = '00000000-0000-4000-8000-0000000a0006';
  const AGENT3 = '00000000-0000-4000-8000-0000000a0007';
  const CONTACT = '00000000-0000-4000-8000-0000000a0008';
  const TEAM = '00000000-0000-4000-8000-0000000a0009';
  const QUEUE = '00000000-0000-4000-8000-0000000a000a';
  const OTHER = '00000000-0000-4000-8000-0000000a000b';
  const OTHER_AGENT = '00000000-0000-4000-8000-0000000a000c';
  let adminToken: string;
  let agentToken: string;
  let sales: number;
  let support: number;

  const api = (method: 'get' | 'post' | 'put' | 'delete', path: string, token = adminToken) =>
    request(app)[method](`/api/assignment-rules${path}`).set('Authorization', `Bearer ${token}`);

  const newTicket = async (extra: Record<string, unknown> = {}) => {
    const [row] = await db('tickets')
      .insert({
        title: 'Something broke',
        description: 'Please help',
        submitter_id: CONTACT,
        company_id: ACME,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        department_id: support,
        status: 'open',
        priority: 0,
        ...extra,
      })
      .returning('*');
    return row;
  };
  const assigneeAfterRules = async (extra: Record<string, unknown> = {}) => {
    const t = await newTicket(extra);
    await AssignmentRuleService.apply(t.id);
    return (await db('tickets').where('id', t.id).first()).assigned_to_id;
  };
  const rule = async (body: Record<string, unknown>) => {
    const res = await api('post', '').send(body);
    expect(res.status).toBe(201);
    return res.body.rule;
  };

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub-a.example.com' },
      { id: ACME, name: 'Acme', domain: 'acme-a.example.com', subscriber_id: SUB },
      { id: GLOBEX, name: 'Globex', domain: 'globex-a.example.com', subscriber_id: SUB },
      { id: OTHER, name: 'Other', domain: 'other-a.example.com' },
    ]);
    const user = (id: string, email: string, role: string, org = SUB) => ({
      id,
      email,
      password_hash: 'x',
      first_name: email.split('@')[0],
      last_name: 'T',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: org,
    });
    await db('users').insert([
      user(ADMIN, 'admin@sub-a.example.com', 'admin'),
      user(AGENT1, 'one@sub-a.example.com', 'employee'),
      user(AGENT2, 'two@sub-a.example.com', 'employee'),
      user(AGENT3, 'three@sub-a.example.com', 'employee'),
      user(CONTACT, 'c@acme-a.example.com', 'customer'),
      user(OTHER_AGENT, 'x@other-a.example.com', 'employee', OTHER),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: AGENT1, company_id: SUB, role: 'member' },
      { user_id: AGENT2, company_id: SUB, role: 'member' },
      { user_id: AGENT3, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
      { user_id: OTHER_AGENT, company_id: OTHER, role: 'member' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await db('team_memberships').insert([
      { user_id: ADMIN, team_id: TEAM, role: 'admin' },
      { user_id: AGENT1, team_id: TEAM, role: 'member' },
    ]);
    await TicketStatus.seedDefaultStatuses(TEAM);
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });
    [{ id: sales }, { id: support }] = await db('departments')
      .insert([
        { company_id: SUB, name: 'Sales' },
        { company_id: SUB, name: 'Support', is_default: true },
      ])
      .returning('id');
    adminToken = JWTUtils.generateAccessToken({
      userId: ADMIN,
      email: 'admin@sub-a.example.com',
      role: 'admin',
    });
    agentToken = JWTUtils.generateAccessToken({
      userId: AGENT1,
      email: 'one@sub-a.example.com',
      role: 'employee',
    });
  });

  beforeEach(async () => {
    await db('assignment_rules').del();
    await db('users').whereIn('id', [AGENT1, AGENT2, AGENT3]).update({ is_active: true });
  });

  it('lists only this subscriber’s agents, accounts and departments', async () => {
    const res = await api('get', '');
    expect(res.status).toBe(200);
    const agentIds = res.body.options.agents.map((a: any) => a.id);
    expect(agentIds).toEqual(expect.arrayContaining([ADMIN, AGENT1, AGENT2, AGENT3]));
    expect(agentIds).not.toContain(OTHER_AGENT);
    expect(agentIds).not.toContain(CONTACT);
    expect(res.body.options.accounts.map((a: any) => a.id).sort()).toEqual([ACME, GLOBEX].sort());
    expect(res.body.options.departments.map((d: any) => d.name).sort()).toEqual([
      'Sales',
      'Support',
    ]);
  });

  it('is for admins only', async () => {
    expect((await api('get', '', agentToken)).status).toBe(403);
  });

  it('refuses agents, accounts or departments from elsewhere, and bad shapes', async () => {
    const bad = [
      { name: 'x', method: 'specific', agentIds: [OTHER_AGENT] },
      { name: 'x', method: 'specific', agentIds: [CONTACT] },
      { name: 'x', method: 'specific', agentIds: [AGENT1, AGENT2] },
      { name: 'x', method: 'round_robin', agentIds: [] },
      { name: '', method: 'specific', agentIds: [AGENT1] },
      { name: 'x', method: 'specific', agentIds: [AGENT1], conditions: { companyIds: [OTHER] } },
      { name: 'x', method: 'specific', agentIds: [AGENT1], conditions: { priorities: [9] } },
      { name: 'x', method: 'specific', agentIds: [AGENT1], conditions: { channels: ['fax'] } },
      {
        name: 'x',
        method: 'specific',
        agentIds: [AGENT1],
        conditions: { departmentIds: [999999] },
      },
    ];
    for (const body of bad) {
      expect((await api('post', '').send(body)).status).toBe(400);
    }
  });

  it('assigns by keyword, and the first matching rule wins', async () => {
    await rule({
      name: 'Billing',
      method: 'specific',
      agentIds: [AGENT2],
      conditions: { keywords: ['invoice', 'refund'] },
    });
    await rule({ name: 'Everything else', method: 'specific', agentIds: [AGENT1] });

    expect(await assigneeAfterRules({ title: 'Wrong INVOICE amount' })).toBe(AGENT2);
    expect(await assigneeAfterRules({ description: '<p>I want a <b>refund</b></p>' })).toBe(
      AGENT2
    );
    expect(await assigneeAfterRules({ title: 'Login problem' })).toBe(AGENT1);
  });

  it('matches department, account, priority and channel - all that are set', async () => {
    await rule({
      name: 'Acme urgent email in Sales',
      method: 'specific',
      agentIds: [AGENT3],
      conditions: {
        departmentIds: [sales],
        companyIds: [ACME],
        priorities: [2, 3],
        channels: ['email'],
      },
    });
    const match = { department_id: sales, company_id: ACME, priority: 3, source: 'email' };
    expect(await assigneeAfterRules(match)).toBe(AGENT3);
    expect(await assigneeAfterRules({ ...match, department_id: support })).toBeNull();
    expect(await assigneeAfterRules({ ...match, company_id: GLOBEX })).toBeNull();
    expect(await assigneeAfterRules({ ...match, priority: 1 })).toBeNull();
    expect(await assigneeAfterRules({ ...match, source: 'web' })).toBeNull();
  });

  it('round-robins in turn and skips inactive agents', async () => {
    await rule({ name: 'Team', method: 'round_robin', agentIds: [AGENT1, AGENT2, AGENT3] });
    const got = [];
    for (let i = 0; i < 4; i++) got.push(await assigneeAfterRules());
    expect(got).toEqual([AGENT1, AGENT2, AGENT3, AGENT1]);

    await db('users').where('id', AGENT2).update({ is_active: false });
    expect(await assigneeAfterRules()).toBe(AGENT3);
    expect(await assigneeAfterRules()).toBe(AGENT1);
  });

  it('falls through to the next rule when its agent is unavailable', async () => {
    await rule({ name: 'Away', method: 'specific', agentIds: [AGENT2] });
    await rule({ name: 'Backup', method: 'specific', agentIds: [AGENT3] });
    await db('users').where('id', AGENT2).update({ is_active: false });
    expect(await assigneeAfterRules()).toBe(AGENT3);
  });

  it('leaves assigned, finished, and paused-rule tickets alone', async () => {
    const r = await rule({ name: 'All', method: 'specific', agentIds: [AGENT2] });
    expect(await assigneeAfterRules({ assigned_to_id: AGENT1 })).toBe(AGENT1);
    expect(await assigneeAfterRules({ status: 'resolved' })).toBeNull();

    await api('put', `/${r.id}`).send({ ...r, isActive: false });
    expect(await assigneeAfterRules()).toBeNull();
  });

  it('runs on a new ticket from the web and records who and why', async () => {
    await rule({ name: 'Web', method: 'specific', agentIds: [AGENT1] });
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'From the portal',
        description: 'hi',
        companyId: ACME,
        teamId: TEAM,
        submitterId: CONTACT,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.assignedToId).toBe(AGENT1);
    const history = await db('ticket_history')
      .where({ ticket_id: res.body.data.id, action: 'assigned' })
      .first();
    expect(history.metadata).toMatchObject({ automatic: true, ruleName: 'Web' });
  });

  it('runs again when an unassigned ticket’s priority changes', async () => {
    await rule({
      name: 'Critical',
      method: 'specific',
      agentIds: [AGENT1],
      conditions: { priorities: [3] },
    });
    const t = await newTicket();
    await AssignmentRuleService.apply(t.id);
    expect((await db('tickets').where('id', t.id).first()).assigned_to_id).toBeNull();

    const res = await request(app)
      .put(`/api/tickets/${t.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priority: 3 });
    expect(res.status).toBe(200);
    expect((await db('tickets').where('id', t.id).first()).assigned_to_id).toBe(AGENT1);
  });

  it('reorders, updates and deletes only this subscriber’s rules', async () => {
    const a = await rule({ name: 'A', method: 'specific', agentIds: [AGENT1] });
    const b = await rule({ name: 'B', method: 'specific', agentIds: [AGENT2] });
    const order = await api('put', '/order').send({ ruleIds: [b.id, a.id] });
    expect(order.body.rules.map((r: any) => r.name)).toEqual(['B', 'A']);
    expect(await assigneeAfterRules()).toBe(AGENT2);

    const [theirs] = await db('assignment_rules')
      .insert({ org_id: OTHER, name: 'Theirs', method: 'specific', agent_ids: '[]' })
      .returning('*');
    expect((await api('put', `/${theirs.id}`).send({ ...a, name: 'Mine now' })).status).toBe(404);
    expect((await api('delete', `/${theirs.id}`)).status).toBe(404);
    expect((await api('delete', `/${a.id}`)).status).toBe(200);
    expect((await api('get', '')).body.rules.map((r: any) => r.name)).toEqual(['B']);
  });
});
