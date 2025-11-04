import { UsageTrackingService } from './UsageTrackingService';
import { SubscriptionService } from './SubscriptionService';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { UsageStats, SubscriptionPlan as SubscriptionPlanModel } from '@/types/models';

export interface LimitEnforcementResult {
  allowed: boolean;
  reason?: string;
  limitType?: 'active' | 'completed' | 'total';
  currentUsage?: UsageStats;
  limits?: { activeTickets: number; completedTickets: number; totalTickets: number };
  upgradeMessage?: string;
  suggestedPlans?: SubscriptionPlanModel[];
}

export class SubscriptionEnforcementService {
  /**
   * Enforce ticket creation limits
   */
  static async enforceTicketCreationLimit(userId: string): Promise<LimitEnforcementResult> {
    try {
      const canCreateResult = await UsageTrackingService.canCreateTicket(userId);

      if (canCreateResult.canCreate) {
        return { allowed: true };
      }

      // Get suggested upgrade plans
      const suggestedPlans = await this.getSuggestedUpgradePlans(userId);

      const upgradeMessage = this.generateUpgradeMessage(
        canCreateResult.limitType || 'active',
        canCreateResult.usage,
        canCreateResult.limits
      );

      return {
        allowed: false,
        reason: canCreateResult.reason,
        limitType: canCreateResult.limitType,
        currentUsage: canCreateResult.usage,
        limits: canCreateResult.limits,
        upgradeMessage,
        suggestedPlans,
      };
    } catch (error) {
      logger.error('Error enforcing ticket creation limit', { userId, error });
      // Allow creation on error to prevent blocking
      return { allowed: true };
    }
  }

  /**
   * Enforce ticket completion limits
   */
  static async enforceTicketCompletionLimit(userId: string): Promise<LimitEnforcementResult> {
    try {
      const canCompleteResult = await UsageTrackingService.canCompleteTicket(userId);

      if (canCompleteResult.canComplete) {
        return { allowed: true };
      }

      const suggestedPlans = await this.getSuggestedUpgradePlans(userId);

      const upgradeMessage = this.generateUpgradeMessage(
        'completed',
        canCompleteResult.usage,
        canCompleteResult.limits
      );

      return {
        allowed: false,
        reason: canCompleteResult.reason,
        limitType: 'completed',
        currentUsage: canCompleteResult.usage,
        limits: canCompleteResult.limits,
        upgradeMessage,
        suggestedPlans,
      };
    } catch (error) {
      logger.error('Error enforcing ticket completion limit', { userId, error });
      // Allow completion on error
      return { allowed: true };
    }
  }

  /**
   * Check and enforce limits before ticket creation
   */
  static async checkTicketCreationLimits(userId: string): Promise<void> {
    const enforcement = await this.enforceTicketCreationLimit(userId);

    if (!enforcement.allowed) {
      const error = new AppError(
        enforcement.reason || 'Ticket creation limit reached',
        429, // Too Many Requests
        'SUBSCRIPTION_LIMIT_REACHED',
        {
          limitType: enforcement.limitType,
          currentUsage: enforcement.currentUsage,
          limits: enforcement.limits,
          upgradeMessage: enforcement.upgradeMessage,
          suggestedPlans: enforcement.suggestedPlans,
        }
      );

      logger.warn('Ticket creation blocked due to subscription limits', {
        userId,
        limitType: enforcement.limitType,
        currentUsage: enforcement.currentUsage,
        limits: enforcement.limits,
      });

      throw error;
    }
  }

  /**
   * Check and enforce limits before ticket completion
   */
  static async checkTicketCompletionLimits(userId: string): Promise<void> {
    const enforcement = await this.enforceTicketCompletionLimit(userId);

    if (!enforcement.allowed) {
      const error = new AppError(
        enforcement.reason || 'Ticket completion limit reached',
        429, // Too Many Requests
        'SUBSCRIPTION_LIMIT_REACHED',
        {
          limitType: enforcement.limitType,
          currentUsage: enforcement.currentUsage,
          limits: enforcement.limits,
          upgradeMessage: enforcement.upgradeMessage,
          suggestedPlans: enforcement.suggestedPlans,
        }
      );

      logger.warn('Ticket completion blocked due to subscription limits', {
        userId,
        limitType: enforcement.limitType,
        currentUsage: enforcement.currentUsage,
        limits: enforcement.limits,
      });

      throw error;
    }
  }

