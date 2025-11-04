import request from 'supertest';
import { app } from '../src/index';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';

describe('User Management Endpoints', () => {
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

    // Create test company
    const company = await Company.createCompany({
      name: 'Test Company',
      domain: 'test.com',
    });

    testCompanyId = company.id;

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

  describe('GET /api/users', () => {
    it('should get users list for admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });

    it('should not allow non-admin to get users list', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((user: any) => {
        expect(user.role).toBe('admin');
      });
    });
  });

  describe('GET /api/users/:userId', () => {
    it('should get user by ID for admin', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.user.id).toBe(testUserId);
      expect(response.body.user.email).toBe('user@example.com');
    });

    it('should allow user to get their own profile', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.user.id).toBe(testUserId);
    });

    it('should not allow user to get other user profiles', async () => {
      // Create another user
      const anotherUser = await User.createUser({
        email: 'another@example.com',
        password: 'password123',
        firstName: 'Another',
        lastName: 'User',
      });

      const response = await request(app)
        .get(`/api/users/${anotherUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });

  describe('PUT /api/users/:userId', () => {
    it('should update user information for admin', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.user.firstName).toBe('Updated');
      expect(response.body.user.lastName).toBe('Name');
    });

    it('should allow user to update their own profile', async () => {
      const updateData = {
        firstName: 'Self Updated',
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.user.firstName).toBe('Self Updated');
    });

    it('should not allow non-admin to change role', async () => {
      const updateData = {
        role: 'admin',
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_REQUIRED');
    });
  });

  describe('POST /api/users/:userId/deactivate', () => {
    it('should deactivate user for admin', async () => {
      const response = await request(app)
        .post(`/api/users/${testUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('User deactivated successfully');

      // Verify user is deactivated
      const user = await User.findById(testUserId);
      expect(user?.is_active).toBe(false);
    });

    it('should not allow non-admin to deactivate users', async () => {
      const response = await request(app)
        .post(`/api/users/${testUserId}/deactivate`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('GET /api/users/search', () => {
    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/users/search?q=Regular')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.users.length).toBeGreaterThan(0);
      expect(response.body.users[0].firstName).toContain('Regular');
    });

    it('should require minimum search length', async () => {
      const response = await request(app)
        .get('/api/users/search?q=a')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_SEARCH_QUERY');
    });
  });
});
