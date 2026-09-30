import crypto from 'crypto';
import request from 'supertest';

// Thumbnailing uses sharp, which needs a newer Node than some dev machines
// have; the image itself isn't what's under test here.
jest.mock('sharp', () => {
  const chain = {
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue(undefined),
  };
  return jest.fn(() => chain);
});
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { EmailService } from '../src/services/EmailService';
import { verifySvixSignature } from '../src/routes/inboundEmail';
import { stripQuotedReply, bodyText } from '../src/services/InboundEmailService';
import { resetDatabase } from './helpers/db';

/**
 * Email for tickets: mail to <slug>@support.bomizzel.com becomes a ticket for
 * that subscriber, replies land on the right ticket (only when the sender is
 * allowed on it), and public staff notes are emailed to the customer.
 */

const SECRET = `whsec_${Buffer.from('test-signing-secret-0123456789').toString('base64')}`;
const DOMAIN = 'support.bomizzel.com';

const A = '00000000-0000-4000-8000-00000000c001';
const B = '00000000-0000-4000-8000-00000000c002';
const A_ACCOUNT = '00000000-0000-4000-8000-00000000c003';
const A_AGENT = '00000000-0000-4000-8000-00000000c004';
const A_CONTACT = '00000000-0000-4000-8000-00000000c005';
const A_TEAM = '00000000-0000-4000-8000-00000000c006';
const A_QUEUE = '00000000-0000-4000-8000-00000000c007';
const B_TEAM = '00000000-0000-4000-8000-00000000c008';
const B_QUEUE = '00000000-0000-4000-8000-00000000c009';
const B_ACCOUNT = '00000000-0000-4000-8000-00000000c00a';
const B_CONTACT = '00000000-0000-4000-8000-00000000c00b';

// What the Resend "get received email" API returns for each id.
const received: Record<string, any> = {};
// Attachment bytes by attachment id, served from a fake signed download URL.
const files: Record<string, Buffer> = {};
let seq = 0;

