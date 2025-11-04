import { UsageTrackingService } from './UsageTrackingService';
import { SubscriptionService } from './SubscriptionService';
import { EmailService } from './EmailService';
import { notificationService, RealTimeNotification } from './NotificationService';
import { User } from '@/models/User';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { SubscriptionPlan } from '@/models/SubscriptionPlan';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { UsageStats, UsageLimitStatus, SubscriptionDetails } from '@/types/models';

export interface UsageWarning {
  userId: string;
  subscriptionId: string;
  warningType: 'approaching_75' | 'approaching_90' | 'at_limit';
  limitType: 'active' | 'completed' | 'total';
  currentUsage: number;
  limit: number;
  percentage: number;
  planName: string;
  timestamp: Date;
}

export interface UsageAlertPreferences {
  emailNotifications: boolean;
  dashboardNotifications: boolean;
  warningThresholds: {
    first: number; // Default 75%
    second: number; // Default 90%
  };
}

export class UsageAlertService {
  private static readonly DEFAULT_WARNING_THRESHOLDS = {
    first: 75,
    second: 90,
  };

  /**
   * Check usage for a specific user and generate warnings if needed
   */
  static async checkUserUsage(userId: string): Promise<UsageWarning[]> {
    try {
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        return [];
      }

      const plan = await SubscriptionPlan.findById(subscription.plan_id);
      if (!plan || plan.active_ticket_limit === -1) {
        return []; // Skip unlimited plans
      }

      const usage = await UsageTrackingService.getCurrentUsage(userId);
      const warnings: UsageWarning[] = [];

      // Check active tickets
      if (plan.active_ticket_limit > 0) {
        const activePercentage = (usage.activeTickets / plan.active_ticket_limit) * 100;
        const activeWarning = this.generateWarning(
          userId,
          subscription.id,
          'active',
          usage.activeTickets,
          plan.active_ticket_limit,
          activePercentage,
          plan.name
        );
        if (activeWarning) {
          warnings.push(activeWarning);
        }
      }

      // Check completed tickets
      if (plan.completed_ticket_limit > 0) {
        const completedPercentage = (usage.completedTickets / plan.completed_ticket_limit) * 100;
        const completedWarning = this.generateWarning(
          userId,
          subscription.id,
          'completed',
          usage.completedTickets,
          plan.completed_ticket_limit,
          completedPercentage,
          plan.name
        );
        if (completedWarning) {
          warnings.push(completedWarning);
        }
      }

      // Check total tickets
      if (plan.total_ticket_limit > 0) {
        const totalPercentage = (usage.totalTickets / plan.total_ticket_limit) * 100;
        const totalWarning = this.generateWarning(
          userId,
          subscription.id,
          'total',
          usage.totalTickets,
          plan.total_ticket_limit,
          totalPercentage,
          plan.name
        );
        if (totalWarning) {
          warnings.push(totalWarning);
        }
      }

      return warnings;
    } catch (error) {
      logger.error('Error checking user usage', { userId, error });
      throw error;
    }
  }

  /**
   * Check usage for all users and send notifications
   */
  static async checkAllUsersUsage(): Promise<void> {
    try {
      logger.info('Starting usage check for all users');

      // Get users approaching limits
      const usersApproachingLimits = await UsageTrackingService.getUsersApproachingLimits(75);

      for (const userLimit of usersApproachingLimits) {
        try {
          const warnings = await this.checkUserUsage(userLimit.userId);

          if (warnings.length > 0) {
            // Send notifications for each warning
            for (const warning of warnings) {
              await this.sendUsageWarningNotification(warning);
            }
          }
        } catch (error) {
          logger.error('Error processing usage warnings for user', {
            userId: userLimit.userId,
            error,
          });
          continue;
        }
      }

      logger.info('Completed usage check for all users', {
        usersChecked: usersApproachingLimits.length,
      });
    } catch (error) {
      logger.error('Error checking usage for all users', { error });
      throw error;
    }
  }

  /**
   * Send usage warning notification to user
   */
  static async sendUsageWarningNotification(warning: UsageWarning): Promise<void> {
    try {
      const user = await User.findById(warning.userId);
      if (!user) {
        logger.warn('User not found for usage warning', { userId: warning.userId });
        return;
      }

      // Send email notification
      await this.sendUsageWarningEmail(user, warning);

      // Send real-time notification
      await this.sendUsageWarningRealTime(user, warning);

      logger.info('Usage warning notification sent', {
        userId: warning.userId,
        warningType: warning.warningType,
        limitType: warning.limitType,
        percentage: warning.percentage,
      });
    } catch (error) {
      logger.error('Error sending usage warning notification', { warning, error });
      throw error;
    }
  }

  /**
   * Send usage warning email
   */
  private static async sendUsageWarningEmail(user: any, warning: UsageWarning): Promise<void> {
    try {
      const { subject, htmlBody, textBody } = this.generateWarningEmailContent(user, warning);

      await EmailService.sendNotificationEmail([user.email], subject, htmlBody, textBody, {
        type: 'usage_warning',
        userId: warning.userId,
        warningType: warning.warningType,
        limitType: warning.limitType,
      });
    } catch (error) {
      logger.error('Error sending usage warning email', { userId: user.id, warning, error });
      throw error;
    }
  }

  /**
   * Send real-time usage warning notification
   */
  private static async sendUsageWarningRealTime(user: any, warning: UsageWarning): Promise<void> {
    try {
      const notification: RealTimeNotification = {
        type: 'user:usage_warning',
        data: {
          user,
          warning,
          message: this.generateWarningMessage(warning),
        },
        userId: user.id,
        timestamp: new Date(),
      };

      notificationService.notifyUser(user.id, notification);
    } catch (error) {
      logger.error('Error sending real-time usage warning', { userId: user.id, warning, error });
      throw error;
    }
  }

  /**
   * Get usage warnings for dashboard display
   */
  static async getUserDashboardWarnings(userId: string): Promise<{
    warnings: UsageWarning[];
    shouldShowUpgradePrompt: boolean;
    upgradeMessage?: string;
  }> {
    try {
      const warnings = await this.checkUserUsage(userId);
      const shouldShowUpgradePrompt = warnings.some((w) => w.percentage >= 90);

      let upgradeMessage: string | undefined;
      if (shouldShowUpgradePrompt) {
        const subscription = await SubscriptionService.getUserSubscription(userId);
        if (subscription) {
          upgradeMessage = this.generateUpgradeMessage(subscription.plan.name);
        }
      }

      return {
        warnings,
        shouldShowUpgradePrompt,
        upgradeMessage,
      };
    } catch (error) {
      logger.error('Error getting dashboard warnings', { userId, error });
      return {
        warnings: [],
        shouldShowUpgradePrompt: false,
      };
    }
  }

  /**
   * Get contextual warning for ticket creation
   */
  static async getTicketCreationWarning(userId: string): Promise<{
    canCreate: boolean;
    warning?: {
      message: string;
      severity: 'info' | 'warning' | 'error';
      showUpgradePrompt: boolean;
      upgradeOptions?: string[];
    };
  }> {
    try {
      const canCreateResult = await UsageTrackingService.canCreateTicket(userId);

      if (!canCreateResult.canCreate) {
        return {
          canCreate: false,
          warning: {
            message: canCreateResult.reason || 'You have reached your ticket limit',
            severity: 'error',
            showUpgradePrompt: true,
            upgradeOptions: await this.getUpgradeOptions(userId),
          },
        };
      }

      // Check if approaching limits
      const warnings = await this.checkUserUsage(userId);
      const highestWarning = warnings.reduce(
        (highest, current) => (current.percentage > (highest?.percentage || 0) ? current : highest),
        null as UsageWarning | null
      );

      if (highestWarning && highestWarning.percentage >= 75) {
        const severity = highestWarning.percentage >= 90 ? 'warning' : 'info';
        const message = this.generateTicketCreationWarningMessage(highestWarning);

        return {
          canCreate: true,
          warning: {
            message,
            severity,
            showUpgradePrompt: highestWarning.percentage >= 90,
            upgradeOptions:
              highestWarning.percentage >= 90 ? await this.getUpgradeOptions(userId) : undefined,
          },
        };
      }

      return { canCreate: true };
    } catch (error) {
      logger.error('Error getting ticket creation warning', { userId, error });
      return { canCreate: true };
    }
  }

  /**
   * Generate warning based on usage percentage
   */
  private static generateWarning(
    userId: string,
    subscriptionId: string,
    limitType: 'active' | 'completed' | 'total',
    currentUsage: number,
    limit: number,
    percentage: number,
    planName: string
  ): UsageWarning | null {
    let warningType: 'approaching_75' | 'approaching_90' | 'at_limit' | null = null;

    if (percentage >= 100) {
      warningType = 'at_limit';
    } else if (percentage >= 90) {
      warningType = 'approaching_90';
    } else if (percentage >= 75) {
      warningType = 'approaching_75';
    }

    if (!warningType) {
      return null;
    }

    return {
      userId,
      subscriptionId,
      warningType,
      limitType,
      currentUsage,
      limit,
      percentage: Math.round(percentage),
      planName,
      timestamp: new Date(),
    };
  }

  /**
   * Generate warning email content
   */
  private static generateWarningEmailContent(
    user: any,
    warning: UsageWarning
  ): {
    subject: string;
    htmlBody: string;
    textBody: string;
  } {
    const limitTypeLabel = this.getLimitTypeLabel(warning.limitType);
    const urgencyLevel =
      warning.warningType === 'at_limit'
        ? 'URGENT'
        : warning.warningType === 'approaching_90'
          ? 'Important'
          : 'Notice';

    const subject = `${urgencyLevel}: ${limitTypeLabel} Usage at ${warning.percentage}% - ${warning.planName} Plan`;

    const textBody = `
Hello ${user.firstName},

${this.generateWarningMessage(warning)}

Current Usage: ${warning.currentUsage} of ${warning.limit} ${limitTypeLabel.toLowerCase()}
Plan: ${warning.planName}

${
  warning.warningType === 'at_limit'
    ? 'You have reached your limit and cannot create new tickets until you upgrade your plan or archive completed tickets.'
    : 'Consider upgrading your plan to avoid hitting your limits.'
}

To upgrade your plan or manage your subscription, please visit your account dashboard.

Best regards,
The Bomizzel Team
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${this.getWarningColor(warning.warningType)}; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .usage-info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .progress-bar { background-color: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { background-color: ${this.getProgressColor(warning.percentage)}; height: 100%; width: ${warning.percentage}%; }
        .cta-button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>${urgencyLevel}: Usage Warning</h2>
        </div>
        
        <div class="content">
            <p>Hello ${user.firstName},</p>
            
            <p>${this.generateWarningMessage(warning)}</p>
            
            <div class="usage-info">
                <strong>Current Usage:</strong> ${warning.currentUsage} of ${warning.limit} ${limitTypeLabel.toLowerCase()}<br>
                <strong>Plan:</strong> ${warning.planName}<br>
                <strong>Usage:</strong> ${warning.percentage}%
                
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
            
            ${
              warning.warningType === 'at_limit'
                ? '<p><strong>You have reached your limit and cannot create new tickets until you upgrade your plan or archive completed tickets.</strong></p>'
                : '<p>Consider upgrading your plan to avoid hitting your limits.</p>'
            }
            
            <a href="#" class="cta-button">Upgrade Your Plan</a>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from the Bomizzel Ticketing System.</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return { subject, htmlBody, textBody };
  }

  /**
   * Generate warning message text
   */
  private static generateWarningMessage(warning: UsageWarning): string {
    const limitTypeLabel = this.getLimitTypeLabel(warning.limitType);

    switch (warning.warningType) {
      case 'at_limit':
        return `You have reached your ${limitTypeLabel.toLowerCase()} limit of ${warning.limit} tickets on your ${warning.planName} plan.`;
      case 'approaching_90':
        return `You are approaching your ${limitTypeLabel.toLowerCase()} limit (${warning.percentage}% used) on your ${warning.planName} plan.`;
      case 'approaching_75':
        return `You have used ${warning.percentage}% of your ${limitTypeLabel.toLowerCase()} limit on your ${warning.planName} plan.`;
      default:
        return `Your ${limitTypeLabel.toLowerCase()} usage is at ${warning.percentage}% on your ${warning.planName} plan.`;
    }
  }

  /**
   * Generate ticket creation warning message
   */
  private static generateTicketCreationWarningMessage(warning: UsageWarning): string {
    const limitTypeLabel = this.getLimitTypeLabel(warning.limitType);

    if (warning.percentage >= 90) {
      return `You're approaching your ${limitTypeLabel.toLowerCase()} limit (${warning.percentage}% used). Consider upgrading to avoid interruptions.`;
    } else {
      return `You've used ${warning.percentage}% of your ${limitTypeLabel.toLowerCase()} limit. You may want to consider upgrading soon.`;
    }
  }

  /**
   * Generate upgrade message
   */
  private static generateUpgradeMessage(currentPlanName: string): string {
    return `Upgrade from your ${currentPlanName} plan to get higher limits and avoid interruptions to your workflow.`;
  }

  /**
   * Get available upgrade options for a user
   */
  private static async getUpgradeOptions(userId: string): Promise<string[]> {
    try {
      const subscription = await SubscriptionService.getUserSubscription(userId);
      if (!subscription) {
        return [];
      }

      const allPlans = await SubscriptionService.getAvailablePlans();
      const currentPlanPrice = subscription.plan.price;

      return allPlans
        .filter((plan) => plan.price > currentPlanPrice)
        .sort((a, b) => a.price - b.price)
        .map((plan) => plan.name);
    } catch (error) {
      logger.error('Error getting upgrade options', { userId, error });
      return [];
    }
  }

  /**
   * Get limit type label for display
   */
  private static getLimitTypeLabel(limitType: 'active' | 'completed' | 'total'): string {
    switch (limitType) {
      case 'active':
        return 'Active Tickets';
      case 'completed':
        return 'Completed Tickets';
      case 'total':
        return 'Total Tickets';
      default:
        return 'Tickets';
    }
  }

  /**
   * Get warning color based on warning type
   */
  private static getWarningColor(
    warningType: 'approaching_75' | 'approaching_90' | 'at_limit'
  ): string {
    switch (warningType) {
      case 'at_limit':
        return '#dc3545'; // Red
      case 'approaching_90':
        return '#fd7e14'; // Orange
      case 'approaching_75':
        return '#ffc107'; // Yellow
      default:
        return '#6c757d'; // Gray
    }
  }

  /**
   * Get progress bar color based on percentage
   */
  private static getProgressColor(percentage: number): string {
    if (percentage >= 100) return '#dc3545'; // Red
    if (percentage >= 90) return '#fd7e14'; // Orange
    if (percentage >= 75) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  }
}
