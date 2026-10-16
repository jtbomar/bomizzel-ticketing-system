import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { EmailService } from '../src/services/EmailService';
import { resetDatabase } from './helpers/db';

/**
 * Sign in with Google / Microsoft / Facebook. The providers are played by a
 * stubbed fetch: each test says what the provider would report.
 */
describe('sign in with a provider', () => {
  const SUB = '00000000-0000-4000-8000-0000000bb001';
  const ADMIN = '00000000-0000-4000-8000-0000000bb002';
  const saved: any = {};
  const env = {
    GOOGLE_CLIENT_ID: 'g-id',
    GOOGLE_CLIENT_SECRET: 'g-secret',
    MICROSOFT_CLIENT_ID: 'm-id',
    MICROSOFT_CLIENT_SECRET: 'm-secret',
    PORTAL_URL: 'https://help.bomizzel.com',
  };
  let identity: Record<string, any> = {};

  // The provider: a token for any code, then `identity` from its user endpoint
  const fakeFetch = jest.fn(async (url: string) => {
    const json = (body: any, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
    if (/token/.test(url)) return json({ access_token: 'provider-token' });
    return json(identity);
  });

  // Start at the company's page, then come back from the provider with a code
  const roundTrip = async (provider: string, query: string, sameBrowser = true) => {
    const start = await request(app).get(`/api/auth/oauth/${provider}/start?${query}`);
    expect(start.status).toBe(302);
    const state = new URL(start.headers.location).searchParams.get('state')!;
    const cookie = String(start.headers['set-cookie']).split(';')[0];
    const back = request(app).get(
      `/api/auth/oauth/${provider}/callback?code=abc&state=${encodeURIComponent(state)}`
    );
    const res = await (sameBrowser ? back.set('Cookie', cookie) : back);
    expect(res.status).toBe(302);
    return res.headers.location as string;
  };
  const spend = (location: string) =>
    request(app)
      .post('/api/auth/handoff/exchange')
      .send({ code: location.split('#handoff=')[1] });

  beforeAll(async () => {
    for (const k of Object.keys(env)) saved[k] = process.env[k];
    Object.assign(process.env, env);
    saved.fetch = global.fetch;
    (global as any).fetch = fakeFetch;
    const svc = EmailService as any;
    saved.transporter = svc.transporter;
    saved.config = svc.config;
    svc.transporter = { sendMail: async () => ({ messageId: 'm' }) };
    svc.config = { from: 'Bomizzel <noreply@bomizzel.com>' };

    await resetDatabase();
    await db('companies').insert({ id: SUB, name: 'Acme Power', support_email_slug: 'acme' });
    await db('users').insert({
      id: ADMIN,
      email: 'Boss@Acme.example.com',
      password_hash: 'x',
      first_name: 'B',
      last_name: 'B',
      role: 'admin',
      is_active: true,
      email_verified: true,
    });
    await db('user_company_associations').insert({
      user_id: ADMIN,
      company_id: SUB,
      role: 'owner',
    });
  });

  afterAll(() => {
    for (const k of Object.keys(env)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    (global as any).fetch = saved.fetch;
    Object.assign(EmailService as any, { transporter: saved.transporter, config: saved.config });
  });

  it('lists only the providers that are set up', async () => {
    const res = await request(app).get('/api/auth/oauth/providers');
    expect(res.body.providers.map((p: any) => p.id)).toEqual(['google', 'microsoft']);
    const fb = await request(app).get('/api/auth/oauth/facebook/start');
    expect(fb.status).toBe(404);
  });

  it("signs staff in with Google and lands them on their company's desk", async () => {
    identity = { email: 'boss@acme.example.com', email_verified: true, name: 'B B' };
    const to = await roundTrip(
      'google',
      'company=acme&audience=staff&origin=https://portal.bomizzel.com'
    );
    expect(to).toMatch(/^https:\/\/portal\.bomizzel\.com\/acme\/agent#handoff=/);
    const res = await spend(to);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(ADMIN);
    expect(JWTUtils.verifyAccessToken(res.body.token)).toMatchObject({ tid: SUB, aud: 'staff' });
  });

  it('from bomizzel.com (no company) it still finds their desk', async () => {
    identity = { email: 'boss@acme.example.com', email_verified: true };
    const to = await roundTrip('google', 'origin=https://www.bomizzel.com');
    expect(to).toMatch(/^https:\/\/portal\.bomizzel\.com\/acme\/agent#handoff=/);
  });

  it("refuses an address Google hasn't confirmed", async () => {
    identity = { email: 'boss@acme.example.com', email_verified: false };
    const to = await roundTrip(
      'google',
      'company=acme&audience=staff&origin=https://portal.bomizzel.com'
    );
    expect(to).toMatch(/^https:\/\/portal\.bomizzel\.com\/acme\/login#oauth_error=/);
  });

  it("Microsoft: matches the sign-in name, not a 'mail' a tenant admin can set (nOAuth)", async () => {
    identity = {
      userPrincipalName: 'mallory@evil.onmicrosoft.com',
      mail: 'boss@acme.example.com',
      displayName: 'Mallory',
    };
    const to = await roundTrip(
      'microsoft',
      'company=acme&audience=staff&origin=https://portal.bomizzel.com'
    );
    expect(to).toContain('#oauth_error=');
    expect(decodeURIComponent(to)).toContain('mallory@evil.onmicrosoft.com');

    identity = { userPrincipalName: 'Boss@Acme.example.com', displayName: 'B' };
    const ok = await roundTrip(
      'microsoft',
      'company=acme&audience=staff&origin=https://portal.bomizzel.com'
    );
    expect(ok).toContain('#handoff=');
  });

  it('a callback opened in another browser is refused', async () => {
    identity = { email: 'boss@acme.example.com', email_verified: true };
    const to = await roundTrip(
      'google',
      'company=acme&audience=staff&origin=https://portal.bomizzel.com',
      false
    );
    expect(to).toContain('#oauth_error=');
  });

  it('someone new on a customer portal becomes its customer', async () => {
    identity = { email: 'pat@newco.example.com', email_verified: true, name: 'Pat Lee' };
    const to = await roundTrip(
      'google',
      'company=acme&audience=portal&origin=https://help.bomizzel.com'
    );
    expect(to).toMatch(/^https:\/\/help\.bomizzel\.com\/acme#handoff=/);
    const res = await spend(to);
    expect(res.body.user).toMatchObject({ role: 'customer', firstName: 'Pat', lastName: 'Lee' });

    const pat = await db('users').where('email', 'pat@newco.example.com').first();
    expect(pat).toMatchObject({ role: 'customer', email_verified: true });
    const account = await db('user_company_associations as a')
      .join('companies as c', 'c.id', 'a.company_id')
      .where('a.user_id', pat.id)
      .first('c.subscriber_id');
    expect(account.subscriber_id).toBe(SUB);
  });

  it("but nobody new gets a staff login, and staff aren't made customers", async () => {
    identity = { email: 'stranger@nowhere.example.com', email_verified: true };
    const to = await roundTrip(
      'google',
      'company=acme&audience=staff&origin=https://portal.bomizzel.com'
    );
    expect(decodeURIComponent(to)).toContain("There's no Bomizzel account");
    expect(
      await db('users').where('email', 'stranger@nowhere.example.com').first()
    ).toBeUndefined();

    identity = { email: 'boss@acme.example.com', email_verified: true };
    const portal = await roundTrip(
      'google',
      'company=acme&audience=portal&origin=https://help.bomizzel.com'
    );
    expect(portal).toMatch(/^https:\/\/help\.bomizzel\.com\/acme\/login#oauth_error=/);
  });

  it("never sends anyone to a site that isn't Bomizzel's", async () => {
    identity = { email: 'boss@acme.example.com', email_verified: true };
    const to = await roundTrip('google', 'origin=https://evil.example.com');
    expect(new URL(to).hostname).toBe('portal.bomizzel.com');
  });
});
