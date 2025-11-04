import { BaseModel } from './BaseModel';
import { CustomerSubscriptionTable } from '@/types/database';
import { CustomerSubscription as CustomerSubscriptionModel } from '@/types/models';
import { SubscriptionPlan } from './SubscriptionPlan';

export class CustomerSubscription extends BaseModel {
  protected static tableName = 'customer_subscriptions';

  static async findByUserId(userId: string): Promise<CustomerSubscriptionTable | null> {
    const result = await this.query
      .where('user_id', userId)
      .whereIn('status', ['active', 'trial'])
      .first();
    return result || null;
  }

  static async findActiveSubscription(userId: string): Promise<CustomerSubscriptionTable | null> {
    const result = await this.query.where('user_id', userId).where('status', 'active').first();
    return result || null;
  }

  static async findTrialSubscription(userId: string): Promise<CustomerSubscriptionTable | null> {
    const result = await this.query
      .where('user_id', userId)
      .where('status', 'trial')
      .where('trial_end', '>', new Date())
      .first();
    return result || null;
  }

  static async createSubscription(subscriptionData: {
    userId: string;
    planId: string;
    status?: 'active' | 'trial';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart?: Date;
    trialEnd?: Date;
    paymentMethodId?: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    metadata?: Record<string, any>;
  }): Promise<CustomerSubscriptionTable> {
    return this.create({
      user_id: subscriptionData.userId,
      plan_id: subscriptionData.planId,
      status: subscriptionData.status || 'active',
      current_period_start: subscriptionData.currentPeriodStart,
      current_period_end: subscriptionData.currentPeriodEnd,
      trial_start: subscriptionData.trialStart,
      trial_end: subscriptionData.trialEnd,
      payment_method_id: subscriptionData.paymentMethodId,
      stripe_subscription_id: subscriptionData.stripeSubscriptionId,
      stripe_customer_id: subscriptionData.stripeCustomerId,
      metadata: JSON.stringify(subscriptionData.metadata || {}),
    });
  }

  static async upgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
    effectiveDate?: Date
  ): Promise<CustomerSubscriptionTable | null> {
    const updateData: any = {
      plan_id: newPlanId,
    };

    if (effectiveDate) {
      updateData.current_period_start = effectiveDate;
      // Calculate new period end (assuming monthly billing)
      const periodEnd = new Date(effectiveDate);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      updateData.current_period_end = periodEnd;
    }

    return this.update(subscriptionId, updateData);
  }

  static async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<CustomerSubscriptionTable | null> {
    const updateData: any = {
      cancel_at_period_end: cancelAtPeriodEnd,
    };

    if (!cancelAtPeriodEnd) {
      updateData.status = 'cancelled';
      updateData.cancelled_at = new Date();
    }

    return this.update(subscriptionId, updateData);
  }

  static async updateSubscriptionStatus(
    subscriptionId: string,
    status: 'active' | 'trial' | 'cancelled' | 'past_due' | 'suspended'
  ): Promise<CustomerSubscriptionTable | null> {
    const updateData: any = { status };

    if (status === 'cancelled') {
      updateData.cancelled_at = new Date();
    }

    return this.update(subscriptionId, updateData);
  }

  static async findExpiredTrials(): Promise<CustomerSubscriptionTable[]> {
    return this.query.where('status', 'trial').where('trial_end', '<', new Date());
  }

  static async findExpiringSubscriptions(
    daysAhead: number = 7
  ): Promise<CustomerSubscriptionTable[]> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysAhead);

    return this.query
      .whereIn('status', ['active', 'trial'])
      .where('current_period_end', '<=', expirationDate)
      .where('current_period_end', '>', new Date());
  }

  static async getSubscriptionWithPlan(subscriptionId: string): Promise<any | null> {
    const result = await this.db('customer_subscriptions as cs')
      .join('subscription_plans as sp', 'cs.plan_id', 'sp.id')
      .where('cs.id', subscriptionId)
      .select(
        'cs.*',
        'sp.name as plan_name',
        'sp.slug as plan_slug',
        'sp.price as plan_price',
        'sp.currency as plan_currency',
        'sp.billing_interval as plan_billing_interval',
        'sp.active_ticket_limit',
        'sp.completed_ticket_limit',
        'sp.total_ticket_limit',
        'sp.features as plan_features',
        'sp.trial_days as plan_trial_days'
      )
      .first();

    return result || null;
  }

  static async getUserSubscriptionWithPlan(userId: string): Promise<any | null> {
    const result = await this.db('customer_subscriptions as cs')
      .join('subscription_plans as sp', 'cs.plan_id', 'sp.id')
      .where('cs.user_id', userId)
      .whereIn('cs.status', ['active', 'trial'])
      .select(
        'cs.*',
        'sp.name as plan_name',
        'sp.slug as plan_slug',
        'sp.price as plan_price',
        'sp.currency as plan_currency',
        'sp.billing_interval as plan_billing_interval',
        'sp.active_ticket_limit',
        'sp.completed_ticket_limit',
        'sp.total_ticket_limit',
        'sp.features as plan_features',
        'sp.trial_days as plan_trial_days'
      )
      .first();

    return result || null;
  }

  static async updateBillingPeriod(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<CustomerSubscriptionTable | null> {
    return this.update(subscriptionId, {
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
  }

  static async updatePaymentMethod(
    subscriptionId: string,
    paymentMethodId: string
  ): Promise<CustomerSubscriptionTable | null> {
    return this.update(subscriptionId, {
      payment_method_id: paymentMethodId,
    });
  }

  static async findByStripeSubscriptionId(
    stripeSubscriptionId: string
  ): Promise<CustomerSubscriptionTable | null> {
    const result = await this.query.where('stripe_subscription_id', stripeSubscriptionId).first();
    return result || null;
  }

  static async findByStripeCustomerId(
    stripeCustomerId: string
  ): Promise<CustomerSubscriptionTable[]> {
    return this.query.where('stripe_customer_id', stripeCustomerId).orderBy('created_at', 'desc');
  }

  // Convert database record to API model
  static toModel(subscription: CustomerSubscriptionTable): CustomerSubscriptionModel {
    return {
      id: subscription.id,
      userId: subscription.user_id,
      planId: subscription.plan_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end,
      cancelledAt: subscription.cancelled_at,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      paymentMethodId: subscription.payment_method_id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      stripeCustomerId: subscription.stripe_customer_id,
      metadata:
        typeof subscription.metadata === 'string'
          ? JSON.parse(subscription.metadata)
          : subscription.metadata,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at,
    };
  }
}
