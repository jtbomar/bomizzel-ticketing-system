import { SubscriptionPlan } from '@/models/SubscriptionPlan';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { User } from '@/models/User';
import { StripeService } from './StripeService';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import {
  SubscriptionPlan as SubscriptionPlanModel,
  CustomerSubscription as CustomerSubscriptionModel,
  SubscriptionDetails,
  UsageLimitStatus,
  UsageStats,
} from '@/types/models';

export class SubscriptionService {
  /**
   * Create a new subscription for a user with Stripe integration
   */
  static async createSubscriptionWithStripe(
    userId: string,
    planId: string,
    options: {
      paymentMethodId?: string;
      startTrial?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{
    subscription: CustomerSubscriptionModel;
    stripeSubscription?: any;
    requiresPaymentConfirmation?: boolean;
    clientSecret?: string;
  }> {
    try {
      // Verify the plan exists and is active
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan || !plan.is_active) {
        throw new AppError('Invalid or inactive subscription plan', 400);
      }

      // Check if user already has an active subscription
      const existingSubscription = await CustomerSubscription.findByUserId(userId);
      if (existingSubscription) {
        throw new AppError('User already has an active subscription', 400);
      }

      // Get user details for Stripe customer creation
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Create or get Stripe customer
      const stripeCustomer = await StripeService.createOrGetCustomer(userId, user.email, {
        name: `${user.first_name} ${user.last_name}`.trim(),
        metadata: { userId, ...options.metadata },
      });

      let stripeSubscription: any = null;
      let requiresPaymentConfirmation = false;
      let clientSecret: string | undefined;

      // Only create Stripe subscription for paid plans
      if (plan.price > 0) {
        // For paid plans, we need a Stripe price ID
        if (!plan.stripe_price_id) {
          throw new AppError('Plan does not have Stripe price configured', 400);
        }

        const createOptions: any = {
          customerId: stripeCustomer.id,
          priceId: plan.stripe_price_id,
          metadata: { userId, planId, ...options.metadata },
        };

        if (options.paymentMethodId) {
          createOptions.paymentMethodId = options.paymentMethodId;
        }

        if (options.startTrial && plan.trial_days > 0) {
          createOptions.trialPeriodDays = plan.trial_days;
        }

        stripeSubscription = await StripeService.createSubscription(createOptions);

        // Check if payment confirmation is required
        if (stripeSubscription.status === 'incomplete') {
          requiresPaymentConfirmation = true;
          // Get client secret from the payment intent
          const upcomingInvoice = await StripeService.getUpcomingInvoice(stripeSubscription.id);
          // Note: In a real implementation, you'd extract the client secret from the payment intent
        }
      }

      // Create local subscription record
      const now = new Date();
      const currentPeriodStart = now;
      const currentPeriodEnd = new Date(now);
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      let subscriptionData: any = {
        userId,
        planId,
        status: stripeSubscription
          ? stripeSubscription.status === 'trialing'
            ? 'trial'
            : 'active'
          : 'active',
        currentPeriodStart: stripeSubscription
          ? stripeSubscription.currentPeriodStart
          : currentPeriodStart,
        currentPeriodEnd: stripeSubscription
          ? stripeSubscription.currentPeriodEnd
          : currentPeriodEnd,
        stripeCustomerId: stripeCustomer.id,
        stripeSubscriptionId: stripeSubscription?.id,
        paymentMethodId: options.paymentMethodId,
        metadata: options.metadata || {},
      };

      // Handle trial period
      if (stripeSubscription?.trialStart && stripeSubscription?.trialEnd) {
        subscriptionData.trialStart = stripeSubscription.trialStart;
        subscriptionData.trialEnd = stripeSubscription.trialEnd;
      } else if (options.startTrial && plan.trial_days > 0 && plan.price === 0) {
        // Handle trial for free plans
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + plan.trial_days);
        subscriptionData.status = 'trial';
        subscriptionData.trialStart = now;
        subscriptionData.trialEnd = trialEnd;
        subscriptionData.currentPeriodEnd = trialEnd;
      }

      const subscription = await CustomerSubscription.createSubscription(subscriptionData);

      logger.info('Subscription created with Stripe integration', {
        userId,
        subscriptionId: subscription.id,
        planId,
        stripeCustomerId: stripeCustomer.id,
        stripeSubscriptionId: stripeSubscription?.id,
        status: subscription.status,
      });

      return {
        subscription: CustomerSubscription.toModel(subscription),
        stripeSubscription,
        requiresPaymentConfirmation,
        clientSecret,
      };
    } catch (error) {
      logger.error('Error creating subscription with Stripe', { userId, planId, error });
      throw error;
    }
  }

