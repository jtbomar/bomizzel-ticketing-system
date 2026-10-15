import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { EmailService } from '../src/services/EmailService';
import { TicketEmailService } from '../src/services/TicketEmailService';
import { TicketStatus } from '../src/models/TicketStatus';
import { resetDatabase } from './helpers/db';

/**
 * Branded email to a subscriber's customers: its logo, colour, name and
 * signature (the agent's own, else the company's) on the welcome email,
 * password resets and ticket mail; Bomizzel's look for staff.
 */
describe('branded customer email', () => {
  const SUB = '00000000-0000-4000-8000-0000000dd001';
  const ACME = '00000000-0000-4000-8000-0000000dd002';
  const ADMIN = '00000000-0000-4000-8000-0000000dd003';
  const AGENT = '00000000-0000-4000-8000-0000000dd004';
  const CONTACT = '00000000-0000-4000-8000-0000000dd005';
  const TEAM = '00000000-0000-4000-8000-0000000dd006';
  const QUEUE = '00000000-0000-4000-8000-0000000dd007';
  // A 1x1 PNG
  const PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  let adminToken: string;
  let agentToken: string;
  const mails: any[] = [];
  const saved: any = {};

  const as = (token: string) => ({
    get: (path: string) => request(app).get(`/api${path}`).set('Authorization', `Bearer ${token}`),
    put: (path: string, body: object) =>
      request(app).put(`/api${path}`).set('Authorization', `Bearer ${token}`).send(body),
    post: (path: string, body: object = {}) =>
      request(app).post(`/api${path}`).set('Authorization', `Bearer ${token}`).send(body),
  });

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
        name: 'Gleason EB',
        domain: 'gleason-eb.example.com',
        support_email_slug: 'gleason-eb',
      },
      { id: ACME, name: 'Acme EB', domain: 'acme-eb.example.com', subscriber_id: SUB },
    ]);
    const user = (id: string, email: string, role: string, first: string) => ({
      id,
      email,
      password_hash: 'x',
      first_name: first,
      last_name: 'Test',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: SUB,
    });
    await db('users').insert([
      user(ADMIN, 'admin@gleason-eb.example.com', 'admin', 'Ada'),
      user(AGENT, 'agent@gleason-eb.example.com', 'employee', 'Gus'),
      user(CONTACT, 'pat@acme-eb.example.com', 'customer', 'Pat'),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
    ]);
    await db('company_profiles').insert({
      company_id: SUB,
      company_name: 'Gleason Power Services',
      tagline: 'Power when you need it',
      linkback_url: 'https://gleason-eb.example.com',
      primary_color: '#0F766E',
      logo: `data:image/png;base64,${PNG}`,
    });
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await TicketStatus.seedDefaultStatuses(TEAM);
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });
    adminToken = JWTUtils.generateAccessToken({
      userId: ADMIN,
      email: 'admin@gleason-eb.example.com',
      role: 'admin',
    });
    agentToken = JWTUtils.generateAccessToken({
      userId: AGENT,
      email: 'agent@gleason-eb.example.com',
      role: 'employee',
    });
  });

  afterAll(() => {
    Object.assign(EmailService as any, saved);
  });

  it('serves the logo publicly, for mail apps', async () => {
    const res = await request(app).get(`/api/public/brand-logo/${SUB}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect((await request(app).get(`/api/public/brand-logo/${ACME}`)).status).toBe(404);
    expect((await request(app).get('/api/public/brand-logo/nope')).status).toBe(404);

    // The portal's tab icon: no favicon uploaded, so the logo
    const portal = await request(app).get('/api/portal/gleason-eb');
    expect(portal.body.iconUrl).toContain(`/api/public/brand-logo/${SUB}`);
    expect((await request(app).get(`/api/public/brand-favicon/${SUB}`)).status).toBe(404);
    await db('company_profiles')
      .where('company_id', SUB)
      .update({ favicon: `data:image/png;base64,${PNG}` });
    expect((await request(app).get('/api/portal/gleason-eb')).body.iconUrl).toContain(
      `/api/public/brand-favicon/${SUB}`
    );
    const icon = await request(app).get(`/api/public/brand-favicon/${SUB}`);
    expect(icon.status).toBe(200);
    expect(icon.headers['content-type']).toBe('image/png');
  });

  it('sets the portal’s background and welcome, and the portal shows them', async () => {
    const put = (body: object) => as(adminToken).put('/company-registration/branding', body);
    expect((await put({ portalBackground: 'data:image/gif;base64,R0lGOD' })).status).toBe(400);
    expect((await put({ portalBackground: 'https://example.com/x.jpg' })).status).toBe(400);
    const res = await put({
      portalBackground: `data:image/png;base64,${PNG}`,
      portalWelcomeTitle: '  Welcome to Gleason support  ',
      portalWelcomeText: 'Call us for emergencies.',
    });
    expect(res.status).toBe(200);

    const portal = (await request(app).get('/api/portal/gleason-eb')).body;
    expect(portal.backgroundUrl).toContain(`/api/public/portal-background/${SUB}`);
    expect(portal).toMatchObject({
      welcomeTitle: 'Welcome to Gleason support',
      welcomeText: 'Call us for emergencies.',
    });
    const pic = await request(app).get(`/api/public/portal-background/${SUB}`);
    expect(pic.status).toBe(200);
    expect(pic.headers['content-type']).toBe('image/png');
    const branding = (await as(agentToken).get('/company-registration/branding')).body.data;
    expect(branding.portalBackgroundUrl).toContain('/portal-background/');
    // The picture isn't sent back whole with the branding
    expect(JSON.stringify(branding)).not.toContain(PNG.slice(0, 40) + 'X');

    // Saving other branding leaves it alone; '' removes it
    await put({ tagline: 'Power when you need it' });
    expect((await request(app).get('/api/portal/gleason-eb')).body.backgroundUrl).toBeTruthy();
    await put({ portalBackground: '', portalWelcomeTitle: '' });
    const after = (await request(app).get('/api/portal/gleason-eb')).body;
    expect(after.backgroundUrl).toBeNull();
    expect(after.welcomeTitle).toBeNull();
    expect((await request(app).get(`/api/public/portal-background/${SUB}`)).status).toBe(404);
  });

  it('saves the company signature and the auto-welcome setting (cleaned)', async () => {
    const res = await as(adminToken).put('/company-registration/branding', {
      emailSignature: '<p>The Gleason Team<script>alert(1)</script></p>',
      autoInviteContacts: true,
    });
    expect(res.status).toBe(200);
    const got = (await as(agentToken).get('/company-registration/branding')).body.data;
    expect(got.emailSignature).toBe('<p>The Gleason Team</p>');
    expect(got.autoInviteContacts).toBe(true);
    // The rest of the branding is untouched
    expect(got.companyName).toBe('Gleason Power Services');
    // Agents can't change it
    expect(
      (await as(agentToken).put('/company-registration/branding', { autoInviteContacts: false }))
        .status
    ).toBe(403);
  });

  it("an agent's own signature", async () => {
    expect((await as(agentToken).get('/email-branding/my-signature')).body.html).toBe('');
    const res = await as(agentToken).put('/email-branding/my-signature', {
      html: '<p onclick="x()">Gus Test · Service Manager</p>',
    });
    expect(res.status).toBe(200);
    expect(res.body.html).toBe('<p>Gus Test · Service Manager</p>');
    expect((await as(agentToken).get('/email-branding/my-signature')).body.html).toBe(
      '<p>Gus Test · Service Manager</p>'
    );
  });

  it('the welcome email: brand, from the support address, signed by the agent', async () => {
    mails.length = 0;
    const res = await as(agentToken).post(`/users/${CONTACT}/send-invitation`);
    expect(res.status).toBe(200);
    expect(mails).toHaveLength(1);
    const m = mails[0];
    expect(m.subject).toBe('Welcome to Gleason Power Services support');
    expect(m.from).toMatch(/^"Gleason Power Services" <gleason-eb@support\./);
    expect(m.replyTo).toMatch(/^gleason-eb@support\./);
    expect(m.html).toContain(`/api/public/brand-logo/${SUB}?v=`);
    expect(m.html).toContain('#0f766e');
    expect(m.html).toContain('Gus Test · Service Manager');
    expect(m.html).toContain('Power when you need it');
    expect(m.html).not.toContain('data:image');
    expect(m.text).toContain('Gus Test · Service Manager');
    expect(m.text).toContain('/reset-password?token=');
  });

  it("an admin with no signature of their own signs with the company's", async () => {
    mails.length = 0;
    await as(adminToken).post(`/users/${CONTACT}/send-invitation`);
    expect(mails[0].html).toContain('The Gleason Team');
    expect(mails[0].html).not.toContain('Service Manager');
  });

  it('password resets: branded for customers, Bomizzel for staff', async () => {
    mails.length = 0;
    await request(app).post('/api/auth/forgot-password').send({ email: 'pat@acme-eb.example.com' });
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'agent@gleason-eb.example.com' });
    expect(mails).toHaveLength(2);
    expect(mails[0].subject).toBe('Reset your password for Gleason Power Services support');
    expect(mails[0].html).toContain('#0f766e');
    expect(mails[1].subject).toBe('Reset your Bomizzel password');
    expect(mails[1].from).toBe('Bomizzel <noreply@bomizzel.com>');
    expect(mails[1].html).not.toContain('Gleason');
  });

  it("ticket mail: the agent's signature on replies, the company's on the receipt", async () => {
    const [ticket] = await db('tickets')
      .insert({
        title: 'Generator knocking',
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
    const [byAgent, byAdmin] = await db('ticket_notes')
      .insert([
        { ticket_id: ticket.id, author_id: AGENT, content: 'Coming Thursday', org_id: SUB },
        { ticket_id: ticket.id, author_id: ADMIN, content: 'Parts ordered', org_id: SUB },
      ])
      .returning('*');

    mails.length = 0;
    expect(await TicketEmailService.sendNote(ticket.id, byAgent.id)).toBe(true);
    expect(await TicketEmailService.sendNote(ticket.id, byAdmin.id)).toBe(true);
    expect(await TicketEmailService.sendReceipt(ticket.id)).toBe(true);
    const [agentMail, adminMail, receipt] = mails;
    expect(agentMail.from).toMatch(/^"Gleason Power Services Support"/);
    expect(agentMail.html).toContain('Gus Test · Service Manager');
    expect(agentMail.html).toContain('#0f766e');
    expect(adminMail.html).toContain('The Gleason Team');
    expect(receipt.html).toContain('The Gleason Team');
    expect(receipt.text).toContain('The Gleason Team');
  });

  it('previews what customers get, with a signature not saved yet', async () => {
    const res = await as(agentToken).get(
      '/email-branding/preview?kind=reply&mine=1&signature=' +
        encodeURIComponent('<p>Draft sig</p>')
    );
    expect(res.status).toBe(200);
    expect(res.body.from).toBe('Gleason Power Services Support');
    expect(res.body.html).toContain('Draft sig');
    // An empty draft of your own falls back to the company's
    const empty = await as(agentToken).get('/email-branding/preview?kind=reply&mine=1&signature=');
    expect(empty.body.html).toContain('The Gleason Team');
    const welcome = await as(agentToken).get('/email-branding/preview?kind=welcome');
    expect(welcome.body.subject).toBe('Welcome to Gleason Power Services support');
  });

  it('customers can’t use the staff-only endpoints', async () => {
    const contactToken = JWTUtils.generateAccessToken({
      userId: CONTACT,
      email: 'pat@acme-eb.example.com',
      role: 'customer',
    });
    expect((await as(contactToken).get('/email-branding/preview?kind=welcome')).status).toBe(403);
    expect((await as(contactToken).put('/email-branding/my-signature', { html: 'x' })).status).toBe(
      403
    );
  });
});
