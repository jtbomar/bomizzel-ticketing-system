import request from 'supertest';
import { app } from '../src/index';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { Team } from '../src/models/Team';
import { Queue } from '../src/models/Queue';
import { JWTUtils } from '../src/utils/jwt';

describe('Queue Management', () => {
  let adminToken: string;
  let employeeToken: string;
  let teamLeadToken: string;
  let adminId: string;
  let employeeId: string;
  let teamLeadId: string;
  let companyId: string;
  let teamId: string;

  beforeAll(async () => {
    // Create test company
    const company = await Company.createCompany({
      name: 'Test Company',
      domain: 'test.com',
    });
    companyId = company.id;

    // Create test team
    const team = await Team.createTeam({
      name: 'Test Team',
      description: 'Test team for queue management',
    });
    teamId = team.id;

    // Create admin user
    const admin = await User.createUser({
      email: 'admin@test.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });
    adminId = admin.id;
    adminToken = JWTUtils.generateToken({ userId: admin.id, role: admin.role });

    // Create team lead user
    const teamLead = await User.createUser({
      email: 'teamlead@test.com',
      password: 'password123',
      firstName: 'Team',
      lastName: 'Lead',
      role: 'employee',
    });
    teamLeadId = teamLead.id;
    teamLeadToken = JWTUtils.generateToken({ userId: teamLead.id, role: teamLead.role });

    // Create employee user
    const employee = await User.createUser({
      email: 'employee@test.com',
      password: 'password123',
      firstName: 'Employee',
      lastName: 'User',
      role: 'employee',
    });
    employeeId = employee.id;
    employeeToken = JWTUtils.generateToken({ userId: employee.id, role: employee.role });

    // Add users to team
    await Team.addUserToTeam(teamLeadId, teamId, 'lead');
    await Team.addUserToTeam(employeeId, teamId, 'member');
  });

  describe('POST /queues', () => {
    it('should create a new unassigned queue as admin', async () => {
      const queueData = {
        name: 'Support Queue',
        description: 'General support queue',
        type: 'unassigned',
        teamId,
      };

      const response = await request(app)
        .post('/api/queues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(queueData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Support Queue');
      expect(response.body.data.type).toBe('unassigned');
      expect(response.body.data.teamId).toBe(teamId);
    });

    it('should create an employee queue as team lead', async () => {
      const queueData = {
        name: 'Personal Queue',
        description: 'Personal employee queue',
        type: 'employee',
        assignedToId: employeeId,
        teamId,
      };

      const response = await request(app)
        .post('/api/queues')
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .send(queueData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Personal Queue');
      expect(response.body.data.type).toBe('employee');
      expect(response.body.data.assignedToId).toBe(employeeId);
    });

    it('should reject queue creation by regular employee', async () => {
      const queueData = {
        name: 'Unauthorized Queue',
        type: 'unassigned',
        teamId,
      };

      const response = await request(app)
        .post('/api/queues')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(queueData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate queue names', async () => {
      const queueData = {
        name: 'Support Queue', // Same name as first test
        type: 'unassigned',
        teamId,
      };

      const response = await request(app)
        .post('/api/queues')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(queueData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /queues', () => {
    it('should get all accessible queues for team lead', async () => {
      const response = await request(app)
        .get('/api/queues')
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get team queues with metrics', async () => {
      const response = await request(app)
        .get(`/api/queues?teamId=${teamId}`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /queues/dashboard/metrics', () => {
    it('should get dashboard metrics for employee', async () => {
      const response = await request(app)
        .get('/api/queues/dashboard/metrics')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get dashboard metrics with filters', async () => {
      const response = await request(app)
        .get('/api/queues/dashboard/metrics?includeTeamQueues=true&includePersonalQueues=false')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /queues/search', () => {
    it('should search and filter queues', async () => {
      const response = await request(app)
        .get('/api/queues/search?search=Support&sortBy=name&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by queue type', async () => {
      const response = await request(app)
        .get('/api/queues/search?type=unassigned')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('PUT /queues/:id', () => {
    let queueId: string;

    beforeAll(async () => {
      // Create a queue for testing updates
      const queue = await Queue.createQueue({
        name: 'Update Test Queue',
        type: 'unassigned',
        teamId,
      });
      queueId = queue.id;
    });

    it('should update queue details as team lead', async () => {
      const updateData = {
        name: 'Updated Queue Name',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Queue Name');
      expect(response.body.data.description).toBe('Updated description');
    });

    it('should reject update by regular employee', async () => {
      const updateData = {
        name: 'Unauthorized Update',
      };

      const response = await request(app)
        .put(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /queues/:id/assign', () => {
    let queueId: string;

    beforeAll(async () => {
      // Create a queue for testing assignment
      const queue = await Queue.createQueue({
        name: 'Assignment Test Queue',
        type: 'unassigned',
        teamId,
      });
      queueId = queue.id;
    });

    it('should assign queue to employee as team lead', async () => {
      const response = await request(app)
        .put(`/api/queues/${queueId}/assign`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .send({ assignedToId: employeeId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedToId).toBe(employeeId);
      expect(response.body.data.type).toBe('employee');
    });

    it('should unassign queue as team lead', async () => {
      const response = await request(app)
        .put(`/api/queues/${queueId}/unassign`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedToId).toBeUndefined();
      expect(response.body.data.type).toBe('unassigned');
    });
  });

  describe('GET /queues/:id/metrics', () => {
    let queueId: string;

    beforeAll(async () => {
      // Create a queue for testing metrics
      const queue = await Queue.createQueue({
        name: 'Metrics Test Queue',
        type: 'unassigned',
        teamId,
      });
      queueId = queue.id;
    });

    it('should get queue metrics as team member', async () => {
      const response = await request(app)
        .get(`/api/queues/${queueId}/metrics`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.queueId).toBe(queueId);
      expect(response.body.data.queueName).toBe('Metrics Test Queue');
      expect(typeof response.body.data.totalTickets).toBe('number');
      expect(typeof response.body.data.openTickets).toBe('number');
      expect(typeof response.body.data.statusBreakdown).toBe('object');
    });
  });

  describe('DELETE /queues/:id', () => {
    let queueId: string;

    beforeAll(async () => {
      // Create a queue for testing deletion
      const queue = await Queue.createQueue({
        name: 'Delete Test Queue',
        type: 'unassigned',
        teamId,
      });
      queueId = queue.id;
    });

    it('should delete queue as team lead', async () => {
      const response = await request(app)
        .delete(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Queue deleted successfully');
    });

    it('should return 404 for deleted queue', async () => {
      const response = await request(app)
        .get(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