const deliver = async (mail: {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  dmarc?: string;
  id?: string;
  attachments?: Array<{ filename: string; type: string; bytes: Buffer; inline?: boolean }>;
}) => {
  const id = mail.id || `email-${++seq}`;
  const attachments = (mail.attachments || []).map((a, i) => {
    const attachmentId = `${id}-att-${i}`;
    files[attachmentId] = a.bytes;
    return {
      id: attachmentId,
      filename: a.filename,
      content_type: a.type,
      content_disposition: a.inline ? 'inline' : 'attachment',
      size: a.bytes.length,
    };
  });
  received[id] = {
    id,
    from: mail.from,
    to: mail.to,
    cc: [],
    received_for: [],
    subject: mail.subject,
    text: mail.text ?? null,
    html: mail.html ?? null,
    headers: { from: mail.from, ...(mail.headers || {}) },
    authentication: { spf: 'pass', dkim: 'pass', dmarc: mail.dmarc || 'pass' },
    message_id: `<${id}@mail.example.com>`,
    attachments,
  };
  const body = JSON.stringify({
    type: 'email.received',
    created_at: new Date().toISOString(),
    data: { email_id: id, from: mail.from, to: mail.to, subject: mail.subject },
  });
  const svixId = `msg_${id}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(SECRET.slice(6), 'base64');
  const signature = crypto
    .createHmac('sha256', key)
    .update(`${svixId}.${timestamp}.${body}`)
    .digest('base64');
  return request(app)
    .post('/api/inbound/email/resend')
    .set('Content-Type', 'application/json')
    .set('svix-id', svixId)
    .set('svix-timestamp', timestamp)
    .set('svix-signature', `v1,${signature}`)
    .send(body);
};

const ticketsOf = (tenant: string) => db('tickets').where('org_id', tenant).orderBy('created_at');

let sendSpy: jest.SpyInstance;
const realFetch = global.fetch;

beforeAll(async () => {
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  process.env.RESEND_RECEIVING_API_KEY = 're_test';
  process.env.INBOUND_EMAIL_DOMAIN = DOMAIN;

  // Resend's API: serve the stored message for GET /emails/receiving/:id
  global.fetch = jest.fn(async (url: any) => {
    const u = String(url);
    if (u.startsWith('https://files.example.com/')) {
      const bytes = files[u.slice('https://files.example.com/'.length)];
      return { ok: !!bytes, status: bytes ? 200 : 404, arrayBuffer: async () => bytes } as any;
    }
    const attachment = u.match(/\/attachments\/([^/?]+)$/);
    if (attachment) {
      const attachmentId = decodeURIComponent(attachment[1]);
      return {
        ok: true,
        status: 200,
        json: async () => ({ download_url: `https://files.example.com/${attachmentId}` }),
      } as any;
    }
    const id = decodeURIComponent(u.split('/emails/receiving/')[1] || '');
    if (!received[id]) return { ok: false, status: 404, json: async () => ({}) } as any;
    return { ok: true, status: 200, json: async () => received[id] } as any;
  }) as any;

  jest.spyOn(EmailService, 'isInitialized').mockReturnValue(true);
  let outbound = 0;
  sendSpy = jest.spyOn(EmailService, 'send').mockImplementation(async () => `out-${++outbound}`);

  await resetDatabase();
  await db('companies').insert([
    { id: A, name: 'Acme Desk', domain: 'acme-desk.example.com', support_email_slug: 'acme' },
    { id: B, name: 'Beta Desk', domain: 'beta-desk.example.com', support_email_slug: 'beta' },
    { id: A_ACCOUNT, name: 'Globex', domain: 'globex.example.com', subscriber_id: A },
    { id: B_ACCOUNT, name: 'Initrode', domain: 'initrode.example.com', subscriber_id: B },
  ]);
  const user = (id: string, email: string, role: string, org: string) => ({
    id,
    email,
    password_hash: 'x',
    first_name: email.split('@')[0],
    last_name: 'Test',
    role,
    is_active: true,
    email_verified: true,
    current_org_id: org,
  });
  await db('users').insert([
    user(A_AGENT, 'agent@acme-desk.example.com', 'employee', A),
    user(A_CONTACT, 'pat@globex.example.com', 'customer', A),
    user(B_CONTACT, 'sam@initrode.example.com', 'customer', B),
  ]);
  await db('user_company_associations').insert([
    { user_id: A_AGENT, company_id: A, role: 'member' },
    { user_id: A_CONTACT, company_id: A_ACCOUNT, role: 'member' },
    { user_id: B_CONTACT, company_id: B_ACCOUNT, role: 'member' },
  ]);
  await db('teams').insert([
    { id: A_TEAM, name: 'Support', org_id: A },
    { id: B_TEAM, name: 'Support', org_id: B },
  ]);
  await db('team_memberships').insert({ user_id: A_AGENT, team_id: A_TEAM, role: 'member' });
  await db('queues').insert([
    { id: A_QUEUE, name: 'Inbox', type: 'unassigned', team_id: A_TEAM, org_id: A },
    { id: B_QUEUE, name: 'Inbox', type: 'unassigned', team_id: B_TEAM, org_id: B },
  ]);
  await db('departments').insert([
    { name: 'General', company_id: A, org_id: A, is_default: true },
    { name: 'General', company_id: B, org_id: B, is_default: true },
  ]);
});

afterAll(() => {
  global.fetch = realFetch;
});

beforeEach(() => sendSpy.mockClear());

describe('webhook signature', () => {
  it('refuses a request that is not signed with the secret', async () => {
    const res = await request(app)
      .post('/api/inbound/email/resend')
      .set('svix-id', 'x')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,bm90LWEtcmVhbC1zaWduYXR1cmU=')
      .send({ type: 'email.received', data: { email_id: 'forged' } });
    expect(res.status).toBe(401);
  });

  it('refuses an old timestamp even with a valid signature', () => {
    const body = '{}';
    const ts = String(Math.floor(Date.now() / 1000) - 3600);
    const sig = crypto
      .createHmac('sha256', Buffer.from(SECRET.slice(6), 'base64'))
      .update(`id.${ts}.${body}`)
      .digest('base64');
    expect(
      verifySvixSignature(SECRET, { id: 'id', timestamp: ts, signature: `v1,${sig}` }, body)
    ).toBe(false);
  });
});

