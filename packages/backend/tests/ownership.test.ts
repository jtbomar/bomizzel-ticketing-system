import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { EmailService } from '../src/services/EmailService';
import { resetDatabase } from './helpers/db';

/**
 * A subscriber's owner: an admin the other admins can't demote, switch off
 * or delete; the only one who can hand ownership over; settable (and
 * addable) by a platform admin from BSI.
 */
describe('account owner', () => {
  const SUB = '00000000-0000-4000-8000-000000aaa001';
  const ACCT = '00000000-0000-4000-8000-000000aaa002';
  const OWNER = '00000000-0000-4000-8000-000000aaa003';
  const ADMIN = '00000000-0000-4000-8000-000000aaa004';
  const AGENT = '00000000-0000-4000-8000-000000aaa005';
  const PLATFORM = '00000000-0000-4000-8000-000000aaa006';
  const OWN = '00000000-0000-4000-8000-000000aaa007';
  const mails: any[] = [];
  const saved: any = {};

  const tok = (id: string, email: string, role: string) =>
    JWTUtils.generateAccessToken({ userId: id, email, role });
  const owner = () => tok(OWNER, 'owner@own.example.com', 'admin');
  const admin = () => tok(ADMIN, 'admin@own.example.com', 'admin');
  const agent = () => tok(AGENT, 'agent@own.example.com', 'employee');
  const platform = () => tok(PLATFORM, 'jeff@bomizzel.com', 'admin');
  const call = (
    method: 'get' | 'put' | 'post' | 'delete',
    path: string,
    token: string,
    body?: object
  ) =>
    (request(app) as any)[method](`/api${path}`).set('Authorization', `Bearer ${token}`).send(body);
  const membership = async (userId: string) =>
    (await db('user_company_associations').where({ user_id: userId, company_id: SUB }).first())
      .role;

  beforeAll(async () => {
    const svc = EmailService as any;
    saved.transporter = svc.transporter;
    saved.config = svc.config;
    svc.transporter = { sendMail: async (m: any) => (mails.push(m), { messageId: 'x' }) };
    svc.config = { from: 'Bomizzel <noreply@bomizzel.com>' };

    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Gleason OW', domain: 'own.example.com', comped_plan: 'professional' },
      { id: ACCT, name: 'Acme OW', domain: 'acme-ow.example.com', subscriber_id: SUB },
      { id: OWN, name: 'Bomizzel OW', domain: 'bomizzel-ow.example.com' },
    ]);
    const u = (id: string, email: string, role: string, org = SUB) => ({
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
      u(OWNER, 'owner@own.example.com', 'admin'),
      u(ADMIN, 'admin@own.example.com', 'admin'),
      u(AGENT, 'agent@own.example.com', 'employee'),
      u(PLATFORM, 'jeff@bomizzel.com', 'admin', OWN),
    ]);
    await db('user_company_associations').insert([
      { user_id: OWNER, company_id: SUB, role: 'owner' },
      { user_id: ADMIN, company_id: SUB, role: 'admin' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: PLATFORM, company_id: OWN, role: 'owner' },
    ]);
  });

  afterAll(() => Object.assign(EmailService as any, saved));

  it('says who the owner is', async () => {
    const res = await call('get', '/ownership', admin());
    expect(res.body).toMatchObject({ owner: { id: OWNER }, isOwner: false });
    expect((await call('get', '/ownership', owner())).body.isOwner).toBe(true);
  });

  it("other admins can't demote, switch off or delete the owner", async () => {
    expect(
      (await call('put', `/admin/users/${OWNER}/status`, admin(), { isActive: false })).status
    ).toBe(403);
    expect(
      (await call('put', `/admin/users/${OWNER}/role`, admin(), { role: 'employee' })).status
    ).toBe(403);
    expect((await call('post', `/users/${OWNER}/deactivate`, admin())).status).toBe(403);
    expect((await call('delete', `/admin/users/${OWNER}/permanent`, admin())).status).toBe(403);
    expect((await db('users').where('id', OWNER).first()).is_active).toBe(true);
    // Their name is fine
    expect(
      (await call('put', `/admin/users/${OWNER}`, admin(), { firstName: 'Johnny' })).status
    ).toBe(200);
  });

  it("the owner can't remove themselves without handing over first", async () => {
    expect(
      (await call('put', `/admin/users/${OWNER}/status`, owner(), { isActive: false })).status
    ).toBe(400);
    expect(
      (await call('put', `/admin/users/${OWNER}/role`, owner(), { role: 'employee' })).status
    ).toBe(400);
  });

  it('only the owner can transfer; the new owner becomes an admin', async () => {
    expect((await call('post', '/ownership/transfer', admin(), { userId: ADMIN })).status).toBe(
      403
    );
    const res = await call('post', '/ownership/transfer', owner(), { userId: AGENT });
    expect(res.status).toBe(200);
    expect(res.body.owner.id).toBe(AGENT);
    expect(await membership(AGENT)).toBe('owner');
    expect(await membership(OWNER)).toBe('admin');
    expect((await db('users').where('id', AGENT).first()).role).toBe('admin');
    // The old owner is an ordinary admin now
    const agentAsAdmin = tok(AGENT, 'agent@own.example.com', 'admin');
    expect(
      (await call('put', `/admin/users/${OWNER}/role`, agentAsAdmin, { role: 'employee' })).status
    ).toBe(200);
    expect(
      (
        await call('post', '/ownership/transfer', agentAsAdmin, {
          userId: '00000000-0000-4000-8000-000000aaa999',
        })
      ).status
    ).toBe(404);
  });

  it('a platform admin sets the owner from BSI, or adds a new person as owner', async () => {
    const staff = await call('get', `/admin/provisioning/companies/${SUB}/staff`, platform());
    expect(staff.body.data.staff.find((s: any) => s.isOwner).id).toBe(AGENT);

    expect(
      (
        await call('put', `/admin/provisioning/companies/${SUB}/owner`, platform(), {
          userId: ADMIN,
        })
      ).status
    ).toBe(200);
    expect(await membership(ADMIN)).toBe('owner');
    expect(await membership(AGENT)).toBe('admin');

    mails.length = 0;
    const add = await call('post', `/admin/provisioning/companies/${SUB}/owner`, platform(), {
      firstName: 'Johnny',
      lastName: 'Gleason',
      email: 'Johnny@Own.example.com',
      sendWelcome: true,
    });
    expect(add.status).toBe(201);
    expect(add.body.data).toMatchObject({
      owner: { name: 'Johnny Gleason', email: 'johnny@own.example.com' },
      emailed: true,
    });
    const johnny = await db('users').where('email', 'johnny@own.example.com').first();
    expect(johnny).toMatchObject({ role: 'admin', email_verified: false, current_org_id: SUB });
    expect(await membership(johnny.id)).toBe('owner');
    expect(await membership(ADMIN)).toBe('admin');
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("You're the owner of Gleason OW on Bomizzel");
    expect(mails[0].text).toContain('/reset-password?token=');
    expect(mails[0].text).not.toContain('/portal/');

    expect(
      (
        await call('post', `/admin/provisioning/companies/${SUB}/owner`, platform(), {
          firstName: 'X',
          lastName: 'Y',
          email: 'johnny@own.example.com',
        })
      ).status
    ).toBe(409);
    expect(
      (
        await call('put', `/admin/provisioning/companies/${ACCT}/owner`, platform(), {
          userId: ADMIN,
        })
      ).status
    ).toBe(404);
    // A customer's own admin can't use BSI
    expect(
      (await call('put', `/admin/provisioning/companies/${SUB}/owner`, admin(), { userId: ADMIN }))
        .status
    ).toBe(403);
  });
});
