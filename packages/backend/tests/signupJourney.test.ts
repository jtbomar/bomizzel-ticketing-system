import request from 'supertest';

// Capture the links instead of sending mail.
const sent: Array<{ kind: string; email: string; token: string }> = [];
jest.mock('../src/services/AccountEmailService', () => ({
  AccountEmailService: {
    sendVerification: jest.fn(async (user: { email: string }, token: string) => {
      sent.push({ kind: 'verify', email: user.email, token });
      return true;
    }),
    sendPasswordReset: jest.fn(async () => true),
    sendInvitation: jest.fn(async (user: { email: string }, token: string) => {
      sent.push({ kind: 'invite', email: user.email, token });
      return true;
    }),
  },
}));

import { app } from '../src/index';
import { db } from '../src/config/database';
import { resetDatabase } from './helpers/db';

/**
 * A business that finds the site and signs up, end to end: it gets its own
 * subscriber with everything it needs (team, queue, departments, support
 * address), the owner signs in after confirming their email, adds a
 * customer, and raises a ticket - and sees nothing of anyone else's.
 */
describe('a new business signs up', () => {
  const owner = { email: 'Owner@NewBiz.example.com', password: 'Str0ng!Passw0rd' };
  let token: string;
  let subscriberId: string;

  const as = () => ({
    get: (path: string) => request(app).get(`/api${path}`).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object) =>
      request(app).post(`/api${path}`).set('Authorization', `Bearer ${token}`).send(body),
  });

  beforeAll(async () => {
    await resetDatabase();
    // Someone else already on the platform, with a ticket
    await db('companies').insert({
      id: '00000000-0000-4000-8000-0000000aa001',
      name: 'Existing Subscriber',
      domain: 'existing.example.com',
    });
  });

  it('signs up a company and its owner, and emails a confirmation link', async () => {
    const res = await request(app).post('/api/company-registration/register').send({
      companyName: 'New Biz',
      adminFirstName: 'Nora',
      adminLastName: 'Owner',
      adminEmail: owner.email,
      adminPassword: owner.password,
    });
    expect(res.status).toBe(201);
    subscriberId = res.body.data.company.id;

    const company = await db('companies').where('id', subscriberId).first();
    expect(company.subscriber_id).toBeNull(); // a subscriber, not an account
    expect(company.support_email_slug).toBe('new-biz');
    expect(await db('teams').where('org_id', subscriberId)).toHaveLength(1);
    expect(await db('queues').where('org_id', subscriberId)).toHaveLength(1);
    expect((await db('departments').where('company_id', subscriberId)).length).toBeGreaterThan(0);
  });

  it('signs in once the email is confirmed', async () => {
    const link = [...sent].reverse().find((m) => m.kind === 'verify');
    expect(
      (await request(app).post('/api/auth/verify-email').send({ token: link!.token })).status
    ).toBe(200);
    const res = await request(app).post('/api/auth/login').send(owner);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    token = res.body.token;
  });

  it('adds a customer account and contact, and raises a ticket', async () => {
    const account = await as().post('/companies', {
      name: 'First Customer Inc',
      domain: 'firstcustomer.example.com',
    });
    expect(account.status).toBe(201);
    const accountId = (account.body.company || account.body.data || account.body).id;
    expect((await db('companies').where('id', accountId).first()).subscriber_id).toBe(subscriberId);

    const contact = await request(app).post('/api/auth/register').send({
      firstName: 'Cam',
      lastName: 'Customer',
      email: 'cam@firstcustomer.example.com',
      password: 'Str0ng!Passw0rd',
      role: 'customer',
    });
    expect(contact.status).toBe(201);
    const contactId = contact.body.user.id;
    expect(
      (await as().post(`/companies/${accountId}/users`, { userId: contactId, role: 'member' }))
        .status
    ).toBeLessThan(300);

    const team = (await db('teams').where('org_id', subscriberId).first()).id;
    const ticket = await as().post('/tickets', {
      title: 'Our first ticket',
      description: 'Hello',
      companyId: accountId,
      teamId: team,
      submitterId: contactId,
    });
    expect(ticket.status).toBe(201);
    expect(ticket.body.data.ticketNumber).toBe(1001);

    const board = await as().get('/tickets?limit=100');
    expect(board.body.data.map((t: any) => t.title)).toEqual(['Our first ticket']);
  });

  it('sees its own setup and nothing of the other subscriber', async () => {
    expect((await as().get('/fields/tickets')).status).toBe(200);
    const accounts = await as().get('/companies');
    const names = (accounts.body.companies || accounts.body.data || accounts.body).map(
      (c: any) => c.name
    );
    expect(names).not.toContain('Existing Subscriber');
    const departments = (await as().get('/departments')).body;
    expect(departments.length).toBeGreaterThan(0);
  });
});
