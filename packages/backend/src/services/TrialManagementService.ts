import { CustomerSubscription } from '@/models/CustomerSubscription';
import { SubscriptionPlan } from '@/models/SubscriptionPlan';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { CustomerSubscription as CustomerSubscriptionModel } from '@/types/models';

export interface TrialReminderConfig {
  daysBeforeExpiration: number[];
  emailTemplate: string;
  includeUpgradeLink: boolean;
}

export interface TrialConversionOptions {
  paymentMethodId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  sendWelcomeEmail?: boolean;
}

export class TrialManagementService {
  private static readonly DEFAULT_TRIAL_DAYS = 14;
  private static readonly REMINDER_DAYS = [7, 3, 1]; // Days before expiration to send reminders

  /**
   * Start a new trial subscription
   */
  static async startTrial(
    userId: string,
    planSlug: string,
    options: {
      trialDays?: number;
      sendWelcomeEmail?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<CustomerSubscriptionModel> {
    try {
      // Get plan by slug
      const plan = await SubscriptionPlan.findBySlug(planSlug);
      if (!plan || !plan.is_active) {
        throw new AppError('Invalid or inactive subscription plan', 400);
      }

      // Check if user already has an active subscription
      const existingSubscription = await CustomerSubscription.findByUserId(userId);
      if (existingSubscription) {
        throw new AppError('User already has an active subscription or trial', 400);
      }

      // Determine trial duration
      const trialDays = options.trialDays || plan.trial_days || this.DEFAULT_TRIAL_DAYS;
      if (trialDays <= 0) {
        throw new AppError('Plan does not support trials', 400);
      }

      const now = new Date();
      const trialStart = now;
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + trialDays);

      const subscriptionData = {
        userId,
        planId: plan.id,
        status: 'trial' as const,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        trialStart,
        trialEnd,
        metadata: {
          ...options.metadata,
          trialStartedAt: now.toISOString(),
          originalTrialDays: trialDays
        }
      };

      const subscription = await CustomerSubscription.createSubscription(subscriptionData);
      
      // Send welcome email if requested
      if (options.sendWelcomeEmail) {
        await this.sendTrialWelcomeEmail(userId, plan, trialEnd);
      }

      logger.info('Trial subscription started', {
        userId,
        subscriptionId: subscription.id,
        planId: plan.id,
        planSlug,
        trialDays,
        trialEnd
      });

      return CustomerSubscription.toModel(subscription);
    } catch (error) {
      logger.error('Error starting trial', { userId, planSlug, error });
      throw error;
    }
  }

  /**
   * Convert trial to paid subscription
   */
  static async convertTrialToPaid(
    subscriptionId: string,
    options: TrialConversionOptions
  ): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status !== 'trial') {
        throw new AppError('Subscription is not in trial status', 400);
      }

      // Check if trial has expired
      const now = new Date();
      if (subscription.trial_end && now > subscription.trial_end) {
        throw new AppError('Trial has already expired', 400);
      }

      // Calculate new billing period starting from now
      const currentPeriodStart = now;
      const currentPeriodEnd = new Date(now);
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      const updateData = {
        status: 'active' as const,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        payment_method_id: options.paymentMethodId,
        stripe_customer_id: options.stripeCustomerId,
        stripe_subscription_id: options.stripeSubscriptionId,
      };

      const updatedSubscription = await CustomerSubscription.update(subscriptionId, updateData);
      if (!updatedSubscription) {
        throw new AppError('Failed to convert trial to paid subscription', 500);
      }

      // Send conversion confirmation email
      if (options.sendWelcomeEmail) {
        await this.sendTrialConversionEmail(subscription.user_id, subscriptionId);
      }