describe('new tickets by email', () => {
  it("opens a ticket for the subscriber, in the known contact's account, and sends a receipt", async () => {
    const res = await deliver({
      from: 'Pat <pat@globex.example.com>',
      to: [`acme@${DOMAIN}`],
      subject: 'Printer is on fire',
      text: 'Please help, it is quite literally on fire.',
    });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('ticket_created');

    const ticket = await db('tickets').where('id', res.body.ticketId).first();
    expect(ticket).toMatchObject({
      org_id: A,
      company_id: A_ACCOUNT,
      submitter_id: A_CONTACT,
      title: 'Printer is on fire',
      source: 'email',
      team_id: A_TEAM,
      queue_id: A_QUEUE,
    });
    expect(ticket.department_id).not.toBeNull();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const receipt = sendSpy.mock.calls[0][0];
    expect(receipt.to).toEqual(['pat@globex.example.com']);
    expect(receipt.fromName).toBe('Acme Desk Support');
    const token = ticket.id.replace(/-/g, '').slice(0, 12);
    expect(receipt.replyTo).toBe(`acme+${token}@${DOMAIN}`);
    // Sent from the ticket's support address itself, so replies reach it
    // even when a mail app ignores Reply-To.
    expect(receipt.fromAddress).toBe(`acme+${token}@${DOMAIN}`);
    expect(receipt.subject).toContain(`[#${token}]`);
  });

  it('ignores the same email delivered twice', async () => {
    const before = (await ticketsOf(A)).length;
    await deliver({
      id: 'dup-1',
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'Once',
      text: 'x',
    });
    const again = await deliver({
      id: 'dup-1',
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'Once',
      text: 'x',
    });
    expect(again.body).toEqual({ outcome: 'ignored', reason: 'duplicate' });
    expect((await ticketsOf(A)).length).toBe(before + 1);
  });

  it("puts a new sender in the account with their email's domain", async () => {
    const res = await deliver({
      from: 'Lee <lee@globex.example.com>',
      to: [`acme@${DOMAIN}`],
      subject: 'Login',
      text: 'x',
    });
    const ticket = await db('tickets').where('id', res.body.ticketId).first();
    expect(ticket.company_id).toBe(A_ACCOUNT);
    const lee = await db('users').where('email', 'lee@globex.example.com').first();
    expect(lee).toMatchObject({ role: 'customer', first_name: 'Lee', email_verified: false });
  });

  it('creates an account for a new company domain', async () => {
    const res = await deliver({
      from: 'kim@newco.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'Hi',
      text: 'x',
    });
    const ticket = await db('tickets').where('id', res.body.ticketId).first();
    const account = await db('companies').where('id', ticket.company_id).first();
    expect(account).toMatchObject({
      name: 'newco.example.com',
      domain: 'newco.example.com',
      subscriber_id: A,
    });
  });

  it('gives each personal-email sender their own account, so they never share tickets', async () => {
    const one = await deliver({
      from: 'Ann <ann@gmail.com>',
      to: [`acme@${DOMAIN}`],
      subject: 'a',
      text: 'x',
    });
    const two = await deliver({
      from: 'Bob <bob@gmail.com>',
      to: [`acme@${DOMAIN}`],
      subject: 'b',
      text: 'x',
    });
    const t1 = await db('tickets').where('id', one.body.ticketId).first();
    const t2 = await db('tickets').where('id', two.body.ticketId).first();
    expect(t1.company_id).not.toBe(t2.company_id);
    expect(await db('companies').where('domain', 'gmail.com').first()).toBeUndefined();
  });

  it('uses HTML when there is no plain text', async () => {
    const res = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'html only',
      html: '<p>First line</p><p>Second &amp; last</p>',
    });
    const ticket = await db('tickets').where('id', res.body.ticketId).first();
    expect(ticket.description).toBe('First line\nSecond & last');
  });
});

