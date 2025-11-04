import request from 'supertest';
import { app } from '../../src/index';
import { User } from '../../src/models/User';
import { Company } from '../../src/models/Company';
import { Team } from '../../src/models/Team';
import { JWTUtils } from '../../src/utils/jwt';
import jwt from 'jsonwebtoken';

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

    await Company.addUserToCompany(userId, companyId);
    validToken = JWTUtils.generateAccessToken({ userId });
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
      const tokenForNonExistentUser = JWTUtils.generateAccessToken({
        userId: 'non-existent-user-id',
      });

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
      otherUserToken = JWTUtils.generateAccessToken({ userId: otherUser.id });
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
      await request(app)
        .get('/api/queues/metrics')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);
    });

    it('should prevent role escalation attempts', async () => {
      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          role: 'admin', // Attempting to escalate role
          firstName: 'Updated',
        })
        .expect(400); // Should reject role changes
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

    it('should prevent XSS in ticket content', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: xssPayload,
          description: `<img src="x" onerror="alert('XSS')">`,
          companyId: companyId,
          teamId: teamId,
        })
        .expect(201);

      // Content should be sanitized
      expect(response.body.data.title).not.toContain('<script>');
      expect(response.body.data.description).not.toContain('onerror');
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

    it('should prevent oversized payloads', async () => {
      const largeDescription = 'A'.repeat(100000); // 100KB description

      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Large Payload Test',
          description: largeDescription,
          companyId: companyId,
          teamId: teamId,
        })
        .expect(413); // Payload too large
    });
  });

  describe('Rate Limiting Security', () => {
    it('should rate limit login attempts', async () => {
      const loginAttempts = Array.from({ length: 10 }, () =>
        request(app).post('/api/auth/login').send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        })
      );

      const responses = await Promise.all(loginAttempts);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);

    it('should rate limit ticket creation', async () => {
      const ticketCreationAttempts = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            title: `Rate Limit Test ${i}`,
            description: 'Testing rate limits',
            companyId: companyId,
            teamId: teamId,
          })
      );

      const responses = await Promise.all(ticketCreationAttempts);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
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

    it('should reject malicious file types', async () => {
      const maliciousScript = Buffer.from('<?php system($_GET["cmd"]); ?>');

      await request(app)
        .post(`/api/tickets/${ticketId}/files`)
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', maliciousScript, 'malicious.php')
        .expect(400); // Should reject PHP files
    });

    it('should reject oversized files', async () => {
      const largeFile = Buffer.alloc(50 * 1024 * 1024); // 50MB file

      await request(app)
        .post(`/api/tickets/${ticketId}/files`)
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', largeFile, 'large.txt')
        .expect(413); // Payload too large
    });

    it('should sanitize file names', async () => {
      const maliciousFileName = '../../../etc/passwd';
      const fileContent = Buffer.from('test content');

      const response = await request(app)
        .post(`/api/tickets/${ticketId}/files`)
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', fileContent, maliciousFileName)
        .expect(201);

      // File name should be sanitized
      expect(response.body.data.fileName).not.toContain('../');
      expect(response.body.data.fileName).not.toContain('/etc/passwd');
    });
  });

  describe('CORS Security', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/tickets')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      await request(app)
        .get('/api/tickets')
        .set('Origin', 'http://malicious-site.com')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403); // Should be blocked by CORS policy
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
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });
});