      logger.info('Trial converted to paid subscription', {
        subscriptionId,
        userId: subscription.user_id,
        planId: subscription.plan_id,
        paymentMethodId: options.paymentMethodId
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error converting trial to paid', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Cancel trial without charges
   */
  static async cancelTrial(
    subscriptionId: string,
    reason?: string
  ): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status !== 'trial') {
        throw new AppError('Subscription is not in trial status', 400);
      }

      // Update subscription status to cancelled
      const updateData = {
        status: 'cancelled' as const,
        cancelled_at: new Date(),
        metadata: JSON.stringify({
          ...JSON.parse(subscription.metadata || '{}'),
          cancellationReason: reason,
          cancelledDuringTrial: true,
          cancelledAt: new Date().toISOString()
        })
      };

      const cancelledSubscription = await CustomerSubscription.update(subscriptionId, updateData);
      if (!cancelledSubscription) {
        throw new AppError('Failed to cancel trial', 500);
      }

      // Send cancellation confirmation email
      await this.sendTrialCancellationEmail(subscription.user_id, reason);

      logger.info('Trial subscription cancelled', {
        subscriptionId,
        userId: subscription.user_id,
        planId: subscription.plan_id,
        reason
      });

      return CustomerSubscription.toModel(cancelledSubscription);
    } catch (error) {
      logger.error('Error cancelling trial', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Get detailed trial status
   */
  static async getTrialStatus(subscriptionId: string): Promise<{
    isInTrial: boolean;
    trialStart?: Date;
    trialEnd?: Date;
    daysRemaining?: number;
    hoursRemaining?: number;
    hasExpired?: boolean;
    canConvert?: boolean;
    canExtend?: boolean;
  }> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status !== 'trial' || !subscription.trial_end) {
        return { 
          isInTrial: false,
          canConvert: false,
          canExtend: false
        };
      }

      const now = new Date();
      const trialEnd = new Date(subscription.trial_end);
      const hasExpired = now > trialEnd;
      
      const timeRemaining = trialEnd.getTime() - now.getTime();
      const daysRemaining = hasExpired ? 0 : Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
      const hoursRemaining = hasExpired ? 0 : Math.ceil(timeRemaining / (1000 * 60 * 60));

      return {
        isInTrial: true,
        trialStart: subscription.trial_start,
        trialEnd: subscription.trial_end,
        daysRemaining,
        hoursRemaining,
        hasExpired,
        canConvert: !hasExpired,
        canExtend: !hasExpired
      };
    } catch (error) {
      logger.error('Error getting trial status', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Extend trial period
   */
  static async extendTrial(
    subscriptionId: string,
    additionalDays: number,
    reason?: string
  ): Promise<CustomerSubscriptionModel> {
    try {
      if (additionalDays <= 0 || additionalDays > 30) {
        throw new AppError('Additional days must be between 1 and 30', 400);
      }

      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status !== 'trial') {
        throw new AppError('Subscription is not in trial status', 400);
      }

      if (!subscription.trial_end) {
        throw new AppError('Trial end date not found', 400);
      }

      // Extend trial end date
      const newTrialEnd = new Date(subscription.trial_end);
      newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays);

      // Also extend current period end to match trial end
      const updateData = {
        trial_end: newTrialEnd,
        current_period_end: newTrialEnd,
        metadata: JSON.stringify({
          ...JSON.parse(subscription.metadata || '{}'),
          trialExtensions: [
            ...(JSON.parse(subscription.metadata || '{}').trialExtensions || []),
            {
              extendedAt: new Date().toISOString(),
              additionalDays,
              reason,
              newTrialEnd: newTrialEnd.toISOString()
            }
          ]
        })
      };

      const updatedSubscription = await CustomerSubscription.update(subscriptionId, updateData);
      if (!updatedSubscription) {
        throw new AppError('Failed to extend trial', 500);
      }

      // Send extension notification email
      await this.sendTrialExtensionEmail(subscription.user_id, additionalDays, newTrialEnd);

      logger.info('Trial extended', {
        subscriptionId,
        userId: subscription.user_id,
        additionalDays,
        newTrialEnd,
        reason
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error extending trial', { subscriptionId, additionalDays, error });
      throw error;
    }
  }

  /**
   * Process expired trials
   */
  static async processExpiredTrials(): Promise<{
    processed: number;
    cancelled: number;
    convertedToFree: number;
    errors: number;
  }> {
    try {
      const expiredTrials = await CustomerSubscription.findExpiredTrials();
      let cancelled = 0;
      let convertedToFree = 0;
      let errors = 0;

      // Get free tier plan
      const freeTierPlan = await SubscriptionPlan.getFreeTier();

      for (const trial of expiredTrials) {
        try {
          if (freeTierPlan) {
            // Convert to free tier
            await CustomerSubscription.upgradeSubscription(
              trial.id,
              freeTierPlan.id,
              new Date()
            );
            await CustomerSubscription.updateSubscriptionStatus(trial.id, 'active');
            convertedToFree++;
            
            // Send downgrade notification
            await this.sendTrialExpiredEmail(trial.user_id, 'converted_to_free');
            
            logger.info('Expired trial converted to free tier', {
              subscriptionId: trial.id,
              userId: trial.user_id
            });
          } else {
            // Cancel the subscription
            await CustomerSubscription.updateSubscriptionStatus(trial.id, 'cancelled');
            cancelled++;
            
            // Send cancellation notification
            await this.sendTrialExpiredEmail(trial.user_id, 'cancelled');
            
            logger.info('Expired trial cancelled', {
              subscriptionId: trial.id,
              userId: trial.user_id
            });
          }
        } catch (error) {
          errors++;
          logger.error('Error processing expired trial', {
            subscriptionId: trial.id,
            userId: trial.user_id,
            error
          });
        }
      }

      logger.info('Processed expired trials', {
        total: expiredTrials.length,
        cancelled,
        convertedToFree,
        errors
      });

      return {
        processed: expiredTrials.length,
        cancelled,
        convertedToFree,
        errors
      };
    } catch (error) {
      logger.error('Error processing expired trials', { error });
      throw error;
    }
  }

  /**
   * Send trial reminder emails
   */
  static async sendTrialReminders(): Promise<{
    sent: number;
    errors: number;
  }> {
    try {
      let sent = 0;
      let errors = 0;

      // Process each reminder day
      for (const days of this.REMINDER_DAYS) {
        try {
          const expiringTrials = await this.getTrialsExpiringInDays(days);
          
          for (const trial of expiringTrials) {
            try {
              await this.sendTrialReminderEmail(trial.user_id, days, trial.trial_end!);
              sent++;
              
              logger.info('Trial reminder sent', {
                subscriptionId: trial.id,
                userId: trial.user_id,
                daysRemaining: days
              });
            } catch (error) {
              errors++;
              logger.error('Error sending trial reminder', {
                subscriptionId: trial.id,
                userId: trial.user_id,
                daysRemaining: days,
                error
              });
            }
          }
        } catch (error) {
          logger.error('Error processing trial reminders for day', { days, error });
        }
      }

      logger.info('Trial reminders processed', { sent, errors });
      return { sent, errors };
    } catch (error) {
      logger.error('Error sending trial reminders', { error });
      throw error;
    }
  }

  /**
   * Get trials expiring in specific number of days
   */
  private static async getTrialsExpiringInDays(days: number): Promise<any[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    
    // Get trials expiring on the target date (within 24 hours)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return CustomerSubscription.query
      .where('status', 'trial')
      .whereBetween('trial_end', [startOfDay, endOfDay]);
  }

  /**
   * Send trial welcome email
   */
  private static async sendTrialWelcomeEmail(
    userId: string,
    plan: any,
    trialEnd: Date
  ): Promise<void> {
    try {
      // TODO: Integrate with EmailService when template system is ready
      logger.info('Trial welcome email would be sent', {
        userId,
        planName: plan.name,
        trialEnd: trialEnd.toLocaleDateString(),
        daysRemaining: Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      });
    } catch (error) {
      logger.error('Error sending trial welcome email', { userId, error });
    }
  }

  /**
   * Send trial reminder email
   */
  private static async sendTrialReminderEmail(
    userId: string,
    daysRemaining: number,
    trialEnd: Date
  ): Promise<void> {
    try {
      // TODO: Integrate with EmailService when template system is ready
      logger.info('Trial reminder email would be sent', {
        userId,
        daysRemaining,
        trialEnd: trialEnd.toLocaleDateString(),
        upgradeUrl: `${process.env.FRONTEND_URL}/pricing?upgrade=true`
      });
    } catch (error) {
      logger.error('Error sending trial reminder email', { userId, daysRemaining, error });
    }
  }

  /**
   * Send trial conversion email
   */
  private static async sendTrialConversionEmail(
    userId: string,
    subscriptionId: string
  ): Promise<void> {
    try {
      // TODO: Integrate with EmailService when template system is ready
      logger.info('Trial conversion email would be sent', {
        userId,
        subscriptionId,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
      });
    } catch (error) {
      logger.error('Error sending trial conversion email', { userId, subscriptionId, error });
    }
  }

  /**
   * Send trial cancellation email
   */
  private static async sendTrialCancellationEmail(
    userId: string,
    reason?: string
  ): Promise<void> {
    try {
      // TODO: Integrate with EmailService when template system is ready
      logger.info('Trial cancellation email would be sent', {
        userId,
        reason: reason || 'No reason provided',
        pricingUrl: `${process.env.FRONTEND_URL}/pricing`
      });
    } catch (error) {
      logger.error('Error sending trial cancellation email', { userId, error });
    }
  }

  /**
   * Send trial extension email
   */
  private static async sendTrialExtensionEmail(
    userId: string,
    additionalDays: number,
    newTrialEnd: Date
  ): Promise<void> {
    try {
      // TODO: Integrate with EmailService when template system is ready
      logger.info('Trial extension email would be sent', {
        userId,
        additionalDays,
        newTrialEnd: newTrialEnd.toLocaleDateString(),
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
      });
    } catch (error) {
      logger.error('Error sending trial extension email', { userId, additionalDays, error });
    }
  }

  /**
   * Send trial expired email
   */
  private static async sendTrialExpiredEmail(
    userId: string,
    action: 'cancelled' | 'converted_to_free'
  ): Promise<void> {
    try {
      // TODO: Integrate with EmailService when template system is ready
      logger.info('Trial expired email would be sent', {
        userId,
        action,
        pricingUrl: `${process.env.FRONTEND_URL}/pricing`,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
      });
    } catch (error) {
      logger.error('Error sending trial expired email', { userId, action, error });
    }
  }
}