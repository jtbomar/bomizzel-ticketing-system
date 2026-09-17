import { UserService } from '../src/services/UserService';
import { CompanyService } from '../src/services/CompanyService';
import { AuthService } from '../src/services/AuthService';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { Team } from '../src/models/Team';
import { TicketStatus } from '../src/models/TicketStatus';

// A well-formed UUID that no row uses. A literal like 'non-existent' makes
// Postgres fail the uuid cast before the service's own check runs.
const ABSENT_UUID = '00000000-0000-4000-8000-000000000000';

describe('UserService', () => {
  let userId: string;
  let companyId: string;
  let teamId: string;
  // CompanyService association methods record who performed the change.
  let adminId: string;

  beforeAll(async () => {
    const admin = await User.createUser({
      email: 'userservice-admin@example.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });
    adminId = admin.id;

    const company = await Company.createCompany({
      name: 'Test Company',
      domain: 'test.com',
    });
    companyId = company.id;

    const team = await Team.createTeam({
      name: 'Test Team',
      description: 'Test team',
    });

    // A team with no ticket_statuses rows only permits 'open', so
    // status changes fail. Give test teams the default set.
    await TicketStatus.seedDefaultStatuses(team.id);
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

      const profile = await AuthService.getUserProfile(userId);

      expect(profile.id).toBe(userId);
      expect(profile.email).toBe('test@example.com');
      expect(profile.companies).toHaveLength(1);
      // getUserProfile returns UserCompanyAssociation[], keyed by companyId.
      expect(profile.companies?.[0].companyId).toBe(companyId);
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

      // getUserProfile returns companies but not teams; memberships come from
      // UserService.getUserTeams.
      const teams = await UserService.getUserTeams(employee.id);

      expect(teams).toHaveLength(1);
      expect(teams[0].teamId).toBe(teamId);
    });

    it('should throw error for non-existent user', async () => {
      await expect(AuthService.getUserProfile(ABSENT_UUID)).rejects.toThrow('User not found');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile information', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const updatedUser = await AuthService.updateProfile(userId, updateData);

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.email).toBe('test@example.com'); // Should remain unchanged
    });

    it('should not allow email updates through profile update', async () => {
      const updateData = {
        email: 'newemail@example.com',
        firstName: 'Test',
      };

      const updatedUser = await AuthService.updateProfile(userId, updateData);

      expect(updatedUser.email).toBe('test@example.com'); // Should remain unchanged
    });

    it('should validate profile data', async () => {
      const updateData = {
        firstName: '', // Invalid empty name
      };

      await expect(AuthService.updateProfile(userId, updateData)).rejects.toThrow(
        'Validation error'
      );
    });
  });

  describe('updateUserPreferences', () => {
    // UserPreferences exposes dashboard.defaultView, not a flat `viewMode`.
    it('should update user preferences', async () => {
      const preferences = {
        dashboard: { defaultView: 'kanban' as const, ticketsPerPage: 25 },
        notifications: {
          email: true,
          browser: false,
          ticketAssigned: true,
          ticketUpdated: true,
          ticketResolved: true,
        },
        theme: 'dark' as const,
      };

      const updatedUser = await UserService.updateUserPreferences(userId, preferences);

      expect(updatedUser.preferences?.dashboard?.defaultView).toBe('kanban');
      expect(updatedUser.preferences?.notifications?.email).toBe(true);
      expect(updatedUser.preferences?.theme).toBe('dark');
    });

    it('should merge preferences with existing ones', async () => {
      await UserService.updateUserPreferences(userId, {
        dashboard: { defaultView: 'list' as const, ticketsPerPage: 25 },
        notifications: {
          email: true,
          browser: true,
          ticketAssigned: true,
          ticketUpdated: true,
          ticketResolved: true,
        },
      });

      const updatedUser = await UserService.updateUserPreferences(userId, {
        dashboard: { defaultView: 'kanban' as const, ticketsPerPage: 25 },
      });

      expect(updatedUser.preferences?.dashboard?.defaultView).toBe('kanban');
      // untouched keys survive the merge
      expect(updatedUser.preferences?.notifications?.email).toBe(true);
    });
  });

  describe('company associations', () => {
    // Association management lives on CompanyService; UserService reads it back
    // via getUserCompanies.
    it('should add user to company', async () => {
      const newCompany = await Company.createCompany({
        name: 'New Company',
        domain: 'new.com',
      });

      await CompanyService.addUserToCompany(newCompany.id, userId, 'member', adminId);

      const companies = await UserService.getUserCompanies(userId);
      expect(companies.map((c) => c.companyId)).toContain(newCompany.id);
    });

    it('should remove user from company', async () => {
      // Use a dedicated company: an earlier test in this file already associated
      // the user with `companyId`, and this suite builds fixtures once in
      // beforeAll, so re-adding threw "User is already associated".
      const removable = await Company.createCompany({
        name: 'Removable Company',
        domain: 'removable.com',
      });

      await CompanyService.addUserToCompany(removable.id, userId, 'member', adminId);
      expect((await UserService.getUserCompanies(userId)).map((c) => c.companyId)).toContain(
        removable.id
      );

      await CompanyService.removeUserFromCompany(removable.id, userId, adminId);

      const companies = await UserService.getUserCompanies(userId);
      expect(companies.map((c) => c.companyId)).not.toContain(removable.id);
    });

    it('should prevent duplicate company associations', async () => {
      const dupCompany = await Company.createCompany({
        name: 'Dup Company',
        domain: 'dup.com',
      });

      await CompanyService.addUserToCompany(dupCompany.id, userId, 'member', adminId);

      await expect(
        CompanyService.addUserToCompany(dupCompany.id, userId, 'member', adminId)
      ).rejects.toThrow();
    });
  });

  describe('access checks', () => {
    // There is no UserService.canAccessCompany/canAccessTeam; access is derived
    // from the association lists.
    it('should report access to an associated company', async () => {
      const accessCompany = await Company.createCompany({
        name: 'Access Company',
        domain: 'access.com',
      });
      await CompanyService.addUserToCompany(accessCompany.id, userId, 'member', adminId);

      const companies = await UserService.getUserCompanies(userId);
      expect(companies.some((c) => c.companyId === accessCompany.id)).toBe(true);
    });

    it('should not report access to a non-associated company', async () => {
      const otherCompany = await Company.createCompany({
        name: 'Other Company',
        domain: 'other.com',
      });

      const companies = await UserService.getUserCompanies(userId);
      expect(companies.some((c) => c.companyId === otherCompany.id)).toBe(false);
    });

    it('should report team membership for an employee', async () => {
      const employee = await User.createUser({
        email: 'employee2@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Employee2',
        role: 'employee',
      });

      await Team.addUserToTeam(employee.id, teamId);

      const teams = await UserService.getUserTeams(employee.id);
      expect(teams.some((t) => t.teamId === teamId)).toBe(true);
    });
  });

  describe('filtering users by role', () => {
    // getUsers({ role }) is the real entry point; there is no getUsersByRole.
    it('should return users filtered by role', async () => {
      // getUsers applies tenant isolation from requestingUser; without it the
      // call deliberately matches nothing, so the context has to be supplied.
      const ctx = {
        requestingUser: { id: adminId, role: 'admin', companies: [companyId] },
      };
      const customers = await UserService.getUsers({ role: 'customer', ...ctx });
      const employees = await UserService.getUsers({ role: 'employee', ...ctx });

      expect(customers.data.length).toBeGreaterThan(0);
      customers.data.forEach((user) => {
        expect(user.role).toBe('customer');
      });

      employees.data.forEach((user) => {
        expect(user.role).toBe('employee');
      });
    });

    it('should return no users for a role nobody has', async () => {
      const users = await UserService.getUsers({
        role: 'invalid_role',
        requestingUser: { id: adminId, role: 'admin', companies: [companyId] },
      });
      expect(users.data).toHaveLength(0);
    });
  });
});
