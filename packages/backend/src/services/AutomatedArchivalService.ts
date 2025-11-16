import { TicketArchivalService } from './TicketArchivalService';
import { UsageTrackingService } from './UsageTrackingService';
import { Ticket } from '@/models/Ticket';
import { User } from '@/models/User';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { logger } from '@/utils/logger';

export interface AutoArchivalConfig {
  enabled: boolean;
  daysAfterCompletion: number;
  maxTicketsPerRun: number;
  onlyWhenApproachingLimits: boolean;
  limitThreshold: number; // Percentage threshold to trigger archival
}

export interface AutoArchivalResult {
  processedSubscriptions: number;
  totalTicketsArchived: number;
  subscriptionResults: Array<{
    subscriptionId: string;
    userId: string;
    planName: string;
    ticketsArchived: number;
    errors: string[];
  }>;
}

export class AutomatedArchivalService {
  private static readonly DEFAULT_CONFIG: AutoArchivalConfig = {
    enabled: true,
    daysAfterCompletion: 30,
    maxTicketsPerRun: 100,
    onlyWhenApproachingLimits: true,
    limitThreshold: 80, // 80% of limit
  };

  /**
   * Run automated archival for all eligible subscriptions
   */
  static async runAutomatedArchival(
    config: Partial<AutoArchivalConfig> = {}
  ): Promise<AutoArchivalResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    if (!finalConfig.enabled) {
      logger.info('Automated archival is disabled');
      return {
        processedSubscriptions: 0,
        totalTicketsArchived: 0,
        subscriptionResults: [],
      };
    }

    logger.info('Starting automated archival run', { config: finalConfig });

    const result: AutoArchivalResult = {
      processedSubscriptions: 0,
      totalTicketsArchived: 0,
      subscriptionResults: [],
    };

