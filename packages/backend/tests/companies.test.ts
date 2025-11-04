import request from 'supertest';
import { app } from '../src/index';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';

describe('Company Management Endpoints', () => {
  let adminToken: string;
  let userToken: string;
  let testUserId: string;
  let testCompanyId: string;

  beforeEach(async () => {
    // Create admin user
    const adminUser = await User.createUser({
      email: 'admin@bomizzel.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });

    // Create regular user
    const regularUser = await User.createUser({
      email: 'user@example.com',
      password: 'password123',
      firstName: 'Regular',
      lastName: 'User',
      role: 'customer',
    });

    testUserId = regularUser.id;

    // Get admin token
    const adminLoginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@bomizzel.com',
      password: 'password123',
    });

    adminToken = adminLoginResponse.body.token;

    // Get user token
    const userLoginResponse = await request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    });

    userToken = userLoginResponse.body.token;
  });

  describe('POST /api/companies', () => {
    it('should create company for admin', async () => {
      const companyData = {
        name: 'Test Company',
        domain: 'test.com',
        description: 'A test company',
      };

      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(companyData)
        .expect(201);

      expect(response.body.company.name).toBe(companyData.name);
      expect(response.body.company.domain).toBe(companyData.domain);
      testCompanyId = response.body.company.id;
    });

    it('should not allow non-admin to create company', async () => {
      const companyData = {
        name: 'Test Company',
        domain: 'test.com',
      };

      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${userToken}`)
        .send(companyData)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should not create company with duplicate name', async () => {
      const companyData = {
        name: 'Unique Company',
        domain: 'unique.com',
      };

      // Create first company
      await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(companyData);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(companyData)
        .expect(409);

      expect(response.body.error.code).toBe('COMPANY_NAME_EXISTS');
    });
  });

  describe('GET /api/companies', () => {
    beforeEach(async () => {
      // Create test company
      const company = await Company.createCompany({
        name: 'Test Company',
        domain: 'test.com',
      });
      testCompanyId = company.id;

      // Associate user with company
      await Company.addUserToCompany(testUserId, testCompanyId, 'member');
    });

    it('should get companies list', async () => {
      const response = await request(app)
        .get('/api/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it('should search companies', async () => {
      const response = await request(app)
        .get('/api/companies?search=Test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].name).toContain('Test');
      }
    });
  });

  describe('GET /api/companies/:companyId', () => {
    beforeEach(async () => {
      // Create test company
      const company = await Company.createCompany({
        name: 'Test Company',
        domain: 'test.com',
      });
      testCompanyId = company.id;

      // Associate user with company
      await Company.addUserToCompany(testUserId, testCompanyId, 'member');
    });

    it('should get company by ID for associated user', async () => {
      const response = await request(app)
        .get(`/api/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.company.id).toBe(testCompanyId);
      expect(response.body.company.name).toBe('Test Company');
    });

    it('should get company by ID for admin', async () => {
      const response = await request(app)
        .get(`/api/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.company.id).toBe(testCompanyId);
    });

    it('should not allow non-associated user to get company', async () => {
      // Create another user not associated with company
      const anotherUser = await User.createUser({
        email: 'another@example.com',
        password: 'password123',
        firstName: 'Another',
        lastName: 'User',
      });

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'another@example.com',
        password: 'password123',
      });

      const anotherToken = loginResponse.body.token;

      const response = await request(app)
        .get(`/api/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('COMPANY_ACCESS_DENIED');
    });
  });

  describe('Company User Management', () => {
    beforeEach(async () => {
      // Create test company
      const company = await Company.createCompany({
        name: 'Test Company',
        domain: 'test.com',
      });
      testCompanyId = company.id;
    });

    it('should add user to company', async () => {
      const response = await request(app)
        .post(`/api/companies/${testCompanyId}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUserId,
          role: 'member',
        })
        .expect(201);

      expect(response.body.message).toBe('User added to company successfully');

      // Verify association
      const isAssociated = await Company.isUserInCompany(testUserId, testCompanyId);
      expect(isAssociated).toBe(true);
    });

    it('should get company users', async () => {
      // Add user to company first
      await Company.addUserToCompany(testUserId, testCompanyId, 'member');

      const response = await request(app)
        .get(`/api/companies/${testCompanyId}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should remove user from company', async () => {
      // Add user to company first
      await Company.addUserToCompany(testUserId, testCompanyId, 'member');

      const response = await request(app)
        .delete(`/api/companies/${testCompanyId}/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('User removed from company successfully');

      // Verify removal
      const isAssociated = await Company.isUserInCompany(testUserId, testCompanyId);
      expect(isAssociated).toBe(false);
    });
  });
});
