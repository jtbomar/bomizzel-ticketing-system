import request from 'supertest';
import { app } from '../src/index';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { Team } from '../src/models/Team';
import { Queue } from '../src/models/Queue';
import { JWTUtils } from '../src/utils/jwt';

describe('Ticket Management', () => {
  let customerToken: string;
  let employeeToken: string;
  let customerId: string;
  let employeeId: string;
  let companyId: string;
  let teamId: string;
  let queueId: string;

  beforeAll(async () => {
    // Create test company
    const company = await Company.createCompany({
      name: 'Test Company',
      domain: 'test.com',
      description: 'Test company for ticket management',
    });
    companyId = company.id;

    // Create test team
    const team = await Team.createTeam({
      name: 'Support Team',
      description: 'Customer support team',
    });
    teamId = team.id;

    // Create test queue
    const queue = await Queue.createQueue({
      name: 'General Support',
      type: 'unassigned',
      teamId: teamId,
    });
    queueId = queue.id;

    // Create test customer
    const customer = await User.createUser({
      email: 'customer@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Customer',
      role: 'customer',
    });
    customerId = customer.id;

    // Create test employee
    const employee = await User.createUser({
      email: 'employee@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
    });
    employeeId = employee.id;

    // Associate customer with company
    await Company.addUserToCompany(customerId, companyId);

    // Associate employee with team
    await Team.addUserToTeam(employeeId, teamId);

    // Generate tokens
    customerToken = JWTUtils.generateAccessToken({ userId: customerId });
    employeeToken = JWTUtils.generateAccessToken({ userId: employeeId });
  });

  describe('POST /api/tickets', () => {
    it('should create a new ticket for authenticated customer', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'This is a test ticket',
        companyId: companyId,
        teamId: teamId,
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(ticketData.title);
      expect(response.body.data.description).toBe(ticketData.description);
      expect(response.body.data.status).toBe('open');
      expect(response.body.data.submitterId).toBe(customerId);
    });

    it('should reject ticket creation without authentication', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'This is a test ticket',
        companyId: companyId,
        teamId: teamId,
      };

      await request(app).post('/api/tickets').send(ticketData).expect(401);
    });

    it('should reject ticket creation for company user is not associated with', async () => {
      // Create another company
      const otherCompany = await Company.createCompany({
        name: 'Other Company',
        domain: 'other.com',
      });

      const ticketData = {
        title: 'Test Ticket',
        description: 'This is a test ticket',
        companyId: otherCompany.id,
        teamId: teamId,
      };

      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ticketData)
        .expect(403);
    });
  });

  describe('GET /api/tickets', () => {
    let ticketId: string;

    beforeAll(async () => {
      // Create a test ticket
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Test Ticket for Retrieval',
          description: 'This ticket is for testing retrieval',
          companyId: companyId,
          teamId: teamId,
        });

      ticketId = response.body.data.id;
    });

    it('should retrieve tickets for authenticated customer', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
    });

    it('should retrieve specific ticket by ID', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(ticketId);
      expect(response.body.data.title).toBe('Test Ticket for Retrieval');
    });

    it('should reject access to tickets without authentication', async () => {
      await request(app).get('/api/tickets').expect(401);
    });
  });

  describe('PUT /api/tickets/:id', () => {
    let ticketId: string;

    beforeAll(async () => {
      // Create a test ticket
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          title: 'Test Ticket for Update',
          description: 'This ticket is for testing updates',
          companyId: companyId,
          teamId: teamId,
        });

      ticketId = response.body.data.id;
    });

    it('should allow customer to update their own ticket', async () => {
      const updateData = {
        title: 'Updated Test Ticket',
        description: 'This ticket has been updated',
      };

      const response = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
    });

    it('should allow employee to assign ticket', async () => {
      const response = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ assignedToId: employeeId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedToId).toBe(employeeId);
    });
  });

  describe('Queue Management', () => {
    it('should retrieve queue tickets for employee', async () => {
      const response = await request(app)
        .get(`/api/queues/${queueId}/tickets`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should retrieve queue details', async () => {
      const response = await request(app)
        .get(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(queueId);
      expect(response.body.data.name).toBe('General Support');
    });
  });
});
