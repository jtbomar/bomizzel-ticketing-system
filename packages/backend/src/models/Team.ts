import { BaseModel } from './BaseModel';
import { TeamTable } from '@/types/database';
import { Team as TeamModel } from '@/types/models';

export class Team extends BaseModel {
  protected static tableName = 'teams';

  static async createTeam(teamData: { name: string; description?: string }): Promise<TeamTable> {
    return this.create({
      name: teamData.name,
      description: teamData.description,
    });
  }

  static async findByName(name: string): Promise<TeamTable | null> {
    const result = await this.query.where('name', name).first();
    return result || null;
  }

  static async findActiveTeams(
    options: {
      limit?: number;
      offset?: number;
      search?: string;
    } = {}
  ): Promise<TeamTable[]> {
    let query = this.query.where('is_active', true);

    if (options.search) {
      query = query.where('name', 'ilike', `%${options.search}%`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('name', 'asc');
  }

  static async addUserToTeam(
    userId: string,
    teamId: string,
    role: 'member' | 'lead' | 'admin' = 'member'
  ): Promise<void> {
    await this.db('team_memberships').insert({
      user_id: userId,
      team_id: teamId,
      role,
    });
  }

  static async removeUserFromTeam(userId: string, teamId: string): Promise<void> {
    await this.db('team_memberships').where('user_id', userId).where('team_id', teamId).del();
  }

  static async getUserTeams(userId: string): Promise<TeamTable[]> {
    return this.db('teams as t')
      .join('team_memberships as tm', 't.id', 'tm.team_id')
      .where('tm.user_id', userId)
      .where('t.is_active', true)
      .select('t.*')
      .orderBy('t.name', 'asc');
  }

  static async getTeamMembers(teamId: string): Promise<any[]> {
    return this.db('users as u')
      .join('team_memberships as tm', 'u.id', 'tm.user_id')
      .where('tm.team_id', teamId)
      .where('u.is_active', true)
      .select('u.*', 'tm.role as team_role', 'tm.created_at as membership_created_at')
      .orderBy('u.first_name', 'asc');
  }

  static async isUserInTeam(userId: string, teamId: string): Promise<boolean> {
    const membership = await this.db('team_memberships')
      .where('user_id', userId)
      .where('team_id', teamId)
      .first();

    return !!membership;
  }

  static async getUserTeamRole(userId: string, teamId: string): Promise<string | null> {
    const membership = await this.db('team_memberships')
      .where('user_id', userId)
      .where('team_id', teamId)
      .select('role')
      .first();

    return membership?.role || null;
  }

  static async updateUserTeamRole(
    userId: string,
    teamId: string,
    role: 'member' | 'lead' | 'admin'
  ): Promise<void> {
    await this.db('team_memberships')
      .where('user_id', userId)
      .where('team_id', teamId)
      .update({ role, updated_at: new Date() });
  }

  static async isTeamLead(userId: string, teamId: string): Promise<boolean> {
    const role = await this.getUserTeamRole(userId, teamId);
    return role === 'lead' || role === 'admin';
  }

  static async getTeamLeads(teamId: string): Promise<any[]> {
    return this.db('users as u')
      .join('team_memberships as tm', 'u.id', 'tm.user_id')
      .where('tm.team_id', teamId)
      .whereIn('tm.role', ['lead', 'admin'])
      .where('u.is_active', true)
      .select('u.*', 'tm.role as team_role')
      .orderBy('u.first_name', 'asc');
  }

  static async getCustomStatuses(teamId: string): Promise<any[]> {
    const statuses = await this.db('ticket_statuses')
      .where('team_id', teamId)
      .where('is_active', true)
      .orderBy('order', 'asc');

    return statuses;
  }

  // Convert database record to API model
  static toModel(team: TeamTable): TeamModel {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      isActive: team.is_active,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
    };
  }
}
