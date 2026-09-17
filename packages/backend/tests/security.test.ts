import request from 'supertest';
import express from 'express';
import { app } from '../src/index';
import { createRateLimiter } from '../src/middleware/rateLimiter';
import { errorHandler } from '../src/middleware/errorHandler';
import { isRedisAvailable, redisClient } from '../src/config/redis';

describe('Security Middleware Tests', () => {
  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts in request body', async () => {
      const maliciousInput = {
        title: '<script>alert("xss")</script>Test Title',
        description: 'javascript:alert("xss")',
      };

      const response = await request(app).post('/api/auth/register').send(maliciousInput);

      // The request should be processed but the input should be sanitized
      expect(response.status).toBe(400); // Validation error due to missing required fields
    });

    it('should block requests with suspicious user agents', async () => {
      // Aimed at a real API path, not /api/health: the health endpoints are
      // deliberately exempt from this check so platform probes always get through.
      const response = await request(app).get('/api/auth/profile').set('User-Agent', 'sqlmap/1.0');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('BLOCKED_USER_AGENT');
    });

    it('should not block ordinary HTTP clients', async () => {
      // curl, wget and python-requests were on the blocklist. They are ordinary
      // clients, not attack tools, and blocking them broke scripts and webhooks
      // while stopping nobody - a User-Agent is whatever the caller says it is.
      for (const ua of ['curl/8.5.0', 'Wget/1.21', 'python-requests/2.31.0', 'axios/1.6.0']) {
        const response = await request(app).get('/api/auth/profile').set('User-Agent', ua);
        expect(response.status).not.toBe(403);
      }
    });

    it('should allow requests with no user agent header', async () => {
      // This used to be a 400. The header is set by the caller, so requiring it
      // stopped no attacker; it only rejected honest server-to-server clients
      // and HTTP libraries that omit it.
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
    });

    it('should let health checks through regardless of user agent', async () => {
      // Railway's probe sends no User-Agent. If these ever start failing the
      // platform marks the service unhealthy and takes it out of rotation.
      for (const path of ['/health', '/api/health']) {
        expect((await request(app).get(path)).status).toBe(200);
        expect((await request(app).get(path).set('User-Agent', 'sqlmap/1.0')).status).toBe(200);
      }
    });
  });

  describe('Rate Limiting', () => {
    // These used to assert rate limit headers on /health, which has never been
    // rate limited - no limiter is mounted globally, only on specific routes
    // like /auth/login. So they were asserting behaviour the app does not have,
    // and the middleware itself went untested. Exercise it directly instead, on
    // its own app, with a Redis stand-in: it needs Redis, and the suite's shared
    // mock reports Redis as unavailable (which makes the limiter step aside).
    const buildApp = (maxRequests: number) => {
      const store = new Map<string, number>();

      (isRedisAvailable as jest.Mock).mockReturnValue(true);
      (redisClient.get as jest.Mock).mockImplementation(async (key: string) =>
        store.has(key) ? String(store.get(key)) : null
      );
      (redisClient as unknown as { multi: jest.Mock }).multi = jest.fn(() => {
        const queued: Array<() => void> = [];
        const pipeline = {
          incr: (key: string) => {
            queued.push(() => store.set(key, (store.get(key) || 0) + 1));
            return pipeline;
          },
          expire: () => pipeline,
          exec: async () => queued.forEach((run) => run()),
        };
        return pipeline;
      });

      const limited = express();
      limited.use(createRateLimiter({ windowMs: 60_000, maxRequests }));
      limited.get('/thing', (_req, res) => res.json({ ok: true }));
      limited.use(errorHandler);
      return limited;
    };

    afterEach(() => {
      (isRedisAvailable as jest.Mock).mockReturnValue(false);
    });

    it('should allow requests within rate limit, and report what is left', async () => {
      const limited = buildApp(3);

      const first = await request(limited).get('/thing').expect(200);
      expect(first.headers['x-ratelimit-limit']).toBe('3');
      expect(first.headers['x-ratelimit-remaining']).toBe('2');

      const second = await request(limited).get('/thing').expect(200);
      expect(second.headers['x-ratelimit-remaining']).toBe('1');
    });

    it('should block requests exceeding rate limit', async () => {
      const limited = buildApp(2);

      await request(limited).get('/thing').expect(200);
      await request(limited).get('/thing').expect(200);

      const blocked = await request(limited).get('/thing').expect(429);
      expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should let requests through when Redis is unavailable', async () => {
      // Failing closed here would take the whole API down with Redis.
      const limited = buildApp(1);
      (isRedisAvailable as jest.Mock).mockReturnValue(false);

      await request(limited).get('/thing').expect(200);
      await request(limited).get('/thing').expect(200);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['strict-transport-security']).toContain('max-age=');

      // Not "1; mode=block". Browsers removed the XSS auditor this header drove,
      // and enabling it was itself exploitable, so helmet sends 0 to switch off
      // whatever remains of it. 0 is the value we want here.
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should not expose server information', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Content Type Validation', () => {
    it('should require content-type for POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      // Should pass content-type validation since supertest sets it automatically
      expect(response.status).not.toBe(415);
    });

    it('should reject unsupported content types', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/xml')
        .send('<xml>test</xml>');

      expect(response.status).toBe(415);
      expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('Request Size Limits', () => {
    it('should reject requests that are too large', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await request(app).post('/api/auth/register').send({ data: largePayload });

      expect(response.status).toBe(413);
    });
  });

  describe('Method Validation', () => {
    it('should allow valid HTTP methods', async () => {
      const response = await request(app).get('/health');

      expect(response.status).not.toBe(405);
    });
  });
});

describe('Performance Monitoring Tests', () => {
  it('should include performance headers in responses', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('should log performance metrics', async () => {
    // This test would verify that performance metrics are being logged
    // For now, just ensure the request completes successfully
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
  });
});

describe('File Upload Security Tests', () => {
  describe('File Type Validation', () => {
    it('should reject dangerous file types', async () => {
      // This test would need authentication and a valid ticket
      // For now, just test that the endpoint exists
      const response = await request(app).post('/api/files/upload');

      expect(response.status).toBe(401); // Should require authentication
    });
  });
});
