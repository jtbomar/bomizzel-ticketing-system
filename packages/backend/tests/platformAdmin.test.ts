import request from 'supertest';

// Every company that signs up gets a user with role 'admin'. These tests prove
// that role alone no longer reaches the routes that can wipe or reseed the
// whole database - you also have to be on the platform admin list, and in
// production the routes stay off unless ALLOW_DANGEROUS_DB_ROUTES=true.
// User is stubbed so the suite runs without a database, and no request here
// ever gets as far as a handler that would touch one.
jest.mock('../src/models/User', () => ({
  User: {
    findById: jest.fn(),
    findWithCompanies: jest.fn(),
    getUserCompanies: jest.fn().mockResolvedValue([]),
    toModel: jest.fn((row: Record<string, unknown>) => row),
  },
}));

import { Request, Response } from 'express';
import { app } from '../src/index';
import { User } from '../src/models/User';
import { JWTUtils } from '../src/utils/jwt';
import {
  isPlatformAdmin,
  requireDangerousRoutesEnabled,
} from '../src/middleware/platformAdmin';

const CUSTOMER_ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'owner@somecustomer.com',
  role: 'admin',
};
const LOOKS_LIKE_US = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'bomizzel.fan@gmail.com', // would have passed the old "contains bomizzel" check
  role: 'admin',
};
const PLATFORM_ADMIN = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'jeff@bomizzel.com',
  role: 'admin',
};

const tokenFor = (user: { id: string; email: string; role: string }): string => {
  (User.findById as jest.Mock).mockResolvedValue({ ...user, is_active: true, organization_id: null });
  (User.findWithCompanies as jest.Mock).mockResolvedValue({
    ...user,
    is_active: true,
    organization_id: null,
    companies: [],
  });
  return JWTUtils.generateAccessToken({ userId: user.id, email: user.email, role: user.role });
};

const DANGEROUS_POSTS = [
  '/api/database-reset/nuclear',
  '/api/database-reset/cleanup-migrations',
  '/api/admin/emergency-reseed',
  '/api/reseed',
  '/api/fix/fix-migrations',
  '/api/cleanup-now',
];

const PLATFORM_ONLY = [
  ['get', '/api/fix/check-database'],
  ['post', '/api/seed/seed-business-hours'],
  ['post', '/api/seed/seed-holiday-lists'],
  ['post', '/api/setup/seed-statuses'],
  // BSI customer management, the raw SQL query builder, and monitoring
  ['get', '/api/admin/provisioning/customers'],
  ['post', '/api/admin/provisioning/customers'],
  ['post', '/api/query-builder/execute'],
  ['get', '/api/query-builder/schema'],
  ['get', '/api/monitoring/performance'],
  ['get', '/api/monitoring/security-logs'],
] as const;

describe('Platform admin guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isPlatformAdmin', () => {
    it('accepts an admin whose email is on the list, ignoring case', () => {
      expect(isPlatformAdmin({ role: 'admin', email: 'Jeff@Bomizzel.com' })).toBe(true);
    });

    it('rejects a customer admin and a look-alike email', () => {
      expect(isPlatformAdmin(CUSTOMER_ADMIN)).toBe(false);
      expect(isPlatformAdmin(LOOKS_LIKE_US)).toBe(false);
    });

    it('does not accept an email that has no account by default', () => {
      // Sign-up doesn't verify email, so an unclaimed address on the list could be taken
      expect(isPlatformAdmin({ role: 'admin', email: 'jeffrey.t.bomar@gmail.com' })).toBe(false);
    });

    it('rejects a listed email without the admin role', () => {
      expect(isPlatformAdmin({ role: 'employee', email: PLATFORM_ADMIN.email })).toBe(false);
    });

    it('reads the list from PLATFORM_ADMIN_EMAILS', () => {
      process.env.PLATFORM_ADMIN_EMAILS = 'a@x.com, b@y.com';
      expect(isPlatformAdmin({ role: 'admin', email: 'b@y.com' })).toBe(true);
      expect(isPlatformAdmin(PLATFORM_ADMIN)).toBe(false);
    });
  });

  describe('dangerous database routes', () => {
    it.each(DANGEROUS_POSTS)('refuses a customer admin: %s', async (path) => {
      const res = await request(app).post(path).set('Authorization', `Bearer ${tokenFor(CUSTOMER_ADMIN)}`);
      expect(res.status).toBe(403);
    });

    it.each(DANGEROUS_POSTS)('refuses a look-alike email: %s', async (path) => {
      const res = await request(app).post(path).set('Authorization', `Bearer ${tokenFor(LOOKS_LIKE_US)}`);
      expect(res.status).toBe(403);
    });

    it.each(DANGEROUS_POSTS)('is switched off in production even for a platform admin: %s', async (path) => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DANGEROUS_DB_ROUTES;
      const res = await request(app).post(path).set('Authorization', `Bearer ${tokenFor(PLATFORM_ADMIN)}`);
      expect(res.status).toBe(404);
    });

    it.each(DANGEROUS_POSTS)('still requires sign-in: %s', async (path) => {
      const res = await request(app).post(path);
      expect(res.status).toBe(401);
    });
  });

  describe('kill switch', () => {
    const run = (): { called: boolean; error?: { statusCode?: number } } => {
      const out: { called: boolean; error?: { statusCode?: number } } = { called: false };
      requireDangerousRoutesEnabled(
        { originalUrl: '/x' } as Request,
        {} as Response,
        (err?: unknown) => {
          out.called = true;
          if (err) out.error = err as { statusCode?: number };
        }
      );
      return out;
    };

    it('blocks in production by default', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DANGEROUS_DB_ROUTES;
      expect(run().error?.statusCode).toBe(404);
    });

    it('allows in production only when ALLOW_DANGEROUS_DB_ROUTES=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_DANGEROUS_DB_ROUTES = 'true';
      expect(run().error).toBeUndefined();
    });

    it('allows outside production', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_DANGEROUS_DB_ROUTES;
      expect(run().error).toBeUndefined();
    });
  });

  describe('/auth/verify', () => {
    it('reports isPlatformAdmin true for a platform admin', async () => {
      const res = await request(app).get('/api/auth/verify').set('Authorization', `Bearer ${tokenFor(PLATFORM_ADMIN)}`);
      expect(res.status).toBe(200);
      expect(res.body.isPlatformAdmin).toBe(true);
    });

    it('reports isPlatformAdmin false for a customer admin and a look-alike', async () => {
      for (const user of [CUSTOMER_ADMIN, LOOKS_LIKE_US]) {
        const res = await request(app).get('/api/auth/verify').set('Authorization', `Bearer ${tokenFor(user)}`);
        expect(res.status).toBe(200);
        expect(res.body.isPlatformAdmin).toBe(false);
      }
    });
  });

  describe('platform-only seed and check routes', () => {
    it.each(PLATFORM_ONLY)('refuses a customer admin: %s %s', async (method, path) => {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${tokenFor(CUSTOMER_ADMIN)}`);
      expect(res.status).toBe(403);
    });

    it.each(PLATFORM_ONLY)('refuses a look-alike email: %s %s', async (method, path) => {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${tokenFor(LOOKS_LIKE_US)}`);
      expect(res.status).toBe(403);
    });
  });
});
