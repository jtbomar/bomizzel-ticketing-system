import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { FieldService } from '../src/services/FieldService';
import { resetDatabase } from './helpers/db';

/**
 * Fields and layouts: standard ticket fields can be moved but not removed,
 * custom fields of every type are checked when a ticket is saved, and each
 * subscriber only sees and uses its own.
 */
describe('fields and layouts', () => {
  const SUB = '00000000-0000-4000-8000-0000000c0001';
  const ACME = '00000000-0000-4000-8000-0000000c0002';
  const ADMIN = '00000000-0000-4000-8000-0000000c0003';
  const AGENT = '00000000-0000-4000-8000-0000000c0004';
  const CONTACT = '00000000-0000-4000-8000-0000000c0005';
  const TEAM = '00000000-0000-4000-8000-0000000c0006';
  const QUEUE = '00000000-0000-4000-8000-0000000c0007';
  const OTHER = '00000000-0000-4000-8000-0000000c0008';
  const OTHER_ADMIN = '00000000-0000-4000-8000-0000000c0009';
  const tokens: Record<string, string> = {};
  let product: number;
  let otherProduct: number;

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
  const createTicket = (who: string, body: object) =>
    api(who).post('/tickets', {
      title: 'Printer jammed',
      description: 'It is jammed',
      companyId: ACME,
      teamId: TEAM,
      submitterId: CONTACT,
      ...body,
    });

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub-f.example.com' },
      { id: ACME, name: 'Acme', domain: 'acme-f.example.com', subscriber_id: SUB },
      { id: OTHER, name: 'Other', domain: 'other-f.example.com' },
    ]);
    const user = (id: string, email: string, role: string, org = SUB, extra = {}) => ({
      id,
      email,
      password_hash: 'x',
      first_name: role,
      last_name: 'T',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: org,
      ...extra,
    });
    await db('users').insert([
      user(ADMIN, 'admin@sub-f.example.com', 'admin'),
      user(AGENT, 'agent@sub-f.example.com', 'employee'),
      user(CONTACT, 'pat@acme-f.example.com', 'customer', SUB, { phone: '+1 555 0100' }),
      user(OTHER_ADMIN, 'x@other-f.example.com', 'admin', OTHER),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
      { user_id: OTHER_ADMIN, company_id: OTHER, role: 'owner' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await db('team_memberships').insert([
      { user_id: ADMIN, team_id: TEAM, role: 'admin' },
      { user_id: AGENT, team_id: TEAM, role: 'member' },
    ]);
    await TicketStatus.seedDefaultStatuses(TEAM);
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });
    const [{ id: dept }] = await db('departments')
      .insert({ company_id: SUB, name: 'Support', is_default: true })
      .returning('id');
    const [{ id: otherDept }] = await db('departments')
      .insert({ company_id: OTHER, name: 'Theirs' })
      .returning('id');
    [{ id: product }] = await db('products')
      .insert({ company_id: SUB, department_id: dept, product_code: 'P1', name: 'Printer' })
      .returning('id');
    [{ id: otherProduct }] = await db('products')
      .insert({ company_id: OTHER, department_id: otherDept, product_code: 'P1', name: 'Theirs' })
      .returning('id');
    for (const [who, id, email, role] of [
      ['admin', ADMIN, 'admin@sub-f.example.com', 'admin'],
      ['agent', AGENT, 'agent@sub-f.example.com', 'employee'],
      ['contact', CONTACT, 'pat@acme-f.example.com', 'customer'],
      ['other', OTHER_ADMIN, 'x@other-f.example.com', 'admin'],
    ] as const) {
      tokens[who] = JWTUtils.generateAccessToken({ userId: id, email, role });
    }
  });

  beforeEach(async () => {
    await db('module_fields').del();
    await db('module_layouts').del();
  });

  it('starts with the standard fields, in two sections', async () => {
    const res = await api('agent').get('/fields/tickets');
    expect(res.status).toBe(200);
    expect(res.body.sections.map((s: any) => s.title)).toEqual([
      'Ticket Information',
      'Additional Information',
    ]);
    const keys = res.body.sections.flatMap((s: any) => s.fields);
    expect(keys).toEqual(
      expect.arrayContaining(['contact', 'account', 'product', 'phone', 'subject', 'status'])
    );
    expect(res.body.customFields).toEqual([]);
  });

  it('only admins change fields; customers see none of it', async () => {
    expect((await api('agent').post('/fields/tickets', { label: 'X', type: 'text' })).status).toBe(
      403
    );
    expect((await api('contact').get('/fields/tickets')).status).toBe(403);
    expect((await api('admin').get('/fields/nope')).status).toBe(404);
  });

  it('adds fields of each type, refusing bad ones', async () => {
    const add = (body: object) => api('admin').post('/fields/tickets', body);
    const res = await add({
      label: 'Product Type',
      type: 'picklist',
      options: ['Hardware', 'Software', 'Hardware'],
    });
    expect(res.status).toBe(201);
    expect(res.body.field).toMatchObject({
      key: 'cf_product_type',
      options: ['Hardware', 'Software'],
    });
    expect((await add({ label: 'Product Type', type: 'text' })).body.field.key).toMatch(
      /^cf_product_type_[0-9a-f]{6}$/
    );
    for (const type of [
      'textarea',
      'number',
      'decimal',
      'date',
      'checkbox',
      'email',
      'phone',
      'url',
    ]) {
      expect((await add({ label: `A ${type}`, type })).status).toBe(201);
    }
    expect((await add({ label: 'Tags', type: 'multiselect', options: ['a', 'b'] })).status).toBe(
      201
    );

    expect((await add({ label: 'No choices', type: 'picklist', options: [] })).status).toBe(400);
    expect((await add({ label: 'Weird', type: 'colour' })).status).toBe(400);
    expect((await add({ label: '', type: 'text' })).status).toBe(400);
    expect((await add({ label: 'Subject', type: 'text' })).status).toBe(400);

    // Shows up at the end of the layout
    const layout = await api('agent').get('/fields/tickets');
    expect(layout.body.sections.at(-1).fields).toContain('cf_product_type');
  });

  it("keeps a field's type, but its label and choices can change", async () => {
    const f = (
      await api('admin').post('/fields/tickets', {
        label: 'Size',
        type: 'picklist',
        options: ['S'],
      })
    ).body.field;
    expect(
      (await api('admin').put(`/fields/tickets/${f.id}`, { label: 'Size', type: 'text' })).status
    ).toBe(400);
    const res = await api('admin').put(`/fields/tickets/${f.id}`, {
      label: 'T-shirt size',
      options: ['S', 'M', 'L'],
      isRequired: true,
    });
    expect(res.body.field).toMatchObject({
      key: 'cf_size',
      label: 'T-shirt size',
      options: ['S', 'M', 'L'],
      isRequired: true,
    });
  });

  it("saves a rearranged layout but won't drop a standard field", async () => {
    const f = (await api('admin').post('/fields/tickets', { label: 'Serial', type: 'text' })).body
      .field;
    const sections = [
      { id: 'a', title: 'Who', fields: ['contact', 'account', 'phone'] },
      { id: 'b', title: 'What', fields: [f.key, 'product', 'subject', 'description'] },
      { id: 'c', title: 'Handling', fields: ['status', 'priority', 'department', 'assignee'] },
    ];
    const ok = await api('admin').put('/fields/tickets/layout', { sections });
    expect(ok.status).toBe(200);
    expect(ok.body.sections.map((s: any) => s.fields)).toEqual(sections.map((s) => s.fields));

    const noPhone = sections.map((s) => ({ ...s, fields: s.fields.filter((k) => k !== 'phone') }));
    const res = await api('admin').put('/fields/tickets/layout', { sections: noPhone });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Phone');

    const twice = [...sections, { id: 'd', title: 'Again', fields: ['subject'] }];
    expect((await api('admin').put('/fields/tickets/layout', { sections: twice })).status).toBe(
      400
    );
    const unknown = [...sections, { id: 'd', title: 'X', fields: ['cf_nope'] }];
    expect((await api('admin').put('/fields/tickets/layout', { sections: unknown })).status).toBe(
      400
    );
  });

  it('checks each type of value', async () => {
    const add = (label: string, type: string, extra = {}) =>
      FieldService.createField(SUB, 'tickets', { label, type, ...extra });
    await add('Kind', 'picklist', { options: ['Hardware', 'Software'] });
    await add('Tags', 'multiselect', { options: ['urgent', 'vip'] });
    await add('Count', 'number');
    await add('Cost', 'decimal');
    await add('Due', 'date');
    await add('Warranty', 'checkbox');
    await add('Owner email', 'email');
    await add('Link', 'url');
    const check = (values: object) => FieldService.validateValues(SUB, 'tickets', values);

    expect(
      await check({
        cf_kind: 'Hardware',
        cf_tags: ['vip', 'urgent', 'vip'],
        cf_count: '3',
        cf_cost: '9.50',
        cf_due: '2026-12-01',
        cf_warranty: false,
        cf_owner_email: ' pat@acme.com ',
        cf_link: 'https://acme.com/x',
      })
    ).toEqual({
      cf_kind: 'Hardware',
      cf_tags: ['vip', 'urgent'],
      cf_count: 3,
      cf_cost: 9.5,
      cf_due: '2026-12-01',
      cf_warranty: false,
      cf_owner_email: 'pat@acme.com',
      cf_link: 'https://acme.com/x',
    });
    for (const bad of [
      { cf_kind: 'Plumbing' },
      { cf_tags: ['urgent', 'nope'] },
      { cf_count: '3.5' },
      { cf_cost: 'lots' },
      { cf_due: 'tomorrow' },
      { cf_warranty: 'maybe' },
      { cf_owner_email: 'pat' },
      { cf_link: 'javascript:alert(1)' },
      { cf_unknown: 'x' },
    ]) {
      await expect(check(bad)).rejects.toThrow();
    }
  });

  it("doesn't let another subscriber's fields or products in", async () => {
    await FieldService.createField(OTHER, 'tickets', { label: 'Theirs', type: 'text' });
    expect((await api('admin').get('/fields/tickets')).body.customFields).toEqual([]);
    expect((await createTicket('admin', { customFieldValues: { cf_theirs: 'x' } })).status).toBe(
      400
    );
    expect((await createTicket('admin', { productId: otherProduct })).status).toBe(400);
  });

  it('saves product, phone, priority and custom fields on a new ticket', async () => {
    await FieldService.createField(SUB, 'tickets', {
      label: 'Product Type',
      type: 'picklist',
      options: ['Hardware', 'Software'],
      isRequired: true,
    });

    // Staff must fill in required fields; customers never see them
    const missing = await createTicket('agent', {});
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missing.body)).toContain('Product Type');
    expect((await createTicket('contact', { submitterId: undefined })).status).toBe(201);

    const res = await createTicket('agent', {
      productId: product,
      priority: 2,
      customFieldValues: { cf_product_type: 'Hardware' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      productId: product,
      phone: '+1 555 0100', // the contact's
      priority: 2,
      customFieldValues: { cf_product_type: 'Hardware' },
    });

    const own = await createTicket('agent', {
      phone: '+1 555 0199',
      customFieldValues: { cf_product_type: 'Software' },
    });
    expect(own.body.data.phone).toBe('+1 555 0199');
  });

  it('changes only the custom fields sent when a ticket is updated', async () => {
    await FieldService.createField(SUB, 'tickets', { label: 'Serial', type: 'text' });
    await FieldService.createField(SUB, 'tickets', {
      label: 'Kind',
      type: 'picklist',
      options: ['A', 'B'],
    });
    const t = (
      await createTicket('agent', { customFieldValues: { cf_serial: 'SN-1', cf_kind: 'A' } })
    ).body.data;

    const res = await api('agent').put(`/tickets/${t.id}`, {
      customFieldValues: { cf_kind: 'B' },
      productId: product,
      phone: '+1 555 0123',
    });
    expect(res.status).toBe(200);
    const row = await db('tickets').where('id', t.id).first();
    expect(row.custom_field_values).toEqual({ cf_serial: 'SN-1', cf_kind: 'B' });
    expect(row).toMatchObject({ product_id: product, phone: '+1 555 0123' });

    await api('agent').put(`/tickets/${t.id}`, {
      customFieldValues: { cf_serial: '' },
      productId: null,
    });
    const cleared = await db('tickets').where('id', t.id).first();
    expect(cleared.custom_field_values).toEqual({ cf_kind: 'B' });
    expect(cleared.product_id).toBeNull();
  });

  it('deleting a field takes it off the layout and leaves saved values alone', async () => {
    const f = await FieldService.createField(SUB, 'tickets', { label: 'Old', type: 'text' });
    const t = (await createTicket('agent', { customFieldValues: { cf_old: 'keep' } })).body.data;
    expect((await api('admin').delete(`/fields/tickets/${f.id}`)).status).toBe(200);
    const layout = await api('agent').get('/fields/tickets');
    expect(layout.body.sections.flatMap((s: any) => s.fields)).not.toContain('cf_old');
    expect((await db('tickets').where('id', t.id).first()).custom_field_values).toEqual({
      cf_old: 'keep',
    });
    expect((await api('other').delete(`/fields/tickets/${f.id}`)).status).toBe(404);
  });
});
