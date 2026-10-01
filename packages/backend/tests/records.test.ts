import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { FieldService } from '../src/services/FieldService';
import { resetDatabase } from './helpers/db';

/**
 * Account and contact layouts: standard fields (name, phone, address,
 * billing address; contact name, email, phone, ...) can't be removed, custom
 * fields are per module, and records are edited only within the subscriber.
 */
describe('account and contact records', () => {
  const SUB = '00000000-0000-4000-8000-0000000e0001';
  const ACME = '00000000-0000-4000-8000-0000000e0002';
  const OTHER = '00000000-0000-4000-8000-0000000e0003';
  const THEIR_ACCOUNT = '00000000-0000-4000-8000-0000000e0004';
  const ADMIN = '00000000-0000-4000-8000-0000000e0005';
  const CONTACT = '00000000-0000-4000-8000-0000000e0006';
  const OTHER_CONTACT = '00000000-0000-4000-8000-0000000e0007';
  const tokens: Record<string, string> = {};

  const api = (who: string) => ({
    get: (path: string) =>
      request(app).get(`/api${path}`).set('Authorization', `Bearer ${tokens[who]}`),
    put: (path: string, body: object) =>
      request(app).put(`/api${path}`).set('Authorization', `Bearer ${tokens[who]}`).send(body),
  });

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub-r2.example.com' },
      {
        id: ACME,
        name: 'Acme',
        domain: 'acme-r2.example.com',
        subscriber_id: SUB,
        city: 'Springfield',
      },
      { id: OTHER, name: 'Other', domain: 'other-r2.example.com' },
      {
        id: THEIR_ACCOUNT,
        name: 'Theirs',
        domain: 'theirs-r2.example.com',
        subscriber_id: OTHER,
      },
    ]);
    const user = (id: string, email: string, role: string) => ({
      id,
      email,
      password_hash: 'x',
      first_name: 'Pat',
      last_name: 'Lee',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: SUB,
    });
    await db('users').insert([
      user(ADMIN, 'admin@sub-r2.example.com', 'admin'),
      user(CONTACT, 'pat@acme-r2.example.com', 'customer'),
      user(OTHER_CONTACT, 'kim@theirs-r2.example.com', 'customer'),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
      { user_id: OTHER_CONTACT, company_id: THEIR_ACCOUNT, role: 'member' },
    ]);
    tokens.admin = JWTUtils.generateAccessToken({
      userId: ADMIN,
      email: 'admin@sub-r2.example.com',
      role: 'admin',
    });
    tokens.contact = JWTUtils.generateAccessToken({
      userId: CONTACT,
      email: 'pat@acme-r2.example.com',
      role: 'customer',
    });
  });

  it('accounts and contacts have their own standard sections and fields', async () => {
    const accounts = (await api('admin').get('/fields/accounts')).body;
    expect(accounts.sections.map((s: any) => s.title)).toEqual([
      'Account Information',
      'Address',
      'Billing Address',
    ]);
    expect(accounts.sections[2].fields).toEqual([
      'billing_street',
      'billing_street2',
      'billing_city',
      'billing_state',
      'billing_county',
      'billing_postal_code',
      'billing_country',
    ]);
    const contacts = (await api('admin').get('/fields/contacts')).body;
    expect(contacts.sections[0].fields).toEqual(
      expect.arrayContaining(['first_name', 'last_name', 'email', 'phone', 'account'])
    );

    // Billing address can't be dropped from the layout
    const noBilling = accounts.sections.slice(0, 2);
    const res = await api('admin').put('/fields/accounts/layout', { sections: noBilling });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Billing street');
  });

  it('custom fields belong to one module', async () => {
    await FieldService.createField(SUB, 'accounts', {
      label: 'Tier',
      type: 'picklist',
      options: ['Gold', 'Silver'],
    });
    expect((await api('admin').get('/fields/accounts')).body.customFields).toHaveLength(1);
    expect((await api('admin').get('/fields/contacts')).body.customFields).toHaveLength(0);
    expect((await api('admin').get('/fields/tickets')).body.customFields).toHaveLength(0);
  });

  it('reads and saves an account: standard fields, addresses and custom fields', async () => {
    const got = await api('admin').get(`/records/accounts/${ACME}`);
    expect(got.status).toBe(200);
    expect(got.body.record.values).toMatchObject({ name: 'Acme', address_city: 'Springfield' });

    const res = await api('admin').put(`/records/accounts/${ACME}`, {
      values: {
        website: 'acme.com',
        address_county: 'Greene',
        billing_street: '1 Money Lane',
        billing_city: 'Capital City',
        billing_postal_code: '12345',
      },
      customFieldValues: { cf_tier: 'Gold' },
    });
    expect(res.status).toBe(200);
    const row = await db('companies').where('id', ACME).first();
    expect(row).toMatchObject({
      website_url: 'https://acme.com',
      county: 'Greene',
      billing_street: '1 Money Lane',
      billing_city: 'Capital City',
      billing_postal_code: '12345',
      city: 'Springfield',
    });
    expect(row.custom_field_values).toEqual({ cf_tier: 'Gold' });

    expect(
      (await api('admin').put(`/records/accounts/${ACME}`, { values: { name: '' } })).status
    ).toBe(400);
    expect(
      (
        await api('admin').put(`/records/accounts/${ACME}`, {
          customFieldValues: { cf_tier: 'Bronze' },
        })
      ).status
    ).toBe(400);
    expect(
      (await api('admin').put(`/records/accounts/${ACME}`, { values: { nope: 'x' } })).status
    ).toBe(400);
  });

  it('reads and saves a contact; the account is shown but not changed here', async () => {
    const got = await api('admin').get(`/records/contacts/${CONTACT}`);
    expect(got.status).toBe(200);
    expect(got.body.record).toMatchObject({
      values: { first_name: 'Pat', email: 'pat@acme-r2.example.com' },
      account: { id: ACME, name: 'Acme' },
    });

    const res = await api('admin').put(`/records/contacts/${CONTACT}`, {
      values: { title: 'IT Manager', mobile: '+1 555 0111', email: 'Pat.Lee@Acme-R2.example.com' },
    });
    expect(res.status).toBe(200);
    expect(await db('users').where('id', CONTACT).first()).toMatchObject({
      job_title: 'IT Manager',
      mobile_phone: '+1 555 0111',
      email: 'pat.lee@acme-r2.example.com',
    });

    const dup = await api('admin').put(`/records/contacts/${CONTACT}`, {
      values: { email: 'admin@sub-r2.example.com' },
    });
    expect(dup.status).toBe(409);
    expect(
      (await api('admin').put(`/records/contacts/${CONTACT}`, { values: { email: 'nope' } })).status
    ).toBe(400);
    expect(
      (await api('admin').put(`/records/contacts/${CONTACT}`, { values: { account: ACME } })).status
    ).toBe(400);
  });

  it("can't reach another subscriber's records, staff as contacts, or as a customer", async () => {
    expect((await api('admin').get(`/records/accounts/${THEIR_ACCOUNT}`)).status).toBe(404);
    expect((await api('admin').get(`/records/contacts/${OTHER_CONTACT}`)).status).toBe(404);
    expect((await api('admin').get(`/records/contacts/${ADMIN}`)).status).toBe(404);
    expect((await api('admin').get(`/records/accounts/${SUB}`)).status).toBe(404);
    expect(
      (await api('admin').put(`/records/accounts/${THEIR_ACCOUNT}`, { values: { name: 'Mine' } }))
        .status
    ).toBe(404);
    expect((await api('contact').get(`/records/contacts/${CONTACT}`)).status).toBe(403);
    expect((await api('admin').get(`/records/nope/${ACME}`)).status).toBe(404);
  });
});
