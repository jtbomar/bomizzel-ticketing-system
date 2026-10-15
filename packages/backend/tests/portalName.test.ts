import request from 'supertest';

jest.mock('../src/services/AccountEmailService', () => ({
  AccountEmailService: {
    sendVerification: jest.fn(async () => true),
    sendPasswordReset: jest.fn(async () => true),
    sendInvitation: jest.fn(async () => true),
  },
}));

import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { resetDatabase } from './helpers/db';
import { portalNameFrom, portalUrl, subscriberForPortalName } from '../src/utils/portalName';

/**
 * A subscriber's name - its portal (portal.bomizzel.com/<name>) and support
 * email: picked at sign-up, checked for format, reserved words and other
 * subscribers, and changeable with the old name still working.
 */
describe('portal names', () => {
  const TAKEN = '00000000-0000-4000-8000-0000000ee001';
  const check = (query: string) =>
    request(app).get(`/api/company-registration/portal-name?${query}`);
  const signUp = (companyName: string, email: string, portalName?: string) =>
    request(app)
      .post('/api/company-registration/register')
      .send({
        companyName,
        adminFirstName: 'Owner',
        adminLastName: 'Test',
        adminEmail: email,
        adminPassword: 'Str0ng!Passw0rd',
        ...(portalName ? { portalName } : {}),
      });

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert({
      id: TAKEN,
      name: 'Gleason Power Services',
      domain: 'gleason-pn.example.com',
      support_email_slug: 'gleason',
    });
  });

  it('makes a name from a company name', () => {
    expect(portalNameFrom("Elena's Jewelry Repair")).toBe('elenas-jewelry-repair');
    expect(portalNameFrom('Smith & Sons, Inc.')).toBe('smith-and-sons-inc');
    expect(portalNameFrom('AB')).toBe('ab-desk');
  });

  it('checks a name: free, taken, reserved, badly formed', async () => {
    expect((await check('name=acme-heating')).body).toMatchObject({
      name: 'acme-heating',
      available: true,
      url: portalUrl('acme-heating'),
    });
    const taken = (await check('name=gleason')).body;
    expect(taken).toMatchObject({ available: false, reason: 'That name is taken.' });
    expect(taken.suggestion).toBe('gleason-2');
    expect((await check('name=portal')).body).toMatchObject({ available: false });
    expect((await check('name=www')).body.reason).toContain('reserved');
    expect((await check('name=-bad-')).body.available).toBe(false);
    expect((await check('name=ab')).body.available).toBe(false);
    // From a company name: a free suggestion
    expect((await check('company=Gleason')).body).toMatchObject({
      available: false,
      suggestion: 'gleason-2',
    });
  });

  it('signs up with the name picked, and refuses a taken one before creating anything', async () => {
    const res = await signUp('Acme Heating', 'owner@acme-pn.example.com', 'acme');
    expect(res.status).toBe(201);
    const company = await db('companies').where('id', res.body.data.company.id).first();
    expect(company.support_email_slug).toBe('acme');

    const clash = await signUp('Another Gleason', 'owner@other-pn.example.com', 'gleason');
    expect(clash.status).toBe(400);
    expect(clash.body.error.message).toContain('gleason-2');
    expect(await db('users').where('email', 'owner@other-pn.example.com').first()).toBeUndefined();
    expect(await db('companies').where('name', 'Another Gleason').first()).toBeUndefined();
  });

  it('without a name, one is made from the company name', async () => {
    const res = await signUp("Elena's Jewelry Repair", 'owner@elena-pn.example.com');
    expect(res.status).toBe(201);
    const company = await db('companies').where('id', res.body.data.company.id).first();
    expect(company.support_email_slug).toBe('elenas-jewelry-repair');
  });

  it('renames: admins only, the old name keeps working and stays theirs', async () => {
    const acme = await db('companies').where('support_email_slug', 'acme').first();
    const owner = await db('users').where('email', 'owner@acme-pn.example.com').first();
    await db('users').where('id', owner.id).update({ email_verified: true });
    const token = JWTUtils.generateAccessToken({
      userId: owner.id,
      email: owner.email,
      role: 'admin',
    });
    const put = (name: string, t = token) =>
      request(app).put('/api/email/portal-name').set('Authorization', `Bearer ${t}`).send({ name });

    expect((await put('gleason')).status).toBe(400);
    expect((await put('support')).status).toBe(400);

    const res = await put('acme-heating');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      portalName: 'acme-heating',
      portalUrl: portalUrl('acme-heating'),
    });
    expect(res.body.data.address).toMatch(/^acme-heating@/);

    // The old name still finds them, and nobody else can take it
    expect(await subscriberForPortalName('acme')).toMatchObject({
      id: acme.id,
      slug: 'acme-heating',
      renamed: true,
    });
    expect((await check('name=acme')).body.available).toBe(false);
    // Taking back your own old name is fine
    expect((await put('acme')).status).toBe(200);
    expect(await subscriberForPortalName('acme')).toMatchObject({ slug: 'acme', renamed: false });
    expect(await subscriberForPortalName('acme-heating')).toMatchObject({
      slug: 'acme',
      renamed: true,
    });

    // Agents can't rename
    const agent = await db('users')
      .insert({
        email: 'agent@acme-pn.example.com',
        password_hash: 'x',
        first_name: 'A',
        last_name: 'Gent',
        role: 'employee',
        is_active: true,
        email_verified: true,
        current_org_id: acme.id,
      })
      .returning('*');
    await db('user_company_associations').insert({
      user_id: agent[0].id,
      company_id: acme.id,
      role: 'member',
    });
    const agentToken = JWTUtils.generateAccessToken({
      userId: agent[0].id,
      email: agent[0].email,
      role: 'employee',
    });
    expect((await put('acme-x', agentToken)).status).toBe(403);
  });
});
