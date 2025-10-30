import { User } from '@/models/User';
import { Team } from '@/models/Team';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { User as UserModel, PaginatedResponse } from '@/types/models';
import { db } from '@/config/database';

export class UserRoleService {
  /**
   * Get all users with pagination and filtering
   */
  static async getUsers(options: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    isActive?: boolean;
  } = {}): Promise<PaginatedResponse<UserModel & { teamCount: number }>> {
    try {
      const { page = 1, limit = 25, role, search, isActive } = options;
      const offset = (page - 1) * limit;

      let query = User.query;
      
      if (role) {
        query = query.where('role', role);
      }
      
      if (isActive !== undefined) {
        query = query.where('is_active', isActive);
      }
      
      if (search) {
        query = query.where(function(this: any) {
          this.where('first_name', 'ilike', `%${search}%`)
            .orWhere('last_name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
        });
      }

      const users = await query
        .limit(limit)
        .offset(offset)
        .orderBy('created_at', 'desc');

      // Get total count
      let countQuery = User.query;
      
      if (role) {
        countQuery = countQuery.where('role', role);
      }
      
      if (isActive !== undefined) {
        countQuery = countQuery.where('is_active', isActive);
      }
      
      if (search) {
        countQuery = countQuery.where(function(this: any) {
          this.where('first_name', 'ilike', `%${search}%`)
            .orWhere('last_name', 'ilike', `%${search}%`)
            .orWhere('email', 'ilike', `%${search}%`);
        });
      }

      const total = await countQuery.count('* as count').first();
      const totalCount = parseInt(total?.count || '0', 10);

      // Get team counts for each user
      const userModels = await Promise.all(
        users.map(async (user: any) => {
          const teams = await Team.getUserTeams(user.id);
          return {
            ...User.toModel(user),
            teamCount: teams.length,
          };
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
   * Update user role (admin only)
   */
  static async updateUserRole(
    userId: string,
    newRole: 'customer' | 'employee' | 'team_lead' | 'admin',
    updatedById: string
  ): Promise<UserModel> {
    try {
      // Check if updater is admin
      const updater = await User.findById(updatedById);
      if (!updater || updater.role !== 'admin') {
        throw new AppError('Only administrators can update user roles', 403, 'ADMIN_REQUIRED');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Prevent self-demotion from admin
      if (userId === updatedById && user.role === 'admin' && newRole !== 'admin') {
        throw new AppError('Cannot demote yourself from admin role', 400, 'CANNOT_DEMOTE_SELF');
      }

      const updatedUser = await User.update(userId, { role: newRole });
      if (!updatedUser) {
        throw new AppError('Failed to update user role', 500, 'UPDATE_FAILED');
      }

      logger.info(`User ${userId} role updated to ${newRole} by ${updatedById}`);

      return User.toModel(updatedUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update user role error:', error);
      throw new AppError('Failed to update user role', 500, 'UPDATE_USER_ROLE_FAILED');
    }
  }

  /**
   * Activate or deactivate user (admin only)
   */
  static async updateUserStatus(
    userId: string,
    isActive: boolean,
    updatedById: string
  ): Promise<UserModel> {
    try {
      // Check if updater is admin
      const updater = await User.findById(updatedById);
      if (!updater || updater.role !== 'admin') {
        throw new AppError('Only administrators can update user status', 403, 'ADMIN_REQUIRED');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Prevent self-deactivation
      if (userId === updatedById && !isActive) {
        throw new AppError('Cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
      }

      const updatedUser = await User.update(userId, { is_active: isActive });
      if (!updatedUser) {
        throw new AppError('Failed to update user status', 500, 'UPDATE_FAILED');
      }

      logger.info(`User ${userId} ${isActive ? 'activated' : 'deactivated'} by ${updatedById}`);

      return User.toModel(updatedUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update user status error:', error);
      throw new AppError('Failed to update user status', 500, 'UPDATE_USER_STATUS_FAILED');
    }
  }

  /**
   * Get user details with teams and permissions
   */
  static async getUserDetails(userId: string): Promise<UserModel & { 
    teams: { id: string; name: string; role: string; membershipDate: Date }[];
    permissions: string[];
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const teams = await Team.getUserTeams(userId);
      const teamMemberships = await Promise.all(
        teams.map(async (team) => {
          const role = await Team.getUserTeamRole(userId, team.id);
          const membership = await db('team_memberships')
            .where('user_id', userId)
            .where('team_id', team.id)
            .select('created_at')
            .first();
          
          return {
            id: team.id,
            name: team.name,
            role: role || 'member',
            membershipDate: membership?.created_at || new Date(),
          };
        })
      );

      // Calculate permissions based on role and team memberships
      const permissions = this.calculateUserPermissions(user.role, teamMemberships);

      return {
        ...User.toModel(user),
        teams: teamMemberships,
        permissions,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get user details error:', error);
      throw new AppError('Failed to get user details', 500, 'GET_USER_DETAILS_FAILED');
    }
  }

  /**
   * Calculate user permissions based on role and team memberships
   */
  private static calculateUserPermissions(
    role: string,
    teams: { id: string; name: string; role: string; membershipDate: Date }[]
  ): string[] {
    const permissions: string[] = [];

    // Base permissions for all authenticated users
    permissions.push('view_own_profile', 'update_own_profile');

    // Customer permissions
    if (role === 'customer') {
      permissions.push(
        'create_ticket',
        'view_own_tickets',
        'add_ticket_notes',
        'upload_files'
      );
    }

    // Employee permissions
    if (role === 'employee' || role === 'admin') {
      permissions.push(
        'view_tickets',
        'update_tickets',
        'assign_tickets',
        'add_internal_notes',
        'send_emails',
        'view_queues',
        'view_dashboard_metrics'
      );
    }

    // Team lead permissions
    const isTeamLead = teams.some(team => team.role === 'lead' || team.role === 'admin');
    if (isTeamLead || role === 'admin') {
      permissions.push(
        'manage_custom_fields',
        'manage_ticket_statuses',
        'manage_team_members',
        'view_team_settings'
      );
    }

    // Admin permissions
    if (role === 'admin') {
      permissions.push(
        'manage_users',
        'manage_teams',
        'manage_system_settings',
        'view_all_tickets',
        'export_data',
        'view_system_reports'
      );
    }

    return permissions;
  }

  /**
   * Create a new user (admin only)
   */
  static async createUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: 'customer' | 'employee' | 'team_lead' | 'admin';
    teamId?: string;
    createdById: string;
  }): Promise<UserModel> {
    try {
      // Check if creator is admin
      const creator = await User.findById(userData.createdById);
      if (!creator || creator.role !== 'admin') {
        throw new AppError('Only administrators can create users', 403, 'ADMIN_REQUIRED');
      }

      // Check if email already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new AppError('Email already exists', 400, 'EMAIL_EXISTS');
      }

      // Create the user
      const newUser = await User.createUser({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: userData.password,
        role: userData.role,
      });

      if (!newUser) {
        throw new AppError('Failed to create user', 500, 'CREATE_FAILED');
      }

      // Add to team if specified
      if (userData.teamId) {
        try {
          await Team.addUserToTeam(newUser.id, userData.teamId, 'member');
        } catch (teamError) {
          logger.warn(`Failed to add user ${newUser.id} to team ${userData.teamId}:`, teamError);
          // Don't fail the user creation if team assignment fails
        }
      }

      logger.info(`User ${newUser.id} created by ${userData.createdById}`);

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
   * Update user details (admin only)
   */
  static async updateUser(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: 'customer' | 'employee' | 'team_lead' | 'admin';
      isActive?: boolean;
      teamId?: string;
    },
    updatedById: string
  ): Promise<UserModel> {
    try {
      // Check if updater is admin
      const updater = await User.findById(updatedById);
      if (!updater || updater.role !== 'admin') {
        throw new AppError('Only administrators can update users', 403, 'ADMIN_REQUIRED');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Prevent self-demotion from admin
      if (userId === updatedById && user.role === 'admin' && updateData.role && updateData.role !== 'admin') {
        throw new AppError('Cannot demote yourself from admin role', 400, 'CANNOT_DEMOTE_SELF');
      }

      // Prevent self-deactivation
      if (userId === updatedById && updateData.isActive === false) {
        throw new AppError('Cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
      }

      // Check if email already exists (if email is being updated)
      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await User.findByEmail(updateData.email);
        if (existingUser) {
          throw new AppError('Email already exists', 400, 'EMAIL_EXISTS');
        }
      }

      // Prepare update object
      const updateObject: any = {};
      if (updateData.firstName) updateObject.first_name = updateData.firstName;
      if (updateData.lastName) updateObject.last_name = updateData.lastName;
      if (updateData.email) updateObject.email = updateData.email;
      if (updateData.role) updateObject.role = updateData.role;
      if (updateData.isActive !== undefined) updateObject.is_active = updateData.isActive;

      const updatedUser = await User.update(userId, updateObject);
      if (!updatedUser) {
        throw new AppError('Failed to update user', 500, 'UPDATE_FAILED');
      }

      // Handle team assignment if specified
      if (updateData.teamId !== undefined) {
        try {
          // Remove from all current teams first
          const currentTeams = await Team.getUserTeams(userId);
          for (const team of currentTeams) {
            await Team.removeUserFromTeam(userId, team.id);
          }

          // Add to new team if specified
          if (updateData.teamId) {
            await Team.addUserToTeam(userId, updateData.teamId, 'member');
          }
        } catch (teamError) {
          logger.warn(`Failed to update team assignment for user ${userId}:`, teamError);
          // Don't fail the user update if team assignment fails
        }
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
   * Get role statistics
   */
  static async getRoleStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    roleDistribution: { role: string; count: number }[];
  }> {
    try {
      const totalUsers = await User.query.count('* as count').first();
      const activeUsers = await User.query.where('is_active', true).count('* as count').first();
      
      const roleDistribution = await User.query
        .select('role')
        .count('* as count')
        .groupBy('role')
        .orderBy('role');

      return {
        totalUsers: parseInt(totalUsers?.count || '0', 10),
        activeUsers: parseInt(activeUsers?.count || '0', 10),
        roleDistribution: roleDistribution.map((r: any) => ({
          role: r.role,
          count: parseInt(r.count, 10),
        })),
      };
    } catch (error) {
      logger.error('Get role stats error:', error);
      throw new AppError('Failed to get role statistics', 500, 'GET_ROLE_STATS_FAILED');
    }
  }
}