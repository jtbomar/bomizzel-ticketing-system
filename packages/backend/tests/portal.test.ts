import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { EmailService } from '../src/services/EmailService';
import { TicketStatus } from '../src/models/TicketStatus';
import { resetDatabase } from './helpers/db';

/**
 * The customer portal end to end: sign up, see only your own tickets until
 * an admin approves (from the email or in the app), open / reply / attach /
 * close, and never see another company's tickets or internal files.
 */
describe('customer portal', () => {
  const SUB = '00000000-0000-4000-8000-0000000ff001';
  const ACME = '00000000-0000-4000-8000-0000000ff002';
  const ADMIN1 = '00000000-0000-4000-8000-0000000ff003';
  const ADMIN2 = '00000000-0000-4000-8000-0000000ff004';
  const AGENT = '00000000-0000-4000-8000-0000000ff005';
  const COWORKER = '00000000-0000-4000-8000-0000000ff006';
  const TEAM = '00000000-0000-4000-8000-0000000ff007';
  const QUEUE = '00000000-0000-4000-8000-0000000ff008';
  const OTHER_SUB = '00000000-0000-4000-8000-0000000ff009';
  const OTHER_ADMIN = '00000000-0000-4000-8000-0000000ff00a';
  const mails: any[] = [];
  const saved: any = {};
  let coworkerTicket: string;

  const tokenFor = (userId: string, email: string, role: string) =>
    JWTUtils.generateAccessToken({ userId, email, role });
  const as = (token: string) => ({
    get: (p: string) => request(app).get(`/api${p}`).set('Authorization', `Bearer ${token}`),
    post: (p: string, body: object = {}) =>
      request(app).post(`/api${p}`).set('Authorization', `Bearer ${token}`).send(body),
  });
  const admin1 = () => as(tokenFor(ADMIN1, 'a1@gleason-pt.example.com', 'admin'));
  const signUp = (body: object) => request(app).post('/api/portal/gleason/signup').send(body);
  const verify = async (email: string) => {
    const u = await db('users').where('email', email).first('email_verification_token');
    return request(app).post('/api/auth/verify-email').send({ token: u.email_verification_token });
  };
  const login = async (email: string) => {
    const u = await db('users').where('email', email).first('id', 'role');
    return as(tokenFor(u.id, email, u.role));
  };

  beforeAll(async () => {
    const svc = EmailService as any;
    saved.transporter = svc.transporter;
    saved.config = svc.config;
    svc.transporter = {
      sendMail: async (m: any) => {
        mails.push(m);
        return { messageId: `m${mails.length}` };
      },
    };
    svc.config = { from: 'Bomizzel <noreply@bomizzel.com>' };

    await resetDatabase();
    await db('companies').insert([
      {
        id: SUB,
        name: 'Gleason PT',
        domain: 'gleason-pt.example.com',
        support_email_slug: 'gleason',
      },
      { id: ACME, name: 'Acme PT', domain: 'acme-pt.example.com', subscriber_id: SUB },
      {
        id: OTHER_SUB,
        name: 'Other PT',
        domain: 'other-pt.example.com',
        support_email_slug: 'other-pt',
      },
    ]);
    const user = (id: string, email: string, role: string, extra: object = {}) => ({
      id,
      email,
      password_hash: 'x',
      first_name: email.split('@')[0],
      last_name: 'Test',
      role,
      is_active: true,
      email_verified: true,
      ...extra,
    });
    await db('users').insert([
      user(ADMIN1, 'a1@gleason-pt.example.com', 'admin', { current_org_id: SUB }),
      user(ADMIN2, 'a2@gleason-pt.example.com', 'admin', { current_org_id: SUB }),
      user(AGENT, 'agent@gleason-pt.example.com', 'employee', { current_org_id: SUB }),
      user(COWORKER, 'cara@acme-pt.example.com', 'customer', {
        current_org_id: SUB,
        portal_scope: 'company',
      }),
      user(OTHER_ADMIN, 'boss@other-pt.example.com', 'admin', { current_org_id: OTHER_SUB }),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN1, company_id: SUB, role: 'owner' },
      { user_id: ADMIN2, company_id: SUB, role: 'admin' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: COWORKER, company_id: ACME, role: 'member' },
      { user_id: OTHER_ADMIN, company_id: OTHER_SUB, role: 'owner' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await TicketStatus.seedDefaultStatuses(TEAM);
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });
    await db('departments').insert({
      company_id: SUB,
      org_id: SUB,
      name: 'Support',
      is_default: true,
    });
    const [t] = await db('tickets')
      .insert({
        title: "Cara's generator",
        description: 'd',
        submitter_id: COWORKER,
        company_id: ACME,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        status: 'open',
        priority: 0,
      })
      .returning('id');
    coworkerTicket = t.id ?? t;
  });

  afterAll(() => {
    Object.assign(EmailService as any, saved);
  });

  it("shows the portal's name and look before sign-in", async () => {
    const res = await request(app).get('/api/portal/gleason');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ portalName: 'gleason', name: 'Gleason PT', renamed: false });
    expect((await request(app).get('/api/portal/nobody-here')).status).toBe(404);
  });

  it('signs someone up: placed in their domain’s account, own tickets only, admins told once confirmed', async () => {
    mails.length = 0;
    const res = await signUp({
      firstName: 'Pat',
      lastName: 'Lee',
      email: 'Pat@Acme-PT.example.com',
      password: 'Str0ng!Passw0rd',
      companyName: 'Acme',
    });
    expect(res.status).toBe(201);
    const pat = await db('users').where('email', 'pat@acme-pt.example.com').first();
    expect(pat).toMatchObject({ role: 'customer', portal_scope: 'own', email_verified: false });
    const assoc = await db('user_company_associations').where('user_id', pat.id);
    expect(assoc.map((a: any) => a.company_id)).toEqual([ACME]);
    const req = await db('portal_access_requests').where('user_id', pat.id).first();
    expect(req).toMatchObject({ status: 'pending', company_id: ACME, admins_notified_at: null });

    // Only the branded confirmation so far, linking back to the portal
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toContain("Gleason PT's support portal");
    expect(mails[0].text).toMatch(/\/portal\/gleason\/verify-email\?token=/);

    expect(
      (
        await signUp({
          firstName: 'X',
          lastName: 'Y',
          email: 'pat@acme-pt.example.com',
          password: 'Str0ng!Passw0rd',
        })
      ).status
    ).toBe(409);

    mails.length = 0;
    expect((await verify('pat@acme-pt.example.com')).status).toBe(200);
    expect(mails.map((m) => m.to[0]).sort()).toEqual([
      'a1@gleason-pt.example.com',
      'a2@gleason-pt.example.com',
    ]);
    expect(mails[0].subject).toBe('Pat Lee is asking for portal access');
    expect(mails[0].html).toContain('/portal-access?token=');
    expect(mails[0].html).toContain('decision=approve');
    expect(mails[0].html).toContain('decision=deny');
  });

  it('before approval: own tickets only - open, reply, attach, close', async () => {
    const pat = await login('pat@acme-pt.example.com');
    const session = await pat.get('/portal/gleason/session');
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({
      scope: 'own',
      accessRequest: { status: 'pending' },
      account: { id: ACME },
    });

    // Cara's ticket at the same company is out of sight
    expect((await pat.get('/tickets')).body.data).toEqual([]);
    expect([403, 404]).toContain((await pat.get(`/tickets/${coworkerTicket}`)).status);
    expect((await pat.get(`/tickets/${coworkerTicket}/notes`)).status).toBe(404);

    const deps = await pat.get('/portal/gleason/departments');
    expect(deps.body.departments.map((d: any) => d.name)).toEqual(['Support']);

    const created = await pat.post('/portal/gleason/tickets', {
      title: 'No power',
      description: 'The unit is dead',
      departmentId: deps.body.departments[0].id,
    });
    expect(created.status).toBe(201);
    const ticketId = created.body.ticket.id;
    const listed = (await pat.get('/tickets')).body.data;
    expect(listed.map((t: any) => t.id)).toEqual([ticketId]);

    const note = await pat.post(`/tickets/${ticketId}/notes`, {
      content: 'Still dead',
      isInternal: true,
    });
    expect(note.status).toBe(201);
    expect(note.body.note?.isInternal ?? note.body.data?.isInternal ?? false).toBe(false);

    const upload = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set(
        'Authorization',
        `Bearer ${tokenFor((await db('users').where('email', 'pat@acme-pt.example.com').first()).id, 'pat@acme-pt.example.com', 'customer')}`
      )
      .attach('file', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(upload.status).toBe(201);

    // Can't close Cara's ticket, can close their own
    expect((await pat.post(`/portal/gleason/tickets/${coworkerTicket}/close`)).status).toBe(403);
    const closed = await pat.post(`/portal/gleason/tickets/${ticketId}/close`);
    expect(closed.status).toBe(200);
    const row = await db('tickets').where('id', ticketId).first();
    expect(row).toMatchObject({ status: 'closed', resolution: 'fixed' });
    expect(row.closed_at).not.toBeNull();
  });

  it('never shows a contact files on internal notes', async () => {
    const patRow = await db('users').where('email', 'pat@acme-pt.example.com').first();
    const [ticket] = await db('tickets').where('submitter_id', patRow.id).select('id');
    const agent = as(tokenFor(AGENT, 'agent@gleason-pt.example.com', 'employee'));
    const internal = await agent.post(`/tickets/${ticket.id}/notes`, {
      content: 'Parts cost',
      isInternal: true,
    });
    const noteId = internal.body.note?.id ?? internal.body.data?.id ?? internal.body.id;
    const up = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set('Authorization', `Bearer ${tokenFor(AGENT, 'agent@gleason-pt.example.com', 'employee')}`)
      .field('noteId', noteId)
      .attach('file', Buffer.from('secret'), { filename: 'costs.txt', contentType: 'text/plain' });
    expect(up.status).toBe(201);
    const fileId = up.body.attachment?.id ?? up.body.data?.id ?? up.body.id;

    const pat = await login('pat@acme-pt.example.com');
    const files = (await pat.get(`/tickets/${ticket.id}/attachments`)).body;
    const names = JSON.stringify(files);
    expect(names).toContain('notes.txt');
    expect(names).not.toContain('costs.txt');
    expect((await pat.get(`/files/${fileId}`)).status).toBe(404);
    // Staff still see it
    expect(JSON.stringify((await agent.get(`/tickets/${ticket.id}/attachments`)).body)).toContain(
      'costs.txt'
    );
  });

  it("approving from the email shows the company's tickets; the first decision stands", async () => {
    const patRow = await db('users').where('email', 'pat@acme-pt.example.com').first();
    const req = await db('portal_access_requests').where('user_id', patRow.id).first();
    const { decisionToken } = await import('../src/services/PortalAccessService');

    // Another subscriber's admin can't use a link for this request
    const forged = decisionToken(req.id, OTHER_ADMIN);
    expect(
      (
        await request(app)
          .post('/api/portal-access/decision')
          .send({ token: forged, decision: 'approve' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/portal-access/decision')
          .send({ token: 'junk', decision: 'approve' })
      ).status
    ).toBe(400);

    const token = decisionToken(req.id, ADMIN2);
    const preview = await request(app).get(
      `/api/portal-access/decision?token=${encodeURIComponent(token)}`
    );
    expect(preview.body).toMatchObject({
      status: 'pending',
      contact: { email: 'pat@acme-pt.example.com' },
      account: { name: 'Acme PT' },
    });
    // Looking doesn't decide
    expect((await db('users').where('id', patRow.id).first()).portal_scope).toBe('own');

    const res = await request(app)
      .post('/api/portal-access/decision')
      .send({ token, decision: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'approved', alreadyDecided: false });
    expect((await db('users').where('id', patRow.id).first()).portal_scope).toBe('company');

    const pat = await login('pat@acme-pt.example.com');
    const ids = (await pat.get('/tickets')).body.data.map((t: any) => t.id);
    expect(ids).toContain(coworkerTicket);
    expect((await pat.get(`/tickets/${coworkerTicket}`)).status).toBe(200);
    // Still can't close a co-worker's ticket
    expect((await pat.post(`/portal/gleason/tickets/${coworkerTicket}/close`)).status).toBe(403);

    const late = await request(app)
      .post('/api/portal-access/decision')
      .send({ token: decisionToken(req.id, ADMIN1), decision: 'deny' });
    expect(late.body).toMatchObject({ status: 'approved', alreadyDecided: true });
  });

  it('a gmail sign-up gets their own account; an admin approves them into Acme in the app', async () => {
    await signUp({
      firstName: 'Sam',
      lastName: 'Ng',
      email: 'sam.ng@gmail.com',
      password: 'Str0ng!Passw0rd',
      companyName: 'Acme',
    });
    await verify('sam.ng@gmail.com');
    const sam = await db('users').where('email', 'sam.ng@gmail.com').first();
    const [own] = await db('user_company_associations as a')
      .join('companies as c', 'c.id', 'a.company_id')
      .where('a.user_id', sam.id)
      .select('c.id', 'c.name', 'c.subscriber_id');
    expect(own).toMatchObject({ name: 'Acme', subscriber_id: SUB });
    expect(own.id).not.toBe(ACME);

    const samApi = await login('sam.ng@gmail.com');
    const t = await samApi.post('/portal/gleason/tickets', { title: 'Hi', description: 'Help' });
    expect(t.status).toBe(201);

    const list = await admin1().get('/portal-access/requests');
    const req = list.body.requests.find((r: any) => r.contact.email === 'sam.ng@gmail.com');
    expect(req).toBeTruthy();
    // Agents can't decide
    const agent = as(tokenFor(AGENT, 'agent@gleason-pt.example.com', 'employee'));
    expect(
      (await agent.post(`/portal-access/requests/${req.id}/decide`, { decision: 'approve' })).status
    ).toBe(403);

    const res = await admin1().post(`/portal-access/requests/${req.id}/decide`, {
      decision: 'approve',
      companyId: ACME,
    });
    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ id: ACME });
    const after = await db('user_company_associations')
      .where('user_id', sam.id)
      .select('company_id');
    expect(after.map((a: any) => a.company_id)).toEqual([ACME]);
    // Their ticket moved with them
    expect((await db('tickets').where('id', t.body.ticket.id).first()).company_id).toBe(ACME);
    expect((await admin1().get(`/portal-access/contacts/${sam.id}`)).body).toMatchObject({
      scope: 'company',
      pendingRequest: null,
    });
  });

  it('deny keeps them to their own tickets; allow and revoke from the profile', async () => {
    await signUp({
      firstName: 'Dee',
      lastName: 'Nied',
      email: 'dee@acme-pt.example.com',
      password: 'Str0ng!Passw0rd',
    });
    await verify('dee@acme-pt.example.com');
    const dee = await db('users').where('email', 'dee@acme-pt.example.com').first();
    const req = await db('portal_access_requests').where('user_id', dee.id).first();
    await admin1().post(`/portal-access/requests/${req.id}/decide`, { decision: 'deny' });
    expect((await db('users').where('id', dee.id).first()).portal_scope).toBe('own');
    const deeApi = await login('dee@acme-pt.example.com');
    expect([403, 404]).toContain((await deeApi.get(`/tickets/${coworkerTicket}`)).status);

    expect((await admin1().post(`/portal-access/contacts/${dee.id}/allow`)).status).toBe(200);
    expect((await deeApi.get(`/tickets/${coworkerTicket}`)).status).toBe(200);
    expect((await admin1().post(`/portal-access/contacts/${dee.id}/revoke`)).status).toBe(200);
    expect([403, 404]).toContain((await deeApi.get(`/tickets/${coworkerTicket}`)).status);
    // Another subscriber's admin can't touch Gleason's contacts
    const other = as(tokenFor(OTHER_ADMIN, 'boss@other-pt.example.com', 'admin'));
    expect((await other.post(`/portal-access/contacts/${dee.id}/allow`)).status).toBe(404);
  });

  it("isn't a way into another subscriber's portal", async () => {
    const pat = await login('pat@acme-pt.example.com');
    expect((await pat.get('/portal/other-pt/session')).status).toBe(403);
    expect(
      (await pat.post('/portal/other-pt/tickets', { title: 'x', description: 'y' })).status
    ).toBe(403);
    const staff = await login('agent@gleason-pt.example.com');
    expect((await staff.get('/portal/gleason/session')).status).toBe(403);
  });

  it('a contact an agent adds can see their company’s tickets', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokenFor(AGENT, 'agent@gleason-pt.example.com', 'employee')}`)
      .send({
        firstName: 'Al',
        lastName: 'Added',
        email: 'al@acme-pt.example.com',
        password: 'Str0ng!Passw0rd',
        role: 'customer',
      });
    expect(res.status).toBe(201);
    expect((await db('users').where('email', 'al@acme-pt.example.com').first()).portal_scope).toBe(
      'company'
    );
  });
});
