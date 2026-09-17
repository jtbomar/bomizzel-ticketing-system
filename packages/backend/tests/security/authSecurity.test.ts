import request from 'supertest';
import { app } from '../../src/index';
import { User } from '../../src/models/User';
import { Company } from '../../src/models/Company';
import { Team } from '../../src/models/Team';
import { JWTUtils } from '../../src/utils/jwt';
import jwt from 'jsonwebtoken';
import { createTestToken } from '../helpers/testUtils';
import { isRedisAvailable, redisClient } from '../../src/config/redis';
import { Queue } from '../../src/models/Queue';
import { TicketStatus } from '../../src/models/TicketStatus';

describe('Authentication Security Tests', () => {
  let validToken: string;
  let userId: string;
  let companyId: string;
  let teamId: string;

  beforeAll(async () => {
    // Create test data
    const company = await Company.createCompany({
      name: 'Security Test Company',
      domain: 'security.com',
    });
    companyId = company.id;

    const team = await Team.createTeam({
      name: 'Security Test Team',
      description: 'Team for security testing',
    });
    teamId = team.id;

    const user = await User.createUser({
      email: 'security@test.com',
      password: 'password123',
      firstName: 'Security',
      lastName: 'User',
      role: 'customer',
    });
    userId = user.id;

    // Filing a ticket needs a queue on the team and the team's statuses;
    // without them creation fails with "No available queue found for team".
    await Queue.createQueue({
      name: 'Security Test Queue',
      description: 'Default queue for security tests',
      type: 'unassigned',
      teamId,
    });
    await TicketStatus.seedDefaultStatuses(teamId);

    await Company.addUserToCompany(userId, companyId);
    validToken = createTestToken(userId);
  });

  describe('JWT Token Security', () => {
    it('should reject requests without authentication token', async () => {
      await request(app).get('/api/tickets').expect(401);
    });

    it('should reject requests with invalid token format', async () => {
      await request(app)
        .get('/api/tickets')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);
    });

    it('should reject requests with expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject tokens with invalid signature', async () => {
      const invalidToken = jwt.sign({ userId }, 'wrong-secret');

      await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should reject tokens with missing required claims', async () => {
      const tokenWithoutUserId = jwt.sign(
        { someOtherClaim: 'value' },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${tokenWithoutUserId}`)
        .expect(401);
    });

    it('should reject tokens for non-existent users', async () => {
      const tokenForNonExistentUser = createTestToken('non-existent-user-id');

      await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${tokenForNonExistentUser}`)
        .expect(401);
    });
  });

  describe('Authorization Security', () => {
    let otherUserToken: string;
    let otherCompanyId: string;

    beforeAll(async () => {
      // Create another company and user for testing authorization
      const otherCompany = await Company.createCompany({
        name: 'Other Company',
        domain: 'other.com',
      });
      otherCompanyId = otherCompany.id;

      const otherUser = await User.createUser({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        role: 'customer',
      });

      await Company.addUserToCompany(otherUser.id, otherCompanyId);
      otherUserToken = createTestToken(otherUser.id);
    });

    it('should prevent access to other companies tickets', async () => {
      // Create ticket for first company
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Company A Ticket',
          description: 'This belongs to company A',
          companyId: companyId,
          teamId: teamId,
        });

      const ticketId = ticketResponse.body.data.id;

      // Try to access with other company's user token
      await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('should prevent ticket creation for unauthorized companies', async () => {
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Unauthorized Ticket',
          description: 'Trying to create ticket for wrong company',
          companyId: companyId, // User not associated with this company
          teamId: teamId,
        })
        .expect(403);
    });

    it('should prevent customers from accessing employee endpoints', async () => {
      // /api/queues/metrics is not a route - it matches /:id and fails uuid
      // validation with a 400, so this never tested authorisation. /api/admin/users
      // carries an explicit authorize('admin'), which is what we mean here.
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);
    });

    it('should ignore a role smuggled into a profile update', async () => {
      // This expected a 400. The request is accepted, and that is fine: Joi is
      // configured with stripUnknown, so `role` never reaches the service, and
      // updateProfile writes only first_name, last_name and preferences. What
      // matters is not the status code but that the role does not move, so
      // assert that instead - including after a re-read, since a 200 carrying
      // the old role would still hide a write that happened underneath.
      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          role: 'admin',
          firstName: 'Updated',
        })
        .expect(200);

      const profile = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(profile.body.user.role).toBe('customer');
      expect(profile.body.user.firstName).toBe('Updated');
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in search queries', async () => {
      const maliciousQuery = "'; DROP TABLE tickets; --";

      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ query: maliciousQuery })
        .expect(200); // Should not crash, should sanitize input

      expect(response.body.success).toBe(true);
    });

    it('should store ticket content verbatim and hand it back as JSON', async () => {
      // This used to assert that <script> was stripped out of the stored title.
      // That was input escaping, and it has been removed: escaping belongs where
      // a value is rendered, because only there do you know if it is landing in
      // HTML, an attribute or JSON. Escaping on the way in prevented nothing -
      // the frontend is React, which escapes on render - while corrupting every
      // ticket that legitimately contained a < or an ampersand.
      //
      // So the assertion is the opposite one, and it is deliberate: content
      // round-trips unaltered, and it comes back as JSON, which no browser
      // executes. The escaping that does happen is at the one place this app
      // builds HTML out of user values - see tests/emailTemplateRendering.
      const xssPayload = '<script>alert("XSS")</script>';
      const descriptionPayload = `<img src="x" onerror="alert('XSS')">`;

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: xssPayload,
          description: descriptionPayload,
          companyId: companyId,
          teamId: teamId,
        })
        .expect(201);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body.data.title).toBe(xssPayload);
      expect(response.body.data.description).toBe(descriptionPayload);
    });

    it('should validate email format in registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email-format',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });

    it('should enforce password strength requirements', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@test.com',
          password: '123', // Too weak
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);
    });

    it('should reject payloads over the body limit', async () => {
      // This sent 100KB and expected a 413. The body limit is 10MB, so 100KB is
      // accepted - as it should be; people paste logs into tickets. Send
      // something actually over the limit.
      const oversizedDescription = 'A'.repeat(11 * 1024 * 1024);

      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Large Payload Test',
          description: oversizedDescription,
          companyId: companyId,
          teamId: teamId,
        })
        .expect(413);
    });

    it('should accept a long but reasonable description', async () => {
      // Guards the other side of that line: there is no per-field cap on
      // description, and a 100KB paste must keep working.
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Long Description Test',
          description: 'A'.repeat(100000),
          companyId: companyId,
          teamId: teamId,
        })
        .expect(201);
    });
  });

  describe('Rate Limiting Security', () => {
    // Every rate limiter steps aside when Redis is unreachable - failing closed
    // would take the API down with it - and the suite's shared mock reports
    // exactly that. So these tests never exercised a limiter at all; they
    // counted 429s that could not happen. Stand in a working Redis for them.
    let store: Map<string, number>;

    beforeEach(() => {
      store = new Map();
      (isRedisAvailable as jest.Mock).mockReturnValue(true);
      (redisClient.get as jest.Mock).mockImplementation(async (key: string) =>
        store.has(key) ? String(store.get(key)) : null
      );
      (redisClient.decr as jest.Mock) = jest.fn(async (key: string) =>
        store.set(key, (store.get(key) || 0) - 1)
      );
      (redisClient as unknown as { multi: jest.Mock }).multi = jest.fn(() => {
        const queued: Array<() => void> = [];
        const pipeline: any = {
          incr: (key: string) => {
            queued.push(() => store.set(key, (store.get(key) || 0) + 1));
            return pipeline;
          },
          expire: () => pipeline,
          exec: async () => queued.forEach((run) => run()),
        };
        return pipeline;
      });
    });

    afterEach(() => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);
    });

    it('should rate limit login attempts', async () => {
      // authRateLimiter allows 5 failed attempts per 15 minutes, keyed by IP and
      // email. Sequential, not Promise.all: the counter is read-then-written, so
      // ten simultaneous requests can all read the same count and none get
      // limited - which is a real weakness of this limiter, but not what this
      // test is for.
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) {
        const response = await request(app).post('/api/auth/login').send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        });
        statuses.push(response.status);
      }

      expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
    }, 20000);

    it('should rate limit ticket creation', async () => {
      // apiRateLimiter, 60 per minute per user - far more than anyone files by
      // hand, so assert the route is governed rather than filing 60 tickets.
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Rate Limit Test',
          description: 'Testing rate limits',
          companyId: companyId,
          teamId: teamId,
        })
        .expect(201);

      expect(response.headers['x-ratelimit-limit']).toBe('60');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    }, 20000);
  });

  describe('Session Security', () => {
    it('should invalidate tokens on logout', async () => {
      // Login to get tokens
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'security@test.com',
        password: 'password123',
      });

      const { token, refreshToken } = loginResponse.body;

      // Verify token works
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken })
        .expect(200);

      // Token should no longer work
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should prevent refresh token reuse', async () => {
      // Login to get tokens
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'security@test.com',
        password: 'password123',
      });

      const { refreshToken } = loginResponse.body;

      // Use refresh token once
      const firstRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Try to use the same refresh token again
      await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(401);

      // New refresh token should work
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: firstRefresh.body.refreshToken })
        .expect(200);
    });
  });

  describe('File Upload Security', () => {
    let ticketId: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'File Upload Security Test',
          description: 'For testing file upload security',
          companyId: companyId,
          teamId: teamId,
        });

      ticketId = response.body.data.id;
    });

    // These all aimed at POST /api/tickets/:id/files, which is not a route -
    // uploads go to POST /api/files/upload with the ticket id in the body. They
    // were asserting against 404s, so the upload rules underneath went untested.

    it('should reject malicious file types', async () => {
      const maliciousScript = Buffer.from('<?php system($_GET["cmd"]); ?>');

      await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .field('ticketId', ticketId)
        .attach('file', maliciousScript, 'malicious.php')
        .expect(400);
    });

    it('should reject oversized files', async () => {
      const largeFile = Buffer.alloc(50 * 1024 * 1024); // 50MB file

      await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .field('ticketId', ticketId)
        .attach('file', largeFile, 'large.txt')
        .expect(413);
    });

    it('should store a file under a name that cannot escape the upload directory', async () => {
      // This expected the name to be rewritten. Nothing rewrites it: the
      // directory component never survives the multipart parse, so the stored
      // name is already a bare filename. The filter's own traversal check sits
      // behind that and never fires for a path. Asserted here through the real
      // API; tests/fileUploadSecurity.test.ts covers the filter directly, with
      // hand-built multipart bodies, because form-data normalises the filename
      // before it reaches the wire and a real attacker would not.
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .field('ticketId', ticketId)
        .attach('file', Buffer.from('test content'), '../../../etc/passwd.txt')
        .expect(201);

      const storedName = response.body.data.fileName ?? response.body.data.filename;
      expect(storedName).not.toContain('..');
      expect(storedName).not.toContain('/');
    });
  });

  describe('CORS Security', () => {
    it('should include proper CORS headers', async () => {
      // 204, not 200: a preflight carries no body, and that is the cors
      // package's default success status.
      const response = await request(app)
        .options('/api/tickets')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Origin', 'http://malicious-site.com')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      // And no allow-origin header, so a browser would refuse to hand the
      // response to the page even if it got one.
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['strict-transport-security']).toBeDefined();
      // helmet 7 sets X-XSS-Protection to 0 on purpose: the legacy XSS auditor
      // is removed from modern browsers and could itself be abused, so asking
      // for '1; mode=block' would be a step backwards.
      expect(response.headers['x-xss-protection']).toBe('0');
      // and the stack should not be advertised
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
