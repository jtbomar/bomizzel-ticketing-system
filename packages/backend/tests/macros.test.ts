import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { fillPlaceholders } from '../src/services/MacroService';
import { resetDatabase } from './helpers/db';

/**
 * Macros: shared ones (admins) and personal ones (any agent), applied to a
 * ticket - the changes are made, and the reply comes back filled in for the
 * agent to check, not sent.
 */
describe('macros', () => {
  const SUB = '00000000-0000-4000-8000-0000000b0001';
  const ACME = '00000000-0000-4000-8000-0000000b0002';
  const ADMIN = '00000000-0000-4000-8000-0000000b0003';
  const AGENT = '00000000-0000-4000-8000-0000000b0004';
  const AGENT2 = '00000000-0000-4000-8000-0000000b0005';
  const CONTACT = '00000000-0000-4000-8000-0000000b0006';
  const TEAM = '00000000-0000-4000-8000-0000000b0007';
  const QUEUE = '00000000-0000-4000-8000-0000000b0008';
  const OTHER = '00000000-0000-4000-8000-0000000b0009';
  const OTHER_ADMIN = '00000000-0000-4000-8000-0000000b000a';
  const tokens: Record<string, string> = {};
  let sales: number;

  const as = (who: string) => ({
    get: (path: string) =>
      request(app).get(`/api/macros${path}`).set('Authorization', `Bearer ${tokens[who]}`),
    post: (path: string, body: unknown) =>
      request(app)
        .post(`/api/macros${path}`)
        .set('Authorization', `Bearer ${tokens[who]}`)
        .send(body as object),
    put: (path: string, body: unknown) =>
      request(app)
        .put(`/api/macros${path}`)
        .set('Authorization', `Bearer ${tokens[who]}`)
        .send(body as object),
    delete: (path: string) =>
      request(app).delete(`/api/macros${path}`).set('Authorization', `Bearer ${tokens[who]}`),
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
      { id: SUB, name: 'Bomizzel', domain: 'sub-m.example.com' },
      { id: ACME, name: 'Acme', domain: 'acme-m.example.com', subscriber_id: SUB },
      { id: OTHER, name: 'Other', domain: 'other-m.example.com' },
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
      user(ADMIN, 'admin@sub-m.example.com', 'admin', 'Ada'),
      user(AGENT, 'agent@sub-m.example.com', 'employee', 'Bea'),
      user(AGENT2, 'agent2@sub-m.example.com', 'employee', 'Cal'),
      user(CONTACT, 'pat@acme-m.example.com', 'customer', 'Pat'),
      user(OTHER_ADMIN, 'x@other-m.example.com', 'admin', 'Xan', OTHER),
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
      ['admin', ADMIN, 'admin@sub-m.example.com', 'admin'],
      ['agent', AGENT, 'agent@sub-m.example.com', 'employee'],
      ['agent2', AGENT2, 'agent2@sub-m.example.com', 'employee'],
      ['contact', CONTACT, 'pat@acme-m.example.com', 'customer'],
      ['other', OTHER_ADMIN, 'x@other-m.example.com', 'admin'],
    ] as const) {
      tokens[who] = JWTUtils.generateAccessToken({ userId: id, email, role });
    }
  });

  beforeEach(async () => {
    await db('macros').del();
  });

  it('fills placeholders, escaping values and leaving unknown ones', () => {
    expect(
      fillPlaceholders('<p>Hi {{customer.firstName}}, re {{ticket.number}} {{nope.x}}</p>', {
        'customer.firstName': '<b>Pat</b>',
        'ticket.number': '#1001',
      })
    ).toBe('<p>Hi &lt;b&gt;Pat&lt;/b&gt;, re #1001 {{nope.x}}</p>');
  });

  it('shared macros are for admins to make; agents make personal ones only they see', async () => {
    expect(
      (await as('agent').post('', { name: 'Team', shared: true, replyHtml: '<p>x</p>' })).status
    ).toBe(403);
    const shared = await as('admin').post('', {
      name: 'Team',
      shared: true,
      replyHtml: '<p>x</p>',
    });
    expect(shared.status).toBe(201);
    const mine = await as('agent').post('', { name: 'Mine', replyHtml: '<p>y</p>' });
    expect(mine.status).toBe(201);
    expect(mine.body.macro.shared).toBe(false);

    const names = async (who: string) =>
      (await as(who).get('')).body.macros.map((m: any) => m.name).sort();
    expect(await names('agent')).toEqual(['Mine', 'Team']);
    expect(await names('agent2')).toEqual(['Team']);
    expect(await names('admin')).toEqual(['Team']);
    expect(await names('other')).toEqual([]);

    // Agents can't change shared ones; nobody else can touch a personal one
    const id = shared.body.macro.id;
    expect((await as('agent').put(`/${id}`, { name: 'Hijack', replyHtml: 'z' })).status).toBe(403);
    expect((await as('agent').delete(`/${id}`)).status).toBe(403);
    expect((await as('agent2').delete(`/${mine.body.macro.id}`)).status).toBe(404);
    expect((await as('other').delete(`/${id}`)).status).toBe(404);
    expect((await as('agent').delete(`/${mine.body.macro.id}`)).status).toBe(200);
  });

  it('is for staff only', async () => {
    expect((await as('contact').get('')).status).toBe(403);
  });

  it('refuses empty macros and things from elsewhere', async () => {
    const bad = [
      { name: 'Nothing' },
      { name: '', replyHtml: '<p>x</p>' },
      { name: 'x', actions: { status: 'deleted' } },
      { name: 'x', actions: { status: 'resolved', resolution: 'no_response' } },
      { name: 'x', actions: { priority: 7 } },
      { name: 'x', actions: { assignTo: OTHER_ADMIN } },
      { name: 'x', actions: { assignTo: CONTACT } },
      { name: 'x', actions: { departmentId: 999999 } },
    ];
    for (const body of bad) expect((await as('admin').post('', body)).status).toBe(400);
  });

  it('cleans the reply HTML when saving', async () => {
    const res = await as('admin').post('', {
      name: 'x',
      shared: true,
      replyHtml: '<p onclick="steal()">Hi<script>alert(1)</script></p>',
    });
    expect(res.body.macro.replyHtml).toBe('<p>Hi</p>');
  });

  it('applies the changes and returns the reply filled in, without sending it', async () => {
    const macro = (
      await as('admin').post('', {
        name: 'Resolve as fixed',
        shared: true,
        replyHtml:
          '<p>Hi {{customer.firstName}}, {{ticket.number}} at {{account.name}} is fixed. – {{agent.firstName}}, {{company.name}}</p>',
        actions: {
          status: 'resolved',
          resolution: 'fixed',
          priority: 2,
          assignTo: 'me',
          departmentId: sales,
        },
      })
    ).body.macro;
    const t = await newTicket({ ticket_number: 1042 });

    const res = await as('agent').post(`/${macro.id}/apply`, { ticketId: t.id });
    expect(res.status).toBe(200);
    expect(res.body.reply).toEqual({
      html: '<p>Hi Pat, #1042 at Acme is fixed. – Bea, Bomizzel</p>',
      text: 'Hi Pat, #1042 at Acme is fixed. – Bea, Bomizzel',
      isInternal: false,
    });
    const row = await db('tickets').where('id', t.id).first();
    expect(row).toMatchObject({
      status: 'resolved',
      resolution: 'fixed',
      priority: 2,
      assigned_to_id: AGENT,
      department_id: sales,
    });
    expect(res.body.ticket.assignedTo.id).toBe(AGENT);
    // Not sent: no note was added
    expect(await db('ticket_notes').where('ticket_id', t.id)).toHaveLength(0);
  });

  it('a reply-only macro changes nothing; unassign works', async () => {
    const reply = (await as('agent').post('', { name: 'Hi', replyHtml: '<p>Hello</p>' })).body
      .macro;
    const unassign = (
      await as('admin').post('', {
        name: 'Unassign',
        shared: true,
        actions: { assignTo: 'unassigned' },
      })
    ).body.macro;
    const t = await newTicket({ assigned_to_id: AGENT2 });

    const res = await as('agent').post(`/${reply.id}/apply`, { ticketId: t.id });
    expect(res.body.changed).toEqual([]);
    expect((await db('tickets').where('id', t.id).first()).assigned_to_id).toBe(AGENT2);

    const res2 = await as('agent').post(`/${unassign.id}/apply`, { ticketId: t.id });
    expect(res2.body.reply).toBeNull();
    expect((await db('tickets').where('id', t.id).first()).assigned_to_id).toBeNull();
  });

  it("can't apply someone else's personal macro, or to another subscriber's ticket", async () => {
    const mine = (await as('agent').post('', { name: 'Mine', replyHtml: '<p>y</p>' })).body.macro;
    const t = await newTicket();
    expect((await as('agent2').post(`/${mine.id}/apply`, { ticketId: t.id })).status).toBe(404);

    const theirs = (
      await as('other').post('', { name: 'Theirs', shared: true, actions: { priority: 3 } })
    ).body.macro;
    expect((await as('other').post(`/${theirs.id}/apply`, { ticketId: t.id })).status).toBe(404);
    expect((await db('tickets').where('id', t.id).first()).priority).toBe(0);
  });
});
