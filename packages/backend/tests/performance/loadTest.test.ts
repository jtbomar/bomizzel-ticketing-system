import request from 'supertest';
import { app } from '../../src/index';
import { User } from '../../src/models/User';
import { Company } from '../../src/models/Company';
import { Team } from '../../src/models/Team';
import { JWTUtils } from '../../src/utils/jwt';

describe('Performance Load Tests', () => {
  let customerTokens: string[] = [];
  let employeeTokens: string[] = [];
  let companyId: string;
  let teamId: string;

  beforeAll(async () => {
    // Create test company and team
    const company = await Company.createCompany({
      name: 'Load Test Company',
      domain: 'loadtest.com',
    });
    companyId = company.id;

    const team = await Team.createTeam({
      name: 'Load Test Team',
      description: 'Team for load testing',
    });
    teamId = team.id;

    // Create multiple test users for concurrent testing
    const customerPromises = Array.from({ length: 10 }, async (_, i) => {
      const user = await User.createUser({
        email: `customer${i}@loadtest.com`,
        password: 'password123',
        firstName: `Customer${i}`,
        lastName: 'User',
        role: 'customer',
      });
      await Company.addUserToCompany(user.id, companyId);
      return JWTUtils.generateAccessToken({ userId: user.id });
    });

    const employeePromises = Array.from({ length: 5 }, async (_, i) => {
      const user = await User.createUser({
        email: `employee${i}@loadtest.com`,
        password: 'password123',
        firstName: `Employee${i}`,
        lastName: 'User',
        role: 'employee',
      });
      await Team.addUserToTeam(user.id, teamId);
      return JWTUtils.generateAccessToken({ userId: user.id });
    });

    customerTokens = await Promise.all(customerPromises);
    employeeTokens = await Promise.all(employeePromises);
  }, 30000); // Extended timeout for setup

  describe('Concurrent Ticket Creation', () => {
    it('should handle 50 concurrent ticket creations', async () => {
      const startTime = Date.now();
      
      const ticketPromises = Array.from({ length: 50 }, (_, i) => {
        const token = customerTokens[i % customerTokens.length];
        return request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Load Test Ticket ${i}`,
            description: `This is load test ticket number ${i}`,
            companyId: companyId,
            teamId: teamId,
          });
      });

      const responses = await Promise.all(ticketPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Performance assertion: should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
      
      // Calculate average response time
      const avgResponseTime = duration / responses.length;
      expect(avgResponseTime).toBeLessThan(200); // Average under 200ms per request

      console.log(`Created 50 tickets in ${duration}ms (avg: ${avgResponseTime}ms per ticket)`);
    }, 15000);

    it('should handle concurrent ticket retrieval', async () => {
      const startTime = Date.now();

      const retrievalPromises = Array.from({ length: 100 }, (_, i) => {
        const token = customerTokens[i % customerTokens.length];
        return request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${token}`)
          .query({ limit: 20, page: 1 });
      });

      const responses = await Promise.all(retrievalPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const avgResponseTime = duration / responses.length;
      expect(avgResponseTime).toBeLessThan(50); // Average under 50ms per request

      console.log(`Retrieved tickets 100 times in ${duration}ms (avg: ${avgResponseTime}ms per request)`);
    }, 10000);
  });

  describe('Database Performance', () => {
    it('should handle large dataset queries efficiently', async () => {
      // Create a large number of tickets first
      const ticketPromises = Array.from({ length: 1000 }, (_, i) => {
        const token = customerTokens[i % customerTokens.length];
        return request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Performance Test Ticket ${i}`,
            description: `Performance test ticket ${i}`,
            companyId: companyId,
            teamId: teamId,
          });
      });

      await Promise.all(ticketPromises);

      // Test search performance on large dataset
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${customerTokens[0]}`)
        .query({ 
          query: 'Performance',
          limit: 50,
          page: 1,
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Search should complete within 1 second

      console.log(`Searched 1000+ tickets in ${duration}ms`);
    }, 60000); // Extended timeout for large dataset creation
  });

  describe('Authentication Performance', () => {
    it('should handle concurrent login requests', async () => {
      const startTime = Date.now();

      const loginPromises = Array.from({ length: 50 }, (_, i) => {
        return request(app)
          .post('/api/auth/login')
          .send({
            email: `customer${i % 10}@loadtest.com`,
            password: 'password123',
          });
      });

      const responses = await Promise.all(loginPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });

      expect(duration).toBeLessThan(5000);
      
      const avgResponseTime = duration / responses.length;
      expect(avgResponseTime).toBeLessThan(100);

      console.log(`Processed 50 logins in ${duration}ms (avg: ${avgResponseTime}ms per login)`);
    }, 10000);
  });

  describe('Real-time Performance', () => {
    it('should handle multiple WebSocket connections', async () => {
      // This would test WebSocket connection limits and message broadcasting
      // For now, we'll test the HTTP endpoints that support real-time features
      
      const startTime = Date.now();

      const metricsPromises = Array.from({ length: 20 }, (_, i) => {
        const token = employeeTokens[i % employeeTokens.length];
        return request(app)
          .get('/api/queues/metrics')
          .set('Authorization', `Bearer ${token}`)
          .query({ teamId: teamId });
      });

      const responses = await Promise.all(metricsPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(duration).toBeLessThan(2000);

      console.log(`Retrieved metrics 20 times in ${duration}ms`);
    }, 5000);
  });

  describe('File Upload Performance', () => {
    let testTicketId: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerTokens[0]}`)
        .send({
          title: 'File Upload Test Ticket',
          description: 'For testing file uploads',
          companyId: companyId,
          teamId: teamId,
        });
      
      testTicketId = response.body.data.id;
    });

    it('should handle concurrent file uploads', async () => {
      const startTime = Date.now();

      const uploadPromises = Array.from({ length: 10 }, (_, i) => {
        const token = customerTokens[i % customerTokens.length];
        const fileContent = Buffer.from(`Test file content ${i}`.repeat(100)); // ~2KB file
        
        return request(app)
          .post(`/api/tickets/${testTicketId}/files`)
          .set('Authorization', `Bearer ${token}`)
          .attach('file', fileContent, `test-file-${i}.txt`);
      });

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      expect(duration).toBeLessThan(5000);

      console.log(`Uploaded 10 files in ${duration}ms`);
    }, 10000);
  });

  describe('Memory Usage', () => {
    it('should not have memory leaks during high load', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      const operations = Array.from({ length: 100 }, async (_, i) => {
        const token = customerTokens[i % customerTokens.length];
        
        // Create ticket
        const createResponse = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Memory Test Ticket ${i}`,
            description: 'Memory test',
            companyId: companyId,
            teamId: teamId,
          });

        const ticketId = createResponse.body.data.id;

        // Add note
        await request(app)
          .post(`/api/tickets/${ticketId}/notes`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            content: `Note for ticket ${i}`,
            isInternal: false,
          });

        // Update ticket
        await request(app)
          .put(`/api/tickets/${ticketId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'in_progress' });

        return ticketId;
      });

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(100);
    }, 30000);
  });
});