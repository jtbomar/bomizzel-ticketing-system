import request from 'supertest';
import { app } from '../src/index';
import { User } from '../src/models/User';
import { Team } from '../src/models/Team';

describe('Custom Fields Endpoints', () => {
  let teamLeadToken: string;
  let employeeToken: string;
  let customerToken: string;
  let teamId: string;

  beforeEach(async () => {
    // Create test users
    const teamLead = await User.createUser({
      email: 'teamlead@example.com',
      password: 'password123',
      firstName: 'Team',
      lastName: 'Lead',
      role: 'team_lead',
    });

    const employee = await User.createUser({
      email: 'employee@example.com',
      password: 'password123',
      firstName: 'Employee',
      lastName: 'User',
      role: 'employee',
    });

    const customer = await User.createUser({
      email: 'customer@example.com',
      password: 'password123',
      firstName: 'Customer',
      lastName: 'User',
      role: 'customer',
    });

    // Create test team
    const team = await Team.createTeam({
      name: 'Test Team',
      description: 'Team for testing custom fields',
    });
    teamId = team.id;

    // Get auth tokens
    const teamLeadLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teamlead@example.com', password: 'password123' });
    teamLeadToken = teamLeadLogin.body.token;

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@example.com', password: 'password123' });
    employeeToken = employeeLogin.body.token;

    const customerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'password123' });
    customerToken = customerLogin.body.token;
  });

  describe('POST /api/custom-fields/teams/:teamId', () => {
    it('should create a string custom field successfully', async () => {
      const fieldData = {
        name: 'customer_name',
        label: 'Customer Name',
        type: 'string',
        isRequired: true,
        validation: {
          min: 2,
          max: 100,
        },
      };

      const response = await request(app)
        .post(`/api/custom-fields/teams/${teamId}`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: fieldData.name,
        label: fieldData.label,
        type: fieldData.type,
        isRequired: fieldData.isRequired,
        validation: fieldData.validation,
      });
    });

    it('should create a picklist custom field successfully', async () => {
      const fieldData = {
        name: 'priority_level',
        label: 'Priority Level',
        type: 'picklist',
        isRequired: false,
        options: ['Low', 'Medium', 'High', 'Critical'],
      };

      const response = await request(app)
        .post(`/api/custom-fields/teams/${teamId}`)
        .set('Authorization', `Bearer ${teamLeadToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: fieldData.name,
        label: fieldData.label,
        type: fieldData.type,
        isRequired: fieldData.isRequired,
        options: fieldData.options,
      });
    });

    it('should reject creation by employee role', async () => {
      const fieldData = {
        name: 'test_field',
        label: 'Test Field',
        type: 'string',
      };

      await request(app)
        .post(`/api/custom-fields/teams/${teamId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(fieldData)
        .expect(403);
    });

    it('should reject creation by customer role', async () => {
      const fieldData = {
        name: 'test_field',
        label: 'Test Field',
        type: 'string',
      };

      await request(app)
        .post(`/api/custom-fields/teams/${teamId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(fieldData)
        .expect(403);
    });
  });

  describe('GET /api/custom-fields/teams/:teamId', () => {
    it('should get all custom fields for a team', async () => {
      const response = await request(app)
        .get(`/api/custom-fields/teams/${teamId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/custom-fields/teams/:teamId/validate', () => {
    it('should validate custom field values successfully', async () => {
      const values = {
        customer_name: 'John Doe',
        priority_level: 'High',
      };

      const response = await request(app)
        .post(`/api/custom-fields/teams/${teamId}/validate`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ values })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(Object.keys(response.body.data.errors)).toHaveLength(0);
    });

    it('should return validation errors for invalid values', async () => {
      const values = {
        customer_name: 'A', // Too short (min: 2)
        priority_level: 'Invalid', // Not in options
      };

      const response = await request(app)
        .post(`/api/custom-fields/teams/${teamId}/validate`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ values })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(Object.keys(response.body.data.errors)).toHaveLength(2);
    });
  });
});