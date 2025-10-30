import { TicketStatus } from '@/models/TicketStatus';
import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { TicketStatus as TicketStatusModel } from '@/types/models';

export class TicketStatusService {
  /**
   * Create a new ticket status for a team
   */
  static async createStatus(
    teamId: string,
    statusData: {
      name: string;
      label: string;
      color?: string;
      order?: number;
      isDefault?: boolean;
      isClosed?: boolean;
    },
    createdById: string
  ): Promise<TicketStatusModel> {
    try {
      // Verify team exists
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      // Check if user has permission to manage team statuses
      const isTeamLead = await Team.isTeamLead(createdById, teamId);
      const user = await User.findById(createdById);
      
      if (!isTeamLead && user?.role !== 'admin') {
        throw new AppError('Only team leads or admins can manage ticket statuses', 403, 'TEAM_LEAD_REQUIRED');
      }

      // Check if status name already exists for this team
      const existingStatus = await TicketStatus.findByTeamAndName(teamId, statusData.name);
      if (existingStatus) {
        throw new AppError('Status with this name already exists for this team', 409, 'STATUS_NAME_EXISTS');
      }

      // If this is set as default, ensure no other default exists
      if (statusData.isDefault) {
        const currentDefault = await TicketStatus.getDefaultStatus(teamId);
        if (currentDefault) {
          throw new AppError('Team already has a default status. Update the existing default first.', 409, 'DEFAULT_STATUS_EXISTS');
        }
      }

      const status = await TicketStatus.createStatus({
        teamId,
        ...statusData,
      });

      logger.info(`Ticket status created: ${status.name} for team ${teamId} by user ${createdById}`);

      return TicketStatus.toModel(status);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Create ticket status error:', error);
      throw new AppError('Failed to create ticket status', 500, 'CREATE_STATUS_FAILED');
    }
  }

  /**
   * Get all statuses for a team
   */
  static async getTeamStatuses(teamId: string): Promise<TicketStatusModel[]> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      const statuses = await TicketStatus.findByTeam(teamId);
      return statuses.map(status => TicketStatus.toModel(status));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get team statuses error:', error);
      throw new AppError('Failed to get team statuses', 500, 'GET_TEAM_STATUSES_FAILED');
    }
  }

  /**
   * Update a ticket status
   */
  static async updateStatus(
    statusId: string,
    updateData: {
      name?: string;
      label?: string;
      color?: string;
      order?: number;
      isDefault?: boolean;
      isClosed?: boolean;
      isActive?: boolean;
    },
    updatedById: string
  ): Promise<TicketStatusModel> {
    try {
      const status = await TicketStatus.findById(statusId);
      if (!status) {
        throw new AppError('Status not found', 404, 'STATUS_NOT_FOUND');
      }

      // Check if user has permission to manage team statuses
      const isTeamLead = await Team.isTeamLead(updatedById, status.team_id);
      const user = await User.findById(updatedById);
      
      if (!isTeamLead && user?.role !== 'admin') {
        throw new AppError('Only team leads or admins can manage ticket statuses', 403, 'TEAM_LEAD_REQUIRED');
      }

      // Check for name conflicts (if name is being updated)
      if (updateData.name && updateData.name !== status.name) {
        const existingStatus = await TicketStatus.findByTeamAndName(status.team_id, updateData.name);
        if (existingStatus) {
          throw new AppError('Status with this name already exists for this team', 409, 'STATUS_NAME_EXISTS');
        }
      }

      // Handle default status changes
      if (updateData.isDefault === true) {
        await TicketStatus.setDefaultStatus(status.team_id, statusId);
      }

      // Prepare update data
      const updateFields: any = {};
      
      if (updateData.name !== undefined) {
        updateFields.name = updateData.name;
      }
      
      if (updateData.label !== undefined) {
        updateFields.label = updateData.label;
      }
      
      if (updateData.color !== undefined) {
        updateFields.color = updateData.color;
      }
      
      if (updateData.order !== undefined) {
        updateFields.order = updateData.order;
      }
      
      if (updateData.isClosed !== undefined) {
        updateFields.is_closed = updateData.isClosed;
      }
      
      if (updateData.isActive !== undefined) {
        updateFields.is_active = updateData.isActive;
      }

      const updatedStatus = await TicketStatus.update(statusId, updateFields);
      if (!updatedStatus) {
        throw new AppError('Failed to update status', 500, 'UPDATE_FAILED');
      }

      logger.info(`Ticket status ${statusId} updated by ${updatedById}`);

      return TicketStatus.toModel(updatedStatus);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update ticket status error:', error);
      throw new AppError('Failed to update ticket status', 500, 'UPDATE_STATUS_FAILED');
    }
  }

  /**
   * Delete a ticket status
   */
  static async deleteStatus(statusId: string, deletedById: string): Promise<void> {
    try {
      const status = await TicketStatus.findById(statusId);
      if (!status) {
        throw new AppError('Status not found', 404, 'STATUS_NOT_FOUND');
      }

      // Check if user has permission to manage team statuses
      const isTeamLead = await Team.isTeamLead(deletedById, status.team_id);
      const user = await User.findById(deletedById);
      
      if (!isTeamLead && user?.role !== 'admin') {
        throw new AppError('Only team leads or admins can manage ticket statuses', 403, 'TEAM_LEAD_REQUIRED');
      }

      // Check if status is being used by any tickets
      const ticketCount = await TicketStatus.query
        .from('tickets')
        .where('status', status.name)
        .where('team_id', status.team_id)
        .count('* as count')
        .first();

      if (ticketCount && parseInt(ticketCount.count, 10) > 0) {
        throw new AppError('Cannot delete status that is being used by tickets', 409, 'STATUS_IN_USE');
      }

      // Soft delete by setting is_active to false
      await TicketStatus.update(statusId, { is_active: false });

      logger.info(`Ticket status ${statusId} deleted by ${deletedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Delete ticket status error:', error);
      throw new AppError('Failed to delete ticket status', 500, 'DELETE_STATUS_FAILED');
    }
  }

  /**
   * Reorder team statuses
   */
  static async reorderStatuses(
    teamId: string,
    statusOrders: { id: string; order: number }[],
    updatedById: string
  ): Promise<void> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      // Check if user has permission to manage team statuses
      const isTeamLead = await Team.isTeamLead(updatedById, teamId);
      const user = await User.findById(updatedById);
      
      if (!isTeamLead && user?.role !== 'admin') {
        throw new AppError('Only team leads or admins can manage ticket statuses', 403, 'TEAM_LEAD_REQUIRED');
      }

      await TicketStatus.updateOrder(teamId, statusOrders);

      logger.info(`Ticket statuses reordered for team ${teamId} by ${updatedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Reorder ticket statuses error:', error);
      throw new AppError('Failed to reorder ticket statuses', 500, 'REORDER_STATUSES_FAILED');
    }
  }

  /**
   * Get status statistics for a team
   */
  static async getStatusStats(teamId: string): Promise<{ statusId: string; name: string; label: string; ticketCount: number }[]> {
    try {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
      }

      return await TicketStatus.getStatusStats(teamId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get status stats error:', error);
      throw new AppError('Failed to get status statistics', 500, 'GET_STATUS_STATS_FAILED');
    }
  }
}