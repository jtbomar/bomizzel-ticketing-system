import request from 'supertest';
import { app } from '../../src/index';
import { User } from '../../src/models/User';
import { Company } from '../../src/models/Company';
import { Team } from '../../src/models/Team';
import { JWTUtils } from '../../src/utils/jwt';
import { createTestToken } from '../helpers/testUtils';
import { Queue } from '../../src/models/Queue';
import { TicketStatus } from '../../src/models/TicketStatus';
import { Ticket } from '../../src/models/Ticket';

describe('Performance Load Tests', () => {
  let customerTokens: string[] = [];
  let employeeTokens: string[] = [];
  let companyId: string;
  let teamId: string;
  let queueId: string;

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

    // Ticket creation needs a queue on the team and the team's statuses; without
    // them every POST /api/tickets fails with "No available queue found for
    // team" and the 201 assertions below cannot hold.
    const queue = await Queue.createQueue({
      name: 'Load Test Queue',
      description: 'Default queue for load testing',
      type: 'unassigned',
      teamId,
    });
    queueId = queue.id;
    await TicketStatus.seedDefaultStatuses(teamId);

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
      return createTestToken(user.id);
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
      return createTestToken(user.id);
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
      responses.forEach((response) => {
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

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      const avgResponseTime = duration / responses.length;
      expect(avgResponseTime).toBeLessThan(50); // Average under 50ms per request

      console.log(
        `Retrieved tickets 100 times in ${duration}ms (avg: ${avgResponseTime}ms per request)`
      );
    }, 10000);
  });

  describe('Database Performance', () => {
    it('should handle large dataset queries efficiently', async () => {
      // The fixture used to be built with a thousand HTTP POSTs, which is what
      // actually consumed the sixty seconds - the test then had nothing left to
      // measure the thing it is named after. The dataset is the precondition,
      // not the subject, so insert it in one statement.
      const submitterId = (await User.findByEmail('customer0@loadtest.com'))!.id;

      await Ticket.query.insert(
        Array.from({ length: 1000 }, (_, i) => ({
          title: `Performance Test Ticket ${i}`,
          description: `Performance test ticket ${i}`,
          status: 'open',
          priority: 0,
          submitter_id: submitterId,
          company_id: companyId,
          queue_id: queueId,
          team_id: teamId,
          custom_field_values: JSON.stringify({}),
        }))
      );

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${customerTokens[0]}`)
        // `search`, not `query`. The route takes search, so the old parameter
        // was dropped on the floor and this measured an unfiltered list.
        .query({
          search: 'Performance',
          limit: 50,
          page: 1,
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Both title and description are matched with a leading-wildcard ILIKE,
      // which cannot use an index, so this is two sequential scans of the table
      // - one for the page, one for the count. 3s leaves room for a shared
      // runner while still catching the day that becomes minutes.
      expect(duration).toBeLessThan(3000);

      console.log(`Searched 1000+ tickets in ${duration}ms`);
    }, 60000);
  });

  describe('Authentication Performance', () => {
    it('should handle concurrent login requests', async () => {
      // Twenty, not fifty. Passwords are hashed with bcrypt at cost 12, which is
      // deliberately expensive, and bcrypt runs on libuv's four-thread pool, so
      // logins serialise four at a time no matter how many arrive. Fifty could
      // not fit in the ten second timeout this test had; it was asserting that a
      // security control was cheap.
      const startTime = Date.now();

      const loginPromises = Array.from({ length: 20 }, (_, i) => {
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

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });

      const avgResponseTime = duration / responses.length;

      // One budget, not two. This had both an absolute ceiling and an average,
      // sized for different versions of the test and disagreeing with each
      // other - 5000ms total against 300ms x 20 - so it failed on the tighter
      // one at 5061ms while the looser one passed.
      //
      // Throughput, not latency: total elapsed over the number of logins. A
      // bcrypt hash costs about a second on this runner, so twenty across four
      // threads lands near 250ms each. 600ms is well clear of that and still
      // catches the login path picking up a query per request; it will not
      // notice a single bump in bcrypt cost, and should not be trusted to.
      expect(avgResponseTime).toBeLessThan(600);

      console.log(
        `Processed ${responses.length} logins in ${duration}ms (avg: ${avgResponseTime}ms per login)`
      );
    }, 30000);
  });

  describe('Queue Metrics Performance', () => {
    // Named for WebSockets, which it has never tested - the body says as much.
    // It measures the queue metrics endpoint the dashboard polls, so it is named
    // for that. It also asked for /api/queues/metrics, which is not a route: it
    // matched GET /:id, failed uuid validation and returned 400, so every
    // assertion here was made against an error.
    it('should handle repeated team metrics requests', async () => {
      const startTime = Date.now();

      const metricsPromises = Array.from({ length: 20 }, (_, i) => {
        const token = employeeTokens[i % employeeTokens.length];
        return request(app)
          .get(`/api/queues/teams/${teamId}/metrics`)
          .set('Authorization', `Bearer ${token}`);
      });

      const responses = await Promise.all(metricsPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(duration).toBeLessThan(3000);

      console.log(`Retrieved metrics 20 times in ${duration}ms`);
    }, 15000);
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

        // Uploads go to /api/files/upload with the ticket id in the body;
        // /api/tickets/:id/files is not a route, so this was measuring 404s.
        return request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${token}`)
          .field('ticketId', testTicketId)
          .attach('file', fileContent, `test-file-${i}.txt`);
      });

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      responses.forEach((response) => {
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

      // "if available" was doing the work here: jest runs without --expose-gc by
      // default, so global.gc was undefined, nothing was collected, and the test
      // compared two high-water marks. It measured how much garbage 300 requests
      // produce, not whether any of it is retained - and 223MB of garbage is
      // unremarkable. test:performance now passes --expose-gc, so this actually
      // collects before measuring; if it ever does not, say so rather than
      // quietly asserting something else.
      expect(typeof global.gc).toBe('function');
      global.gc!();
      // A second pass, since the first can leave objects that only became
      // unreachable during it.
      global.gc!();

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory retained after GC: ${memoryIncreaseMB.toFixed(2)}MB`);

      // What survives collection is what matters. 300 requests holding on to
      // 50MB would mean something is keeping references it should not.
      expect(memoryIncreaseMB).toBeLessThan(50);
    }, 30000);
  });
});
