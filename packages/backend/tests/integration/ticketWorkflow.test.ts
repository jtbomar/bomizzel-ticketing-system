import request from 'supertest';
import { app } from '../../src/index';
import { User } from '../../src/models/User';
import { Company } from '../../src/models/Company';
import { Team } from '../../src/models/Team';
import { CustomField } from '../../src/models/CustomField';
import { JWTUtils } from '../../src/utils/jwt';

describe('Ticket Workflow Integration', () => {
  let customerToken: string;
  let employeeToken: string;
  let teamLeadToken: string;
  let customerId: string;
  let employeeId: string;
  let teamLeadId: string;
  let companyId: string;
  let teamId: string;

  beforeAll(async () => {
    // Create test company
    const company = await Company.createCompany({
      name: 'Integration Test Company',
      domain: 'integration.com',
    });
    companyId = company.id;

    // Create test team
    const team = await Team.createTeam({
      name: 'Integration Support Team',
      description: 'Team for integration testing',
    });
    teamId = team.id;

    // Create test users
    const customer = await User.createUser({
      email: 'customer@integration.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Customer',
      role: 'customer',
    });
    customerId = customer.id;

    const employee = await User.createUser({
      email: 'employee@integration.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
    });
    employeeId = employee.id;

    const teamLead = await User.createUser({
      email: 'teamlead@integration.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'TeamLead',
      role: 'team_lead',
    });
    teamLeadId = teamLead.id;

    // Set up associations
    await Company.addUserToCompany(customerId, companyId);
    await Team.addUserToTeam(employeeId, teamId);
    await Team.addUserToTeam(teamLeadId, teamId);

    // Generate tokens
    customerToken = JWTUtils.generateAccessToken({ userId: customerId });
    employeeToken = JWTUtils.generateAccessToken({ userId: employeeId });
    teamLeadToken = JWTUtils.generateAccessToken({ userId: teamLeadId });

    // Create custom fields
    await CustomField.createField({
      teamId: teamId,
      name: 'issue_type',
      label: 'Issue Type',
      type: 'picklist',
      isRequired: true,
      options: ['Bug', 'Feature Request', 'Support'],
      order: 1,
    });

    await CustomField.createField({
      teamId: teamId,
      name: 'severity',
      label: 'Severity',
      type: 'picklist',
      isRequired: false,
      options: ['Low', 'Medium', 'High', 'Critical'],
      order: 2,
    });
  });

  describe('Complete Ticket Lifecycle', () => {
    let ticketId: string;

    it('should allow customer to create ticket with custom fields', async () => {
      const ticketData = {
        title: 'Integration Test Ticket',
        description: 'This is a comprehensive integration test ticket',
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {
          issue_type: 'Bug',
          severity: 'High',
        },
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(ticketData.title);
      expect(response.body.data.status).toBe('open');
      expect(response.body.data.customFieldValues.issue_type).toBe('Bug');
      expect(response.body.data.customFieldValues.severity).toBe('High');

      ticketId = response.body.data.id;
    });

    it('should allow customer to add notes to their ticket', async () => {
      const noteData = {
        content: 'Additional information about the bug',
        isInternal: false,
      };

      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(noteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(noteData.content);
      expect(response.body.data.isInternal).toBe(false);
    });

    it('should allow customer to upload file attachment', async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/files`)
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('file', Buffer.from('test file content'), 'test.txt')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fileName).toBe('test.txt');
    });

    it('should allow employee to view ticket in queue', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({ teamId: teamId })
        .expect(200);

      expect(response.body.success).toBe(true);
      const ticket = response.body.data.find((t: any) => t.id === ticketId);
      expect(ticket).toBeDefined();
      expect(ticket.title).toBe('Integration Test Ticket');
    });

    it('should allow employee to assign ticket to themselves', async () => {
      const response = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ assignedToId: employeeId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedToId).toBe(employeeId);
    });

    it('should allow employee to add internal note', async () => {
      const noteData = {
        content: 'Internal note: Investigating the issue',
        isInternal: true,
      };

      const response = await request(app)
        .post(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(noteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isInternal).toBe(true);
    });

    it('should not show internal notes to customer', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const internalNotes = response.body.data.filter((note: any) => note.isInternal);
      expect(internalNotes).toHaveLength(0);
    });

    it('should allow employee to update ticket status', async () => {
      const response = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
    });

    it('should allow employee to send email from ticket', async () => {
      const emailData = {
        to: 'customer@integration.com',
        subject: 'Re: Integration Test Ticket',
        body: 'We are working on your issue and will update you soon.',
        templateId: null,
      };

      const response = await request(app)
        .post(`/api/tickets/${ticketId}/email`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(emailData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Email sent successfully');
    });

    it('should create note from sent email', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/notes`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const emailNotes = response.body.data.filter((note: any) => note.isEmailGenerated);
      expect(emailNotes.length).toBeGreaterThan(0);
    });

    it('should allow employee to resolve ticket', async () => {
      const response = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'resolved' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('resolved');
    });

    it('should track complete ticket history', async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/history`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const actions = response.body.data.map((h: any) => h.action);
      expect(actions).toContain('created');
      expect(actions).toContain('assigned');
      expect(actions).toContain('status_changed');
    });
  });

  describe('Custom Field Configuration Workflow', () => {
    it('should allow team lead to create custom field', async () => {
      const fieldData = {
        name: 'priority_score',
        label: 'Priority Score',
        type: 'integer',
        isRequired: false,
        validation: {
          min: 1,
          max: 10,
        },
        order: 3,
      };

      const response = await request(app)
        .post(`/api/teams/${teamId}/custom-fields`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(fieldData.name);
      expect(response.body.data.type).toBe(fieldData.type);
    });

    it('should validate custom field usage in ticket creation', async () => {
      const ticketData = {
        title: 'Ticket with New Custom Field',
        description: 'Testing new custom field',
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {
          issue_type: 'Support',
          priority_score: 8,
        },
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customFieldValues.priority_score).toBe(8);
    });

    it('should reject invalid custom field values', async () => {
      const ticketData = {
        title: 'Ticket with Invalid Custom Field',
        description: 'Testing validation',
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {
          issue_type: 'Support',
          priority_score: 15, // Exceeds max value of 10
        },
      };

      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(ticketData)
        .expect(400);
    });
  });

  describe('Queue Management Workflow', () => {
    it('should show tickets in unassigned queue', async () => {
      const response = await request(app)
        .get('/api/queues')
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({ type: 'unassigned', teamId: teamId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should show employee personal queue', async () => {
      const response = await request(app)
        .get('/api/queues')
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({ type: 'employee', assignedToId: employeeId })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should provide queue metrics', async () => {
      const response = await request(app)
        .get(`/api/queues/metrics`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .query({ teamId: teamId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalTickets');
      expect(response.body.data).toHaveProperty('statusCounts');
    });
  });

  describe('Bulk Operations Workflow', () => {
    let ticketIds: string[];

    beforeAll(async () => {
      // Create multiple tickets for bulk operations
      const tickets = await Promise.all([
        request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            title: 'Bulk Test Ticket 1',
            description: 'First bulk test ticket',
            companyId: companyId,
            teamId: teamId,
            customFieldValues: { issue_type: 'Bug' },
          }),
        request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            title: 'Bulk Test Ticket 2',
            description: 'Second bulk test ticket',
            companyId: companyId,
            teamId: teamId,
            customFieldValues: { issue_type: 'Feature Request' },
          }),
      ]);

      ticketIds = tickets.map(response => response.body.data.id);
    });

    it('should allow bulk status update', async () => {
      const response = await request(app)
        .put('/api/tickets/bulk')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          ticketIds: ticketIds,
          updates: { status: 'in_progress' },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBe(ticketIds.length);
    });

    it('should allow bulk assignment', async () => {
      const response = await request(app)
        .put('/api/tickets/bulk')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          ticketIds: ticketIds,
          updates: { assignedToId: employeeId },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBe(ticketIds.length);
    });
  });
});