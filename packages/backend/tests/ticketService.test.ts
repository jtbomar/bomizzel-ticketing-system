import { TicketService } from '../src/services/TicketService';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { Team } from '../src/models/Team';
import { Queue } from '../src/models/Queue';
import { CustomField } from '../src/models/CustomField';
import { Ticket } from '../src/models/Ticket';
import { MetricsService } from '../src/services/MetricsService';
import { AdvancedSearchService } from '../src/services/AdvancedSearchService';
import { TicketStatus } from '../src/models/TicketStatus';

// Well-formed uuid that matches no row. A literal like 'non-existent-id'
// fails Postgres' uuid cast before the service's own check runs.
const ABSENT_UUID = '00000000-0000-4000-8000-000000000000';

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

    // A team with no ticket_statuses rows only permits 'open', so
    // status changes fail. Give test teams the default set.
    await TicketStatus.seedDefaultStatuses(team.id);
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
    const customField = await CustomField.createCustomField({
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

      const ticket = await TicketService.createTicket(ticketData, customerId);

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

      // The service reports: Field '<label>' must be one of: <options>
      await expect(TicketService.createTicket(ticketData, customerId)).rejects.toThrow(
        'must be one of'
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

      await expect(TicketService.createTicket(ticketData, customerId)).rejects.toThrow(
        'is required'
      );
    });
  });

  describe('assignTicket', () => {
    let ticketId: string;

    beforeEach(async () => {
      const ticket = await TicketService.createTicket(
        {
          title: 'Test Ticket for Assignment',
          description: 'Test description',
          companyId: companyId,
          teamId: teamId,
          customFieldValues: {
            priority_level: 'Medium',
          },
        },
        customerId
      );
      ticketId = ticket.id;
    });

    it('should assign ticket to employee', async () => {
      const updatedTicket = await TicketService.assignTicket(
        ticketId,
        employeeId,
        employeeId,
        'employee'
      );

      expect(updatedTicket.assignedToId).toBe(employeeId);
    });

    it('should move the ticket into the assignee personal queue', async () => {
      // assignTicket does not create a queue - it moves the ticket into the
      // assignee's existing personal queue when there is one. This used to
      // assert that assigning created the queue, which was never implemented.
      const personalQueue = await Queue.createQueue({
        name: `Personal Queue ${employeeId.slice(0, 8)}`,
        type: 'employee',
        assignedToId: employeeId,
        teamId,
      });

      const updated = await TicketService.assignTicket(
        ticketId,
        employeeId,
        employeeId,
        'employee'
      );

      expect(updated.assignedToId).toBe(employeeId);

      const employeeQueues = await Queue.findByAssignee(employeeId);
      expect(employeeQueues.map((q) => q.id)).toContain(personalQueue.id);
      expect(employeeQueues[0].type).toBe('employee');
    });

    it('should reject assignment to non-existent employee', async () => {
      await expect(
        TicketService.assignTicket(ticketId, ABSENT_UUID, employeeId, 'employee')
      ).rejects.toThrow('Employee not found');
    });
  });

  describe('updateTicketStatus', () => {
    let ticketId: string;

    beforeEach(async () => {
      const ticket = await TicketService.createTicket(
        {
          title: 'Test Ticket for Status Update',
          description: 'Test description',
          companyId: companyId,
          teamId: teamId,
          customFieldValues: {
            priority_level: 'Low',
          },
        },
        customerId
      );
      ticketId = ticket.id;
    });

    it('should update ticket status', async () => {
      const updatedTicket = await TicketService.updateTicketStatus(
        ticketId,
        'in_progress',
        employeeId,
        'employee'
      );

      expect(updatedTicket.status).toBe('in_progress');
    });
    it('should track status change history', async () => {
      await TicketService.updateTicketStatus(ticketId, 'in_progress', employeeId, 'employee');

      // History lives on the Ticket model, and rows use snake_case columns.
      const history = await Ticket.getTicketHistory(ticketId);
      // Creating the ticket also writes a 'created' row, and history comes back
      // newest first, so assert on the status_changed entry rather than a count.
      const statusChange = history.find((h: any) => h.action === 'status_changed');
      expect(statusChange).toBeDefined();
      expect(statusChange.new_value).toBe('in_progress');
    });
  });

  describe('searchTickets', () => {
    beforeAll(async () => {
      // Create multiple test tickets
      await TicketService.createTicket(
        {
          title: 'Bug Report',
          description: 'Application crashes on startup',
          companyId: companyId,
          teamId: teamId,
          customFieldValues: { priority_level: 'High' },
        },
        customerId
      );

      await TicketService.createTicket(
        {
          title: 'Feature Request',
          description: 'Add dark mode support',
          companyId: companyId,
          teamId: teamId,
          customFieldValues: { priority_level: 'Low' },
        },
        customerId
      );
    });

    // Ticket.searchTickets returns a plain array, takes status as string[], and
    // has no custom-field filtering - that lives in AdvancedSearchService.
    it('should search tickets by title', async () => {
      const results = await Ticket.searchTickets({
        query: 'Bug',
        companyIds: [companyId],
      });

      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Bug');
    });

    it('should filter by custom field values', async () => {
      const results = await AdvancedSearchService.search(
        {
          // Custom fields are addressed with a `custom_field_` name prefix.
          filters: [
            {
              field: 'custom_field_priority_level',
              operator: 'equals' as const,
              value: 'High',
            },
          ],
          companyIds: [companyId],
        },
        customerId,
        'customer'
      );

      // The suite's own beforeAll also creates a High ticket, so assert the
      // filter held rather than a fixed count.
      expect(results.data.length).toBeGreaterThan(0);
      results.data.forEach((t: any) => {
        expect(t.customFieldValues?.priority_level).toBe('High');
      });
      expect(results.data.map((t: any) => t.title)).toContain('Bug Report');
    });

    it('should filter by status', async () => {
      const results = await Ticket.searchTickets({
        companyIds: [companyId],
        status: ['open'],
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((ticket) => {
        expect(ticket.status).toBe('open');
      });
    });
  });

  describe('getTicketMetrics', () => {
    // Metrics come from MetricsService; the shape is QueueMetrics.
    it('should calculate queue metrics', async () => {
      const metrics = await MetricsService.calculateQueueMetrics(queueId);

      expect(metrics).toHaveProperty('totalTickets');
      expect(metrics).toHaveProperty('statusBreakdown');
      expect(metrics).toHaveProperty('averageResolutionTime');
      expect(metrics.queueId).toBe(queueId);
    });

    it('should calculate team metrics', async () => {
      const metrics = await MetricsService.calculateTeamMetrics(teamId);

      expect(Array.isArray(metrics)).toBe(true);
      metrics.forEach((m) => {
        expect(m).toHaveProperty('totalTickets');
        expect(m).toHaveProperty('assignedTickets');
        expect(m).toHaveProperty('statusBreakdown');
      });
    });
  });
});
