import request from 'supertest';

jest.mock('../src/models/User', () => ({
  User: {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    getUserCompanies: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../src/config/database', () => {
  const rows: any[] = [];
  const builder: any = {
    __rows: rows,
    whereRaw: jest.fn((_sql: string, [value]: any[]) => {
      builder.__matched = rows.find((r) => r.email.toLowerCase() === value);
      return builder;
    }),
    where: jest.fn((_col: string, value: any) => {
      // The exact-match form this used to use, kept so a regression back to it
      // is visible: it only finds a row whose stored case matches.
      builder.__matched = rows.find((r) => r.email === value);
      return builder;
    }),
    first: jest.fn(async () => builder.__matched),
  };
  const db: any = jest.fn(() => builder);
  db.__builder = builder;
  // tests/setup.ts truncates between suites. It refuses to run against a
  // database whose name does not say "test", and in CI it will not tolerate an
  // unreachable one - so the mock has to look like a test database and return
  // an empty table list rather than simply throwing.
  db.client = { config: { connection: { database: 'bomizzel_test' } } };
  db.raw = jest.fn(async () => ({ rows: [] }));
  return { db, testConnection: jest.fn(), closeConnection: jest.fn() };
});

import { app } from '../src/index';
import { db } from '../src/config/database';
import bcrypt from 'bcryptjs';

const builder = (db as any).__builder;

describe('signing in when the stored address has capitals', () => {
  beforeAll(async () => {
    // A row exactly as company registration used to write it: whatever the
    // person typed, not lowercased.
    builder.__rows.push({
      id: '33333333-3333-4333-8333-333333333333',
      email: 'Jeff@Bomizzel.com',
      password_hash: await bcrypt.hash('Welcome123!', 10),
      role: 'admin',
      is_active: true,
      first_name: 'Jeff',
      last_name: 'Bomar',
      organization_id: null,
    });
  });

  beforeEach(() => {
    builder.__matched = undefined;
  });

  it.each([
    ['the address as registered', 'Jeff@Bomizzel.com'],
    ['all lowercase', 'jeff@bomizzel.com'],
    ['shouting', 'JEFF@BOMIZZEL.COM'],
  ])('accepts %s', async (_label, email) => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Welcome123!' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('still rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jeff@bomizzel.com', password: 'not-the-password' });

    expect(res.status).toBe(401);
  });

  it('still rejects an address that does not exist', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@bomizzel.com', password: 'Welcome123!' });

    expect(res.status).toBe(401);
  });
});
