import request from 'supertest';
import { app } from '@/app';
import { db } from '@/config/database';
import { AuthService } from '@/services/AuthService';
import { TicketService } from '@/services/TicketService';
import { CompanyService } from '@/services/CompanyService';
import { TeamService } from '@/services/TeamService';
import { QueueService } from '@/services/QueueService';

describe('Ticket Notes API', () => {
  let customerToken: string;
  let employeeToken: string;
  let customerId: string;
  let employeeId: string;
  let companyId: string;
  let teamId: string;
  let queueId: string;
  let ticketId: string;

  beforeAll(async () => {
    // Clean up database
    await db('ticket_notes').del();
    await db('tickets').del();
    await db('queues').del();
    await db('teams').del();
    await db('user_company_associations').del();
    await db('companies').del();
    await db('users').del();

    // Create test users
    const customer = await AuthService.register({
      email: 'customer@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Customer',
      role: 'customer',
    });
    customerId = customer.user.id;
    customerToken = customer.token;

    const employee = await AuthService.register({
      email: 'employee@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
    });
    employeeId = employee.user.id;
    employeeToken = employee.token;

    // Create test company
    const company = await CompanyService.createCompany({
      name: 'Test Company',
      domain: 'test.com',
    }, employeeId);
    companyId = company.id;

    // Associate customer with company
    await CompanyService.addUserToCompany(companyId, customerId, 'member', employeeId);

    // Create test team
    const team = await TeamService.createTeam({
      name: 'Test Team',
      description: 'Test team for notes',
    }, employeeId);
    teamId = team.id;

    // Add employee to team
    await TeamService.addUserToTeam(teamId, employeeId, 'member', employeeId);

    // Create test queue
    const queue = await QueueService.createQueue({
      name: 'Test Queue',
      type: 'unassigned',
      teamId,
    }, employeeId, 'employee');
    queueId = queue.id;

    // Create test ticket
    const ticket = await TicketService.createTicket(
      {
        title: 'Test Ticket for Notes',
        description: 'Test ticket description',
        companyId,
        teamId,
      },
      customerId
    );
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('POST /tickets/:ticketId/notes', () => {
    it('should create a customer note', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          content: 'This is a customer note',
          isInternal: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        content: 'This is a customer note',
        isInternal: false,
        isEmailGenerated: false,
        authorId: customerId,
        ticketId,
      });
    });

    it('should create an internal employee note', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          content: 'This is an internal employee note',
          isInternal: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        content: 'This is an internal employee note',
        isInternal: true,
        isEmailGenerated: false,
        authorId: employeeId,
        ticketId,
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).post(`/api/tickets/${ticketId}/notes`).send({
        content: 'Unauthorized note',
      });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should reject invalid ticket ID', async () => {
      const response = await request(app)
        .post('/api/tickets/invalid-id/notes')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          content: 'Test note',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /tickets/:ticketId/notes', () => {
    it('should get all notes for employee', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter internal notes for customers', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      // Should not include internal notes
      const hasInternalNotes = response.body.data.some((note: any) => note.isInternal);
      expect(hasInternalNotes).toBe(false);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/notes?page=1&limit=1`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await request(app).get(`/api/tickets/${ticketId}/notes`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /notes/:noteId', () => {
    let noteId: string;

    beforeAll(async () => {
      // Create a note to update
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          content: 'Original note content',
          isInternal: false,
        });
      noteId = response.body.data.id;
    });

    it('should update note content', async () => {
      const response = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          content: 'Updated note content',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Updated note content');
    });

    it('should not allow other users to update note', async () => {
      const response = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          content: 'Unauthorized update',
        });

      expect(response.status).toBe(500); // Should be handled by service error
    });

    it('should require authentication', async () => {
      const response = await request(app).put(`/api/notes/${noteId}`).send({
        content: 'Unauthorized update',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /notes/:noteId', () => {
    let noteId: string;

    beforeAll(async () => {
      // Create a note to delete
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          content: 'Note to be deleted',
          isInternal: false,
        });
      noteId = response.body.data.id;
    });

    it('should delete own note', async () => {
      const response = await request(app)
        .delete(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent note', async () => {
      const response = await request(app)
        .delete(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app).delete('/api/notes/some-id');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /notes/search', () => {
    beforeAll(async () => {
      // Create some searchable notes
      await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          content: 'Searchable customer note with keyword',
          isInternal: false,
        });

      await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          content: 'Searchable employee note with keyword',
          isInternal: true,
        });
    });

    it('should search notes by content', async () => {
      const response = await request(app)
        .get('/api/notes/search?q=keyword')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter internal notes for customers', async () => {
      const response = await request(app)
        .get('/api/notes/search?q=keyword')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Should not include internal notes
      const hasInternalNotes = response.body.data.some((note: any) => note.isInternal);
      expect(hasInternalNotes).toBe(false);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/notes/search?q=keyword&page=1&limit=1')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/notes/search?q=keyword');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /tickets/:ticketId/notes/history', () => {
    it('should get notes history', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/notes/history`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should require authentication', async () => {
      const response = await request(app).get(`/api/tickets/${ticketId}/notes/history`);

      expect(response.status).toBe(401);
    });
  });
});
