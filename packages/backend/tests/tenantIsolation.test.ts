import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { resetDatabase } from './helpers/db';

/**
 * Two subscribers (tenants), A and B, set up like Zoho Desk:
 *
 *   subscriber -> staff (admin, agent)
 *              -> accounts (their customers' companies) -> contacts
 *
 * Nobody in A may see anything of B's, and a contact may see only tickets of
 * their own account - their own and their co-workers' - never another
 * account's, even in the same subscriber.
 *
 * The "sees nothing of B" checks are deliberately blunt: every id and name
 * belonging to B is searched for in the raw response body.
 */

type Tenant = {
  subscriberId: string;
  adminId: string;
  agentId: string;
  teamId: string;
  queueId: string;
  account1Id: string;
  account2Id: string;
  contact1Id: string; // account 1
  coworkerId: string; // account 1, same account as contact1
  contact2Id: string; // account 2
  ticket1Id: string; // raised by contact1 in account 1
  coworkerTicketId: string; // raised by coworker in account 1
  ticket2Id: string; // raised by contact2 in account 2
  internalNoteId: string; // on ticket1
  publicNoteId: string; // on ticket1
  secrets: string[]; // every id and name that must never leak
};

let seq = 0;
const uuid = (): string => {
  seq += 1;
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, '0')}`;
};

const token = (id: string, email: string, role: string): string =>
  JWTUtils.generateAccessToken({ userId: id, email, role });

const makeUser = async (email: string, role: string, currentOrgId: string): Promise<string> => {
  const id = uuid();
  await db('users').insert({
    id,
    email,
    password_hash: 'x',
    first_name: email.split('@')[0],
    last_name: 'Test',
    role,
    is_active: true,
    current_org_id: currentOrgId,
  });
  return id;
};

const makeTenant = async (tag: 'a' | 'b'): Promise<Tenant> => {
  const T = tag.toUpperCase();
  const subscriberId = uuid();
  await db('companies').insert({
    id: subscriberId,
    name: `Subscriber ${T}`,
    domain: `sub-${tag}.test`,
  });

  const adminId = await makeUser(`admin@sub-${tag}.test`, 'admin', subscriberId);
  const agentId = await makeUser(`agent@sub-${tag}.test`, 'employee', subscriberId);
  await db('user_company_associations').insert([
    { user_id: adminId, company_id: subscriberId, role: 'owner' },
    { user_id: agentId, company_id: subscriberId, role: 'member' },
  ]);

  const teamId = uuid();
  await db('teams').insert({ id: teamId, name: `Team ${T}`, org_id: subscriberId });
  await db('team_memberships').insert([
    { user_id: adminId, team_id: teamId, role: 'admin' },
    { user_id: agentId, team_id: teamId, role: 'member' },
  ]);
  const queueId = uuid();
  await db('queues').insert({
    id: queueId,
    name: `Queue ${T}`,
    type: 'unassigned',
    team_id: teamId,
    org_id: subscriberId,
  });
  await db('departments').insert({
    name: `Dept ${T}`,
    company_id: subscriberId,
    org_id: subscriberId,
  });
  await db('business_hours').insert({
    company_id: subscriberId,
    title: `Hours ${T}`,
    timezone: 'UTC',
  });
  await db('holiday_lists').insert({ company_id: subscriberId, name: `Holidays ${T}` });
  await db('trophies').insert({
    company_id: subscriberId,
    name: `Trophy ${T}`,
    category: 'volume',
    criteria_type: 'tickets',
  });
  await db('organizational_roles').insert({ company_id: subscriberId, name: `Role ${T}` });
  await db('user_profiles').insert({ company_id: subscriberId, name: `Profile ${T}` });

  const account1Id = uuid();
  const account2Id = uuid();
  await db('companies').insert([
    {
      id: account1Id,
      name: `Account ${T}1`,
      domain: `acct-${tag}1.test`,
      subscriber_id: subscriberId,
    },
    {
      id: account2Id,
      name: `Account ${T}2`,
      domain: `acct-${tag}2.test`,
      subscriber_id: subscriberId,
    },
  ]);

  const contact1Id = await makeUser(`contact1@acct-${tag}1.test`, 'customer', subscriberId);
  const coworkerId = await makeUser(`coworker@acct-${tag}1.test`, 'customer', subscriberId);
  const contact2Id = await makeUser(`contact2@acct-${tag}2.test`, 'customer', subscriberId);
  await db('user_company_associations').insert([
    { user_id: contact1Id, company_id: account1Id, role: 'member' },
    { user_id: coworkerId, company_id: account1Id, role: 'member' },
    { user_id: contact2Id, company_id: account2Id, role: 'member' },
  ]);

  const ticket = async (title: string, submitter: string, company: string): Promise<string> => {
    const id = uuid();
    await db('tickets').insert({
      id,
      title,
      description: `${title} description`,
      submitter_id: submitter,
      company_id: company,
      org_id: subscriberId,
      team_id: teamId,
      queue_id: queueId,
      status: 'open',
      priority: 0,
    });
    return id;
  };
  const ticket1Id = await ticket(`Ticket ${T}1 from contact1`, contact1Id, account1Id);
  const coworkerTicketId = await ticket(`Ticket ${T}1 from coworker`, coworkerId, account1Id);
  const ticket2Id = await ticket(`Ticket ${T}2 from contact2`, contact2Id, account2Id);

  const internalNoteId = uuid();
  const publicNoteId = uuid();
  await db('ticket_notes').insert([
    {
      id: internalNoteId,
      ticket_id: ticket1Id,
      author_id: agentId,
      content: `Internal note ${T}`,
      is_internal: true,
      org_id: subscriberId,
    },
    {
      id: publicNoteId,
      ticket_id: ticket1Id,
      author_id: agentId,
      content: `Public note ${T}`,
      is_internal: false,
      org_id: subscriberId,
    },
  ]);

  return {
    subscriberId,
    adminId,
    agentId,
    teamId,
    queueId,
    account1Id,
    account2Id,
    contact1Id,
    coworkerId,
    contact2Id,
    ticket1Id,
    coworkerTicketId,
    ticket2Id,
    internalNoteId,
    publicNoteId,
    secrets: [
      subscriberId,
      adminId,
      agentId,
      teamId,
      queueId,
      account1Id,
      account2Id,
      contact1Id,
      coworkerId,
      contact2Id,
      ticket1Id,
      coworkerTicketId,
      ticket2Id,
      internalNoteId,
      publicNoteId,
      `Subscriber ${T}`,
      `Account ${T}1`,
      `Account ${T}2`,
      `sub-${tag}.test`,
      `acct-${tag}1.test`,
      `acct-${tag}2.test`,
      `Ticket ${T}1`,
      `Ticket ${T}2`,
      `Team ${T}`,
      `Queue ${T}`,
      `Dept ${T}`,
      `Internal note ${T}`,
      `Public note ${T}`,
      `Hours ${T}`,
      `Holidays ${T}`,
      `Trophy ${T}`,
      `Role ${T}`,
      `Profile ${T}`,
    ],
  };
};

let A: Tenant;
let B: Tenant;
let tokens: Record<string, string>;

beforeAll(async () => {
  await resetDatabase();
  A = await makeTenant('a');
  B = await makeTenant('b');
  tokens = {
    adminA: token(A.adminId, 'admin@sub-a.test', 'admin'),
    agentA: token(A.agentId, 'agent@sub-a.test', 'employee'),
    contact1A: token(A.contact1Id, 'contact1@acct-a1.test', 'customer'),
    contact2A: token(A.contact2Id, 'contact2@acct-a2.test', 'customer'),
  };
});

const leaks = (body: unknown, secrets: string[]): string[] => {
  const text = JSON.stringify(body ?? '');
  return secrets.filter((s) => text.includes(s));
};

const get = (path: string, who: string) =>
  request(app).get(path).set('Authorization', `Bearer ${tokens[who]}`);

// Endpoints that list or search things. Nothing of B's may appear for anyone
// in A, whatever the status code.
const LIST_ENDPOINTS = [
  '/api/tickets',
  '/api/tickets?limit=100',
  `/api/tickets?queueId=${'QUEUE_B'}`,
  '/api/companies',
  '/api/companies/search?q=Account',
  '/api/companies/stats',
  '/api/agents',
  '/api/agents/customers',
  '/api/agents/accounts',
  '/api/users',
  '/api/users/list',
  '/api/users/search?q=test',
  '/api/users/stats',
  '/api/admin/users',
  '/api/teams',
  '/api/queues',
  '/api/queues/dashboard/metrics',
  '/api/departments',
  '/api/notes/search?q=note',
  '/api/reports/tickets',
  '/api/reports/users',
  '/api/reports/teams',
  '/api/business-hours',
  '/api/holiday-lists',
  '/api/products',
  '/api/organizational-roles',
  '/api/user-profiles',
  '/api/gamification/trophies',
];

describe.each(['adminA', 'agentA', 'contact1A'])('%s sees nothing of subscriber B', (who) => {
  it.each(LIST_ENDPOINTS)('%s', async (rawPath) => {
    const path = rawPath.replace('QUEUE_B', B.queueId);
    const res = await get(path, who);
    expect(leaks(res.body, B.secrets)).toEqual([]);
  });
});

// B's objects by id: never 200 for anyone in A.
describe.each(['adminA', 'agentA', 'contact1A'])("%s can't open B's objects by id", (who) => {
  const paths = (): string[] => [
    `/api/tickets/${B.ticket1Id}`,
    `/api/tickets/${B.ticket1Id}/notes`,
    `/api/tickets/${B.ticket1Id}/history`,
    `/api/tickets/${B.ticket1Id}/attachments`,
    `/api/notes/${B.publicNoteId}`,
    `/api/companies/${B.account1Id}`,
    `/api/companies/${B.account1Id}/users`,
    `/api/companies/${B.subscriberId}`,
    `/api/users/${B.adminId}`,
    `/api/users/${B.contact1Id}/companies`,
    `/api/admin/users/${B.contact1Id}`,
    `/api/teams/${B.teamId}`,
    `/api/teams/${B.teamId}/members`,
    `/api/teams/${B.teamId}/statuses`,
    `/api/queues/${B.queueId}`,
    `/api/queues/${B.queueId}/tickets`,
    `/api/custom-fields/teams/${B.teamId}`,
    `/api/search/fields/${B.teamId}`,
  ];

  it('returns no B data for any of them', async () => {
    const failures: string[] = [];
    for (const path of paths()) {
      const res = await get(path, who);
      if (res.status === 200 || leaks(res.body, B.secrets).length > 0) {
        failures.push(`${path} -> ${res.status} ${leaks(res.body, B.secrets).join(',')}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("changing B's objects from A", () => {
  it.each(['adminA', 'agentA', 'contact1A'])(
    '%s cannot update, assign, note, or delete B tickets',
    async (who) => {
      const auth = { Authorization: `Bearer ${tokens[who]}` };
      const attempts = [
        request(app).put(`/api/tickets/${B.ticket1Id}`).set(auth).send({ title: 'hijacked' }),
        request(app).put(`/api/tickets/${B.ticket1Id}/status`).set(auth).send({ status: 'closed' }),
        request(app).put(`/api/tickets/${B.ticket1Id}/priority`).set(auth).send({ priority: 50 }),
        request(app)
          .post(`/api/tickets/${B.ticket1Id}/assign`)
          .set(auth)
          .send({ assignedToId: A.agentId }),
        request(app)
          .post(`/api/tickets/${B.ticket1Id}/notes`)
          .set(auth)
          .send({ content: 'hijacked note' }),
        request(app).delete(`/api/tickets/${B.ticket1Id}`).set(auth),
        request(app)
          .post('/api/bulk/status')
          .set(auth)
          .send({ ticketIds: [B.ticket1Id], status: 'closed' }),
        request(app)
          .post('/api/bulk/assign')
          .set(auth)
          .send({ ticketIds: [B.ticket1Id], assignedToId: A.agentId }),
        request(app)
          .delete('/api/bulk/delete')
          .set(auth)
          .send({ ticketIds: [B.ticket1Id] }),
      ];
      await Promise.all(attempts);

      const ticket = await db('tickets').where('id', B.ticket1Id).first();
      expect(ticket).toBeDefined();
      expect(ticket.title).toBe('Ticket B1 from contact1');
      expect(ticket.status).toBe('open');
      expect(ticket.assigned_to_id).toBeNull();
      const notes = await db('ticket_notes').where('ticket_id', B.ticket1Id);
      expect(notes).toHaveLength(2);
    }
  );

  it("admin A cannot file tickets into B, or edit B's settings rows", async () => {
    const auth = { Authorization: `Bearer ${tokens.adminA}` };
    const before = await db('tickets').where('org_id', B.subscriberId).count('* as n').first();
    await request(app).post('/api/tickets').set(auth).send({
      title: 'planted',
      description: 'planted in B',
      companyId: B.account1Id,
      teamId: B.teamId,
      submitterId: B.contact1Id,
    });
    const after = await db('tickets').where('org_id', B.subscriberId).count('* as n').first();
    expect(after).toEqual(before);

    const trophy = await db('trophies').where('company_id', B.subscriberId).first();
    const role = await db('organizational_roles').where('company_id', B.subscriberId).first();
    const profile = await db('user_profiles').where('company_id', B.subscriberId).first();
    const hours = await db('business_hours').where('company_id', B.subscriberId).first();
    await Promise.all([
      request(app)
        .put(`/api/gamification/trophies/${trophy.id}`)
        .set(auth)
        .send({ name: 'hijacked' }),
      request(app).put(`/api/organizational-roles/${role.id}`).set(auth).send({ name: 'hijacked' }),
      request(app).delete(`/api/user-profiles/${profile.id}`).set(auth),
      request(app).delete(`/api/business-hours/${hours.id}`).set(auth),
    ]);
    expect((await db('trophies').where('id', trophy.id).first()).name).toBe('Trophy B');
    expect((await db('organizational_roles').where('id', role.id).first()).name).toBe('Role B');
    expect((await db('user_profiles').where('id', profile.id).first()).is_active).not.toBe(false);
    expect(await db('business_hours').where('id', hours.id).first()).toBeDefined();
  });

  it("a contact of A cannot change A's business hours", async () => {
    const hours = await db('business_hours').where('company_id', A.subscriberId).first();
    const res = await request(app)
      .delete(`/api/business-hours/${hours.id}`)
      .set('Authorization', `Bearer ${tokens.contact1A}`);
    expect(res.status).toBe(403);
    expect(await db('business_hours').where('id', hours.id).first()).toBeDefined();
  });

  it("admin A cannot edit B's accounts, users or teams, or join B's companies", async () => {
    const auth = { Authorization: `Bearer ${tokens.adminA}` };
    await Promise.all([
      request(app).put(`/api/companies/${B.account1Id}`).set(auth).send({ name: 'hijacked' }),
      request(app)
        .post(`/api/companies/${B.account1Id}/users`)
        .set(auth)
        .send({ userId: A.adminId, role: 'admin' }),
      request(app).put(`/api/users/${B.adminId}`).set(auth).send({ role: 'customer' }),
      request(app).post(`/api/users/${B.adminId}/deactivate`).set(auth),
      request(app).put(`/api/admin/users/${B.adminId}/status`).set(auth).send({ isActive: false }),
      request(app).put(`/api/admin/users/${B.adminId}/role`).set(auth).send({ role: 'customer' }),
      request(app).put(`/api/teams/${B.teamId}`).set(auth).send({ name: 'hijacked' }),
      request(app).post(`/api/teams/${B.teamId}/members`).set(auth).send({ userId: A.adminId }),
    ]);
    await request(app).delete(`/api/admin/users/${B.contact2Id}/permanent`).set(auth);
    await request(app).delete(`/api/companies/${B.account2Id}`).set(auth);

    expect((await db('companies').where('id', B.account1Id).first()).name).toBe('Account B1');
    expect(await db('companies').where('id', B.account2Id).first()).toBeDefined();
    const bAdmin = await db('users').where('id', B.adminId).first();
    expect(bAdmin.role).toBe('admin');
    expect(bAdmin.is_active).toBe(true);
    expect(await db('users').where('id', B.contact2Id).first()).toBeDefined();
    expect((await db('teams').where('id', B.teamId).first()).name).toBe('Team B');
    expect(
      await db('user_company_associations')
        .where({ user_id: A.adminId })
        .whereIn('company_id', [B.account1Id, B.subscriberId])
    ).toHaveLength(0);
    expect(
      await db('team_memberships').where({ user_id: A.adminId, team_id: B.teamId })
    ).toHaveLength(0);
  });
});

