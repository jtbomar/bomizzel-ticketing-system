import { BaseModel } from './BaseModel';
import { SubscriptionPlanTable } from '@/types/database';
import { SubscriptionPlan as SubscriptionPlanModel } from '@/types/models';

export class SubscriptionPlan extends BaseModel {
  protected static tableName = 'subscription_plans';

  static async findBySlug(slug: string): Promise<SubscriptionPlanTable | null> {
    const result = await this.query.where('slug', slug).first();
    return result || null;
  }

  static async findActivePlans(): Promise<SubscriptionPlanTable[]> {
    return this.query.where('is_active', true).orderBy('sort_order', 'asc').orderBy('price', 'asc');
  }

  static async createPlan(planData: {
    name: string;
    slug: string;
    price: number;
    currency?: string;
    billingInterval?: 'month' | 'year';
    activeTicketLimit: number;
    completedTicketLimit: number;
    totalTicketLimit: number;
    features?: string[];
    trialDays?: number;
    description?: string;
    sortOrder?: number;
  }): Promise<SubscriptionPlanTable> {
    return this.create({
      name: planData.name,
      slug: planData.slug,
      price: planData.price,
      currency: planData.currency || 'USD',
      billing_interval: planData.billingInterval || 'month',
      active_ticket_limit: planData.activeTicketLimit,
      completed_ticket_limit: planData.completedTicketLimit,
      total_ticket_limit: planData.totalTicketLimit,
      features: JSON.stringify(planData.features || []),
      trial_days: planData.trialDays || 0,
      description: planData.description,
      sort_order: planData.sortOrder || 0,
    });
  }

  static async getFreeTier(): Promise<SubscriptionPlanTable | null> {
    const result = await this.query.where('slug', 'free-tier').where('is_active', true).first();
    return result || null;
  }

  static async getPlanLimits(planId: string): Promise<{
    activeTicketLimit: number;
    completedTicketLimit: number;
    totalTicketLimit: number;
  } | null> {
    const plan = await this.findById(planId);
    if (!plan) return null;

    return {
      activeTicketLimit: plan.active_ticket_limit,
      completedTicketLimit: plan.completed_ticket_limit,
      totalTicketLimit: plan.total_ticket_limit,
    };
  }

  static async isUnlimitedPlan(planId: string): Promise<boolean> {
    const plan = await this.findById(planId);
    if (!plan) return false;

    return (
      plan.active_ticket_limit === -1 &&
      plan.completed_ticket_limit === -1 &&
      plan.total_ticket_limit === -1
    );
  }

  static async getPlansByPriceRange(
    minPrice: number,
    maxPrice: number
  ): Promise<SubscriptionPlanTable[]> {
    return this.query
      .where('is_active', true)
      .whereBetween('price', [minPrice, maxPrice])
      .orderBy('price', 'asc');
  }

  static async updatePlanLimits(
    planId: string,
    limits: {
      activeTicketLimit?: number;
      completedTicketLimit?: number;
      totalTicketLimit?: number;
    }
  ): Promise<SubscriptionPlanTable | null> {
    const updateData: any = {};

    if (limits.activeTicketLimit !== undefined) {
      updateData.active_ticket_limit = limits.activeTicketLimit;
    }
    if (limits.completedTicketLimit !== undefined) {
      updateData.completed_ticket_limit = limits.completedTicketLimit;
    }
    if (limits.totalTicketLimit !== undefined) {
      updateData.total_ticket_limit = limits.totalTicketLimit;
    }

    return this.update(planId, updateData);
  }

  // Convert database record to API model
  static toModel(plan: SubscriptionPlanTable): SubscriptionPlanModel {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: parseFloat(plan.price.toString()),
      currency: plan.currency,
      billingInterval: plan.billing_interval,
      limits: {
        activeTickets: plan.active_ticket_limit,
        completedTickets: plan.completed_ticket_limit,
        totalTickets: plan.total_ticket_limit,
      },
      features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
      trialDays: plan.trial_days,
      isActive: plan.is_active,
      sortOrder: plan.sort_order,
      description: plan.description,
      stripePriceId: plan.stripe_price_id,
      stripeProductId: plan.stripe_product_id,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
    };
  }
}
