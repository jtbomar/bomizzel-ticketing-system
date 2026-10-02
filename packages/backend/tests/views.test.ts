import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { resetDatabase } from './helpers/db';

/**
 * Saved ticket views: shared ones (admins) and personal ones (any agent), and
 * their conditions checked when saved.
 */
describe('ticket views', () => {
  const SUB = '00000000-0000-4000-8000-0000000e9001';
  const ACME = '00000000-0000-4000-8000-0000000e9002';
  const ADMIN = '00000000-0000-4000-8000-0000000e9003';
  const AGENT = '00000000-0000-4000-8000-0000000e9004';
  const AGENT2 = '00000000-0000-4000-8000-0000000e9005';
  const CONTACT = '00000000-0000-4000-8000-0000000e9006';
  const TEAM = '00000000-0000-4000-8000-0000000e9007';
  const QUEUE = '00000000-0000-4000-8000-0000000e9008';
  const OTHER = '00000000-0000-4000-8000-0000000e9009';
  const OTHER_ADMIN = '00000000-0000-4000-8000-0000000e900a';
  const tokens: Record<string, string> = {};
  let sales: number;

  const as = (who: string) => ({
    get: (path: string) =>
      request(app).get(`/api/views${path}`).set('Authorization', `Bearer ${tokens[who]}`),
    post: (path: string, body: unknown) =>
      request(app)
        .post(`/api/views${path}`)
        .set('Authorization', `Bearer ${tokens[who]}`)
        .send(body as object),
    put: (path: string, body: unknown) =>
      request(app)
        .put(`/api/views${path}`)
        .set('Authorization', `Bearer ${tokens[who]}`)
        .send(body as object),
    delete: (path: string) =>
      request(app).delete(`/api/views${path}`).set('Authorization', `Bearer ${tokens[who]}`),
  });

  const newTicket = async (extra: Record<string, unknown> = {}) => {
    const [row] = await db('tickets')
      .insert({
        title: 'Printer jammed',
        description: 'd',
        submitter_id: CONTACT,
        company_id: ACME,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        status: 'open',
        priority: 0,
        ...extra,
      })
      .returning('*');
    return row;
  };

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Bomizzel', domain: 'sub-v.example.com' },
      { id: ACME, name: 'Acme', domain: 'acme-v.example.com', subscriber_id: SUB },
      { id: OTHER, name: 'Other', domain: 'other-v.example.com' },
    ]);
    const user = (id: string, email: string, role: string, first: string, org = SUB) => ({
      id,
      email,
      password_hash: 'x',
      first_name: first,
      last_name: 'Smith',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: org,
    });
    await db('users').insert([
      user(ADMIN, 'admin@sub-v.example.com', 'admin', 'Ada'),
      user(AGENT, 'agent@sub-v.example.com', 'employee', 'Bea'),
      user(AGENT2, 'agent2@sub-v.example.com', 'employee', 'Cal'),
      user(CONTACT, 'pat@acme-v.example.com', 'customer', 'Pat'),
      user(OTHER_ADMIN, 'x@other-v.example.com', 'admin', 'Xan', OTHER),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: AGENT2, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
      { user_id: OTHER_ADMIN, company_id: OTHER, role: 'owner' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await db('team_memberships').insert([
      { user_id: ADMIN, team_id: TEAM, role: 'admin' },
      { user_id: AGENT, team_id: TEAM, role: 'member' },
      { user_id: AGENT2, team_id: TEAM, role: 'member' },
    ]);
    await TicketStatus.seedDefaultStatuses(TEAM);
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });
    [{ id: sales }] = await db('departments')
      .insert([{ company_id: SUB, name: 'Sales' }])
      .returning('id');
    for (const [who, id, email, role] of [
      ['admin', ADMIN, 'admin@sub-v.example.com', 'admin'],
      ['agent', AGENT, 'agent@sub-v.example.com', 'employee'],
      ['agent2', AGENT2, 'agent2@sub-v.example.com', 'employee'],
      ['contact', CONTACT, 'pat@acme-v.example.com', 'customer'],
      ['other', OTHER_ADMIN, 'x@other-v.example.com', 'admin'],
    ] as const) {
      tokens[who] = JWTUtils.generateAccessToken({ userId: id, email, role });
    }
  });

  beforeEach(async () => {
    await db('ticket_views').del();
  });

  it('shared views are for admins; agents make their own, only they see', async () => {
    const shared = await as('admin').post('', {
      name: 'Urgent',
      shared: true,
      conditions: [{ field: 'priority', values: ['3'] }],
    });
    expect(shared.status).toBe(201);
    expect(
      (await as('agent').post('', { name: 'Team', shared: true, conditions: [] })).status
    ).toBe(403);
    const mine = await as('agent').post('', {
      name: 'Mine, open',
      conditions: [
        { field: 'assignee', values: ['me'] },
        { field: 'status', values: ['open', 'in_progress'] },
      ],
    });
    expect(mine.status).toBe(201);
    expect(mine.body.view).toMatchObject({ shared: false, conditions: expect.any(Array) });

    const names = async (who: string) =>
      (await as(who).get('')).body.views.map((v: any) => v.name).sort();
    expect(await names('agent')).toEqual(['Mine, open', 'Urgent']);
    expect(await names('agent2')).toEqual(['Urgent']);
    expect(await names('other')).toEqual([]);

    expect(
      (await as('agent').put(`/${shared.body.view.id}`, { name: 'X', conditions: [] })).status
    ).toBe(403);
    expect((await as('agent2').delete(`/${mine.body.view.id}`)).status).toBe(404);
    expect((await as('agent').delete(`/${mine.body.view.id}`)).status).toBe(200);
  });

  it('checks conditions when saving', async () => {
    const bad = [
      { name: '', conditions: [] },
      { name: 'x', conditions: [{ field: 'nope', values: ['a'] }] },
      { name: 'x', conditions: [{ field: 'status', values: ['deleted'] }] },
      { name: 'x', conditions: [{ field: 'priority', values: ['9'] }] },
      { name: 'x', conditions: [{ field: 'created', values: ['forever'] }] },
      { name: 'x', conditions: [{ field: 'assignee', values: ['bob'] }] },
      { name: 'x', conditions: [{ field: 'status', values: [] }] },
      { name: 'x', conditions: [{ field: 'cf:missing', values: ['a'] }] },
      {
        name: 'x',
        conditions: [
          { field: 'status', values: ['open'] },
          { field: 'status', values: ['waiting'] },
        ],
      },
    ];
    for (const body of bad) expect((await as('agent').post('', body)).status).toBe(400);
    const ok = await as('agent').post('', {
      name: 'Recent email',
      conditions: [
        { field: 'channel', values: ['email'] },
        { field: 'created', values: ['7d'] },
        { field: 'keywords', values: ['refund'] },
      ],
    });
    expect(ok.status).toBe(201);
  });

  it('is for staff only', async () => {
    expect((await as('contact').get('')).status).toBe(403);
  });
});
