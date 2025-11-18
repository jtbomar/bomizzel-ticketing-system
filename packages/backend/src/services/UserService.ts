import { User } from '@/models/User';
import { Company } from '@/models/Company';
import { Team } from '@/models/Team';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import {
  User as UserModel,
  UserCompanyAssociation,
  TeamMembership,
  PaginatedResponse,
} from '@/types/models';

export class UserService {
  /**
   * Get all users with pagination and filtering
   */
  static async getUsers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      role?: string;
      isActive?: boolean;
    } = {}
  ): Promise<PaginatedResponse<UserModel>> {
    try {
      const { page = 1, limit = 25, search, role, isActive } = options;
      const offset = (page - 1) * limit;

      let whereClause: any = {};

      if (role) {
        whereClause.role = role;
      }

      if (isActive !== undefined) {
        whereClause.is_active = isActive;
      }

      // Build search query
      let searchQuery = User.query;

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
   * Get user by ID with company associations
   */
  static async getUserById(
    userId: string
  ): Promise<UserModel & { companies?: UserCompanyAssociation[] }> {
    try {
      const userWithCompanies = await User.findWithCompanies(userId);
      if (!userWithCompanies) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
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

      const updatedUser = await User.update(userId, updateFields);
      if (!updatedUser) {
        throw new AppError('Failed to update user', 500, 'UPDATE_FAILED');
      }

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

      await User.update(userId, { is_active: true });

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
    } = {}
  ): Promise<UserModel[]> {
    try {
      const { limit = 10, excludeUserIds = [], role } = options;

      let searchQuery = User.query.where('is_active', true).where(function () {
        this.where('first_name', 'ilike', `%${query}%`)
          .orWhere('last_name', 'ilike', `%${query}%`)
          .orWhere('email', 'ilike', `%${query}%`);
      });

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
  static async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    customerCount: number;
    employeeCount: number;
    recentRegistrations: number;
  }> {
    try {
      const stats = await User.db.raw(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN role = 'customer' THEN 1 END) as customer_count,
          COUNT(CASE WHEN role IN ('employee', 'team_lead', 'admin') THEN 1 END) as employee_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_registrations
        FROM users
      `);

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
  static async getCustomersWithCompanies(): Promise<Array<UserModel & { companies: UserCompanyAssociation[] }>> {
    try {
      const customers = await User.findActiveUsers({ role: 'customer' });
      
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
  static async getAllCompanies(isActive?: boolean): Promise<any[]> {
    try {
      let query = Company.query;
      
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
            ticketCount: parseInt(ticketCount?.count || '0', 10),
            contactCount: parseInt(contactCount?.count || '0', 10),
          };
        })
      );
      
      return enrichedCompanies;
    } catch (error) {
      logger.error('Get all companies error:', error);
      throw new AppError('Failed to get companies', 500, 'GET_COMPANIES_FAILED');
    }
  }
}
