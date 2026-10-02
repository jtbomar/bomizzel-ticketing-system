import { User } from '@/models/User';
import { Company } from '@/models/Company';
import { Team } from '@/models/Team';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { isCompanyInTenant, isStaff, tenantContextFor, tenantUserIds } from '@/utils/tenant';
import {
  User as UserModel,
  UserCompanyAssociation,
  TeamMembership,
  PaginatedResponse,
} from '@/types/models';
import { PlanService } from './PlanService';
import { OrgBillingService } from './OrgBillingService';

export class UserService {
  /**
   * Get all users with pagination and filtering (with tenant isolation)
   */
  static async getUsers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      role?: string;
      isActive?: boolean;
      requestingUser?: {
        id: string;
        role: string;
        tenantId?: string;
        companyId?: string;
        companies?: string[];
      };
    } = {}
  ): Promise<PaginatedResponse<UserModel>> {
    try {
      const { page = 1, limit = 25, search, role, isActive, requestingUser } = options;
      const offset = (page - 1) * limit;

      let whereClause: any = {};

      if (role) {
        whereClause.role = role;
      }

      if (isActive !== undefined) {
        whereClause.is_active = isActive;
      }

      // Build search query with tenant isolation
      let searchQuery = User.query;

      // Tenant isolation: staff see the people of their own subscriber (its
      // staff and its accounts' contacts); contacts see their co-workers.
      // Admins and team leads saw every user on the platform before.
      if (requestingUser) {
        if (!requestingUser.tenantId) {
          searchQuery = searchQuery.where('id', requestingUser.id);
        } else if (isStaff(requestingUser)) {
          // Admins, team leads and agents: everyone in their subscriber. (An
          // admin used to be scoped to whatever companies they happened to be
          // associated with, then to the whole platform; the subscriber is
          // the rule that means something.)
          searchQuery = searchQuery.whereIn('id', tenantUserIds(requestingUser.tenantId));
        } else if (requestingUser.companies?.length) {
          // Customer users can only see users from their own companies
          searchQuery = searchQuery.whereIn('id', function () {
            this.select('user_id')
              .from('user_company_associations')
              .whereIn('company_id', requestingUser.companies!);
          });
        } else {
          // If user has no organization or company associations, they can only see themselves
          searchQuery = searchQuery.where('id', requestingUser.id);
        }
      } else {
        // If no requesting user context, return empty results for security.
        //
        // This used to be .where('id', 'impossible-id-that-never-exists'), but
        // users.id is a uuid column, so Postgres rejected the cast and the
        // "return nothing" path raised a 500 instead. whereRaw('1 = 0') matches
        // no rows without touching a typed column.
        searchQuery = searchQuery.whereRaw('1 = 0');
      }

      if (search) {
        searchQuery = searchQuery.where(function () {
          this.where('first_name', 'ilike', `%${search}%`)
            .orWhere('last_name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
        });
      }

      if (Object.keys(whereClause).length > 0) {
        searchQuery = searchQuery.where(whereClause);
      }

      // Get total count
      const totalQuery = searchQuery.clone();
      const total = await totalQuery.count('* as count').first();
      const totalCount = parseInt(total?.count || '0', 10);

      // Get paginated results
      const users = await searchQuery.limit(limit).offset(offset).orderBy('created_at', 'desc');

      // Enrich user models with company associations for customers
      const userModels = await Promise.all(
        users.map(async (user: any) => {
          const baseModel = User.toModel(user);

          // Add company associations for customers
          if (user.role === 'customer') {
            const companies = await User.getUserCompanies(user.id);
            return {
              ...baseModel,
              companies,
            };
          }

          return baseModel;
        })
      );

      return {
        data: userModels,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Get users error:', error);
      throw new AppError('Failed to get users', 500, 'GET_USERS_FAILED');
    }
  }

  /**
   * Get user by ID with company associations (with tenant isolation)
   */
  static async getUserById(
    userId: string,
    requestingUser?: {
      id: string;
      role: string;
      tenantId?: string;
      organizationId?: string;
      companyId?: string;
      companies?: string[];
    }
  ): Promise<UserModel & { companies?: UserCompanyAssociation[] }> {
    try {
      const userWithCompanies = await User.findWithCompanies(userId);
      if (!userWithCompanies) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // CRITICAL: Implement tenant isolation for user details
      if (requestingUser) {
        let hasAccess = requestingUser.id === userId; // User can see their own profile

        // Global admins. The route guards this with authorizeOwnerOrAdmin, so
        // it already intends admins to have access, but the checks below only
        // covered organization or shared-company membership - so an admin with
        // no company in common with the target got "User not found".
        if (!hasAccess && requestingUser.role === 'admin') {
          hasAccess = true;
        }

        if (!hasAccess && requestingUser.organizationId) {
          // Organization users can see users from their own organization
          const targetUser = await User.findById(userId);
          hasAccess = targetUser?.organization_id === requestingUser.organizationId;
        }

        if (!hasAccess && requestingUser.companies?.length) {
          // Customer users can see users from their own companies
          hasAccess = requestingUser.companies.some((companyId) =>
            userWithCompanies.companies.some((uc) => uc.companyId === companyId)
          );
        }

        if (!hasAccess) {
          throw new AppError('User not found', 404, 'USER_NOT_FOUND'); // Don't reveal existence
        }
      }

      const userModel = User.toModel(userWithCompanies);

      return {
        ...userModel,
        companies: userWithCompanies.companies,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get user by ID error:', error);
      throw new AppError('Failed to get user', 500, 'GET_USER_FAILED');
    }
  }

  /**
   * Update user information
   */
  static async updateUser(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      role?: string;
      isActive?: boolean;
      preferences?: any;
    },
    updatedById: string
  ): Promise<UserModel> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Prepare update data
      const updateFields: any = {};

      if (updateData.firstName !== undefined) {
        updateFields.first_name = updateData.firstName;
      }

      if (updateData.lastName !== undefined) {
        updateFields.last_name = updateData.lastName;
      }

      if (updateData.role !== undefined) {
        updateFields.role = updateData.role;
      }

      if (updateData.isActive !== undefined) {
        updateFields.is_active = updateData.isActive;
      }

      if (updateData.preferences !== undefined) {
        updateFields.preferences = { ...user.preferences, ...updateData.preferences };
      }

      // Becoming an active agent (activated, or made staff) counts against the
      // plan's agents (Settings > Billing); the paid seat count follows.
      const wasAgent = user.role !== 'customer' && user.is_active;
      const role = updateFields.role ?? user.role;
      const active = updateFields.is_active ?? user.is_active;
      const isAgent = role !== 'customer' && active;
      if (isAgent && !wasAgent) {
        const tenant = (await tenantContextFor(userId)).tenantId;
        if (tenant) await PlanService.assertCan(tenant, 'agent');
      }

      const updatedUser = await User.update(userId, updateFields);
      if (!updatedUser) {
        throw new AppError('Failed to update user', 500, 'UPDATE_FAILED');
      }
      if (isAgent !== wasAgent) await this.syncSeatsFor({ id: userId, role: 'staff' });

      logger.info(`User ${userId} updated by ${updatedById}`);

      return User.toModel(updatedUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update user error:', error);
      throw new AppError('Failed to update user', 500, 'UPDATE_USER_FAILED');
    }
  }

  /**
   * Deactivate user account
   */
  /** An agent added or removed: the paid seat count follows (Settings > Billing). */
  private static async syncSeatsFor(user: { id: string; role: string }): Promise<void> {
    if (user.role === 'customer') return;
    const tenant = (await tenantContextFor(user.id)).tenantId;
    if (tenant) await OrgBillingService.syncSeats(tenant);
  }

  static async deactivateUser(userId: string, deactivatedById: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.is_active) {
        throw new AppError('User is already deactivated', 400, 'USER_ALREADY_DEACTIVATED');
      }

      await User.update(userId, { is_active: false });
      await this.syncSeatsFor(user);

      logger.info(`User ${userId} deactivated by ${deactivatedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Deactivate user error:', error);
      throw new AppError('Failed to deactivate user', 500, 'DEACTIVATE_USER_FAILED');
    }
  }

  /**
   * Reactivate user account
   */
  static async reactivateUser(userId: string, reactivatedById: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (user.is_active) {
        throw new AppError('User is already active', 400, 'USER_ALREADY_ACTIVE');
      }

      const tenant = user.role === 'customer' ? null : (await tenantContextFor(userId)).tenantId;
      if (tenant) await PlanService.assertCan(tenant, 'agent');
      await User.update(userId, { is_active: true });
      await this.syncSeatsFor(user);

      logger.info(`User ${userId} reactivated by ${reactivatedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Reactivate user error:', error);
      throw new AppError('Failed to reactivate user', 500, 'REACTIVATE_USER_FAILED');
    }
  }

  /**
   * Get user's company associations
   */
  static async getUserCompanies(userId: string): Promise<UserCompanyAssociation[]> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const companies = await Company.getUserCompanies(userId);

      return companies.map((company) => ({
        userId,
        companyId: company.id,
        role: 'member', // This would come from the association table
        createdAt: company.created_at,
        company: Company.toModel(company),
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get user companies error:', error);
      throw new AppError('Failed to get user companies', 500, 'GET_USER_COMPANIES_FAILED');
    }
  }

  /**
   * Get user's team memberships
   */
  static async getUserTeams(userId: string): Promise<TeamMembership[]> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const teams = await Team.getUserTeams(userId);

      return teams.map((team) => ({
        userId,
        teamId: team.id,
        role: 'member', // This would come from the membership table
        createdAt: team.created_at,
        team: Team.toModel(team),
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get user teams error:', error);
      throw new AppError('Failed to get user teams', 500, 'GET_USER_TEAMS_FAILED');
    }
  }

  /**
   * Update user preferences
   */
  static async updateUserPreferences(userId: string, preferences: any): Promise<UserModel> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const updatedPreferences = { ...user.preferences, ...preferences };
      const updatedUser = await User.update(userId, { preferences: updatedPreferences });

      if (!updatedUser) {
        throw new AppError('Failed to update preferences', 500, 'UPDATE_FAILED');
      }

      logger.info(`Preferences updated for user: ${userId}`);

      return User.toModel(updatedUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update user preferences error:', error);
      throw new AppError('Failed to update preferences', 500, 'UPDATE_PREFERENCES_FAILED');
    }
  }

  /**
   * Search users by email or name
   */
  static async searchUsers(
    query: string,
    options: {
      limit?: number;
      excludeUserIds?: string[];
      role?: string;
      // Required scope: the caller. Staff search their subscriber's people;
      // contacts only their co-workers.
      requestingUser?: { id: string; role: string; tenantId?: string; companies?: string[] };
    } = {}
  ): Promise<UserModel[]> {
    try {
      const { limit = 10, excludeUserIds = [], role, requestingUser } = options;
      if (!requestingUser?.tenantId) return [];

      let searchQuery = User.query.where('is_active', true).where(function () {
        this.where('first_name', 'ilike', `%${query}%`)
          .orWhere('last_name', 'ilike', `%${query}%`)
          .orWhere('email', 'ilike', `%${query}%`);
      });
      searchQuery = isStaff(requestingUser)
        ? searchQuery.whereIn('id', tenantUserIds(requestingUser.tenantId))
        : searchQuery.whereIn(
            'id',
            User.db('user_company_associations')
              .select('user_id')
              .whereIn('company_id', requestingUser.companies || [])
          );

      if (excludeUserIds.length > 0) {
        searchQuery = searchQuery.whereNotIn('id', excludeUserIds);
      }

      if (role) {
        searchQuery = searchQuery.where('role', role);
      }

      const users = await searchQuery.limit(limit).orderBy('first_name', 'asc');

      // Add company associations for customers
      const userModels = await Promise.all(
        users.map(async (user: any) => {
          const baseModel = User.toModel(user);

          if (user.role === 'customer') {
            const companies = await User.getUserCompanies(user.id);
            return {
              ...baseModel,
              companies,
            };
          }

          return baseModel;
        })
      );

      return userModels;
    } catch (error) {
      logger.error('Search users error:', error);
      throw new AppError('Failed to search users', 500, 'SEARCH_USERS_FAILED');
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(tenantId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    customerCount: number;
    employeeCount: number;
    recentRegistrations: number;
  }> {
    try {
      const stats = await User.db.raw(
        `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN role = 'customer' THEN 1 END) as customer_count,
          COUNT(CASE WHEN role IN ('employee', 'team_lead', 'admin') THEN 1 END) as employee_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_registrations
        FROM users
        WHERE id IN (
          SELECT a.user_id FROM user_company_associations a
            JOIN companies c ON c.id = a.company_id
           WHERE c.id = ? OR c.subscriber_id = ?
        )
      `,
        [tenantId, tenantId]
      );

      const result = stats.rows[0];

      return {
        totalUsers: parseInt(result.total_users, 10),
        activeUsers: parseInt(result.active_users, 10),
        customerCount: parseInt(result.customer_count, 10),
        employeeCount: parseInt(result.employee_count, 10),
        recentRegistrations: parseInt(result.recent_registrations, 10),
      };
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw new AppError('Failed to get user statistics', 500, 'GET_USER_STATS_FAILED');
    }
  }

  /**
   * Get all customers with their company associations
   */
  static async getCustomersWithCompanies(
    tenantId: string
  ): Promise<Array<UserModel & { companies: UserCompanyAssociation[] }>> {
    try {
      // Contacts of this subscriber's accounts only - this returned every
      // contact on the platform.
      const customers = await User.findActiveUsers({
        role: 'customer',
        idsIn: tenantUserIds(tenantId),
      });

      const customersWithCompanies = await Promise.all(
        customers.map(async (customer) => {
          const companies = await User.getUserCompanies(customer.id);
          return {
            ...User.toModel(customer),
            companies,
          };
        })
      );

      return customersWithCompanies;
    } catch (error) {
      logger.error('Get customers with companies error:', error);
      throw new AppError('Failed to get customers', 500, 'GET_CUSTOMERS_FAILED');
    }
  }

  /**
   * Get all companies (accounts)
   */
  static async getAllCompanies(tenantId: string, isActive?: boolean): Promise<any[]> {
    try {
      // This subscriber's accounts only - this returned every company.
      let query = Company.query.where('subscriber_id', tenantId);

      if (isActive !== undefined) {
        query = query.where('is_active', isActive);
      }

      const companies = await query.orderBy('name', 'asc');

      // Enrich with ticket and contact counts
      const enrichedCompanies = await Promise.all(
        companies.map(async (company: any) => {
          // Get ticket count
          const ticketCount = await Company.db('tickets')
            .where('company_id', company.id)
            .count('* as count')
            .first();

          // Get contact/customer count
          const contactCount = await Company.db('user_company_associations')
            .where('company_id', company.id)
            .count('* as count')
            .first();

          return {
            ...Company.toModel(company),
            ticketCount: parseInt(String(ticketCount?.count || 0), 10),
            contactCount: parseInt(String(contactCount?.count || 0), 10),
          };
        })
      );

      return enrichedCompanies;
    } catch (error) {
      logger.error('Get all companies error:', error);
      throw new AppError('Failed to get companies', 500, 'GET_COMPANIES_FAILED');
    }
  }

  /**
   * Create new user
   */
  static async createUser(
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      role: string;
      companyId?: string;
      teamId?: string;
    },
    createdById: string,
    // The creating admin's subscriber. Staff join the subscriber itself;
    // a contact joins one of its accounts (companyId). A user created with no
    // company used to belong to nobody, and an employee with no team then saw
    // every ticket on the platform.
    tenantId?: string
  ): Promise<UserModel> {
    try {
      if (!tenantId) {
        throw new AppError('No subscriber account for this user', 403, 'NO_TENANT');
      }
      const isContact = userData.role === 'customer';
      if (!isContact) await PlanService.assertCan(tenantId, 'agent');
      const companyId = isContact ? userData.companyId : tenantId;
      if (isContact && !(companyId && (await isCompanyInTenant(companyId, tenantId)))) {
        throw new AppError(
          'A contact needs an account (companyId) of this subscriber',
          400,
          'COMPANY_REQUIRED'
        );
      }
      // Check if user already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new AppError('User with this email already exists', 400, 'USER_EXISTS');
      }

      // Use the User.createUser method which handles password hashing
      const newUser = await User.createUser({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: userData.password,
        role: userData.role as 'customer' | 'employee' | 'team_lead' | 'admin',
      });

      if (!newUser) {
        throw new AppError('Failed to create user', 500, 'CREATE_FAILED');
      }

      await User.db('user_company_associations').insert({
        user_id: newUser.id,
        company_id: companyId,
        role: 'member',
      });
      if (!isContact) await OrgBillingService.syncSeats(tenantId);
      await User.db('users').where('id', newUser.id).update({ current_org_id: tenantId });

      logger.info(`User ${newUser.id} created by ${createdById}`);

      return User.toModel(newUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Create user error:', error);
      throw new AppError('Failed to create user', 500, 'CREATE_USER_FAILED');
    }
  }

  /**
   * Delete user permanently
   */
  static async deleteUser(userId: string, deletedById: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check if user has any active tickets or important associations
      // This is a safety check - in a real system you'd want to handle this more carefully

      await User.delete(userId);

      logger.info(`User ${userId} permanently deleted by ${deletedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Delete user error:', error);
      throw new AppError('Failed to delete user', 500, 'DELETE_USER_FAILED');
    }
  }
}
