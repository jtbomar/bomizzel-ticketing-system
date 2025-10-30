import { UsageTracking, UsageSummary } from '@/models/UsageTracking';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { SubscriptionPlan } from '@/models/SubscriptionPlan';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { 
  UsageRecord,
  UsageStats,
  UsageLimitStatus,
  CustomerSubscription as CustomerSubscriptionModel
} from '@/types/models';

export class UsageTrackingService {
  /**
   * Record ticket creation
   */
  static async recordTicketCreation(
    userId: string,
    ticketId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Get user's subscription
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        logger.warn('No subscription found for user when recording ticket creation', { userId, ticketId });
        return;
      }

      await UsageTracking.recordTicketAction({
        subscriptionId: subscription.id,
        ticketId,
        action: 'created',
        metadata
      });

      logger.debug('Ticket creation recorded', {
        userId,
        subscriptionId: subscription.id,
        ticketId
      });
    } catch (error) {
      logger.error('Error recording ticket creation', { userId, ticketId, error });
      throw error;
    }
  }

  /**
   * Record ticket status change
   */
  static async recordTicketStatusChange(
    userId: string,
    ticketId: string,
    previousStatus: string,
    newStatus: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Get user's subscription
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        logger.warn('No subscription found for user when recording ticket status change', { 
          userId, 
          ticketId, 
          previousStatus, 
          newStatus 
        });
        return;
      }

      // Determine the action based on status change
      let action: 'created' | 'completed' | 'archived' | 'deleted' = 'created';
      
      if (newStatus === 'completed' || newStatus === 'resolved' || newStatus === 'closed') {
        action = 'completed';
      } else if (newStatus === 'archived') {
        action = 'archived';
      } else if (newStatus === 'deleted') {
        action = 'deleted';
      }

      await UsageTracking.recordTicketAction({
        subscriptionId: subscription.id,
        ticketId,
        action,
        previousStatus,
        newStatus,
        metadata
      });

      logger.debug('Ticket status change recorded', {
        userId,
        subscriptionId: subscription.id,
        ticketId,
        previousStatus,
        newStatus,
        action
      });
    } catch (error) {
      logger.error('Error recording ticket status change', { 
        userId, 
        ticketId, 
        previousStatus, 
        newStatus, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get current usage statistics for a user
   */
  static async getCurrentUsage(userId: string): Promise<UsageStats> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        // Return zero usage if no subscription
        return {
          activeTickets: 0,
          completedTickets: 0,
          totalTickets: 0,
          archivedTickets: 0
        };
      }

      return await UsageTracking.getCurrentUsageStats(subscription.id);
    } catch (error) {
      logger.error('Error getting current usage', { userId, error });
      throw error;
    }
  }

  /**
   * Get usage statistics for a specific period
   */
  static async getUsageForPeriod(
    userId: string,
    period: string // YYYY-MM format
  ): Promise<UsageStats> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return {
          activeTickets: 0,
          completedTickets: 0,
          totalTickets: 0,
          archivedTickets: 0
        };
      }

      return await UsageTracking.getUsageByPeriod(subscription.id, period);
    } catch (error) {
      logger.error('Error getting usage for period', { userId, period, error });
      throw error;
    }
  }

  /**
   * Check if user is approaching or at limits
   */
  static async checkLimitStatus(userId: string): Promise<UsageLimitStatus> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        throw new AppError('No active subscription found', 404);
      }

      // Get plan limits
      const plan = await SubscriptionPlan.findById(subscription.plan_id);
      if (!plan) {
        throw new AppError('Subscription plan not found', 404);
      }

      // Get current usage
      const usage = await UsageTracking.getCurrentUsageStats(subscription.id);

      // Calculate limit status
      return this.calculateLimitStatus(usage, {
        activeTickets: plan.active_ticket_limit,
        completedTickets: plan.completed_ticket_limit,
        totalTickets: plan.total_ticket_limit
      });
    } catch (error) {
      logger.error('Error checking limit status', { userId, error });
      throw error;
    }
  }

  /**
   * Check if user can create a new ticket
   */
  static async canCreateTicket(userId: string): Promise<{
    canCreate: boolean;
    reason?: string;
    limitType?: 'active' | 'total';
    usage?: UsageStats;
    limits?: { activeTickets: number; completedTickets: number; totalTickets: number };
  }> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        // Allow ticket creation if no subscription (fallback)
        return { canCreate: true };
      }

      // Get plan limits
      const plan = await SubscriptionPlan.findById(subscription.plan_id);
      if (!plan) {
        return { canCreate: true };
      }

      // Check if unlimited plan
      if (plan.active_ticket_limit === -1 && plan.total_ticket_limit === -1) {
        return { canCreate: true };
      }

      // Get current usage
      const usage = await UsageTracking.getCurrentUsageStats(subscription.id);

      const limits = {
        activeTickets: plan.active_ticket_limit,
        completedTickets: plan.completed_ticket_limit,
        totalTickets: plan.total_ticket_limit
      };

      // Check active ticket limit
      if (limits.activeTickets > 0 && usage.activeTickets >= limits.activeTickets) {
        return {
          canCreate: false,
          reason: `Active ticket limit reached (${limits.activeTickets})`,
          limitType: 'active',
          usage,
          limits
        };
      }

      // Check total ticket limit
      if (limits.totalTickets > 0 && usage.totalTickets >= limits.totalTickets) {
        return {
          canCreate: false,
          reason: `Total ticket limit reached (${limits.totalTickets})`,
          limitType: 'total',
          usage,
          limits
        };
      }

      return { canCreate: true, usage, limits };
    } catch (error) {
      logger.error('Error checking if user can create ticket', { userId, error });
      // Allow creation on error to prevent blocking
      return { canCreate: true };
    }
  }

  /**
   * Check if user can complete a ticket
   */
  static async canCompleteTicket(userId: string): Promise<{
    canComplete: boolean;
    reason?: string;
    usage?: UsageStats;
    limits?: { activeTickets: number; completedTickets: number; totalTickets: number };
  }> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return { canComplete: true };
      }

      const plan = await SubscriptionPlan.findById(subscription.plan_id);
      if (!plan) {
        return { canComplete: true };
      }

      // Check if unlimited plan
      if (plan.completed_ticket_limit === -1) {
        return { canComplete: true };
      }

      const usage = await UsageTracking.getCurrentUsageStats(subscription.id);
      const limits = {
        activeTickets: plan.active_ticket_limit,
        completedTickets: plan.completed_ticket_limit,
        totalTickets: plan.total_ticket_limit
      };

      // Check completed ticket limit
      if (limits.completedTickets > 0 && usage.completedTickets >= limits.completedTickets) {
        return {
          canComplete: false,
          reason: `Completed ticket limit reached (${limits.completedTickets})`,
          usage,
          limits
        };
      }

      return { canComplete: true, usage, limits };
    } catch (error) {
      logger.error('Error checking if user can complete ticket', { userId, error });
      return { canComplete: true };
    }
  }

  /**
   * Get usage percentage for warnings
   */
  static async getUsagePercentages(userId: string): Promise<{
    active: number;
    completed: number;
    total: number;
  }> {
    try {
      const limitStatus = await this.checkLimitStatus(userId);
      return limitStatus.percentageUsed;
    } catch (error) {
      logger.error('Error getting usage percentages', { userId, error });
      return { active: 0, completed: 0, total: 0 };
    }
  }

  /**
   * Get users approaching limits (for notifications)
   */
  static async getUsersApproachingLimits(
    warningThreshold: number = 75
  ): Promise<Array<{
    userId: string;
    subscriptionId: string;
    usage: UsageStats;
    limits: { activeTickets: number; completedTickets: number; totalTickets: number };
    percentageUsed: { active: number; completed: number; total: number };
  }>> {
    try {
      // Get all active subscriptions
      const subscriptions = await CustomerSubscription.query
        .whereIn('status', ['active', 'trial']);

      const usersApproachingLimits = [];

      for (const subscription of subscriptions) {
        try {
          const plan = await SubscriptionPlan.findById(subscription.plan_id);
          if (!plan || plan.active_ticket_limit === -1) {
            continue; // Skip unlimited plans
          }

          const usage = await UsageTracking.getCurrentUsageStats(subscription.id);
          const limits = {
            activeTickets: plan.active_ticket_limit,
            completedTickets: plan.completed_ticket_limit,
            totalTickets: plan.total_ticket_limit
          };

          const limitStatus = this.calculateLimitStatus(usage, limits);

          // Check if any usage is above threshold
          if (limitStatus.percentageUsed.active >= warningThreshold ||
              limitStatus.percentageUsed.completed >= warningThreshold ||
              limitStatus.percentageUsed.total >= warningThreshold) {
            
            usersApproachingLimits.push({
              userId: subscription.user_id,
              subscriptionId: subscription.id,
              usage,
              limits,
              percentageUsed: limitStatus.percentageUsed
            });
          }
        } catch (error) {
          logger.error('Error checking limits for subscription', { 
            subscriptionId: subscription.id, 
            error 
          });
          continue;
        }
      }

      return usersApproachingLimits;
    } catch (error) {
      logger.error('Error getting users approaching limits', { error });
      throw error;
    }
  }

  /**
   * Update usage summary for a subscription (for optimization)
   */
  static async updateUsageSummary(
    subscriptionId: string,
    period?: string
  ): Promise<void> {
    try {
      const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
      const usage = await UsageTracking.getCurrentUsageStats(subscriptionId);
      
      await UsageSummary.updateSummary(subscriptionId, currentPeriod, usage);
      
      logger.debug('Usage summary updated', { subscriptionId, period: currentPeriod });
    } catch (error) {
      logger.error('Error updating usage summary', { subscriptionId, period, error });
      throw error;
    }
  }

  /**
   * Get ticket history for a specific ticket
   */
  static async getTicketHistory(ticketId: string): Promise<UsageRecord[]> {
    try {
      const history = await UsageTracking.getTicketHistory(ticketId);
      return history.map(record => UsageTracking.toModel(record));
    } catch (error) {
      logger.error('Error getting ticket history', { ticketId, error });
      throw error;
    }
  }

  /**
   * Get recent usage activity for a user
   */
  static async getRecentActivity(
    userId: string,
    limit: number = 50
  ): Promise<UsageRecord[]> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return [];
      }

      const activity = await UsageTracking.getRecentActivity(subscription.id, limit);
      return activity.map(record => UsageTracking.toModel(record));
    } catch (error) {
      logger.error('Error getting recent activity', { userId, limit, error });
      throw error;
    }
  }

  /**
   * Record ticket archival
   */
  static async recordTicketArchival(
    userId: string,
    ticketId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        logger.warn('No subscription found for user when recording ticket archival', { userId, ticketId });
        return;
      }

      await UsageTracking.recordTicketAction({
        subscriptionId: subscription.id,
        ticketId,
        action: 'archived',
        metadata
      });

      logger.debug('Ticket archival recorded', {
        userId,
        subscriptionId: subscription.id,
        ticketId
      });
    } catch (error) {
      logger.error('Error recording ticket archival', { userId, ticketId, error });
      throw error;
    }
  }

  /**
   * Record ticket restoration (unarchival)
   */
  static async recordTicketRestoration(
    userId: string,
    ticketId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        logger.warn('No subscription found for user when recording ticket restoration', { userId, ticketId });
        return;
      }

      // Record as a special action to track restoration
      await UsageTracking.recordTicketAction({
        subscriptionId: subscription.id,
        ticketId,
        action: 'created', // Restoration brings ticket back into active usage
        previousStatus: 'archived',
        newStatus: 'restored',
        metadata: {
          ...metadata,
          isRestoration: true
        }
      });

      logger.debug('Ticket restoration recorded', {
        userId,
        subscriptionId: subscription.id,
        ticketId
      });
    } catch (error) {
      logger.error('Error recording ticket restoration', { userId, ticketId, error });
      throw error;
    }
  }

  /**
   * Calculate limit status based on usage and limits
   */
  private static calculateLimitStatus(
    usage: UsageStats,
    limits: { activeTickets: number; completedTickets: number; totalTickets: number }
  ): UsageLimitStatus {
    // Handle unlimited plans
    const isUnlimited = limits.activeTickets === -1 && 
                       limits.completedTickets === -1 && 
                       limits.totalTickets === -1;

    if (isUnlimited) {
      return {
        isAtLimit: false,
        isNearLimit: false,
        percentageUsed: {
          active: 0,
          completed: 0,
          total: 0
        },
        limits,
        current: usage
      };
    }

    // Calculate percentages
    const activePercentage = limits.activeTickets > 0 ? 
      (usage.activeTickets / limits.activeTickets) * 100 : 0;
    const completedPercentage = limits.completedTickets > 0 ? 
      (usage.completedTickets / limits.completedTickets) * 100 : 0;
    const totalPercentage = limits.totalTickets > 0 ? 
      (usage.totalTickets / limits.totalTickets) * 100 : 0;

    // Check if at or near limits
    const isAtLimit = usage.activeTickets >= limits.activeTickets ||
                     usage.completedTickets >= limits.completedTickets ||
                     usage.totalTickets >= limits.totalTickets;

    const isNearLimit = activePercentage >= 75 || 
                       completedPercentage >= 75 || 
                       totalPercentage >= 75;

    return {
      isAtLimit,
      isNearLimit,
      percentageUsed: {
        active: Math.min(activePercentage, 100),
        completed: Math.min(completedPercentage, 100),
        total: Math.min(totalPercentage, 100)
      },
      limits,
      current: usage
    };
  }
}