import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { EmailService } from '../src/services/EmailService';
import { UserService } from '../src/services/UserService';
import { TicketStatus } from '../src/models/TicketStatus';
import { resetDatabase } from './helpers/db';

/**
 * One login, two companies: Darrell is an admin of Gleason (his company's own
 * help desk on Bomizzel) and a customer in Bomizzel Services' help desk,
 * because Gleason is Bomizzel's customer. His role and company come from the
 * sign-in, not from users.role alone, and neither side can see or change the
 * other's data through him.
 */
describe('one login: staff of one company, customer of another', () => {
  const BSI = '00000000-0000-4000-8000-0000000ee001'; // Bomizzel Services (subscriber)
  const GLEASON_ACCT = '00000000-0000-4000-8000-0000000ee002'; // Gleason, Bomizzel's account
  const GLEASON = '00000000-0000-4000-8000-0000000ee003'; // Gleason (subscriber)
  const GLEASON_CUST_ACCT = '00000000-0000-4000-8000-0000000ee004'; // a Gleason customer's account
  const JEFF = '00000000-0000-4000-8000-0000000ee005';
  const DARRELL = '00000000-0000-4000-8000-0000000ee006';
  const CUSTOMER = '00000000-0000-4000-8000-0000000ee007'; // Gleason's customer
  const BSI_TEAM = '00000000-0000-4000-8000-0000000ee008';
  const GLEASON_TEAM = '00000000-0000-4000-8000-0000000ee009';
  const PASSWORD = 'Darrell-pass-1';
  const saved: any = {};
  let gleasonTicket: string;

  const as = (token: string) => ({
    get: (p: string) => request(app).get(`/api${p}`).set('Authorization', `Bearer ${token}`),
    post: (p: string, body: object = {}) =>
      request(app).post(`/api${p}`).set('Authorization', `Bearer ${token}`).send(body),
    put: (p: string, body: object = {}) =>
      request(app).put(`/api${p}`).set('Authorization', `Bearer ${token}`).send(body),
  });
  const jeff = () =>
    as(
      JWTUtils.generateAccessToken({
        userId: JEFF,
        email: 'jeff@bsi.example.com',
        role: 'admin',
        tid: BSI,
        aud: 'staff',
      })
    );
  const signIn = (body: object) =>
    request(app)
      .post('/api/auth/login')
      .send({ email: 'darrell@gleason.example.com', password: PASSWORD, ...body });

  beforeAll(async () => {
    saved.portalUrl = process.env['PORTAL_URL'];
    process.env['PORTAL_URL'] = 'https://help.bomizzel.com';
    const svc = EmailService as any;
    saved.transporter = svc.transporter;
    saved.config = svc.config;
    svc.transporter = { sendMail: async () => ({ messageId: 'm' }) };
    svc.config = { from: 'Bomizzel <noreply@bomizzel.com>' };

    await resetDatabase();
    await db('companies').insert([
      { id: BSI, name: 'Bomizzel Services', support_email_slug: 'bsi' },
      { id: GLEASON_ACCT, name: 'Gleason (account)', subscriber_id: BSI },
      { id: GLEASON, name: 'Gleason Power', support_email_slug: 'gleason' },
      { id: GLEASON_CUST_ACCT, name: 'Gleason customer', subscriber_id: GLEASON },
    ]);
    const hash = await bcrypt.hash(PASSWORD, 4);
    const user = (id: string, email: string, role: string, extra: object = {}) => ({
      id,
      email,
      password_hash: hash,
      first_name: email.split('@')[0],
      last_name: 'Test',
      role,
      is_active: true,
      email_verified: true,
      ...extra,
    });
    await db('users').insert([
      user(JEFF, 'jeff@bsi.example.com', 'admin', { current_org_id: BSI }),
      user(DARRELL, 'darrell@gleason.example.com', 'admin', { current_org_id: GLEASON }),
      user(CUSTOMER, 'pat@gleason-customer.example.com', 'customer', {
        current_org_id: GLEASON,
      }),
    ]);
    await db('user_company_associations').insert([
      { user_id: JEFF, company_id: BSI, role: 'owner' },
      { user_id: DARRELL, company_id: GLEASON, role: 'owner' },
      { user_id: CUSTOMER, company_id: GLEASON_CUST_ACCT, role: 'member' },
    ]);
    await db('teams').insert([
      { id: BSI_TEAM, name: 'BSI support', org_id: BSI },
      { id: GLEASON_TEAM, name: 'Gleason support', org_id: GLEASON },
    ]);
    await TicketStatus.seedDefaultStatuses(BSI_TEAM);
    await TicketStatus.seedDefaultStatuses(GLEASON_TEAM);
    const [, gq] = await db('queues')
      .insert([
        { name: 'Inbox', type: 'unassigned', team_id: BSI_TEAM, org_id: BSI },
        { name: 'Inbox', type: 'unassigned', team_id: GLEASON_TEAM, org_id: GLEASON },
      ])
      .returning('id');
    await db('departments').insert([
      { company_id: BSI, org_id: BSI, name: 'Support', is_default: true },
      { company_id: GLEASON, org_id: GLEASON, name: 'Support', is_default: true },
    ]);
    const [t] = await db('tickets')
      .insert({
        title: "Pat's generator",
        description: 'd',
        submitter_id: CUSTOMER,
        company_id: GLEASON_CUST_ACCT,
        org_id: GLEASON,
        team_id: GLEASON_TEAM,
        queue_id: gq.id ?? gq,
        status: 'open',
        priority: 0,
      })
      .returning('id');
    gleasonTicket = t.id ?? t;
  });

  afterAll(() => {
    const { portalUrl, ...email } = saved;
    Object.assign(EmailService as any, email);
    if (portalUrl === undefined) delete process.env['PORTAL_URL'];
    else process.env['PORTAL_URL'] = portalUrl;
  });

  it("Bomizzel staff can add Gleason's admin to an account as a customer", async () => {
    // The create-ticket form's "new customer": the login already exists
    const reg = await jeff().post('/auth/register', {
      firstName: 'Darrell',
      lastName: 'Vanny',
      email: 'Darrell@Gleason.example.com',
      password: 'Temp-pass-123',
      role: 'customer',
    });
    expect(reg.status).toBe(200);
    expect(reg.body.existing).toBe(true);
    expect(reg.body.user.id).toBe(DARRELL);

    const add = await jeff().post(`/companies/${GLEASON_ACCT}/users`, {
      userId: DARRELL,
      role: 'member',
    });
    expect(add.status).toBe(201);

    // His login is untouched: still Gleason's admin
    const row = await db('users').where('id', DARRELL).first('role', 'password_hash');
    expect(row.role).toBe('admin');
    expect(await bcrypt.compare(PASSWORD, row.password_hash)).toBe(true);
  });

  it("but can't make him Bomizzel staff", async () => {
    const add = await jeff().post(`/companies/${BSI}/users`, { userId: DARRELL, role: 'member' });
    expect(add.status).toBe(404);
  });

  it("he signs in to Gleason as its admin, and to Bomizzel's portal as a customer", async () => {
    const staff = await signIn({ company: 'gleason', audience: 'staff' });
    expect(staff.status).toBe(200);
    expect(staff.body.user.role).toBe('admin');
    expect(JWTUtils.verifyAccessToken(staff.body.token)?.tid).toBe(GLEASON);

    const portal = await signIn({ company: 'bsi', audience: 'portal' });
    expect(portal.status).toBe(200);
    expect(portal.body.user.role).toBe('customer');
    expect(JWTUtils.verifyAccessToken(portal.body.token)?.tid).toBe(BSI);

    const session = await as(portal.body.token).get('/portal/bsi/session');
    expect(session.status).toBe(200);
    expect(session.body.account.id).toBe(GLEASON_ACCT);
  });

  it("is refused where he doesn't belong that way", async () => {
    const bsiStaff = await signIn({ company: 'bsi', audience: 'staff' });
    expect(bsiStaff.status).toBe(403);
    expect(bsiStaff.body.error.code).toBe('NOT_STAFF_HERE');

    const gleasonPortal = await signIn({ company: 'gleason', audience: 'portal' });
    expect(gleasonPortal.status).toBe(403);
    expect(gleasonPortal.body.error.code).toBe('NOT_A_PORTAL_CONTACT');

    // A Gleason staff session can't be used on Bomizzel's portal
    const staff = await signIn({ company: 'gleason', audience: 'staff' });
    const res = await as(staff.body.token).get('/portal/bsi/session');
    expect(res.status).toBe(403);
  });

  it('a portal ticket at Bomizzel stays out of his Gleason staff view, and the other way round', async () => {
    const portal = await signIn({ company: 'bsi', audience: 'portal' });
    const staff = await signIn({ company: 'gleason', audience: 'staff' });

    const created = await as(portal.body.token).post('/portal/bsi/tickets', {
      title: 'Our Bomizzel bill',
      description: 'A question about the invoice',
    });
    expect(created.status).toBe(201);
    const bsiTicket = created.body.id ?? created.body.data?.id ?? created.body.ticket?.id;
    expect(bsiTicket).toBeTruthy();

    // After using the portal, his staff session is still Gleason's
    const gleasonList = await as(staff.body.token).get('/tickets');
    expect(gleasonList.status).toBe(200);
    const gleasonIds = gleasonList.body.data.map((t: any) => t.id);
    expect(gleasonIds).toContain(gleasonTicket);
    expect(gleasonIds).not.toContain(bsiTicket);

    // And as a customer he sees his Bomizzel ticket, not Gleason's
    const portalList = await as(portal.body.token).get('/tickets');
    expect(portalList.status).toBe(200);
    const portalIds = portalList.body.data.map((t: any) => t.id);
    expect(portalIds).toContain(bsiTicket);
    expect(portalIds).not.toContain(gleasonTicket);

    // Jeff sees it as a customer's ticket
    const jeffList = await jeff().get('/tickets');
    expect(jeffList.body.data.map((t: any) => t.id)).toContain(bsiTicket);
    expect(jeffList.body.data.map((t: any) => t.id)).not.toContain(gleasonTicket);
  });

  it('Bomizzel sees him as a customer, not an agent', async () => {
    const customers = await jeff().get('/agents/customers');
    expect(customers.status).toBe(200);
    const d = customers.body.data.find((u: any) => u.id === DARRELL);
    expect(d?.role).toBe('customer');
    // Only Bomizzel's account, not his own company
    expect(d.companies.map((c: any) => c.companyId)).toEqual([GLEASON_ACCT]);

    const agents = await jeff().get('/agents');
    expect(agents.body.data.map((u: any) => u.id)).not.toContain(DARRELL);

    const admins = await jeff().get('/users?role=admin');
    expect(admins.status).toBe(200);
    expect(admins.body.data.map((u: any) => u.id)).not.toContain(DARRELL);
  });

  it("Bomizzel can't deactivate or demote his login", async () => {
    const off = await jeff().post(`/users/${DARRELL}/deactivate`);
    expect(off.status).toBe(403);
    expect(off.body.error.code).toBe('SHARED_LOGIN');

    const demote = await jeff().put(`/users/${DARRELL}`, { role: 'customer' });
    expect(demote.status).toBe(403);

    const row = await db('users').where('id', DARRELL).first('role', 'is_active');
    expect(row).toEqual({ role: 'admin', is_active: true });
  });

  it("a token for a company he's been removed from stops working", async () => {
    const portal = await signIn({ company: 'bsi', audience: 'portal' });
    await db('user_company_associations')
      .where({ user_id: DARRELL, company_id: GLEASON_ACCT })
      .del();
    const res = await as(portal.body.token).get('/portal/bsi/session');
    expect(res.status).toBe(401);
    await db('user_company_associations').insert({
      user_id: DARRELL,
      company_id: GLEASON_ACCT,
      role: 'member',
    });
  });

  it('signing up on a portal with an existing login (and its password) joins it', async () => {
    const res = await request(app).post('/api/portal/gleason/signup').send({
      firstName: 'Jeff',
      lastName: 'B',
      email: 'jeff@bsi.example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.joined).toBe(true);

    const wrong = await request(app).post('/api/portal/gleason/signup').send({
      firstName: 'Mallory',
      lastName: 'X',
      email: 'pat@gleason-customer.example.com',
      password: 'not-their-password',
    });
    expect(wrong.status).toBe(409);
  });

  it('signing in on bomizzel.com hands off to the company address, once', async () => {
    const staff = await signIn({});
    expect(staff.status).toBe(200);
    expect(staff.body.company).toMatchObject({ id: GLEASON, portalName: 'gleason' });

    const h = await as(staff.body.token).post('/auth/handoff');
    expect(h.status).toBe(200);
    expect(h.body.url).toMatch(/^https:\/\/portal\.bomizzel\.com\/gleason\/agent#handoff=/);
    const code = h.body.url.split('#handoff=')[1];

    // Not a login token in its own right
    expect((await as(code).get('/tickets')).status).toBe(401);

    const first = await request(app).post('/api/auth/handoff/exchange').send({ code });
    expect(first.status).toBe(200);
    expect(first.body.user.role).toBe('admin');
    expect(JWTUtils.verifyAccessToken(first.body.token)?.tid).toBe(GLEASON);

    const again = await request(app).post('/api/auth/handoff/exchange').send({ code });
    expect(again.status).toBe(401);
    // And an access token can't be spent as a hand-off
    const swap = await request(app)
      .post('/api/auth/handoff/exchange')
      .send({ code: staff.body.token });
    expect(swap.status).toBe(401);
  });

  it('a customer sign-in hands off to their customer portal', async () => {
    const portal = await signIn({ company: 'bsi', audience: 'portal' });
    const h = await as(portal.body.token).post('/auth/handoff');
    expect(h.body.url).toMatch(/^https:\/\/help\.bomizzel\.com\/bsi#handoff=/);
    const res = await request(app)
      .post('/api/auth/handoff/exchange')
      .send({ code: h.body.url.split('#handoff=')[1] });
    expect(res.body.user.role).toBe('customer');
    expect(JWTUtils.verifyAccessToken(res.body.token)).toMatchObject({ tid: BSI, aud: 'portal' });
  });

  it("an admin can't look up another company's people", async () => {
    // Someone who is only on Bomizzel's side (Jeff isn't any more: an earlier
    // test signed him up on Gleason's portal, which made him its customer)
    const BSI_AGENT = '00000000-0000-4000-8000-0000000ee010';
    await db('users').insert({
      id: BSI_AGENT,
      email: 'agent@bsi.example.com',
      password_hash: 'x',
      first_name: 'Agent',
      last_name: 'Test',
      role: 'employee',
      is_active: true,
      email_verified: true,
    });
    await db('user_company_associations').insert({
      user_id: BSI_AGENT,
      company_id: BSI,
      role: 'member',
    });
    const darrell = as(
      JWTUtils.generateAccessToken({
        userId: DARRELL,
        email: 'darrell@gleason.example.com',
        role: 'admin',
        tid: GLEASON,
        aud: 'staff',
      })
    );
    expect((await darrell.get(`/admin/users/${BSI_AGENT}`)).status).toBe(404);
    expect((await darrell.get(`/users/${BSI_AGENT}`)).status).toBe(404);
    // ...while Jeff can see his own agent
    expect((await jeff().get(`/admin/users/${BSI_AGENT}`)).status).toBe(200);
    // And the service holds the line by itself, without the route's check
    await expect(
      UserService.getUserById(BSI_AGENT, { id: DARRELL, role: 'admin', tenantId: GLEASON })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