describe('replies', () => {
  let ticketId: string;
  let token: string;

  beforeAll(async () => {
    const res = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'Thread',
      text: 'start',
    });
    ticketId = res.body.ticketId;
    token = ticketId.replace(/-/g, '').slice(0, 12);
  });

  it("adds the customer's reply to the ticket, without the quoted history", async () => {
    await db('tickets').where('id', ticketId).update({ status: 'resolved' });
    const res = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme+${token}@${DOMAIN}`],
      subject: `Re: [#${token}] Thread`,
      text: 'Still broken.\n\nOn Mon, Sep 29, 2026 at 9:00 AM Acme Desk Support wrote:\n> We fixed it',
    });
    expect(res.body).toEqual({ outcome: 'note_added', ticketId });
    const note = await db('ticket_notes')
      .where('ticket_id', ticketId)
      .orderBy('created_at', 'desc')
      .first();
    expect(note).toMatchObject({
      content: 'Still broken.',
      is_internal: false,
      is_email_generated: true,
      author_id: A_CONTACT,
    });
    // A customer writing back reopens a resolved ticket.
    expect((await db('tickets').where('id', ticketId).first()).status).toBe('open');
  });

  it('a co-worker at the same account can reply on it too', async () => {
    const res = await deliver({
      from: 'lee@globex.example.com',
      to: [`acme+${token}@${DOMAIN}`],
      subject: 'Re: x',
      text: 'Same here',
    });
    expect(res.body.outcome).toBe('note_added');
  });

  it("someone who isn't on the ticket gets a new ticket instead of posting into it", async () => {
    const res = await deliver({
      from: 'stranger@evil.example.com',
      to: [`acme+${token}@${DOMAIN}`],
      subject: 'Re: x',
      text: 'let me in',
    });
    expect(res.body.outcome).toBe('ticket_created');
    expect(res.body.ticketId).not.toBe(ticketId);
  });

  it("another subscriber's ticket token doesn't reach across", async () => {
    const [bTicket] = await db('tickets')
      .insert({
        title: 'B ticket',
        description: 'd',
        submitter_id: B_CONTACT,
        company_id: B_ACCOUNT,
        org_id: B,
        team_id: B_TEAM,
        queue_id: B_QUEUE,
        status: 'open',
        priority: 0,
      })
      .returning('*');
    const bToken = bTicket.id.replace(/-/g, '').slice(0, 12);
    const res = await deliver({
      from: 'sam@initrode.example.com',
      to: [`acme+${bToken}@${DOMAIN}`],
      subject: 'Re: x',
      text: 'hi',
    });
    // Sent to Acme's address, so it's Acme's (new) ticket; B's ticket is untouched.
    expect(res.body.outcome).toBe('ticket_created');
    expect(await db('ticket_notes').where('ticket_id', bTicket.id)).toHaveLength(0);
    expect((await db('tickets').where('id', res.body.ticketId).first()).org_id).toBe(A);
  });
});

