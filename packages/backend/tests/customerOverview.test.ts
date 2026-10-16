import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { resetDatabase } from './helpers/db';

/**
 * The account and contact pages' overview: counts, channels, handling times,
 * tickets, contacts/accounts, history and files - within the subscriber.
 */
describe('account and contact overview', () => {
  const SUB = '00000000-0000-4000-8000-0000000aa001';
  const ACCT = '00000000-0000-4000-8000-0000000aa002';
  const AGENT = '00000000-0000-4000-8000-0000000aa003';
  const PAT = '00000000-0000-4000-8000-0000000aa004';
  const SAM = '00000000-0000-4000-8000-0000000aa005';
  const TEAM = '00000000-0000-4000-8000-0000000aa006';
  const OTHER = '00000000-0000-4000-8000-0000000aa007';
  const OTHER_ACCT = '00000000-0000-4000-8000-0000000aa008';
  let token: string;
  const get = (path: string) =>
    request(app).get(`/api/records${path}`).set('Authorization', `Bearer ${token}`);

  // Minutes ago, as a timestamp
  const ago = (min: number) => new Date(Date.now() - min * 60_000);

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', support_email_slug: 'subov' },
      { id: ACCT, name: 'Acme', subscriber_id: SUB },
      { id: OTHER, name: 'Other', support_email_slug: 'otherov' },
      { id: OTHER_ACCT, name: 'Their account', subscriber_id: OTHER },
    ]);
    const user = (id: string, email: string, role: string, first: string) => ({
      id,
      email,
      password_hash: 'x',
      first_name: first,
      last_name: 'T',
      role,
      is_active: true,
      email_verified: true,
    });
    await db('users').insert([
      user(AGENT, 'agent@sub.example.com', 'employee', 'Gus'),
      user(PAT, 'pat@acme.example.com', 'customer', 'Pat'),
      user(SAM, 'sam@acme.example.com', 'customer', 'Sam'),
    ]);
    await db('user_company_associations').insert([
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: PAT, company_id: ACCT, role: 'member' },
      { user_id: SAM, company_id: ACCT, role: 'member' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'S', org_id: SUB });
    await db('ticket_statuses').insert([
      { team_id: TEAM, name: 'open', label: 'Open', color: '#3B82F6', order: 1 },
      { team_id: TEAM, name: 'waiting', label: 'Waiting', color: '#8B5CF6', order: 2 },
      { team_id: TEAM, name: 'resolved', label: 'Resolved', color: '#10B981', order: 3 },
    ]);
    const [q] = await db('queues')
      .insert({ name: 'Inbox', type: 'unassigned', team_id: TEAM, org_id: SUB })
      .returning('id');
    const ticket = (
      title: string,
      submitter: string,
      status: string,
      source: string,
      created: Date,
      extra = {}
    ) => ({
      title,
      description: 'd',
      submitter_id: submitter,
      company_id: ACCT,
      org_id: SUB,
      team_id: TEAM,
      queue_id: q.id ?? q,
      status,
      priority: 0,
      source,
      created_at: created,
      ...extra,
    });
    const rows = await db('tickets')
      .insert([
        // Opened 120 min ago, answered after 30, resolved after 60
        ticket('Printer', PAT, 'resolved', 'web', ago(120), { resolved_at: ago(60) }),
        // Opened 100 min ago, answered after 10; waiting on Pat
        ticket('Login', PAT, 'waiting', 'email', ago(100)),
        // Sam's, still open, no reply
        ticket('Scanner', SAM, 'open', 'web', ago(50)),
      ])
      .returning('id');
    const [printer, login] = rows.map((r: any) => r.id ?? r);
    await db('ticket_notes').insert([
      {
        ticket_id: printer,
        author_id: AGENT,
        content: 'On it',
        is_internal: false,
        created_at: ago(90),
        org_id: SUB,
      },
      {
        ticket_id: printer,
        author_id: AGENT,
        content: 'internal',
        is_internal: true,
        created_at: ago(119),
        org_id: SUB,
      },
      {
        ticket_id: login,
        author_id: AGENT,
        content: 'Which user?',
        is_internal: false,
        created_at: ago(90),
        org_id: SUB,
      },
      // Pat answers, Gus replies 20 minutes later
      {
        ticket_id: login,
        author_id: PAT,
        content: 'jdoe',
        is_internal: false,
        created_at: ago(80),
        org_id: SUB,
      },
      {
        ticket_id: login,
        author_id: AGENT,
        content: 'Reset',
        is_internal: false,
        created_at: ago(60),
        org_id: SUB,
      },
    ]);
    await db('ticket_history').insert({
      ticket_id: printer,
      user_id: AGENT,
      action: 'status_changed',
      field_name: 'status',
      old_value: 'open',
      new_value: 'resolved',
    });
    token = JWTUtils.generateAccessToken({
      userId: AGENT,
      email: 'agent@sub.example.com',
      role: 'employee',
      tid: SUB,
      aud: 'staff',
    });
  });

  it("an account's counts, channels and handling times", async () => {
    const res = await get(`/accounts/${ACCT}/overview`);
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ all: 3, open: 2, onHold: 1, finished: 1 });
    expect(res.body.channels).toEqual([
      { channel: 'web', count: 2 },
      { channel: 'email', count: 1 },
    ]);
    expect(res.body.happiness).toBeNull();
    // First responses 30 and 10 min; replies after a customer message 30, 10, 20; resolution 60
    expect(res.body.handling).toMatchObject({
      firstResponseMinutes: 20,
      responseMinutes: 20,
      resolutionMinutes: 60,
    });
  });

  it("a contact's are only their own tickets", async () => {
    const res = await get(`/contacts/${SAM}/overview`);
    expect(res.body.counts).toEqual({ all: 1, open: 1, onHold: 0, finished: 0 });
    expect(res.body.handling.firstResponseMinutes).toBeNull();
  });

  it('lists tickets by filter, with status labels, contact, account and reply counts', async () => {
    const all = await get(`/accounts/${ACCT}/tickets`);
    expect(all.body.total).toBe(3);
    expect(all.body.tickets.map((t: any) => t.title)).toEqual(['Scanner', 'Login', 'Printer']);
    const login = all.body.tickets.find((t: any) => t.title === 'Login');
    expect(login).toMatchObject({
      statusLabel: 'Waiting',
      channel: 'email',
      contact: { id: PAT, name: 'Pat T' },
      account: { id: ACCT, name: 'Acme' },
      replies: 3,
    });
    expect((await get(`/accounts/${ACCT}/tickets?filter=open`)).body.total).toBe(2);
    expect((await get(`/accounts/${ACCT}/tickets?filter=on_hold`)).body.tickets[0].title).toBe(
      'Login'
    );
  });

  it("an account's contacts and a contact's accounts", async () => {
    const people = await get(`/accounts/${ACCT}/people`);
    expect(people.body.contacts.map((c: any) => [c.name, c.tickets])).toEqual([
      ['Pat T', 2],
      ['Sam T', 1],
    ]);
    const accounts = await get(`/contacts/${PAT}/people`);
    expect(accounts.body.accounts.map((a: any) => a.name)).toEqual(['Acme']);
  });

  it('history of their tickets', async () => {
    const res = await get(`/accounts/${ACCT}/history`);
    expect(res.body.history[0]).toMatchObject({
      action: 'status_changed',
      to: 'resolved',
      by: 'Gus T',
    });
  });

  it("nothing of another subscriber's account", async () => {
    expect((await get(`/accounts/${OTHER_ACCT}/overview`)).status).toBe(404);
    expect((await get(`/accounts/${OTHER_ACCT}/tickets`)).status).toBe(404);
    expect((await get(`/accounts/${ACCT}/nonsense`)).status).toBe(404);
  });
});
