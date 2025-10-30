import { UserService } from '../src/services/UserService';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { Team } from '../src/models/Team';

describe('UserService', () => {
  let userId: string;
  let companyId: string;
  let teamId: string;

  beforeAll(async () => {
    const company = await Company.createCompany({
      name: 'Test Company',
      domain: 'test.com',
    });
    companyId = company.id;

    const team = await Team.createTeam({
      name: 'Test Team',
      description: 'Test team',
    });
    teamId = team.id;

    const user = await User.createUser({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'customer',
    });
    userId = user.id;
  });

  describe('getUserProfile', () => {
    it('should return user profile with company associations', async () => {
      await Company.addUserToCompany(userId, companyId);

      const profile = await UserService.getUserProfile(userId);

      expect(profile.id).toBe(userId);
      expect(profile.email).toBe('test@example.com');
      expect(profile.companies).toHaveLength(1);
      expect(profile.companies[0].id).toBe(companyId);
    });

    it('should return user profile with team memberships for employees', async () => {
      const employee = await User.createUser({
        email: 'employee@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Employee',
        role: 'employee',
      });

      await Team.addUserToTeam(employee.id, teamId);

      const profile = await UserService.getUserProfile(employee.id);

      expect(profile.teams).toHaveLength(1);
      expect(profile.teams[0].id).toBe(teamId);
    });

    it('should throw error for non-existent user', async () => {
      await expect(UserService.getUserProfile('non-existent-id'))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile information', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const updatedUser = await UserService.updateUserProfile(userId, updateData);

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.email).toBe('test@example.com'); // Should remain unchanged
    });

    it('should not allow email updates through profile update', async () => {
      const updateData = {
        email: 'newemail@example.com',
        firstName: 'Test',
      };

      const updatedUser = await UserService.updateUserProfile(userId, updateData);

      expect(updatedUser.email).toBe('test@example.com'); // Should remain unchanged
    });

    it('should validate profile data', async () => {
      const updateData = {
        firstName: '', // Invalid empty name
      };

      await expect(UserService.updateUserProfile(userId, updateData))
        .rejects.toThrow('Validation error');
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const preferences = {
        viewMode: 'kanban',
        notifications: {
          email: true,
          browser: false,
        },
        theme: 'dark',
      };

      const updatedUser = await UserService.updateUserPreferences(userId, preferences);

      expect(updatedUser.preferences.viewMode).toBe('kanban');
      expect(updatedUser.preferences.notifications.email).toBe(true);
      expect(updatedUser.preferences.theme).toBe('dark');
    });

    it('should merge preferences with existing ones', async () => {
      // Set initial preferences
      await UserService.updateUserPreferences(userId, {
        viewMode: 'list',
        notifications: { email: true, browser: true },
      });

      // Update only part of preferences
      const updatedUser = await UserService.updateUserPreferences(userId, {
        viewMode: 'kanban',
      });

      expect(updatedUser.preferences.viewMode).toBe('kanban');
      expect(updatedUser.preferences.notifications.email).toBe(true); // Should remain
    });
  });

  describe('manageCompanyAssociations', () => {
    it('should add user to company', async () => {
      const newCompany = await Company.createCompany({
        name: 'New Company',
        domain: 'new.com',
      });

      await UserService.addUserToCompany(userId, newCompany.id);

      const profile = await UserService.getUserProfile(userId);
      const companyIds = profile.companies.map(c => c.id);
      expect(companyIds).toContain(newCompany.id);
    });

    it('should remove user from company', async () => {
      await UserService.removeUserFromCompany(userId, companyId);

      const profile = await UserService.getUserProfile(userId);
      const companyIds = profile.companies.map(c => c.id);
      expect(companyIds).not.toContain(companyId);
    });

    it('should prevent duplicate company associations', async () => {
      await UserService.addUserToCompany(userId, companyId);

      await expect(UserService.addUserToCompany(userId, companyId))
        .rejects.toThrow('User already associated with company');
    });
  });

  describe('validateUserPermissions', () => {
    it('should validate customer access to company tickets', async () => {
      await Company.addUserToCompany(userId, companyId);

      const hasAccess = await UserService.canAccessCompany(userId, companyId);
      expect(hasAccess).toBe(true);
    });

    it('should reject access to non-associated company', async () => {
      const otherCompany = await Company.createCompany({
        name: 'Other Company',
        domain: 'other.com',
      });

      const hasAccess = await UserService.canAccessCompany(userId, otherCompany.id);
      expect(hasAccess).toBe(false);
    });

    it('should validate employee access to team resources', async () => {
      const employee = await User.createUser({
        email: 'employee2@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Employee2',
        role: 'employee',
      });

      await Team.addUserToTeam(employee.id, teamId);

      const hasAccess = await UserService.canAccessTeam(employee.id, teamId);
      expect(hasAccess).toBe(true);
    });
  });

  describe('getUsersByRole', () => {
    it('should return users filtered by role', async () => {
      const customers = await UserService.getUsersByRole('customer');
      const employees = await UserService.getUsersByRole('employee');

      expect(customers.length).toBeGreaterThan(0);
      customers.forEach(user => {
        expect(user.role).toBe('customer');
      });

      employees.forEach(user => {
        expect(user.role).toBe('employee');
      });
    });

    it('should return empty array for non-existent role', async () => {
      const users = await UserService.getUsersByRole('invalid_role' as any);
      expect(users).toHaveLength(0);
    });
  });
});