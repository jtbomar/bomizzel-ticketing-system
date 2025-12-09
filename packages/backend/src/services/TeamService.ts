import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import {
  Team as TeamModel,
  User as UserModel,
  TeamMembership,
  PaginatedResponse,
} from '@/types/models';
import { TeamTable } from '@/types/database';

export class TeamService {
  /**
   * Create a new team
   */
  static async createTeam(
    teamData: {
      name: string;
      description?: string;
    },
    createdById: string
  ): Promise<TeamModel> {
    try {
      // Check if team name already exists
      const existingTeam = await Team.findByName(teamData.name);
      if (existingTeam) {
        throw new AppError('Team with this name already exists', 409, 'TEAM_NAME_EXISTS');
      }

      const team = await Team.createTeam(teamData);

      // Add creator as team admin
      await Team.addUserToTeam(createdById, team.id, 'admin');

      logger.info(`Team created: ${team.name} by user ${createdById}`);

      return Team.toModel(team);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Create team error:', error);
      throw new AppError('Failed to create team', 500, 'CREATE_TEAM_FAILED');
    }
  }

  /**
   * Get all teams with pagination and filtering
   */
  static async getTeams(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {}
  ): Promise<PaginatedResponse<TeamModel>> {
    try {
      const { page = 1, limit = 25, search, isActive } = options;
      const offset = (page - 1) * limit;

      // Build query for teams with member counts
      let teamsQuery = Team.query
        .leftJoin('team_memberships', 'teams.id', 'team_memberships.team_id')
        .select('teams.*')
        .count('team_memberships.user_id as member_count')
        .groupBy('teams.id');

      if (isActive !== undefined) {
        teamsQuery = teamsQuery.where('teams.is_active', isActive);
      }

      if (search) {
        teamsQuery = teamsQuery.where('teams.name', 'ilike', `%${search}%`);
      }

      const teams = await teamsQuery
        .limit(limit)
        .offset(offset)
        .orderBy('teams.name', 'asc');

      // Get total count
      let countQuery = Team.query;

      if (isActive !== undefined) {
        countQuery = countQuery.where('is_active', isActive);
      }

      if (search) {
        countQuery = countQuery.where('name', 'ilike', `%${search}%`);
      }

      const total = await countQuery.count('* as count').first();
      const totalCount = parseInt(total?.count || '0', 10);

      const teamModels = teams.map((team: any) => ({
        ...Team.toModel(team),
        member_count: parseInt(team.member_count || '0', 10),
      }));

      return {
        data: teamModels,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Get teams error:', error);
      throw new AppError('Failed to get teams', 500, 'GET_TEAMS_FAILED');
    }
  }

  /**
   * Get team by ID
   */
  static async getTeamById(teamId: string): Promise<TeamModel> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      return Team.toModel(team);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get team by ID error:', error);
      throw new AppError('Failed to get team', 500, 'GET_TEAM_FAILED');
    }
  }

  /**
   * Update team information
   */
  static async updateTeam(
    teamId: string,
    updateData: {
      name?: string;
      description?: string;
      isActive?: boolean;
    },
    updatedById: string
  ): Promise<TeamModel> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      // Check if user has permission to update team
      const isTeamLead = await Team.isTeamLead(updatedById, teamId);
      const user = await User.findById(updatedById);

      if (!isTeamLead && user?.role !== 'admin') {
        throw new AppError(
          'Only team leads or admins can update team information',
          403,
          'TEAM_LEAD_REQUIRED'
        );
      }

      // Check for name conflicts (if name is being updated)
      if (updateData.name && updateData.name !== team.name) {
        const existingTeam = await Team.findByName(updateData.name);
        if (existingTeam) {
          throw new AppError('Team with this name already exists', 409, 'TEAM_NAME_EXISTS');
        }
      }

      // Prepare update data
      const updateFields: any = {};

      if (updateData.name !== undefined) {
        updateFields.name = updateData.name;
      }

      if (updateData.description !== undefined) {
        updateFields.description = updateData.description;
      }

      if (updateData.isActive !== undefined) {
        updateFields.is_active = updateData.isActive;
      }

      const updatedTeam = await Team.update(teamId, updateFields);
      if (!updatedTeam) {
        throw new AppError('Failed to update team', 500, 'UPDATE_FAILED');
      }

      logger.info(`Team ${teamId} updated by ${updatedById}`);

      return Team.toModel(updatedTeam);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update team error:', error);
      throw new AppError('Failed to update team', 500, 'UPDATE_TEAM_FAILED');
    }
  }

  /**
   * Get team members with their roles
   */
  static async getTeamMembers(
    teamId: string
  ): Promise<(UserModel & { teamRole: string; membershipDate: Date })[]> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      const members = await Team.getTeamMembers(teamId);

      return members.map((member) => ({
        ...User.toModel(member),
        teamRole: member.team_role,
        membershipDate: member.membership_created_at,
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get team members error:', error);
      throw new AppError('Failed to get team members', 500, 'GET_TEAM_MEMBERS_FAILED');
    }
  }

  /**
   * Add user to team
   */
  static async addUserToTeam(
    teamId: string,
    userId: string,
    role: 'member' | 'lead' | 'admin' = 'member',
    addedById: string
  ): Promise<void> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.is_active) {
        throw new AppError('Cannot add inactive user to team', 400, 'USER_INACTIVE');
      }

      // Check if user has permission to add members
      const isTeamLead = await Team.isTeamLead(addedById, teamId);
      const addedByUser = await User.findById(addedById);

      if (!isTeamLead && addedByUser?.role !== 'admin') {
        throw new AppError(
          'Only team leads or admins can add team members',
          403,
          'TEAM_LEAD_REQUIRED'
        );
      }

      // Check if user is already in the team
      const isAlreadyMember = await Team.isUserInTeam(userId, teamId);
      if (isAlreadyMember) {
        throw new AppError('User is already a member of this team', 409, 'USER_ALREADY_IN_TEAM');
      }

      await Team.addUserToTeam(userId, teamId, role);

      logger.info(`User ${userId} added to team ${teamId} with role ${role} by ${addedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Add user to team error:', error);
      throw new AppError('Failed to add user to team', 500, 'ADD_USER_TO_TEAM_FAILED');
    }
  }

  /**
   * Remove user from team
   */
  static async removeUserFromTeam(
    teamId: string,
    userId: string,
    removedById: string
  ): Promise<void> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check if user has permission to remove members
      const isTeamLead = await Team.isTeamLead(removedById, teamId);
      const removedByUser = await User.findById(removedById);

      if (!isTeamLead && removedByUser?.role !== 'admin' && removedById !== userId) {
        throw new AppError(
          'Only team leads, admins, or the user themselves can remove team members',
          403,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      // Check if user is in the team
      const isMember = await Team.isUserInTeam(userId, teamId);
      if (!isMember) {
        throw new AppError('User is not a member of this team', 404, 'USER_NOT_IN_TEAM');
      }

      await Team.removeUserFromTeam(userId, teamId);

      logger.info(`User ${userId} removed from team ${teamId} by ${removedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Remove user from team error:', error);
      throw new AppError('Failed to remove user from team', 500, 'REMOVE_USER_FROM_TEAM_FAILED');
    }
  }

  /**
   * Update user's role in team
   */
  static async updateUserTeamRole(
    teamId: string,
    userId: string,
    role: 'member' | 'lead' | 'admin',
    updatedById: string
  ): Promise<void> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check if user has permission to update roles
      const isTeamLead = await Team.isTeamLead(updatedById, teamId);
      const updatedByUser = await User.findById(updatedById);

      if (!isTeamLead && updatedByUser?.role !== 'admin') {
        throw new AppError(
          'Only team leads or admins can update team member roles',
          403,
          'TEAM_LEAD_REQUIRED'
        );
      }

      // Check if user is in the team
      const isMember = await Team.isUserInTeam(userId, teamId);
      if (!isMember) {
        throw new AppError('User is not a member of this team', 404, 'USER_NOT_IN_TEAM');
      }

      await Team.updateUserTeamRole(userId, teamId, role);

      logger.info(`User ${userId} role in team ${teamId} updated to ${role} by ${updatedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update user team role error:', error);
      throw new AppError('Failed to update user team role', 500, 'UPDATE_USER_TEAM_ROLE_FAILED');
    }
  }

  /**
   * Get teams for a specific user
   */
  static async getUserTeams(userId: string): Promise<TeamModel[]> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const teams = await Team.getUserTeams(userId);
      return teams.map((team) => Team.toModel(team));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get user teams error:', error);
      throw new AppError('Failed to get user teams', 500, 'GET_USER_TEAMS_FAILED');
    }
  }
}