  /**
   * Create a new subscription for a user (legacy method)
   */
  static async createSubscription(
    userId: string,
    planId: string,
    options: {
      startTrial?: boolean;
      paymentMethodId?: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<CustomerSubscriptionModel> {
    try {
      // Verify the plan exists and is active
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan || !plan.is_active) {
        throw new AppError('Invalid or inactive subscription plan', 400);
      }

      // Check if user already has an active subscription
      const existingSubscription = await CustomerSubscription.findByUserId(userId);
      if (existingSubscription) {
        throw new AppError('User already has an active subscription', 400);
      }

      const now = new Date();
      const currentPeriodStart = now;
      const currentPeriodEnd = new Date(now);
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      let subscriptionData: any = {
        userId,
        planId,
        status: 'active',
        currentPeriodStart,
        currentPeriodEnd,
        paymentMethodId: options.paymentMethodId,
        stripeCustomerId: options.stripeCustomerId,
        stripeSubscriptionId: options.stripeSubscriptionId,
        metadata: options.metadata || {},
      };

      // Handle trial period
      if (options.startTrial && plan.trial_days > 0) {
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + plan.trial_days);

        subscriptionData.status = 'trial';
        subscriptionData.trialStart = now;
        subscriptionData.trialEnd = trialEnd;
        subscriptionData.currentPeriodEnd = trialEnd;
      }

      const subscription = await CustomerSubscription.createSubscription(subscriptionData);

      logger.info('Subscription created', {
        userId,
        subscriptionId: subscription.id,
        planId,
        status: subscription.status,
      });

      return CustomerSubscription.toModel(subscription);
    } catch (error) {
      logger.error('Error creating subscription', { userId, planId, error });
      throw error;
    }
  }

  /**
   * Upgrade a subscription to a new plan with Stripe integration
   */
  static async upgradeSubscriptionWithStripe(
    subscriptionId: string,
    newPlanId: string,
    options: {
      effectiveDate?: Date;
      prorate?: boolean;
    } = {}
  ): Promise<CustomerSubscriptionModel> {
    try {
      // Get current subscription
      const currentSubscription = await CustomerSubscription.findById(subscriptionId);
      if (!currentSubscription) {
        throw new AppError('Subscription not found', 404);
      }

      // Verify new plan exists and is active
      const newPlan = await SubscriptionPlan.findById(newPlanId);
      if (!newPlan || !newPlan.is_active) {
        throw new AppError('Invalid or inactive subscription plan', 400);
      }

      // Get current plan for comparison
      const currentPlan = await SubscriptionPlan.findById(currentSubscription.plan_id);
      if (!currentPlan) {
        throw new AppError('Current subscription plan not found', 404);
      }

      // Update Stripe subscription if it exists
      if (currentSubscription.stripe_subscription_id && newPlan.stripe_price_id) {
        await StripeService.updateSubscription(currentSubscription.stripe_subscription_id, {
          priceId: newPlan.stripe_price_id,
          prorate: options.prorate !== false, // Default to true
          metadata: { planId: newPlanId },
        });

        // Sync the subscription from Stripe to get updated billing periods
        await StripeService.syncSubscriptionFromStripe(currentSubscription.stripe_subscription_id);
      }

      const effectiveDate = options.effectiveDate || new Date();
      const updatedSubscription = await CustomerSubscription.upgradeSubscription(
        subscriptionId,
        newPlanId,
        effectiveDate
      );

      if (!updatedSubscription) {
        throw new AppError('Failed to upgrade subscription', 500);
      }

      logger.info('Subscription upgraded with Stripe integration', {
        subscriptionId,
        oldPlanId: currentSubscription.plan_id,
        newPlanId,
        stripeSubscriptionId: currentSubscription.stripe_subscription_id,
        effectiveDate,
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error upgrading subscription with Stripe', {
        subscriptionId,
        newPlanId,
        error,
      });
      throw error;
    }
  }

