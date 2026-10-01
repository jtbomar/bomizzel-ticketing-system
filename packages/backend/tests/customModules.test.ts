import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { resetDatabase } from './helpers/db';

/**
 * Custom modules and lookup fields: a subscriber adds a module (Assets),
 * gives it fields - including lookups to accounts, contacts and other
 * modules - and records link to each other, with related lists on the
 * other side. Nothing crosses to another subscriber.
 */
describe('custom modules and lookups', () => {
  const SUB = '00000000-0000-4000-8000-0000000f0001';
  const ACME = '00000000-0000-4000-8000-0000000f0002';
  const OTHER = '00000000-0000-4000-8000-0000000f0003';
  const THEIR_ACCOUNT = '00000000-0000-4000-8000-0000000f0004';
  const ADMIN = '00000000-0000-4000-8000-0000000f0005';
  const AGENT = '00000000-0000-4000-8000-0000000f0006';
  const CONTACT = '00000000-0000-4000-8000-0000000f0007';
  const OTHER_ADMIN = '00000000-0000-4000-8000-0000000f0008';
  const TEAM = '00000000-0000-4000-8000-0000000f0009';
  const QUEUE = '00000000-0000-4000-8000-0000000f000a';
  const tokens: Record<string, string> = {};

  const api = (who: string) => ({
    get: (path: string) =>
      request(app).get(`/api${path}`).set('Authorization', `Bearer ${tokens[who]}`),
    post: (path: string, body: object) =>
      request(app).post(`/api${path}`).set('Authorization', `Bearer ${tokens[who]}`).send(body),
    put: (path: string, body: object) =>
      request(app).put(`/api${path}`).set('Authorization', `Bearer ${tokens[who]}`).send(body),
    delete: (path: string) =>
      request(app).delete(`/api${path}`).set('Authorization', `Bearer ${tokens[who]}`),
  });

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub-cm.example.com' },
      { id: ACME, name: 'Acme', domain: 'acme-cm.example.com', subscriber_id: SUB },
      { id: OTHER, name: 'Other', domain: 'other-cm.example.com' },
      { id: THEIR_ACCOUNT, name: 'Theirs', domain: 'theirs-cm.example.com', subscriber_id: OTHER },
    ]);
    const user = (id: string, email: string, role: string, first: string, org = SUB) => ({
      id,
      email,
      password_hash: 'x',
      first_name: first,
      last_name: 'Lee',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: org,
    });
    await db('users').insert([
      user(ADMIN, 'admin@sub-cm.example.com', 'admin', 'Ada'),
      user(AGENT, 'agent@sub-cm.example.com', 'employee', 'Bea'),
      user(CONTACT, 'pat@acme-cm.example.com', 'customer', 'Pat'),
      user(OTHER_ADMIN, 'x@other-cm.example.com', 'admin', 'Xan', OTHER),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
      { user_id: OTHER_ADMIN, company_id: OTHER, role: 'owner' },
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
    for (const [who, id, email, role] of [
      ['admin', ADMIN, 'admin@sub-cm.example.com', 'admin'],
      ['agent', AGENT, 'agent@sub-cm.example.com', 'employee'],
      ['contact', CONTACT, 'pat@acme-cm.example.com', 'customer'],
      ['other', OTHER_ADMIN, 'x@other-cm.example.com', 'admin'],
    ] as const) {
      tokens[who] = JWTUtils.generateAccessToken({ userId: id, email, role });
    }
  });

  let assets: { key: string };
  let locations: { key: string };

  it('admins add modules; each gets a layout with a locked name', async () => {
    expect((await api('agent').post('/modules', { name: 'Assets' })).status).toBe(403);
    const res = await api('admin').post('/modules', { name: 'Assets', singular: 'Asset' });
    expect(res.status).toBe(201);
    assets = res.body.module;
    expect(assets.key).toBe('cm_assets');
    locations = (await api('admin').post('/modules', { name: 'Locations', singular: 'Location' }))
      .body.module;
    expect((await api('admin').post('/modules', { name: 'assets' })).status).toBe(400);
    expect((await api('admin').post('/modules', { name: 'Accounts' })).status).toBe(400);

    const layout = (await api('agent').get(`/fields/${assets.key}`)).body;
    expect(layout.sections).toEqual([
      { id: 'information', title: 'Asset Information', fields: ['name'] },
    ]);
    expect(layout.systemFields[0]).toMatchObject({ key: 'name', label: 'Asset name' });

    expect((await api('agent').get('/modules')).body.modules.map((m: any) => m.name)).toEqual([
      'Assets',
      'Locations',
    ]);
    expect((await api('other').get('/modules')).body.modules).toEqual([]);
    expect((await api('other').get(`/fields/${assets.key}`)).status).toBe(404);
  });

  it('lookup fields link to accounts, contacts or another module', async () => {
    const add = (module: string, body: object) => api('admin').post(`/fields/${module}`, body);
    expect(
      (await add(assets.key, { label: 'Owner account', type: 'lookup', lookupModule: 'accounts' }))
        .status
    ).toBe(201);
    expect(
      (await add(assets.key, { label: 'Used by', type: 'lookup', lookupModule: 'contacts' })).status
    ).toBe(201);
    expect(
      (await add(assets.key, { label: 'Location', type: 'lookup', lookupModule: locations.key }))
        .status
    ).toBe(201);
    expect((await add(assets.key, { label: 'Serial', type: 'text' })).status).toBe(201);
    // And on tickets: which asset a ticket is about
    expect(
      (await add('tickets', { label: 'Asset', type: 'lookup', lookupModule: assets.key })).status
    ).toBe(201);
    // Bad targets
    expect((await add(assets.key, { label: 'X', type: 'lookup' })).status).toBe(400);
    expect(
      (await add(assets.key, { label: 'Y', type: 'lookup', lookupModule: 'cm_nope' })).status
    ).toBe(400);
    expect(
      (await add(assets.key, { label: 'Z', type: 'lookup', lookupModule: 'tickets' })).status
    ).toBe(400);
  });

  let laptop: string;
  let hq: string;

  it('records are added, linked, edited and listed', async () => {
    hq = (await api('agent').post(`/records/${locations.key}`, { values: { name: 'HQ' } })).body
      .record.id;
    const res = await api('agent').post(`/records/${assets.key}`, {
      values: { name: 'Laptop 42' },
      customFieldValues: {
        cf_owner_account: ACME,
        cf_used_by: CONTACT,
        cf_location: hq,
        cf_serial: 'SN-42',
      },
    });
    expect(res.status).toBe(201);
    laptop = res.body.record.id;
    expect(res.body.record).toMatchObject({
      values: { name: 'Laptop 42' },
      customFieldValues: { cf_owner_account: ACME, cf_used_by: CONTACT, cf_location: hq },
    });

    expect(
      (await api('agent').post(`/records/${assets.key}`, { values: { name: '' } })).status
    ).toBe(400);
    // Links must be to this subscriber's records of the right module
    for (const cf of [
      { cf_owner_account: THEIR_ACCOUNT },
      { cf_owner_account: CONTACT },
      { cf_used_by: ADMIN },
      { cf_location: laptop },
      { cf_location: 'not-an-id' },
    ]) {
      expect(
        (
          await api('agent').post(`/records/${assets.key}`, {
            values: { name: 'X' },
            customFieldValues: cf,
          })
        ).status
      ).toBe(400);
    }

    const edit = await api('agent').put(`/records/${assets.key}/${laptop}`, {
      values: { name: 'Laptop 42 (spare)' },
      customFieldValues: { cf_serial: 'SN-43' },
    });
    expect(edit.status).toBe(200);
    expect(edit.body.record.customFieldValues).toMatchObject({
      cf_serial: 'SN-43',
      cf_location: hq,
    });

    const list = await api('agent').get(`/records/${assets.key}?q=spare`);
    expect(list.body.records.map((r: any) => r.name)).toEqual(['Laptop 42 (spare)']);
    expect(list.body.total).toBe(1);
    expect((await api('other').get(`/records/${assets.key}/${laptop}`)).status).toBe(404);
    expect((await api('contact').get(`/records/${assets.key}`)).status).toBe(403);
  });

  it('finds records to link to, and shows linked ones by name', async () => {
    const search = await api('agent').get(`/lookup/${assets.key}?q=laptop`);
    expect(search.body.records).toEqual([{ id: laptop, name: 'Laptop 42 (spare)' }]);
    expect((await api('agent').get('/lookup/accounts?q=ac')).body.records).toEqual([
      { id: ACME, name: 'Acme' },
    ]);
    expect((await api('agent').get('/lookup/contacts?q=pat')).body.records).toEqual([
      { id: CONTACT, name: 'Pat Lee' },
    ]);
    expect(
      (await api('agent').get(`/lookup/accounts?ids=${ACME},${THEIR_ACCOUNT}`)).body.records
    ).toEqual([{ id: ACME, name: 'Acme' }]);
  });

  it('related lists show what links to a record, tickets included', async () => {
    const [ticket] = await db('tickets')
      .insert({
        title: 'Laptop will not boot',
        description: 'd',
        submitter_id: CONTACT,
        company_id: ACME,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        status: 'open',
        priority: 0,
        ticket_number: 1001,
        custom_field_values: JSON.stringify({ cf_asset: laptop }),
      })
      .returning('*');

    const forAcme = (await api('agent').get(`/records/accounts/${ACME}/related`)).body.related;
    expect(forAcme).toEqual([
      {
        module: assets.key,
        moduleName: 'Assets',
        field: 'Owner account',
        records: [{ id: laptop, name: 'Laptop 42 (spare)' }],
      },
    ]);
    const forLaptop = (await api('agent').get(`/records/${assets.key}/${laptop}/related`)).body
      .related;
    expect(forLaptop).toEqual([
      {
        module: 'tickets',
        moduleName: 'Tickets',
        field: 'Asset',
        records: [{ id: ticket.id, name: '#1001 Laptop will not boot' }],
      },
    ]);
    const forHq = (await api('agent').get(`/records/${locations.key}/${hq}/related`)).body.related;
    expect(forHq[0].records.map((r: any) => r.id)).toEqual([laptop]);
  });

  it('deleting a module removes its records and the lookups to it', async () => {
    expect((await api('agent').delete(`/modules/${locations.key}`)).status).toBe(403);
    expect((await api('admin').delete(`/modules/${locations.key}`)).status).toBe(200);
    expect((await api('agent').get(`/fields/${locations.key}`)).status).toBe(404);
    const fields = (await api('agent').get(`/fields/${assets.key}`)).body.customFields;
    expect(fields.map((f: any) => f.key)).not.toContain('cf_location');
    expect(await db('custom_records').where('id', hq).first()).toBeUndefined();

    expect((await api('agent').delete(`/records/${assets.key}/${laptop}`)).status).toBe(403);
    expect((await api('admin').delete(`/records/${assets.key}/${laptop}`)).status).toBe(200);
    expect((await api('admin').delete(`/records/accounts/${ACME}`)).status).toBe(400);
  });
});