describe('attachments', () => {
  // A "screenshot" big enough not to be taken for a signature logo, and a logo.
  const png = (size: number) =>
    Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(size, 1)]);
  const screenshot = png(20 * 1024);
  const logo = png(600);

  it('saves an emailed screenshot on the new ticket, skipping signature logos and disallowed files', async () => {
    expect(screenshot.length).toBeGreaterThan(5 * 1024);
    const res = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'See screenshot',
      text: 'Error attached',
      attachments: [
        { filename: 'error.png', type: 'image/png', bytes: screenshot },
        { filename: 'logo.png', type: 'image/png', bytes: logo, inline: true },
        { filename: 'virus.exe', type: 'application/x-msdownload', bytes: Buffer.from('MZ') },
      ],
    });
    expect(res.body.outcome).toBe('ticket_created');
    const saved = await db('file_attachments').where('ticket_id', res.body.ticketId);
    expect(saved.map((f: any) => f.original_name)).toEqual(['error.png']);
    expect(saved[0]).toMatchObject({ is_image: true, uploaded_by_id: A_CONTACT });
  });

  it("links a reply's attachment to that reply's note", async () => {
    const first = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'Two',
      text: 'x',
    });
    const token = first.body.ticketId.replace(/-/g, '').slice(0, 12);
    const reply = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme+${token}@${DOMAIN}`],
      subject: 'Re: Two',
      text: 'Here it is',
      attachments: [
        { filename: 'report.pdf', type: 'application/pdf', bytes: Buffer.from('%PDF-1.4 test') },
      ],
    });
    expect(reply.body.outcome).toBe('note_added');
    const note = await db('ticket_notes')
      .where('ticket_id', first.body.ticketId)
      .orderBy('created_at', 'desc')
      .first();
    const saved = await db('file_attachments').where('ticket_id', first.body.ticketId);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ original_name: 'report.pdf', note_id: note.id });
  });
});

describe('mail that is ignored', () => {
  it.each([
    ['an auto-reply', { headers: { 'Auto-Submitted': 'auto-replied' } }, 'automated'],
    ['a failed DMARC check', { dmarc: 'fail' }, 'dmarc fail'],
    ['a no-reply sender', { from: 'no-reply@shop.example.com' }, 'automated'],
    ['mail from our own domain', { from: `acme@${DOMAIN}` }, 'own address'],
    ['an unknown support address', { to: [`nobody@${DOMAIN}`] }, 'unknown support address'],
  ])('%s', async (_label, extra: any, reason) => {
    const before = (await db('tickets')).length;
    const res = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'x',
      text: 'x',
      ...extra,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ outcome: 'ignored', reason });
    expect((await db('tickets')).length).toBe(before);
  });
});

describe('emailing notes to the customer', () => {
  let ticketId: string;
  const agentToken = () =>
    JWTUtils.generateAccessToken({
      userId: A_AGENT,
      email: 'agent@acme-desk.example.com',
      role: 'employee',
    });

  beforeAll(async () => {
    const res = await deliver({
      from: 'pat@globex.example.com',
      to: [`acme@${DOMAIN}`],
      subject: 'Notes',
      text: 'x',
    });
    ticketId = res.body.ticketId;
  });

  const waitForSend = async () => {
    for (let i = 0; i < 50 && sendSpy.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
  };

  it('a public note from staff is emailed to the customer, with the reply address', async () => {
    sendSpy.mockClear();
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${agentToken()}`)
      .send({ content: 'Have you tried turning it off and on again?' });
    expect(res.status).toBe(201);
    await waitForSend();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const mail = sendSpy.mock.calls[0][0];
    expect(mail.to).toEqual(['pat@globex.example.com']);
    expect(mail.text).toContain('Have you tried turning it off and on again?');
    expect(mail.replyTo).toBe(`acme+${ticketId.replace(/-/g, '').slice(0, 12)}@${DOMAIN}`);
  });

  it('falls back to the platform address if the support address is refused', async () => {
    sendSpy.mockClear();
    sendSpy.mockRejectedValueOnce(new Error('Resend 403: domain not verified'));
    await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${agentToken()}`)
      .send({ content: 'Second try' });
    for (let i = 0; i < 50 && sendSpy.mock.calls.length < 2; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy.mock.calls[1][0].fromAddress).toBeUndefined();
    expect(sendSpy.mock.calls[1][0].replyTo).toContain(`@${DOMAIN}`);
  });

  it('an internal note is never emailed', async () => {
    sendSpy.mockClear();
    await request(app)
      .post(`/api/tickets/${ticketId}/notes`)
      .set('Authorization', `Bearer ${agentToken()}`)
      .send({ content: 'The customer is wrong, as usual.', isInternal: true });
    await new Promise((r) => setTimeout(r, 200));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("staff see their subscriber's support address", async () => {
    const res = await request(app)
      .get('/api/email/support-address')
      .set('Authorization', `Bearer ${agentToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.address).toBe(`acme@${DOMAIN}`);
  });
});

describe('reply parsing', () => {
  it('keeps only the new part of common reply formats', () => {
    expect(stripQuotedReply('Thanks!\n\nOn Tue, 30 Sep 2026, Acme <x@y> wrote:\n> old')).toBe(
      'Thanks!'
    );
    expect(stripQuotedReply('Fixed.\n-----Original Message-----\nFrom: a')).toBe('Fixed.');
    expect(stripQuotedReply('Ok\n\nFrom: Acme Support\nSent: Tuesday\nTo: me')).toBe('Ok');
    expect(stripQuotedReply('Yes\n— Reply above this line to add to your ticket —\nold')).toBe(
      'Yes'
    );
    expect(stripQuotedReply('No quote at all')).toBe('No quote at all');
  });

  it('reads HTML sent as a data URI', () => {
    const html = `data:text/html;base64,${Buffer.from('<p>Hi <b>there</b></p>').toString('base64')}`;
    expect(bodyText({ text: null, html })).toBe('Hi there');
  });
});
