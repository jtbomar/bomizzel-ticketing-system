import request from 'supertest';
import { app } from '@/app';
import { db } from '@/config/database';
import { AuthService } from '@/services/AuthService';
import { EmailService } from '@/services/EmailService';
import { TicketService } from '@/services/TicketService';
import { CompanyService } from '@/services/CompanyService';
import { TeamService } from '@/services/TeamService';
import { QueueService } from '@/services/QueueService';

// Mock EmailService
jest.mock('@/services/EmailService');
const MockedEmailService = EmailService as jest.Mocked<typeof EmailService>;

describe('Email API', () => {
  let employeeToken: string;
  let employeeId: string;
  let companyId: string;
  let teamId: string;
  let queueId: string;
  let ticketId: string;
  let templateId: string;

  beforeAll(async () => {
    // Clean up database
    await db('email_templates').del();
    await db('tickets').del();
    await db('queues').del();
    await db('teams').del();
    await db('user_company_associations').del();
    await db('companies').del();
    await db('users').del();

    // Create test employee
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
    });
    companyId = company.id;

    // Create test team
    const team = await TeamService.createTeam({
      name: 'Test Team',
      description: 'Test team for email',
    });
    teamId = team.id;

    // Add employee to team
    await TeamService.addMember(teamId, employeeId, 'member');

    // Create test queue
    const queue = await QueueService.createQueue({
      name: 'Test Queue',
      type: 'unassigned',
      teamId,
    });
    queueId = queue.id;

    // Create test ticket
    const ticket = await TicketService.createTicket(
      {
        title: 'Test Ticket for Email',
        description: 'Test ticket description',
        companyId,
        teamId,
      },
      employeeId
    );
    ticketId = ticket.id;

    // Mock EmailService methods
    MockedEmailService.isInitialized.mockReturnValue(true);
    MockedEmailService.verifyConnection.mockResolvedValue(true);
    MockedEmailService.getEmailConfig.mockResolvedValue({
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: { user: 'test@test.com', pass: 'password' },
      from: 'noreply@test.com',
    });
    MockedEmailService.sendTicketEmail.mockResolvedValue({
      messageId: 'test-message-id',
      subject: 'Test Subject',
      to: ['customer@test.com'],
      sentAt: new Date(),
    });
    MockedEmailService.sendTicketNotification.mockResolvedValue();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('POST /tickets/:ticketId/email', () => {
    it('should send email from ticket', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/email`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          to: ['customer@test.com'],
          cc: ['manager@test.com'],
          subject: 'Test Email Subject',
          htmlBody: '<p>Test HTML content</p>',
          textBody: 'Test text content',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messageId).toBe('test-message-id');
      expect(MockedEmailService.sendTicketEmail).toHaveBeenCalledWith(
        employeeId,
        expect.objectContaining({
          ticketId,
          to: ['customer@test.com'],
          cc: ['manager@test.com'],
          subject: 'Test Email Subject',
          htmlBody: '<p>Test HTML content</p>',
          textBody: 'Test text content',
        })
      );
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/email`)
        .send({
          to: ['customer@test.com'],
          subject: 'Test Subject',
          textBody: 'Test content',
        });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/email`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          to: ['customer@test.com'],
          // Missing subject
        });

      expect(response.status).toBe(400);
    });

    it('should require either htmlBody or textBody', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/email`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          to: ['customer@test.com'],
          subject: 'Test Subject',
          // Missing both htmlBody and textBody
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_BODY');
    });
  });

  describe('POST /tickets/:ticketId/notify', () => {
    it('should send ticket notification', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notify`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'assigned',
          recipients: ['customer@test.com'],
          message: 'Your ticket has been assigned',
          additionalData: { assigneeName: 'John Doe' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(MockedEmailService.sendTicketNotification).toHaveBeenCalledWith(
        ticketId,
        'assigned',
        ['customer@test.com'],
        {
          message: 'Your ticket has been assigned',
          assigneeName: 'John Doe',
        }
      );
    });

    it('should validate notification type', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notify`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'invalid_type',
          recipients: ['customer@test.com'],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /email/status', () => {
    it('should return email service status', async () => {
      const response = await request(app)
        .get('/api/email/status')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isInitialized).toBe(true);
      expect(response.body.data.isConnected).toBe(true);
      expect(response.body.data.config).toMatchObject({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        from: 'noreply@test.com',
      });
    });
  });

  describe('Email Templates', () => {
    describe('POST /email/templates', () => {
      it('should create email template', async () => {
        const response = await request(app)
          .post('/api/email/templates')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            name: 'test_template',
            subject: 'Test Template: {{ticket.title}}',
            htmlBody: '<p>Hello {{customer.firstName}}</p>',
            textBody: 'Hello {{customer.firstName}}',
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('test_template');
        templateId = response.body.data.id;
      });

      it('should validate template fields', async () => {
        const response = await request(app)
          .post('/api/email/templates')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            name: 'invalid_template',
            subject: '', // Empty subject
            htmlBody: '',
            textBody: '', // Both bodies empty
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_TEMPLATE');
      });
    });

    describe('GET /email/templates', () => {
      it('should get all templates', async () => {
        const response = await request(app)
          .get('/api/email/templates')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('should get only active templates', async () => {
        const response = await request(app)
          .get('/api/email/templates?activeOnly=true')
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
      });
    });

    describe('GET /email/templates/:templateId', () => {
      it('should get template by ID', async () => {
        const response = await request(app)
          .get(`/api/email/templates/${templateId}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(templateId);
      });

      it('should return 404 for non-existent template', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .get(`/api/email/templates/${fakeId}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe('TEMPLATE_NOT_FOUND');
      });
    });

    describe('PUT /email/templates/:templateId', () => {
      it('should update template', async () => {
        const response = await request(app)
          .put(`/api/email/templates/${templateId}`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            subject: 'Updated Template: {{ticket.title}}',
            htmlBody: '<p>Updated HTML content</p>',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.subject).toBe('Updated Template: {{ticket.title}}');
      });
    });

    describe('POST /email/templates/:templateId/render', () => {
      it('should render template with variables', async () => {
        const response = await request(app)
          .post(`/api/email/templates/${templateId}/render`)
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({
            variables: {
              'ticket.title': 'My Test Ticket',
              'customer.firstName': 'John',
            },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.subject).toContain('My Test Ticket');
      });
    });

    describe('DELETE /email/templates/:templateId', () => {
      it('should delete template', async () => {
        const response = await request(app)
          .delete(`/api/email/templates/${templateId}`)
          .set('Authorization', `Bearer ${employeeToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('GET /email/template-variables', () => {
    it('should return template variables reference', async () => {
      const response = await request(app)
        .get('/api/email/template-variables')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('ticket');
      expect(response.body.data).toHaveProperty('customer');
      expect(response.body.data).toHaveProperty('company');
      expect(response.body.data.ticket).toContain('ticket.id');
    });
  });
});
