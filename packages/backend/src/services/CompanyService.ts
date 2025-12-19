import { Company } from '@/models/Company';
import { User } from '@/models/User';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { Company as CompanyModel, User as UserModel, PaginatedResponse } from '@/types/models';

export class CompanyService {
  /**
   * Create a new company
   */
  static async createCompany(
    companyData: {
      name: string;
      domain?: string;
      description?: string;
    },
    createdById: string
  ): Promise<CompanyModel> {
    try {
      // Check if company name already exists
      const existingCompany = await Company.findByName(companyData.name);
      if (existingCompany) {
        throw new AppError('Company with this name already exists', 409, 'COMPANY_NAME_EXISTS');
      }

      // Check if domain already exists (if provided)
      if (companyData.domain) {
        const existingDomain = await Company.findByDomain(companyData.domain);
        if (existingDomain) {
          throw new AppError(
            'Company with this domain already exists',
            409,
            'COMPANY_DOMAIN_EXISTS'
          );
        }
      }

      const company = await Company.createCompany(companyData);

      logger.info(`Company created: ${company.name} by user ${createdById}`);

      return Company.toModel(company);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Create company error:', error);
      throw new AppError('Failed to create company', 500, 'CREATE_COMPANY_FAILED');
    }
  }

  /**
   * Get all companies with pagination and filtering
   */
  static async getCompanies(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      requestingUser?: {
        id: string;
        role: string;
        organizationId?: string;
        companies?: string[];
      };
    } = {}
  ): Promise<PaginatedResponse<CompanyModel>> {
    try {
      const { page = 1, limit = 25, search, isActive, requestingUser } = options;
      const offset = (page - 1) * limit;

      // CRITICAL: Implement tenant isolation for companies
      if (requestingUser?.organizationId) {
        // Organization users should not see companies - they manage their own organization
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      // For customer users or fallback, use existing logic
      const companies = await Company.findActiveCompanies({
        limit,
        offset,
        search,
      });

      // Get total count
      let countQuery = Company.query;

      if (isActive !== undefined) {
        countQuery = countQuery.where('is_active', isActive);
      }

      if (search) {
        countQuery = countQuery.where(function () {
          this.where('name', 'ilike', `%${search}%`).orWhere('domain', 'ilike', `%${search}%`);
        });
      }

      const total = await countQuery.count('* as count').first();
      const totalCount = parseInt(total?.count || '0', 10);

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

      return {
        data: enrichedCompanies,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Get companies error:', error);
      throw new AppError('Failed to get companies', 500, 'GET_COMPANIES_FAILED');
    }
  }

  /**
   * Get company by ID
   */
  static async getCompanyById(companyId: string): Promise<CompanyModel> {
    try {
      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      return Company.toModel(company);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get company by ID error:', error);
      throw new AppError('Failed to get company', 500, 'GET_COMPANY_FAILED');
    }
  }

  /**
   * Update company information
   */
  static async updateCompany(
    companyId: string,
    updateData: {
      name?: string;
      domain?: string;
      description?: string;
      isActive?: boolean;
    },
    updatedById: string
  ): Promise<CompanyModel> {
    try {
      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      // Check for name conflicts (if name is being updated)
      if (updateData.name && updateData.name !== company.name) {
        const existingCompany = await Company.findByName(updateData.name);
        if (existingCompany) {
          throw new AppError('Company with this name already exists', 409, 'COMPANY_NAME_EXISTS');
        }
      }

      // Check for domain conflicts (if domain is being updated)
      if (updateData.domain && updateData.domain !== company.domain) {
        const existingDomain = await Company.findByDomain(updateData.domain);
        if (existingDomain) {
          throw new AppError(
            'Company with this domain already exists',
            409,
            'COMPANY_DOMAIN_EXISTS'
          );
        }
      }

      // Prepare update data
      const updateFields: any = {};

      if (updateData.name !== undefined) {
        updateFields.name = updateData.name;
      }

      if (updateData.domain !== undefined) {
        updateFields.domain = updateData.domain;
      }

      if (updateData.description !== undefined) {
        updateFields.description = updateData.description;
      }

      if (updateData.isActive !== undefined) {
        updateFields.is_active = updateData.isActive;
      }

      const updatedCompany = await Company.update(companyId, updateFields);
      if (!updatedCompany) {
        throw new AppError('Failed to update company', 500, 'UPDATE_FAILED');
      }

      logger.info(`Company ${companyId} updated by ${updatedById}`);

      return Company.toModel(updatedCompany);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update company error:', error);
      throw new AppError('Failed to update company', 500, 'UPDATE_COMPANY_FAILED');
    }
  }

  /**
   * Delete company (soft delete by deactivating)
   */
  static async deleteCompany(companyId: string, deletedById: string): Promise<void> {
    try {
      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      if (!company.is_active) {
        throw new AppError('Company is already deactivated', 400, 'COMPANY_ALREADY_DEACTIVATED');
      }

      await Company.update(companyId, { is_active: false });

      logger.info(`Company ${companyId} deactivated by ${deletedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Delete company error:', error);
      throw new AppError('Failed to delete company', 500, 'DELETE_COMPANY_FAILED');
    }
  }

  /**
   * Get company users with their roles
   */
  static async getCompanyUsers(
    companyId: string
  ): Promise<(UserModel & { companyRole: string; associationDate: Date })[]> {
    try {
      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      const users = await Company.getCompanyUsers(companyId);

      return users.map((user) => ({
        ...User.toModel(user),
        companyRole: user.company_role,
        associationDate: user.association_created_at,
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get company users error:', error);
      throw new AppError('Failed to get company users', 500, 'GET_COMPANY_USERS_FAILED');
    }
  }

  /**
   * Add user to company
   */
  static async addUserToCompany(
    companyId: string,
    userId: string,
    role: string = 'member',
    addedById: string
  ): Promise<void> {
    try {
      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.is_active) {
        throw new AppError('Cannot add inactive user to company', 400, 'USER_INACTIVE');
      }

      // Check if user is already associated with the company
      const isAlreadyAssociated = await Company.isUserInCompany(userId, companyId);
      if (isAlreadyAssociated) {
        throw new AppError(
          'User is already associated with this company',
          409,
          'USER_ALREADY_IN_COMPANY'
        );
      }

      await Company.addUserToCompany(userId, companyId, role);

      logger.info(`User ${userId} added to company ${companyId} with role ${role} by ${addedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Add user to company error:', error);
      throw new AppError('Failed to add user to company', 500, 'ADD_USER_TO_COMPANY_FAILED');
    }
  }

  /**
   * Remove user from company
   */
  static async removeUserFromCompany(
    companyId: string,
    userId: string,
    removedById: string
  ): Promise<void> {
    try {
      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check if user is associated with the company
      const isAssociated = await Company.isUserInCompany(userId, companyId);
      if (!isAssociated) {
        throw new AppError('User is not associated with this company', 404, 'USER_NOT_IN_COMPANY');
      }

      await Company.removeUserFromCompany(userId, companyId);

      logger.info(`User ${userId} removed from company ${companyId} by ${removedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Remove user from company error:', error);
      throw new AppError(
        'Failed to remove user from company',
        500,
        'REMOVE_USER_FROM_COMPANY_FAILED'
      );
    }
  }

  /**
   * Update user's role in company
   */
  static async updateUserCompanyRole(
    companyId: string,
    userId: string,
    role: string,
    updatedById: string
  ): Promise<void> {
    try {
      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check if user is associated with the company
      const isAssociated = await Company.isUserInCompany(userId, companyId);
      if (!isAssociated) {
        throw new AppError('User is not associated with this company', 404, 'USER_NOT_IN_COMPANY');
      }

      await Company.updateUserCompanyRole(userId, companyId, role);

      logger.info(
        `User ${userId} role in company ${companyId} updated to ${role} by ${updatedById}`
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update user company role error:', error);
      throw new AppError(
        'Failed to update user company role',
        500,
        'UPDATE_USER_COMPANY_ROLE_FAILED'
      );
    }
  }

  /**
   * Search companies by name or domain
   */
  static async searchCompanies(
    query: string,
    options: {
      limit?: number;
      excludeCompanyIds?: string[];
    } = {}
  ): Promise<CompanyModel[]> {
    try {
      const { limit = 10, excludeCompanyIds = [] } = options;

      let searchQuery = Company.query.where('is_active', true).where(function () {
        this.where('name', 'ilike', `%${query}%`).orWhere('domain', 'ilike', `%${query}%`);
      });

      if (excludeCompanyIds.length > 0) {
        searchQuery = searchQuery.whereNotIn('id', excludeCompanyIds);
      }

      const companies = await searchQuery.limit(limit).orderBy('name', 'asc');

      return companies.map((company: any) => Company.toModel(company));
    } catch (error) {
      logger.error('Search companies error:', error);
      throw new AppError('Failed to search companies', 500, 'SEARCH_COMPANIES_FAILED');
    }
  }

  /**
   * Get company statistics
   */
  static async getCompanyStats(): Promise<{
    totalCompanies: number;
    activeCompanies: number;
    companiesWithUsers: number;
    averageUsersPerCompany: number;
    recentCompanies: number;
  }> {
    try {
      const stats = await Company.db.raw(`
        SELECT 
          COUNT(*) as total_companies,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_companies,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_companies
        FROM companies
      `);

      const userStats = await Company.db.raw(`
        SELECT 
          COUNT(DISTINCT company_id) as companies_with_users,
          COALESCE(AVG(user_count), 0) as avg_users_per_company
        FROM (
          SELECT company_id, COUNT(*) as user_count
          FROM user_company_associations
          GROUP BY company_id
        ) company_user_counts
      `);

      const companyResult = stats.rows[0];
      const userResult = userStats.rows[0];

      return {
        totalCompanies: parseInt(companyResult.total_companies, 10),
        activeCompanies: parseInt(companyResult.active_companies, 10),
        companiesWithUsers: parseInt(userResult.companies_with_users || '0', 10),
        averageUsersPerCompany: parseFloat(userResult.avg_users_per_company || '0'),
        recentCompanies: parseInt(companyResult.recent_companies, 10),
      };
    } catch (error) {
      logger.error('Get company stats error:', error);
      throw new AppError('Failed to get company statistics', 500, 'GET_COMPANY_STATS_FAILED');
    }
  }

  /**
   * Check if user can access company resources
   */
  static async canUserAccessCompany(userId: string, companyId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      // Admin users can access any company
      if (user.role === 'admin') {
        return true;
      }

      // Check if user is associated with the company
      return await Company.isUserInCompany(userId, companyId);
    } catch (error) {
      logger.error('Check user company access error:', error);
      return false;
    }
  }
}
