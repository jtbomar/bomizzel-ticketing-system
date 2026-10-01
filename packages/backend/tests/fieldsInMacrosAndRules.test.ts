import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { FieldService } from '../src/services/FieldService';
import { AssignmentRuleService } from '../src/services/AssignmentRuleService';
import { resetDatabase } from './helpers/db';

/**
 * Custom fields in macros (set several at once, or clear them) and in
 * assignment rules (match on them; rules run again when they change).
 */
describe('custom fields in macros and assignment rules', () => {
  const SUB = '00000000-0000-4000-8000-0000000d0001';
  const ACME = '00000000-0000-4000-8000-0000000d0002';
  const ADMIN = '00000000-0000-4000-8000-0000000d0003';
  const AGENT = '00000000-0000-4000-8000-0000000d0004';
  const CONTACT = '00000000-0000-4000-8000-0000000d0005';
  const TEAM = '00000000-0000-4000-8000-0000000d0006';
  const QUEUE = '00000000-0000-4000-8000-0000000d0007';
  const OTHER = '00000000-0000-4000-8000-0000000d0008';
  let adminToken: string;
  let product: number;
  let otherProduct: number;

  const api = (method: 'post' | 'put', path: string, body: object) =>
    request(app)[method](`/api${path}`).set('Authorization', `Bearer ${adminToken}`).send(body);
  const newTicket = async (extra: Record<string, unknown> = {}) => {
    const [row] = await db('tickets')
      .insert({
        title: 'Something broke',
        description: 'Please help',
        submitter_id: CONTACT,
        company_id: ACME,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        status: 'open',
        priority: 0,
        ...extra,
      })
      .returning('*');
    return row;
  };

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub-p2.example.com' },
      { id: ACME, name: 'Acme', domain: 'acme-p2.example.com', subscriber_id: SUB },
      { id: OTHER, name: 'Other', domain: 'other-p2.example.com' },
    ]);
    const user = (id: string, email: string, role: string) => ({
      id,
      email,
      password_hash: 'x',
      first_name: role,
      last_name: 'T',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: SUB,
    });
    await db('users').insert([
      user(ADMIN, 'admin@sub-p2.example.com', 'admin'),
      user(AGENT, 'agent@sub-p2.example.com', 'employee'),
      user(CONTACT, 'pat@acme-p2.example.com', 'customer'),
    ]);
    await db('user_company_associations').insert([
      { user_id: ADMIN, company_id: SUB, role: 'owner' },
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACME, role: 'member' },
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
      .insert({ company_id: OTHER, department_id: otherDept, product_code: 'X', name: 'Theirs' })
      .returning('id');

    await FieldService.createField(SUB, 'tickets', {
      label: 'Product Type',
      type: 'picklist',
      options: ['Hardware', 'Software', 'Service'],
    });
    await FieldService.createField(SUB, 'tickets', { label: 'Serial', type: 'text' });
    await FieldService.createField(SUB, 'tickets', {
      label: 'Tags',
      type: 'multiselect',
      options: ['vip', 'urgent', 'billing'],
    });
    await FieldService.createField(SUB, 'tickets', { label: 'Under warranty', type: 'checkbox' });
    await FieldService.createField(OTHER, 'tickets', { label: 'Theirs', type: 'text' });

    adminToken = JWTUtils.generateAccessToken({
      userId: ADMIN,
      email: 'admin@sub-p2.example.com',
      role: 'admin',
    });
  });

  beforeEach(async () => {
    await db('macros').del();
    await db('assignment_rules').del();
  });

  describe('macros', () => {
    it('set several fields and the product at once, and clear one', async () => {
      const res = await api('post', '/macros', {
        name: 'Hardware fault',
        shared: true,
        actions: {
          productId: product,
          fields: {
            cf_product_type: 'Hardware',
            cf_tags: ['urgent', 'vip'],
            cf_under_warranty: true,
            cf_serial: null,
          },
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.macro.actions.fields).toEqual({
        cf_product_type: 'Hardware',
        cf_tags: ['urgent', 'vip'],
        cf_under_warranty: true,
        cf_serial: null,
      });

      const t = await newTicket({
        custom_field_values: JSON.stringify({ cf_serial: 'SN-1', cf_product_type: 'Software' }),
      });
      const applied = await api('post', `/macros/${res.body.macro.id}/apply`, { ticketId: t.id });
      expect(applied.status).toBe(200);
      const row = await db('tickets').where('id', t.id).first();
      expect(row.product_id).toBe(product);
      expect(row.custom_field_values).toEqual({
        cf_product_type: 'Hardware',
        cf_tags: ['urgent', 'vip'],
        cf_under_warranty: true,
      });
      expect(applied.body.changed).toEqual(
        expect.arrayContaining(['productId', 'customFieldValues'])
      );
    });

    it('refuse bad values, unknown fields and other subscribers’ things', async () => {
      const bad = [
        { fields: { cf_product_type: 'Plumbing' } },
        { fields: { cf_tags: ['nope'] } },
        { fields: { cf_theirs: 'x' } },
        { fields: { cf_nope: 'x' } },
        { productId: otherProduct },
      ];
      for (const actions of bad) {
        expect((await api('post', '/macros', { name: 'x', shared: true, actions })).status).toBe(
          400
        );
      }
    });

    it('skip a field deleted since the macro was saved', async () => {
      const temp = await FieldService.createField(SUB, 'tickets', { label: 'Temp', type: 'text' });
      const macro = (
        await api('post', '/macros', {
          name: 'Two fields',
          shared: true,
          actions: { fields: { cf_temp: 'x', cf_serial: 'SN-9' } },
        })
      ).body.macro;
      await FieldService.deleteField(SUB, 'tickets', temp.id);
      const t = await newTicket();
      const res = await api('post', `/macros/${macro.id}/apply`, { ticketId: t.id });
      expect(res.status).toBe(200);
      expect((await db('tickets').where('id', t.id).first()).custom_field_values).toEqual({
        cf_serial: 'SN-9',
      });
    });
  });

  describe('assignment rules', () => {
    const rule = (conditions: object) =>
      api('post', '/assignment-rules', {
        name: 'By field',
        method: 'specific',
        agentIds: [AGENT],
        conditions,
      });
    const assignee = async (values: object) => {
      const t = await newTicket({ custom_field_values: JSON.stringify(values) });
      await AssignmentRuleService.apply(t.id);
      return (await db('tickets').where('id', t.id).first()).assigned_to_id;
    };

    it('match a pick list, multi-select, checkbox and text', async () => {
      const res = await rule({
        fields: [
          { key: 'cf_product_type', values: ['Hardware', 'Service'] },
          { key: 'cf_tags', values: ['vip'] },
          { key: 'cf_under_warranty', values: ['true'] },
          { key: 'cf_serial', values: ['SN-'] },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.rule.conditions.fields.map((f: any) => f.match)).toEqual([
        'is',
        'is',
        'is',
        'contains',
      ]);
      const match = {
        cf_product_type: 'Service',
        cf_tags: ['urgent', 'vip'],
        cf_under_warranty: true,
        cf_serial: 'sn-123',
      };
      expect(await assignee(match)).toBe(AGENT);
      expect(await assignee({ ...match, cf_product_type: 'Software' })).toBeNull();
      expect(await assignee({ ...match, cf_tags: ['urgent'] })).toBeNull();
      expect(await assignee({ ...match, cf_under_warranty: false })).toBeNull();
      expect(await assignee({ ...match, cf_serial: 'X-1' })).toBeNull();
      const { cf_serial, ...noSerial } = match;
      void cf_serial;
      expect(await assignee(noSerial)).toBeNull();
    });

    it('refuse unknown fields and choices', async () => {
      for (const fields of [
        [{ key: 'cf_nope', values: ['x'] }],
        [{ key: 'cf_theirs', values: ['x'] }],
        [{ key: 'cf_product_type', values: ['Plumbing'] }],
        [{ key: 'cf_under_warranty', values: ['maybe'] }],
        [{ key: 'cf_serial', values: [] }],
      ]) {
        expect((await rule({ fields })).status).toBe(400);
      }
    });

    it('run again when an unassigned ticket’s fields are filled in', async () => {
      await rule({ fields: [{ key: 'cf_product_type', values: ['Hardware'] }] });
      const t = await newTicket();
      await AssignmentRuleService.apply(t.id);
      expect((await db('tickets').where('id', t.id).first()).assigned_to_id).toBeNull();

      const res = await api('put', `/tickets/${t.id}`, {
        customFieldValues: { cf_product_type: 'Hardware' },
      });
      expect(res.status).toBe(200);
      expect((await db('tickets').where('id', t.id).first()).assigned_to_id).toBe(AGENT);
    });
  });
});