    try {
      // Get all active Enterprise subscriptions
      const enterpriseSubscriptions = await this.getEnterpriseSubscriptions();

      for (const subscription of enterpriseSubscriptions) {
        try {
          const subscriptionResult = await this.processSubscriptionArchival(
            subscription,
            finalConfig
          );

          result.subscriptionResults.push(subscriptionResult);
          result.totalTicketsArchived += subscriptionResult.ticketsArchived;
          result.processedSubscriptions++;
        } catch (error) {
          logger.error('Error processing subscription for automated archival', {
            subscriptionId: subscription.id,
            userId: subscription.user_id,
            error,
          });

          result.subscriptionResults.push({
            subscriptionId: subscription.id,
            userId: subscription.user_id,
            planName: 'Unknown',
            ticketsArchived: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          });
        }
      }

      logger.info('Automated archival run completed', {
        processedSubscriptions: result.processedSubscriptions,
        totalTicketsArchived: result.totalTicketsArchived,
      });

      return result;
    } catch (error) {
      logger.error('Error during automated archival run', { error });
      throw error;
    }
  }

  /**
   * Process archival for a specific subscription
   */
  static async processSubscriptionArchival(
    subscription: any,
    config: AutoArchivalConfig
  ): Promise<{
    subscriptionId: string;
    userId: string;
    planName: string;
    ticketsArchived: number;
    errors: string[];
  }> {
    const result = {
      subscriptionId: subscription.id,
      userId: subscription.user_id,
      planName: 'Enterprise',
      ticketsArchived: 0,
      errors: [],
    };

    try {
      // Check if user is approaching limits (if configured)
      if (config.onlyWhenApproachingLimits) {
        const usage = await UsageTrackingService.getCurrentUsage(subscription.user_id);
        const plan = { completed_ticket_limit: 100 }; // Mock plan

        if (plan && plan.completed_ticket_limit > 0) {
          const completedUsagePercentage =
            (usage.completedTickets / plan.completed_ticket_limit) * 100;

          if (completedUsagePercentage < config.limitThreshold) {
            logger.debug('Subscription not approaching limits, skipping archival', {
              subscriptionId: subscription.id,
              completedUsagePercentage,
              threshold: config.limitThreshold,
            });
            return result;
          }
        }
      }

      // Get archivable tickets for this user
      const user = await User.findById(subscription.user_id);
      if (!user) {
        (result.errors as string[]).push('User not found');
        return result;
      }

      const archivableTickets = await Ticket.findArchivable({
        limit: config.maxTicketsPerRun,
        olderThanDays: config.daysAfterCompletion,
        companyIds:
          user.role === 'customer'
            ? (await User.getUserCompanies(user.id)).map((uc) => uc.companyId)
            : undefined,
        teamIds:
          user.role === 'agent'
            ? (await User.getUserTeams(user.id)).map((ut) => ut.teamId)
            : undefined,
      });

      if (archivableTickets.length === 0) {
        logger.debug('No archivable tickets found for subscription', {
          subscriptionId: subscription.id,
          userId: subscription.user_id,
        });
        return result;
      }

      // Archive tickets one by one
      for (const ticket of archivableTickets) {
        try {
          await TicketArchivalService.archiveTicket(
            ticket.id,
            'system', // System user for automated archival
            'admin' // Admin role for system operations
          );
          result.ticketsArchived++;

          logger.debug('Ticket automatically archived', {
            ticketId: ticket.id,
            subscriptionId: subscription.id,
            userId: subscription.user_id,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          (result.errors as string[]).push(
            `Failed to archive ticket ${ticket.id}: ${errorMessage}`
          );

          logger.error('Failed to archive ticket during automated run', {
            ticketId: ticket.id,
            subscriptionId: subscription.id,
            error,
          });
        }
      }

      return result;
    } catch (error) {
      (result.errors as string[]).push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Get archival suggestions for a specific user with enhanced logic
   */
  static async getArchivalSuggestionsForUser(
    userId: string,
    userRole: string
  ): Promise<{
    shouldSuggestArchival: boolean;
    reason: string;
    suggestions: Array<{
      ticketId: string;
      title: string;
      status: string;
      completedAt: Date;
      daysSinceCompletion: number;
      priority: 'high' | 'medium' | 'low';
    }>;
    usageInfo: {
      current: number;
      limit: number;
      percentage: number;
    };
    automationAvailable: boolean;
    automationConfig?: {
      enabled: boolean;
      daysAfterCompletion: number;
      nextRunDate?: Date;
    };
  }> {
    try {
      // Get user's subscription and usage
      const subscriptionDetails = await CustomerSubscription.findByUserId(userId);
      if (!subscriptionDetails) {
        return {
          shouldSuggestArchival: false,
          reason: 'No active subscription found',
          suggestions: [],
          usageInfo: { current: 0, limit: 0, percentage: 0 },
          automationAvailable: false,
        };
      }

      const usage = await UsageTrackingService.getCurrentUsage(userId);
      const completedLimit = 100; // Mock limit for demo

      // Don't suggest for unlimited plans
      if (completedLimit < 0) {
        return {
          shouldSuggestArchival: false,
          reason: 'Unlimited plan - no archival needed',
          suggestions: [],
          usageInfo: { current: usage.completedTickets, limit: -1, percentage: 0 },
          automationAvailable: true,
        };
      }

      const usagePercentage = (usage.completedTickets / completedLimit) * 100;
      const usageInfo = {
        current: usage.completedTickets,
        limit: completedLimit,
        percentage: usagePercentage,
      };

      // Only suggest if approaching limits (75% or more)
      if (usagePercentage < 75) {
        return {
          shouldSuggestArchival: false,
          reason: 'Usage below threshold for archival suggestions',
          suggestions: [],
          usageInfo,
          automationAvailable: true,
        };
      }

      // Get archivable tickets
      const archivableTickets = await TicketArchivalService.getArchivableTickets(
        userId,
        userRole,
        50 // Limit suggestions to 50 tickets
      );

      const suggestions = archivableTickets
        .map((ticket) => {
          const completedAt = ticket.resolved_at || ticket.closed_at || ticket.updated_at;
          const daysSinceCompletion = Math.floor(
            (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Determine priority based on age and usage percentage
          let priority: 'high' | 'medium' | 'low' = 'low';
          if (usagePercentage >= 95 || daysSinceCompletion > 90) {
            priority = 'high';
          } else if (usagePercentage >= 85 || daysSinceCompletion > 60) {
            priority = 'medium';
          }

          return {
            ticketId: ticket.id,
            title: ticket.title,
            status: ticket.status,
            completedAt: new Date(completedAt),
            daysSinceCompletion,
            priority,
          };
        })
        .sort((a, b) => b.daysSinceCompletion - a.daysSinceCompletion); // Oldest first

      let reason = 'Usage is within normal range';
      if (usagePercentage >= 95) {
        reason = 'Critical: Very close to completed ticket limit';
      } else if (usagePercentage >= 85) {
        reason = 'Warning: Approaching completed ticket limit';
      } else if (usagePercentage >= 75) {
        reason = 'Notice: Consider archiving old completed tickets';
      }

      // Check if user has Enterprise plan for automation
      const isEnterprisePlan = true; // Mock for demo
      const automationConfig = isEnterprisePlan
        ? {
            enabled: true,
            daysAfterCompletion: 30,
            nextRunDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
          }
        : undefined;

      return {
        shouldSuggestArchival: suggestions.length > 0,
        reason,
        suggestions,
        usageInfo,
        automationAvailable: isEnterprisePlan,
        automationConfig,
      };
    } catch (error) {
      logger.error('Error getting archival suggestions for user', { userId, error });
      throw error;
    }
  }

  /**
   * Schedule automated archival (to be called by a cron job or scheduler)
   */
  static async scheduleAutomatedArchival(): Promise<void> {
    try {
      logger.info('Running scheduled automated archival');

      const result = await this.runAutomatedArchival({
        enabled: true,
        daysAfterCompletion: 30,
        maxTicketsPerRun: 50,
        onlyWhenApproachingLimits: true,
        limitThreshold: 80,
      });

      logger.info('Scheduled automated archival completed', {
        processedSubscriptions: result.processedSubscriptions,
        totalTicketsArchived: result.totalTicketsArchived,
      });

      // Log any errors
      const subscriptionsWithErrors = result.subscriptionResults.filter((s) => s.errors.length > 0);
      if (subscriptionsWithErrors.length > 0) {
        logger.warn('Some subscriptions had errors during automated archival', {
          subscriptionsWithErrors: subscriptionsWithErrors.length,
          totalErrors: subscriptionsWithErrors.reduce((sum, s) => sum + s.errors.length, 0),
        });
      }
    } catch (error) {
      logger.error('Error during scheduled automated archival', { error });
      throw error;
    }
  }

  /**
   * Configure automatic archival for Enterprise users
   */
  static async configureEnterpriseAutoArchival(
    userId: string,
    config: {
      enabled: boolean;
      daysAfterCompletion?: number;
      maxTicketsPerRun?: number;
    }
  ): Promise<{
    success: boolean;
    message: string;
    config?: AutoArchivalConfig;
  }> {
    try {
      // Verify user has Enterprise subscription
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return {
          success: false,
          message: 'No subscription found for user',
        };
      }

      // Store configuration (in a real implementation, this would be stored in database)
      const finalConfig: AutoArchivalConfig = {
        enabled: config.enabled,
        daysAfterCompletion: config.daysAfterCompletion || 30,
        maxTicketsPerRun: config.maxTicketsPerRun || 50,
        onlyWhenApproachingLimits: false, // Enterprise users get full automation
        limitThreshold: 0, // No threshold for Enterprise
      };

      logger.info('Enterprise auto-archival configured', {
        userId,
        config: finalConfig,
      });

      return {
        success: true,
        message: 'Automatic archival configuration updated successfully',
        config: finalConfig,
      };
    } catch (error) {
      logger.error('Error configuring Enterprise auto-archival', { userId, error });
      return {
        success: false,
        message: 'Failed to configure automatic archival',
      };
    }
  }

  /**
   * Get automatic archival configuration for a user
   */
  static async getAutoArchivalConfig(userId: string): Promise<{
    available: boolean;
    enabled: boolean;
    config?: AutoArchivalConfig;
    planName?: string;
  }> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return { available: false, enabled: false };
      }

      const isEnterprise = true; // Simplified for demo

      if (!isEnterprise) {
        return {
          available: false,
          enabled: false,
          planName: 'Standard',
        };
      }

      // In a real implementation, retrieve stored config from database
      const config: AutoArchivalConfig = {
        enabled: true,
        daysAfterCompletion: 30,
        maxTicketsPerRun: 50,
        onlyWhenApproachingLimits: false,
        limitThreshold: 0,
      };

      return {
        available: true,
        enabled: config.enabled,
        config,
        planName: 'Enterprise',
      };
    } catch (error) {
      logger.error('Error getting auto-archival config', { userId, error });
      return { available: false, enabled: false };
    }
  }

  /**
   * Trigger immediate archival for a specific user (Enterprise only)
   */
  static async triggerImmediateArchival(
    userId: string,
    options: {
      daysAfterCompletion?: number;
      maxTickets?: number;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    archivedCount?: number;
    errors?: string[];
  }> {
    try {
      // Verify Enterprise subscription
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return {
          success: false,
          message: 'Immediate archival is only available for Enterprise plans',
        };
      }

      const config: AutoArchivalConfig = {
        enabled: true,
        daysAfterCompletion: options.daysAfterCompletion || 30,
        maxTicketsPerRun: options.maxTickets || 100,
        onlyWhenApproachingLimits: false,
        limitThreshold: 0,
      };

      const result = await this.processSubscriptionArchival(subscription, config);

      return {
        success: true,
        message: `Archived ${result.ticketsArchived} tickets successfully`,
        archivedCount: result.ticketsArchived,
        errors: result.errors,
      };
    } catch (error) {
      logger.error('Error triggering immediate archival', { userId, error });
      return {
        success: false,
        message: 'Failed to trigger immediate archival',
      };
    }
  }

  /**
   * Get Enterprise subscriptions eligible for automated archival
   */
  private static async getEnterpriseSubscriptions(): Promise<any[]> {
    try {
      // Get all active subscriptions with Enterprise plans
      const subscriptions = await CustomerSubscription.query
        .join('subscription_plans', 'customer_subscriptions.plan_id', 'subscription_plans.id')
        .where('customer_subscriptions.status', 'active')
        .where('subscription_plans.name', 'ilike', '%enterprise%')
        .select(
          'customer_subscriptions.*',
          'subscription_plans.name as plan_name',
          'subscription_plans.completed_ticket_limit'
        );

      return subscriptions.map((sub: any) => ({
        ...sub,
        plan: {
          name: sub.plan_name,
          completed_ticket_limit: sub.completed_ticket_limit,
        },
      }));
    } catch (error) {
      logger.error('Error getting Enterprise subscriptions', { error });
      throw error;
    }
  }
}
