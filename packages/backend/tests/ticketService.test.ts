import { TicketService } from '../src/services/TicketService';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { Team } from '../src/models/Team';
import { Queue } from '../src/models/Queue';
import { CustomField } from '../src/models/CustomField';

describe('TicketService', () => {
  let customerId: string;
  let employeeId: string;
  let companyId: string;
  let teamId: string;
  let queueId: string;
  let customFieldId: string;

  beforeAll(async () => {
    // Create test data
    const company = await Company.createCompany({
      name: 'Test Company',
      domain: 'test.com',
    });
    companyId = company.id;

    const team = await Team.createTeam({
      name: 'Support Team',
      description: 'Test team',
    });
    teamId = team.id;

    const queue = await Queue.createQueue({
      name: 'Test Queue',
      type: 'unassigned',
      teamId: teamId,
    });
    queueId = queue.id;

    const customer = await User.createUser({
      email: 'customer@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Customer',
      role: 'customer',
    });
    customerId = customer.id;

    const employee = await User.createUser({
      email: 'employee@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Employee',
      role: 'employee',
    });
    employeeId = employee.id;

    await Company.addUserToCompany(customerId, companyId);
    await Team.addUserToTeam(employeeId, teamId);

    // Create custom field
    const customField = await CustomField.createField({
      teamId: teamId,
      name: 'priority_level',
      label: 'Priority Level',
      type: 'picklist',
      isRequired: true,
      options: ['Low', 'Medium', 'High'],
      order: 1,
    });
    customFieldId = customField.id;
  });

  describe('createTicket', () => {
    it('should create ticket with valid data', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'Test description',
        submitterId: customerId,
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {
          priority_level: 'High',
        },
      };

      const ticket = await TicketService.createTicket(ticketData);

      expect(ticket).toHaveProperty('id');
      expect(ticket.title).toBe(ticketData.title);
      expect(ticket.status).toBe('open');
      expect(ticket.submitterId).toBe(customerId);
      expect(ticket.customFieldValues.priority_level).toBe('High');
    });

    it('should validate custom field values', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'Test description',
        submitterId: customerId,
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {
          priority_level: 'Invalid',
        },
      };

      await expect(TicketService.createTicket(ticketData)).rejects.toThrow(
        'Invalid value for custom field'
      );
    });

    it('should require required custom fields', async () => {
      const ticketData = {
        title: 'Test Ticket',
        description: 'Test description',
        submitterId: customerId,
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {},
      };

      await expect(TicketService.createTicket(ticketData)).rejects.toThrow(
        'Required custom field missing'
      );
    });
  });

  describe('assignTicket', () => {
    let ticketId: string;

    beforeEach(async () => {
      const ticket = await TicketService.createTicket({
        title: 'Test Ticket for Assignment',
        description: 'Test description',
        submitterId: customerId,
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {
          priority_level: 'Medium',
        },
      });
      ticketId = ticket.id;
    });

    it('should assign ticket to employee', async () => {
      const updatedTicket = await TicketService.assignTicket(ticketId, employeeId);

      expect(updatedTicket.assignedToId).toBe(employeeId);
    });

    it('should create employee queue when assigning', async () => {
      await TicketService.assignTicket(ticketId, employeeId);

      const employeeQueue = await Queue.findByEmployeeId(employeeId);
      expect(employeeQueue).toBeDefined();
      expect(employeeQueue.type).toBe('employee');
    });

    it('should reject assignment to non-existent employee', async () => {
      await expect(TicketService.assignTicket(ticketId, 'non-existent-id')).rejects.toThrow(
        'Employee not found'
      );
    });
  });

  describe('updateTicketStatus', () => {
    let ticketId: string;

    beforeEach(async () => {
      const ticket = await TicketService.createTicket({
        title: 'Test Ticket for Status Update',
        description: 'Test description',
        submitterId: customerId,
        companyId: companyId,
        teamId: teamId,
        customFieldValues: {
          priority_level: 'Low',
        },
      });
      ticketId = ticket.id;
    });

    it('should update ticket status', async () => {
      const updatedTicket = await TicketService.updateTicketStatus(ticketId, 'in_progress');

      expect(updatedTicket.status).toBe('in_progress');
    });

    it('should track status change history', async () => {
      await TicketService.updateTicketStatus(ticketId, 'in_progress');

      const history = await TicketService.getTicketHistory(ticketId);
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('status_changed');
      expect(history[0].newValue).toBe('in_progress');
    });
  });

  describe('searchTickets', () => {
    beforeAll(async () => {
      // Create multiple test tickets
      await TicketService.createTicket({
        title: 'Bug Report',
        description: 'Application crashes on startup',
        submitterId: customerId,
        companyId: companyId,
        teamId: teamId,
        customFieldValues: { priority_level: 'High' },
      });

      await TicketService.createTicket({
        title: 'Feature Request',
        description: 'Add dark mode support',
        submitterId: customerId,
        companyId: companyId,
        teamId: teamId,
        customFieldValues: { priority_level: 'Low' },
      });
    });

    it('should search tickets by title', async () => {
      const results = await TicketService.searchTickets({
        query: 'Bug',
        companyIds: [companyId],
      });

      expect(results.tickets).toHaveLength(1);
      expect(results.tickets[0].title).toContain('Bug');
    });

    it('should filter by custom field values', async () => {
      const results = await TicketService.searchTickets({
        companyIds: [companyId],
        customFieldFilters: {
          priority_level: 'High',
        },
      });

      expect(results.tickets).toHaveLength(1);
      expect(results.tickets[0].customFieldValues.priority_level).toBe('High');
    });

    it('should filter by status', async () => {
      const results = await TicketService.searchTickets({
        companyIds: [companyId],
        status: 'open',
      });

      expect(results.tickets.length).toBeGreaterThan(0);
      results.tickets.forEach((ticket) => {
        expect(ticket.status).toBe('open');
      });
    });
  });

  describe('getTicketMetrics', () => {
    it('should calculate queue metrics', async () => {
      const metrics = await TicketService.getQueueMetrics(queueId);

      expect(metrics).toHaveProperty('totalTickets');
      expect(metrics).toHaveProperty('statusCounts');
      expect(metrics).toHaveProperty('averageResolutionTime');
      expect(metrics.statusCounts).toHaveProperty('open');
    });

    it('should calculate team metrics', async () => {
      const metrics = await TicketService.getTeamMetrics(teamId);

      expect(metrics).toHaveProperty('totalTickets');
      expect(metrics).toHaveProperty('assignedTickets');
      expect(metrics).toHaveProperty('unassignedTickets');
      expect(metrics).toHaveProperty('statusDistribution');
    });
  });
});
