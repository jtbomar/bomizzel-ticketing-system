import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';

/**
 * Organization-scoped Team Service
 * All methods require orgId to ensure proper tenant isolation
 */
export class OrgScopedTeamService {
  /**
   * Get all teams for an organization
   */
  static async getTeams(orgId: string) {
    const teams = await db('teams')
      .where('org_id', orgId)
      .where('is_active', true)
      .orderBy('name', 'asc');

    return teams;
  }

  /**
   * Get single team (with org verification)
   */
  static async getTeam(orgId: string, teamId: string) {
    const team = await db('teams')
      .where('id', teamId)
      .where('org_id', orgId)
      .first();

    if (!team) {
      throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
    }

    return team;
  }

  /**
   * Create team (org-scoped)
   */
  static async createTeam(orgId: string, data: any) {
    const [team] = await db('teams')
      .insert({
        ...data,
        org_id: orgId,
        is_active: true,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return team;
  }

  /**
   * Update team (with org verification)
   */
  static async updateTeam(orgId: string, teamId: string, updates: any) {
    // Verify team belongs to org
    await this.getTeam(orgId, teamId);

    const [updatedTeam] = await db('teams')
      .where('id', teamId)
      .where('org_id', orgId)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return updatedTeam;
  }

  /**
   * Delete team (with org verification)
   */
  static async deleteTeam(orgId: string, teamId: string) {
    const deleted = await db('teams')
      .where('id', teamId)
      .where('org_id', orgId)
      .del();

    if (deleted === 0) {
      throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
    }

    return { success: true };
  }

  /**
   * Get team members
   */
  static async getTeamMembers(orgId: string, teamId: string) {
    // Verify team belongs to org
    await this.getTeam(orgId, teamId);

    const members = await db('team_members as tm')
      .join('users as u', 'tm.user_id', 'u.id')
      .where('tm.team_id', teamId)
      .select(
        'u.id',
        'u.first_name',
        'u.last_name',
        'u.email',
        'u.role',
        'tm.role as team_role',
        'tm.joined_at'
      );

    return members;
  }

  /**
   * Add team member
   */
  static async addTeamMember(orgId: string, teamId: string, userId: string, role: string = 'member') {
    // Verify team belongs to org
    await this.getTeam(orgId, teamId);

    // Verify user has access to org
    const userAccess = await db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', orgId)
      .first();

    if (!userAccess) {
      throw new AppError('User does not have access to this organization', 403, 'USER_NO_ORG_ACCESS');
    }

    // Check if already a member
    const existing = await db('team_members')
      .where('team_id', teamId)
      .where('user_id', userId)
      .first();

    if (existing) {
      throw new AppError('User is already a team member', 400, 'ALREADY_TEAM_MEMBER');
    }

    await db('team_members').insert({
      team_id: teamId,
      user_id: userId,
      role,
      joined_at: db.fn.now(),
    });

    return { success: true };
  }

  /**
   * Remove team member
   */
  static async removeTeamMember(orgId: string, teamId: string, userId: string) {
    // Verify team belongs to org
    await this.getTeam(orgId, teamId);

    const deleted = await db('team_members')
      .where('team_id', teamId)
      .where('user_id', userId)
      .del();

    if (deleted === 0) {
      throw new AppError('Team member not found', 404, 'TEAM_MEMBER_NOT_FOUND');
    }

    return { success: true };
  }
}