  /**
   * Get usage warnings for approaching limits
   */
  static async getUsageWarnings(userId: string): Promise<{
    hasWarnings: boolean;
    warnings: Array<{
      type: 'active' | 'completed' | 'total';
      percentage: number;
      message: string;
      severity: 'info' | 'warning' | 'critical';
    }>;
    upgradeMessage?: string;
    suggestedPlans?: SubscriptionPlanModel[];
  }> {
    try {
      const limitStatus = await UsageTrackingService.checkLimitStatus(userId);
      const warnings = [];

      // Check active tickets warning
      if (limitStatus.percentageUsed.active >= 75) {
        const severity: 'info' | 'warning' | 'critical' =
          limitStatus.percentageUsed.active >= 90 ? 'critical' : 'warning';
        warnings.push({
          type: 'active' as const,
          percentage: limitStatus.percentageUsed.active,
          message: `You're using ${Math.round(limitStatus.percentageUsed.active)}% of your active ticket limit (${limitStatus.current.activeTickets}/${limitStatus.limits.activeTickets})`,
          severity,
        });
      }

      // Check completed tickets warning
      if (limitStatus.percentageUsed.completed >= 75) {
        const severity: 'info' | 'warning' | 'critical' =
          limitStatus.percentageUsed.completed >= 90 ? 'critical' : 'warning';
        warnings.push({
          type: 'completed' as const,
          percentage: limitStatus.percentageUsed.completed,
          message: `You're using ${Math.round(limitStatus.percentageUsed.completed)}% of your completed ticket limit (${limitStatus.current.completedTickets}/${limitStatus.limits.completedTickets})`,
          severity,
        });
      }

      // Check total tickets warning
      if (limitStatus.percentageUsed.total >= 75) {
        const severity: 'info' | 'warning' | 'critical' =
          limitStatus.percentageUsed.total >= 90 ? 'critical' : 'warning';
        warnings.push({
          type: 'total' as const,
          percentage: limitStatus.percentageUsed.total,
          message: `You're using ${Math.round(limitStatus.percentageUsed.total)}% of your total ticket limit (${limitStatus.current.totalTickets}/${limitStatus.limits.totalTickets})`,
          severity,
        });
      }

      let upgradeMessage;
      let suggestedPlans;

      if (warnings.length > 0) {
        suggestedPlans = await this.getSuggestedUpgradePlans(userId);
        upgradeMessage =
          'Consider upgrading your plan to get higher limits and avoid interruptions.';
      }

      return {
        hasWarnings: warnings.length > 0,
        warnings,
        upgradeMessage,
        suggestedPlans,
      };
    } catch (error) {
      logger.error('Error getting usage warnings', { userId, error });
      return { hasWarnings: false, warnings: [] };
    }
  }

  /**
   * Get suggested upgrade plans for a user
   */
  static async getSuggestedUpgradePlans(userId: string): Promise<SubscriptionPlanModel[]> {
    try {
      const userSubscription = await SubscriptionService.getUserSubscription(userId);
      if (!userSubscription) {
        // Return all plans if no subscription
        return await SubscriptionService.getAvailablePlans();
      }

      const currentPlan = userSubscription.plan;
      const allPlans = await SubscriptionService.getAvailablePlans();

      // Filter plans that are higher tier than current plan
      return allPlans
        .filter((plan) => plan.price > currentPlan.price && plan.id !== currentPlan.id)
        .sort((a, b) => a.price - b.price);
    } catch (error) {
      logger.error('Error getting suggested upgrade plans', { userId, error });
      return [];
    }
  }

  /**
   * Generate upgrade message based on limit type and usage
   */
  private static generateUpgradeMessage(
    limitType: 'active' | 'completed' | 'total',
    usage?: UsageStats,
    limits?: { activeTickets: number; completedTickets: number; totalTickets: number }
  ): string {
    if (!usage || !limits) {
      return 'Upgrade your plan to continue using all features without interruption.';
    }

    switch (limitType) {
      case 'active':
        return `You've reached your active ticket limit of ${limits.activeTickets}. Upgrade to a higher plan to create more tickets or complete some existing tickets to free up space.`;

      case 'completed':
        return `You've reached your completed ticket limit of ${limits.completedTickets}. Upgrade to a higher plan or archive some completed tickets to continue.`;

      case 'total':
        return `You've reached your total ticket limit of ${limits.totalTickets}. Upgrade to a higher plan to continue creating and managing tickets.`;

      default:
        return 'Upgrade your plan to get higher limits and continue without interruption.';
    }
  }

  /**
   * Check if user has Enterprise unlimited plan
   */
  static async hasUnlimitedPlan(userId: string): Promise<boolean> {
    try {
      const userSubscription = await SubscriptionService.getUserSubscription(userId);
      if (!userSubscription) {
        return false;
      }

      return await SubscriptionService.isPlanUnlimited(userSubscription.plan.id);
    } catch (error) {
      logger.error('Error checking if user has unlimited plan', { userId, error });
      return false;
    }
  }