describe('contacts see only their own account', () => {
  it("contact 1 sees their own and their co-worker's tickets, not account 2's", async () => {
    const res = await get('/api/tickets?limit=100', 'contact1A');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toContain(A.ticket1Id);
    expect(text).toContain(A.coworkerTicketId);
    expect(text).not.toContain(A.ticket2Id);
  });

  it("contact 1 can open a co-worker's ticket but not account 2's", async () => {
    expect((await get(`/api/tickets/${A.coworkerTicketId}`, 'contact1A')).status).toBe(200);
    expect((await get(`/api/tickets/${A.ticket2Id}`, 'contact1A')).status).not.toBe(200);
  });

  it('contact 2 sees only account 2', async () => {
    const res = await get('/api/tickets?limit=100', 'contact2A');
    const text = JSON.stringify(res.body);
    expect(text).toContain(A.ticket2Id);
    expect(text).not.toContain(A.ticket1Id);
    expect(text).not.toContain(A.coworkerTicketId);
  });

  it('contacts never see internal notes', async () => {
    const res = await get(`/api/tickets/${A.ticket1Id}/notes?includeInternal=true`, 'contact1A');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('Public note A');
    expect(JSON.stringify(res.body)).not.toContain('Internal note A');
    expect((await get(`/api/notes/${A.internalNoteId}`, 'contact1A')).status).not.toBe(200);
  });

  it("contact 1 can't list other accounts or staff directories", async () => {
    for (const path of [
      '/api/agents/customers',
      '/api/agents/accounts',
      '/api/companies',
      '/api/users/search?q=test',
    ]) {
      const res = await get(path, 'contact1A');
      const text = JSON.stringify(res.body);
      expect([path, text.includes(A.account2Id) || text.includes(A.contact2Id)]).toEqual([
        path,
        false,
      ]);
    }
  });
});

describe('staff of A still see all of A', () => {
  it.each(['adminA', 'agentA'])('%s lists every ticket of A', async (who) => {
    const res = await get('/api/tickets?limit=100', who);
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    for (const id of [A.ticket1Id, A.coworkerTicketId, A.ticket2Id]) expect(text).toContain(id);
  });

  it("admin A lists both of A's accounts", async () => {
    const res = await get('/api/companies', 'adminA');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toContain(A.account1Id);
    expect(text).toContain(A.account2Id);
  });
});
