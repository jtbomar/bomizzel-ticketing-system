import request from 'supertest';

// Capture the links instead of sending mail.
const sent: Array<{ kind: string; email: string; token: string }> = [];
jest.mock('../src/services/AccountEmailService', () => ({
  AccountEmailService: {
    sendVerification: jest.fn(async (user: { email: string }, token: string) => {
      sent.push({ kind: 'verify', email: user.email, token });
      return true;
    }),
    sendPasswordReset: jest.fn(async (user: { email: string }, token: string) => {
      sent.push({ kind: 'reset', email: user.email, token });
      return true;
    }),
    sendInvitation: jest.fn(async (user: { email: string }, token: string) => {
      sent.push({ kind: 'invite', email: user.email, token });
      return true;
    }),
  },
}));

import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { resetDatabase } from './helpers/db';

/**
 * Nobody can sign in with an email address they haven't proved they own.
 * Sign-up used to create the account already verified and log straight in,
 * so anyone could register a company in someone else's name.
 */
const last = (kind: string, email: string) =>
  [...sent].reverse().find((m) => m.kind === kind && m.email === email.toLowerCase());

const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('email verification', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  describe('company sign-up', () => {
    const signup = {
      companyName: 'Verify Co',
      adminFirstName: 'Vera',
      adminLastName: 'Fy',
      adminEmail: 'Owner@Verify.example.com',
      adminPassword: 'Str0ng!Passw0rd',
    };

    it('creates the company but no login, and emails a link', async () => {
      const res = await request(app).post('/api/company-registration/register').send(signup);
      expect(res.status).toBe(201);
      expect(res.body.data.requiresVerification).toBe(true);
      expect(res.body.data.tokens).toBeUndefined();
      expect(last('verify', signup.adminEmail)).toBeDefined();
    });

    it("can't sign in before confirming", async () => {
      const res = await login(signup.adminEmail, signup.adminPassword);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it("a wrong password doesn't reveal that the account exists", async () => {
      const res = await login(signup.adminEmail, 'not-the-password');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('signs in after opening the link', async () => {
      const { token } = last('verify', signup.adminEmail)!;
      const verify = await request(app).post('/api/auth/verify-email').send({ token });
      expect(verify.status).toBe(200);

      const res = await login(signup.adminEmail, signup.adminPassword);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it('a used or made-up link is refused', async () => {
      const { token } = last('verify', signup.adminEmail)!;
      expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
      expect(
        (await request(app).post('/api/auth/verify-email').send({ token: 'made-up' })).status
      ).toBe(400);
    });
  });

  describe('public contact sign-up and resend', () => {
    const contact = {
      email: 'person@contact.example.com',
      password: 'Str0ng!Passw0rd',
      firstName: 'Per',
      lastName: 'Son',
    };

    it('returns no token and emails a link', async () => {
      const res = await request(app).post('/api/auth/register').send(contact);
      expect(res.status).toBe(201);
      expect(res.body.requiresVerification).toBe(true);
      expect(res.body.token).toBeUndefined();
      expect(last('verify', contact.email)).toBeDefined();
      expect((await login(contact.email, contact.password)).status).toBe(403);
    });

    it('resend sends a fresh link, and answers the same for unknown addresses', async () => {
      const before = last('verify', contact.email)!.token;
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: contact.email });
      expect(res.status).toBe(200);
      expect(last('verify', contact.email)!.token).not.toBe(before);

      const unknown = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody@nowhere.example.com' });
      expect(unknown.status).toBe(200);
      expect(unknown.body.message).toBe(res.body.message);
    });
  });

  describe('forgot password', () => {
    it('emails a reset link that works, and confirms the address', async () => {
      const email = 'person@contact.example.com';
      const res = await request(app).post('/api/auth/forgot-password').send({ email });
      expect(res.status).toBe(200);
      const { token } = last('reset', email)!;

      const reset = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'N3w!Passw0rd' });
      expect(reset.status).toBe(200);

      // The link came to their inbox, so they're verified now too.
      expect((await login(email, 'N3w!Passw0rd')).status).toBe(200);
    });
  });

  describe('contact invitations', () => {
    const SUB = '00000000-0000-4000-8000-00000000b001';
    const OTHER = '00000000-0000-4000-8000-00000000b002';
    const ACCOUNT = '00000000-0000-4000-8000-00000000b003';
    const OTHER_ACCOUNT = '00000000-0000-4000-8000-00000000b004';
    const AGENT = '00000000-0000-4000-8000-00000000b005';
    const CONTACT = '00000000-0000-4000-8000-00000000b006';
    const OTHER_CONTACT = '00000000-0000-4000-8000-00000000b007';
    let agentToken: string;

    beforeAll(async () => {
      await db('companies').insert([
        { id: SUB, name: 'Invite Sub', domain: 'invite.example.com' },
        { id: OTHER, name: 'Other Sub', domain: 'other-invite.example.com' },
        { id: ACCOUNT, name: 'Acct', domain: 'acct-invite.example.com', subscriber_id: SUB },
        {
          id: OTHER_ACCOUNT,
          name: 'Other Acct',
          domain: 'oacct.example.com',
          subscriber_id: OTHER,
        },
      ]);
      const user = (id: string, email: string, role: string, verified: boolean) => ({
        id,
        email,
        password_hash: 'x',
        first_name: 'T',
        last_name: 'T',
        role,
        is_active: true,
        email_verified: verified,
      });
      await db('users').insert([
        user(AGENT, 'agent@invite.example.com', 'employee', true),
        user(CONTACT, 'contact@acct-invite.example.com', 'customer', false),
        user(OTHER_CONTACT, 'contact@oacct.example.com', 'customer', false),
      ]);
      await db('user_company_associations').insert([
        { user_id: AGENT, company_id: SUB, role: 'member' },
        { user_id: CONTACT, company_id: ACCOUNT, role: 'member' },
        { user_id: OTHER_CONTACT, company_id: OTHER_ACCOUNT, role: 'member' },
      ]);
      agentToken = JWTUtils.generateAccessToken({
        userId: AGENT,
        email: 'agent@invite.example.com',
        role: 'employee',
      });
    });

    it('a contact created by staff gets no verification email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          email: 'staff-made@acct-invite.example.com',
          password: 'Temp!Passw0rd1',
          firstName: 'Made',
          lastName: 'ByStaff',
        });
      expect(res.status).toBe(201);
      expect(last('verify', 'staff-made@acct-invite.example.com')).toBeUndefined();
    });

    it('emails the contact a set-your-password link that also confirms them', async () => {
      const res = await request(app)
        .post(`/api/users/${CONTACT}/send-invitation`)
        .set('Authorization', `Bearer ${agentToken}`);
      expect(res.status).toBe(200);
      const { token } = last('invite', 'contact@acct-invite.example.com')!;

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'Mine!Passw0rd' });
      expect((await login('contact@acct-invite.example.com', 'Mine!Passw0rd')).status).toBe(200);
    });

    it("can't invite another subscriber's contact", async () => {
      const res = await request(app)
        .post(`/api/users/${OTHER_CONTACT}/send-invitation`)
        .set('Authorization', `Bearer ${agentToken}`);
      expect(res.status).toBe(404);
      expect(last('invite', 'contact@oacct.example.com')).toBeUndefined();
    });
  });
});
