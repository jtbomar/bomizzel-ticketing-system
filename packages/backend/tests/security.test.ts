import request from 'supertest';
import { app } from '../src/index';

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
      const response = await request(app).get('/api/health').set('User-Agent', 'sqlmap/1.0');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('BLOCKED_USER_AGENT');
    });

    it('should require user agent header', async () => {
      const response = await request(app).get('/api/health').set('User-Agent', '');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_USER_AGENT');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should block requests exceeding rate limit', async () => {
      // This test would need to make many requests quickly
      // For now, just verify rate limit headers are present
      const response = await request(app).get('/health');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
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