  /**
   * Get enforcement status for dashboard display
   */
  static async getEnforcementStatus(userId: string): Promise<{
    canCreateTickets: boolean;
    canCompleteTickets: boolean;
    hasUnlimitedPlan: boolean;
    currentUsage: UsageStats;
    limits: { activeTickets: number; completedTickets: number; totalTickets: number };
    percentageUsed: { active: number; completed: number; total: number };
    warnings: Array<{
      type: 'active' | 'completed' | 'total';
      percentage: number;
      message: string;
      severity: 'info' | 'warning' | 'critical';
    }>;
  }> {
    try {
      const [canCreateResult, canCompleteResult, hasUnlimited, warningsResult] = await Promise.all([
        UsageTrackingService.canCreateTicket(userId),
        UsageTrackingService.canCompleteTicket(userId),
        this.hasUnlimitedPlan(userId),
        this.getUsageWarnings(userId),
      ]);

      return {
        canCreateTickets: canCreateResult.canCreate,
        canCompleteTickets: canCompleteResult.canComplete,
        hasUnlimitedPlan: hasUnlimited,
        currentUsage: canCreateResult.usage || {
          activeTickets: 0,
          completedTickets: 0,
          totalTickets: 0,
          archivedTickets: 0,
        },
        limits: canCreateResult.limits || {
          activeTickets: 0,
          completedTickets: 0,
          totalTickets: 0,
        },
        percentageUsed: {
          active: 0,
          completed: 0,
          total: 0,
        },
        warnings: warningsResult.warnings,
      };
    } catch (error) {
      logger.error('Error getting enforcement status', { userId, error });

      // Return safe defaults on error
      return {
        canCreateTickets: true,
        canCompleteTickets: true,
        hasUnlimitedPlan: false,
        currentUsage: {
          activeTickets: 0,
          completedTickets: 0,
          totalTickets: 0,
          archivedTickets: 0,
        },
        limits: {
          activeTickets: 0,
          completedTickets: 0,
          totalTickets: 0,
        },
        percentageUsed: {
          active: 0,
          completed: 0,
          total: 0,
        },
        warnings: [],
      };
    }
  }

  /**
   * Validate subscription limits before bulk operations
   */
  static async validateBulkOperation(
    userId: string,
    operationType: 'create' | 'complete',
    count: number
  ): Promise<LimitEnforcementResult> {
    try {
      const currentUsage = await UsageTrackingService.getCurrentUsage(userId);
      const userSubscription = await SubscriptionService.getUserSubscription(userId);

      if (!userSubscription) {
        return { allowed: true };
      }

      const limits = userSubscription.plan.limits;

      // Check if unlimited plan
      if (
        limits.activeTickets === -1 &&
        limits.completedTickets === -1 &&
        limits.totalTickets === -1
      ) {
        return { allowed: true };
      }

      let wouldExceedLimit = false;
      let limitType: 'active' | 'completed' | 'total' = 'active';
      let reason = '';

      if (operationType === 'create') {
        const newActiveCount = currentUsage.activeTickets + count;
        const newTotalCount = currentUsage.totalTickets + count;

        if (limits.activeTickets > 0 && newActiveCount > limits.activeTickets) {
          wouldExceedLimit = true;
          limitType = 'active';
          reason = `Bulk operation would exceed active ticket limit. Current: ${currentUsage.activeTickets}, Limit: ${limits.activeTickets}, Attempting to add: ${count}`;
        } else if (limits.totalTickets > 0 && newTotalCount > limits.totalTickets) {
          wouldExceedLimit = true;
          limitType = 'total';
          reason = `Bulk operation would exceed total ticket limit. Current: ${currentUsage.totalTickets}, Limit: ${limits.totalTickets}, Attempting to add: ${count}`;
        }
      } else if (operationType === 'complete') {
        const newCompletedCount = currentUsage.completedTickets + count;

        if (limits.completedTickets > 0 && newCompletedCount > limits.completedTickets) {
          wouldExceedLimit = true;
          limitType = 'completed';
          reason = `Bulk operation would exceed completed ticket limit. Current: ${currentUsage.completedTickets}, Limit: ${limits.completedTickets}, Attempting to complete: ${count}`;
        }
      }

      if (wouldExceedLimit) {
        const suggestedPlans = await this.getSuggestedUpgradePlans(userId);
        const upgradeMessage = this.generateUpgradeMessage(limitType, currentUsage, limits);

        return {
          allowed: false,
          reason,
          limitType,
          currentUsage,
          limits,
          upgradeMessage,
          suggestedPlans,
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error validating bulk operation', { userId, operationType, count, error });
      return { allowed: true }; // Allow on error
    }
  }
}