  /**
   * Upgrade a subscription to a new plan (legacy method)
   */
  static async upgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
    options: {
      effectiveDate?: Date;
      prorate?: boolean;
    } = {}
  ): Promise<CustomerSubscriptionModel> {
    try {
      // Get current subscription
      const currentSubscription = await CustomerSubscription.findById(subscriptionId);
      if (!currentSubscription) {
        throw new AppError('Subscription not found', 404);
      }

      // Verify new plan exists and is active
      const newPlan = await SubscriptionPlan.findById(newPlanId);
      if (!newPlan || !newPlan.is_active) {
        throw new AppError('Invalid or inactive subscription plan', 400);
      }

      // Get current plan for comparison
      const currentPlan = await SubscriptionPlan.findById(currentSubscription.plan_id);
      if (!currentPlan) {
        throw new AppError('Current subscription plan not found', 404);
      }

      // Prevent downgrade to same or lower tier (for now)
      if (newPlan.price <= currentPlan.price) {
        throw new AppError('Cannot downgrade to a lower or same tier plan', 400);
      }

      const effectiveDate = options.effectiveDate || new Date();
      const updatedSubscription = await CustomerSubscription.upgradeSubscription(
        subscriptionId,
        newPlanId,
        effectiveDate
      );

      if (!updatedSubscription) {
        throw new AppError('Failed to upgrade subscription', 500);
      }

      logger.info('Subscription upgraded', {
        subscriptionId,
        oldPlanId: currentSubscription.plan_id,
        newPlanId,
        effectiveDate,
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error upgrading subscription', { subscriptionId, newPlanId, error });
      throw error;
    }
  }

  /**
   * Cancel a subscription with Stripe integration
   */
  static async cancelSubscriptionWithStripe(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status === 'cancelled') {
        throw new AppError('Subscription is already cancelled', 400);
      }

      // Cancel Stripe subscription if it exists
      if (subscription.stripe_subscription_id) {
        await StripeService.cancelSubscription(
          subscription.stripe_subscription_id,
          cancelAtPeriodEnd
        );
      }

      const cancelledSubscription = await CustomerSubscription.cancelSubscription(
        subscriptionId,
        cancelAtPeriodEnd
      );

      if (!cancelledSubscription) {
        throw new AppError('Failed to cancel subscription', 500);
      }

      logger.info('Subscription cancelled with Stripe integration', {
        subscriptionId,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        cancelAtPeriodEnd,
        userId: subscription.user_id,
      });

      return CustomerSubscription.toModel(cancelledSubscription);
    } catch (error) {
      logger.error('Error cancelling subscription with Stripe', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Cancel a subscription (legacy method)
   */
  static async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status === 'cancelled') {
        throw new AppError('Subscription is already cancelled', 400);
      }

      const cancelledSubscription = await CustomerSubscription.cancelSubscription(
        subscriptionId,
        cancelAtPeriodEnd
      );

      if (!cancelledSubscription) {
        throw new AppError('Failed to cancel subscription', 500);
      }

      logger.info('Subscription cancelled', {
        subscriptionId,
        cancelAtPeriodEnd,
        userId: subscription.user_id,
      });

      return CustomerSubscription.toModel(cancelledSubscription);
    } catch (error) {
      logger.error('Error cancelling subscription', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Update subscription status
   */
  static async updateSubscriptionStatus(
    subscriptionId: string,
    status: 'active' | 'trial' | 'cancelled' | 'past_due' | 'suspended'
  ): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      const updatedSubscription = await CustomerSubscription.updateSubscriptionStatus(
        subscriptionId,
        status
      );

      if (!updatedSubscription) {
        throw new AppError('Failed to update subscription status', 500);
      }

      logger.info('Subscription status updated', {
        subscriptionId,
        oldStatus: subscription.status,
        newStatus: status,
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error updating subscription status', { subscriptionId, status, error });
      throw error;
    }
  }

  /**
   * Get subscription details for a user
   */
  static async getUserSubscription(userId: string): Promise<SubscriptionDetails | null> {
    try {
      const subscriptionWithPlan = await CustomerSubscription.getUserSubscriptionWithPlan(userId);
      if (!subscriptionWithPlan) {
        return null;
      }

      // Convert to models
      const subscription = CustomerSubscription.toModel(subscriptionWithPlan);
      const plan: SubscriptionPlanModel = {
        id: subscriptionWithPlan.plan_id,
        name: subscriptionWithPlan.plan_name,
        slug: subscriptionWithPlan.plan_slug,
        price: parseFloat(subscriptionWithPlan.plan_price.toString()),
        currency: subscriptionWithPlan.plan_currency,
        billingInterval: subscriptionWithPlan.plan_billing_interval,
        limits: {
          activeTickets: subscriptionWithPlan.active_ticket_limit,
          completedTickets: subscriptionWithPlan.completed_ticket_limit,
          totalTickets: subscriptionWithPlan.total_ticket_limit,
        },
        features:
          typeof subscriptionWithPlan.plan_features === 'string'
            ? JSON.parse(subscriptionWithPlan.plan_features)
            : subscriptionWithPlan.plan_features,
        trialDays: subscriptionWithPlan.plan_trial_days,
        isActive: true,
        sortOrder: 0,
        createdAt: subscriptionWithPlan.created_at,
        updatedAt: subscriptionWithPlan.updated_at,
      };

      // Get usage stats (will be implemented in UsageTrackingService)
      const usage: UsageStats = {
        activeTickets: 0,
        completedTickets: 0,
        totalTickets: 0,
        archivedTickets: 0,
      };

      // Calculate limit status
      const limitStatus = this.calculateLimitStatus(usage, plan.limits);

      return {
        subscription,
        plan,
        usage,
        limitStatus,
      };
    } catch (error) {
      logger.error('Error getting user subscription', { userId, error });
      throw error;
    }
  }

  /**
   * Get all available subscription plans
   */
  static async getAvailablePlans(): Promise<SubscriptionPlanModel[]> {
    try {
      const plans = await SubscriptionPlan.findActivePlans();
      return plans.map((plan) => SubscriptionPlan.toModel(plan));
    } catch (error) {
      logger.error('Error getting available plans', { error });
      throw error;
    }
  }

  /**
   * Get subscription plan by ID
   */
  static async getPlanById(planId: string): Promise<SubscriptionPlanModel | null> {
    try {
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan) {
        return null;
      }
      return SubscriptionPlan.toModel(plan);
    } catch (error) {
      logger.error('Error getting plan by ID', { planId, error });
      throw error;
    }
  }

  /**
   * Get subscription plan by slug
   */
  static async getPlanBySlug(slug: string): Promise<SubscriptionPlanModel | null> {
    try {
      const plan = await SubscriptionPlan.findBySlug(slug);
      if (!plan) {
        return null;
      }
      return SubscriptionPlan.toModel(plan);
    } catch (error) {
      logger.error('Error getting plan by slug', { slug, error });
      throw error;
    }
  }

  /**
   * Check if a plan is unlimited
   */
  static async isPlanUnlimited(planId: string): Promise<boolean> {
    try {
      return await SubscriptionPlan.isUnlimitedPlan(planId);
    } catch (error) {
      logger.error('Error checking if plan is unlimited', { planId, error });
      throw error;
    }
  }

  /**
   * Get expired trials
   */
  static async getExpiredTrials(): Promise<CustomerSubscriptionModel[]> {
    try {
      const expiredTrials = await CustomerSubscription.findExpiredTrials();
      return expiredTrials.map((subscription) => CustomerSubscription.toModel(subscription));
    } catch (error) {
      logger.error('Error getting expired trials', { error });
      throw error;
    }
  }

  /**
   * Get expiring subscriptions
   */
  static async getExpiringSubscriptions(
    daysAhead: number = 7
  ): Promise<CustomerSubscriptionModel[]> {
    try {
      const expiringSubscriptions = await CustomerSubscription.findExpiringSubscriptions(daysAhead);
      return expiringSubscriptions.map((subscription) =>
        CustomerSubscription.toModel(subscription)
      );
    } catch (error) {
      logger.error('Error getting expiring subscriptions', { daysAhead, error });
      throw error;
    }
  }

  /**
   * Update payment method for a subscription
   */
  static async updatePaymentMethod(
    subscriptionId: string,
    paymentMethodId: string
  ): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      const updatedSubscription = await CustomerSubscription.updatePaymentMethod(
        subscriptionId,
        paymentMethodId
      );

      if (!updatedSubscription) {
        throw new AppError('Failed to update payment method', 500);
      }

      logger.info('Payment method updated', {
        subscriptionId,
        paymentMethodId,
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error updating payment method', { subscriptionId, paymentMethodId, error });
      throw error;
    }
  }

  /**
   * Start a trial subscription for a user
   */
  static async startTrial(
    userId: string,
    planId: string,
    options: {
      trialDays?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<CustomerSubscriptionModel> {
    try {
      // Verify the plan exists and is active
      const plan = await SubscriptionPlan.findById(planId);
      if (!plan || !plan.is_active) {
        throw new AppError('Invalid or inactive subscription plan', 400);
      }

      // Check if user already has an active subscription or trial
      const existingSubscription = await CustomerSubscription.findByUserId(userId);
      if (existingSubscription) {
        throw new AppError('User already has an active subscription or trial', 400);
      }

      // Determine trial duration
      const trialDays = options.trialDays || plan.trial_days || 14;
      if (trialDays <= 0) {
        throw new AppError('Plan does not support trials', 400);
      }

      const now = new Date();
      const trialStart = now;
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + trialDays);

      const subscriptionData = {
        userId,
        planId,
        status: 'trial' as const,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        trialStart,
        trialEnd,
        metadata: options.metadata || {},
      };

      const subscription = await CustomerSubscription.createSubscription(subscriptionData);

      logger.info('Trial subscription started', {
        userId,
        subscriptionId: subscription.id,
        planId,
        trialDays,
        trialEnd,
      });

      return CustomerSubscription.toModel(subscription);
    } catch (error) {
      logger.error('Error starting trial', { userId, planId, error });
      throw error;
    }
  }

  /**
   * Convert trial to paid subscription
   */
  static async convertTrialToPaid(
    subscriptionId: string,
    options: {
      paymentMethodId: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    }
  ): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status !== 'trial') {
        throw new AppError('Subscription is not in trial status', 400);
      }

      // Calculate new billing period starting from now
      const now = new Date();
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

      logger.info('Trial converted to paid subscription', {
        subscriptionId,
        userId: subscription.user_id,
        planId: subscription.plan_id,
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error converting trial to paid', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Cancel trial subscription
   */
  static async cancelTrial(subscriptionId: string): Promise<CustomerSubscriptionModel> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status !== 'trial') {
        throw new AppError('Subscription is not in trial status', 400);
      }

      const cancelledSubscription = await CustomerSubscription.updateSubscriptionStatus(
        subscriptionId,
        'cancelled'
      );

      if (!cancelledSubscription) {
        throw new AppError('Failed to cancel trial', 500);
      }

      logger.info('Trial subscription cancelled', {
        subscriptionId,
        userId: subscription.user_id,
        planId: subscription.plan_id,
      });

      return CustomerSubscription.toModel(cancelledSubscription);
    } catch (error) {
      logger.error('Error cancelling trial', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Get trial status for a subscription
   */
  static async getTrialStatus(subscriptionId: string): Promise<{
    isInTrial: boolean;
    trialStart?: Date;
    trialEnd?: Date;
    daysRemaining?: number;
    hasExpired?: boolean;
  }> {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status !== 'trial' || !subscription.trial_end) {
        return { isInTrial: false };
      }

      const now = new Date();
      const trialEnd = new Date(subscription.trial_end);
      const hasExpired = now > trialEnd;
      const daysRemaining = hasExpired
        ? 0
        : Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        isInTrial: true,
        trialStart: subscription.trial_start,
        trialEnd: subscription.trial_end,
        daysRemaining,
        hasExpired,
      };
    } catch (error) {
      logger.error('Error getting trial status', { subscriptionId, error });
      throw error;
    }
  }

  /**
   * Process expired trials (convert to cancelled or free tier)
   */
  static async processExpiredTrials(): Promise<{
    processed: number;
    cancelled: number;
    convertedToFree: number;
  }> {
    try {
      const expiredTrials = await CustomerSubscription.findExpiredTrials();
      let cancelled = 0;
      let convertedToFree = 0;

      // Get free tier plan
      const freeTierPlan = await SubscriptionPlan.getFreeTier();

      for (const trial of expiredTrials) {
        try {
          if (freeTierPlan) {
            // Convert to free tier
            await CustomerSubscription.upgradeSubscription(trial.id, freeTierPlan.id, new Date());
            await CustomerSubscription.updateSubscriptionStatus(trial.id, 'active');
            convertedToFree++;

            logger.info('Expired trial converted to free tier', {
              subscriptionId: trial.id,
              userId: trial.user_id,
            });
          } else {
            // Cancel the subscription
            await CustomerSubscription.updateSubscriptionStatus(trial.id, 'cancelled');
            cancelled++;

            logger.info('Expired trial cancelled', {
              subscriptionId: trial.id,
              userId: trial.user_id,
            });
          }
        } catch (error) {
          logger.error('Error processing expired trial', {
            subscriptionId: trial.id,
            userId: trial.user_id,
            error,
          });
        }
      }

      logger.info('Processed expired trials', {
        total: expiredTrials.length,
        cancelled,
        convertedToFree,
      });

      return {
        processed: expiredTrials.length,
        cancelled,
        convertedToFree,
      };
    } catch (error) {
      logger.error('Error processing expired trials', { error });
      throw error;
    }
  }

  /**
   * Extend trial period
   */
  static async extendTrial(
    subscriptionId: string,
    additionalDays: number
  ): Promise<CustomerSubscriptionModel> {
    try {
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
      };

      const updatedSubscription = await CustomerSubscription.update(subscriptionId, updateData);
      if (!updatedSubscription) {
        throw new AppError('Failed to extend trial', 500);
      }

      logger.info('Trial extended', {
        subscriptionId,
        userId: subscription.user_id,
        additionalDays,
        newTrialEnd,
      });

      return CustomerSubscription.toModel(updatedSubscription);
    } catch (error) {
      logger.error('Error extending trial', { subscriptionId, additionalDays, error });
      throw error;
    }
  }

  /**
   * Calculate usage limit status
   */
  private static calculateLimitStatus(
    usage: UsageStats,
    limits: { activeTickets: number; completedTickets: number; totalTickets: number }
  ): UsageLimitStatus {
    // Handle unlimited plans
    const isUnlimited =
      limits.activeTickets === -1 && limits.completedTickets === -1 && limits.totalTickets === -1;

    if (isUnlimited) {
      return {
        isAtLimit: false,
        isNearLimit: false,
        percentageUsed: {
          active: 0,
          completed: 0,
          total: 0,
        },
        limits,
        current: usage,
      };
    }

    // Calculate percentages
    const activePercentage =
      limits.activeTickets > 0 ? (usage.activeTickets / limits.activeTickets) * 100 : 0;
    const completedPercentage =
      limits.completedTickets > 0 ? (usage.completedTickets / limits.completedTickets) * 100 : 0;
    const totalPercentage =
      limits.totalTickets > 0 ? (usage.totalTickets / limits.totalTickets) * 100 : 0;

    // Check if at or near limits
    const isAtLimit =
      usage.activeTickets >= limits.activeTickets ||
      usage.completedTickets >= limits.completedTickets ||
      usage.totalTickets >= limits.totalTickets;

    const isNearLimit =
      activePercentage >= 75 || completedPercentage >= 75 || totalPercentage >= 75;

    return {
      isAtLimit,
      isNearLimit,
      percentageUsed: {
        active: Math.min(activePercentage, 100),
        completed: Math.min(completedPercentage, 100),
        total: Math.min(totalPercentage, 100),
      },
      limits,
      current: usage,
    };
  }
}
