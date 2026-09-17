import request from 'supertest';

// The blocklist has to be provable without a database: these tests are about
// token state, not about rows. The User model is the only thing the auth path
// touches beyond the token itself, so it is stubbed out here, which also lets
// the suite run anywhere - the DB-backed assertions live in tests/security.
jest.mock('../src/models/User', () => ({
  User: {
    findById: jest.fn(),
    findWithCompanies: jest.fn(),
    getUserCompanies: jest.fn().mockResolvedValue([]),
    toModel: jest.fn((row: Record<string, unknown>) => row),
  },
}));

import { app } from '../src/index';
import { User } from '../src/models/User';
import { JWTUtils } from '../src/utils/jwt';
import {
  revokeToken,
  isTokenRevoked,
  clearMemoryBlocklist,
} from '../src/utils/tokenBlocklist';

const USER_ID = '11111111-1111-4111-8111-111111111111';

// What goes into a token...
const TEST_USER = {
  userId: USER_ID,
  email: 'blocklist@test.com',
  role: 'employee',
};

describe('Token blocklist', () => {
  beforeEach(() => {
    clearMemoryBlocklist();
    // ...and what comes back out of the users table for it.
    const row = {
      id: USER_ID,
      email: TEST_USER.email,
      role: TEST_USER.role,
      is_active: true,
      organization_id: null,
    };
    (User.findById as jest.Mock).mockResolvedValue(row);
    (User.findWithCompanies as jest.Mock).mockResolvedValue({ ...row, companies: [] });
  });

  describe('store', () => {
    it('reports a revoked token as revoked, and leaves others alone', async () => {
      const revoked = JWTUtils.generateAccessToken(TEST_USER);
      const untouched = JWTUtils.generateAccessToken({ ...TEST_USER, email: 'other@test.com' });

      await revokeToken(revoked);

      expect(await isTokenRevoked(revoked)).toBe(true);
      expect(await isTokenRevoked(untouched)).toBe(false);
    });

    it('does not store a token that has already expired', async () => {
      // Nothing to revoke: signature verification rejects it regardless, and
      // storing it would be an entry that outlives its own purpose.
      const expired = JWTUtils.generateAccessToken(TEST_USER);
      jest.spyOn(JWTUtils, 'getTokenExpiration').mockReturnValue(new Date(Date.now() - 1000));

      await revokeToken(expired);

      jest.restoreAllMocks();
      expect(await isTokenRevoked(expired)).toBe(false);
    });

    it('stops reporting an entry once the token would have expired anyway', async () => {
      const token = JWTUtils.generateAccessToken(TEST_USER);
      // TTLs round up to whole seconds, matching Redis' granularity.
      jest.spyOn(JWTUtils, 'getTokenExpiration').mockReturnValue(new Date(Date.now() + 100));

      await revokeToken(token);
      expect(await isTokenRevoked(token)).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      jest.restoreAllMocks();
      expect(await isTokenRevoked(token)).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('accepts a token that has not been revoked', async () => {
      const token = JWTUtils.generateAccessToken(TEST_USER);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('rejects a revoked token even though its signature is still valid', async () => {
      const token = JWTUtils.generateAccessToken(TEST_USER);
      await revokeToken(token);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_REVOKED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the access token it was called with', async () => {
      const token = JWTUtils.generateAccessToken(TEST_USER);

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('revokes the refresh token supplied in the body', async () => {
      const token = JWTUtils.generateAccessToken(TEST_USER);
      const refreshToken = JWTUtils.generateRefreshToken(TEST_USER);

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken })
        .expect(200);

      await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('still succeeds when called without any credentials', async () => {
      await request(app).post('/api/auth/logout').expect(200);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the refresh token, so the spent one stops working', async () => {
      const refreshToken = JWTUtils.generateRefreshToken(TEST_USER);

      const first = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(first.body.refreshToken).toBeDefined();
      expect(first.body.refreshToken).not.toBe(refreshToken);

      const replay = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      // The replacement is still good - rotation must not lock the user out.
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(200);
    });
  });
});
