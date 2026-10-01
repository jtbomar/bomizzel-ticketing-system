import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { resetDatabase } from './helpers/db';

/**
 * Moving a product to another department: allowed within the subscriber,
 * refused for another subscriber's department or a clashing product code.
 */
describe('moving a product between departments', () => {
  const SUB = '00000000-0000-4000-8000-00000000e001';
  const OTHER = '00000000-0000-4000-8000-00000000e002';
  const ADMIN = '00000000-0000-4000-8000-00000000e003';
  let token: string;
  let general: number;
  let support: number;
  let foreign: number;

  const put = (id: number, body: Record<string, unknown>) =>
    request(app)
      .put(`/api/products/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const newProduct = async (code: string, departmentId: number) => {
    const [row] = await db('products')
      .insert({
        company_id: SUB,
        department_id: departmentId,
        product_code: code,
        name: code,
        is_active: true,
      })
      .returning('*');
    return row;
  };

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub-p.example.com' },
      { id: OTHER, name: 'Other', domain: 'other-p.example.com' },
    ]);
    await db('users').insert({
      id: ADMIN,
      email: 'admin@sub-p.example.com',
      password_hash: 'x',
      first_name: 'Admin',
      last_name: 'T',
      role: 'admin',
      is_active: true,
      email_verified: true,
      current_org_id: SUB,
    });
    await db('user_company_associations').insert({
      user_id: ADMIN,
      company_id: SUB,
      role: 'owner',
    });
    [{ id: general }, { id: support }, { id: foreign }] = await db('departments')
      .insert([
        { company_id: SUB, name: 'General' },
        { company_id: SUB, name: 'Support' },
        { company_id: OTHER, name: 'Theirs' },
      ])
      .returning('id');
    token = JWTUtils.generateAccessToken({
      userId: ADMIN,
      email: 'admin@sub-p.example.com',
      role: 'admin',
    });
  });

  it('moves a product to another of its departments', async () => {
    const product = await newProduct('MOVE-1', general);
    const res = await put(product.id, { name: 'Moved', department_id: String(support) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ department_id: support, department_name: 'Support' });
    const row = await db('products').where('id', product.id).first();
    expect(row).toMatchObject({ department_id: support, name: 'Moved' });

    const list = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.map((p: any) => p.product_code)).toContain('MOVE-1');
  });

  it("refuses another subscriber's department", async () => {
    const product = await newProduct('MOVE-2', general);
    const res = await put(product.id, { department_id: foreign });
    expect(res.status).toBe(400);
    expect((await db('products').where('id', product.id).first()).department_id).toBe(general);
  });

  it('refuses a move that would clash with a product code there', async () => {
    await newProduct('SAME', support);
    const product = await newProduct('SAME', general);
    const res = await put(product.id, { department_id: support });
    expect(res.status).toBe(409);
  });

  it('leaves the department alone when none is sent', async () => {
    const product = await newProduct('MOVE-3', general);
    const res = await put(product.id, { name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.department_id).toBe(general);
  });
});
