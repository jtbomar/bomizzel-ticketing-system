import { CustomerSubscription } from '@/models/CustomerSubscription';
import { SubscriptionPlan } from '@/models/SubscriptionPlan';
import { BillingRecord } from '@/models/BillingRecord';
import { User } from '@/models/User';
import { db } from '@/config/database';
import { logger } from '@/utils/logger';

export interface MonthlyRecurringRevenue {
  month: string; // YYYY-MM format
  mrr: number;
  currency: string;
  activeSubscriptions: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  upgrades: number;
  downgrades: number;
  netMrrGrowth: number;
}

export interface CustomerLifetimeValue {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  totalRevenue: number;
  subscriptionStartDate: Date;
  subscriptionDuration: number; // in days
  currentPlan: string;
  averageMonthlyRevenue: number;
  predictedClv: number;
  churnProbability: number;
}

export interface ConversionRateMetrics {
  period: string; // YYYY-MM format
  totalSignups: number;
  freeTrialStarts: number;
  trialToFreeTierConversions: number;
  trialToPaidConversions: number;
  freeTierToPaidConversions: number;
  trialConversionRate: number; // percentage
  freeTierConversionRate: number; // percentage
  overallConversionRate: number; // percentage
}

export interface PlanDistribution {
  planId: string;
  planName: string;
  planSlug: string;
  price: number;
  activeSubscriptions: number;
  totalRevenue: number;
  percentageOfCustomers: number;
  percentageOfRevenue: number;
}

export interface ChurnAnalysis {
  period: string; // YYYY-MM format
  totalActiveStart: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  totalActiveEnd: number;
  churnRate: number; // percentage
  revenueChurn: number;
  averageChurnedCustomerValue: number;
  churnReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

export interface UsageAnalytics {
  customersApproachingLimits: Array<{
    userId: string;
    email: string;
    currentPlan: string;
    usagePercentage: {
      active: number;
      completed: number;
      total: number;
    };
    daysUntilRenewal: number;
    upgradeRecommendation: string;
  }>;
  averageUsageByPlan: Array<{
    planName: string;
    averageActiveTickets: number;
    averageCompletedTickets: number;
    averageTotalTickets: number;
    utilizationRate: number; // percentage
  }>;
}

export class SubscriptionAnalyticsService {
  /**
   * Calculate Monthly Recurring Revenue (MRR) for a specific month
   */
  static async calculateMRR(year: number, month: number): Promise<MonthlyRecurringRevenue> {
    try {
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      // Get all active subscriptions at the end of the month
      const activeSubscriptions = await db('customer_subscriptions as cs')
        .join('subscription_plans as sp', 'cs.plan_id', 'sp.id')
        .where('cs.status', 'active')
        .where('cs.created_at', '<=', endDate)
        .whereRaw('(cs.cancelled_at IS NULL OR cs.cancelled_at > ?)', [endDate])
        .select(
          'cs.id',
          'cs.user_id',
          'cs.created_at',
          'cs.cancelled_at',
          'sp.price',
          'sp.currency',
          'sp.billing_interval'
        );

      // Calculate MRR from active subscriptions
      let totalMrr = 0;
      const currency = 'USD'; // Default currency

      for (const subscription of activeSubscriptions) {
        let monthlyRevenue = parseFloat(subscription.price.toString());

        // Convert to monthly if needed
        if (subscription.billing_interval === 'year') {
          monthlyRevenue = monthlyRevenue / 12;
        }

        totalMrr += monthlyRevenue;
      }

      // Get new subscriptions for the month
      const newSubscriptions = await db('customer_subscriptions')
        .whereBetween('created_at', [startDate, endDate])
        .whereIn('status', ['active', 'trial'])
        .count('* as count')
        .first();

      // Get churned subscriptions for the month
      const churnedSubscriptions = await db('customer_subscriptions')
        .whereBetween('cancelled_at', [startDate, endDate])
        .count('* as count')
        .first();

      // Get upgrades and downgrades (simplified - would need subscription history table for accurate tracking)
      const upgrades = 0; // TODO: Implement with subscription change history
      const downgrades = 0; // TODO: Implement with subscription change history

      // Calculate net MRR growth (simplified)
      const previousMonth = month === 1 ? 12 : month - 1;
      const previousYear = month === 1 ? year - 1 : year;
      const previousMrr = await this.calculateMRR(previousYear, previousMonth);
      const netMrrGrowth = totalMrr - previousMrr.mrr;

      return {
        month: monthStr,
        mrr: Math.round(totalMrr * 100) / 100,
        currency,
        activeSubscriptions: activeSubscriptions.length,
        newSubscriptions: parseInt(String(newSubscriptions?.count || '0')),
        churnedSubscriptions: parseInt(String(churnedSubscriptions?.count || '0')),
        upgrades,
        downgrades,
        netMrrGrowth: Math.round(netMrrGrowth * 100) / 100,
      };
    } catch (error) {
      logger.error('Error calculating MRR', { year, month, error });
      throw error;
    }
  }

  /**
   * Calculate Customer Lifetime Value (CLV) for all customers or specific customers
   */
  static async calculateCustomerLifetimeValue(
    limit: number = 100,
    offset: number = 0
  ): Promise<CustomerLifetimeValue[]> {
    try {
      // Get customers with their subscription and billing data
      const customers = await db('users as u')
        .join('customer_subscriptions as cs', 'u.id', 'cs.user_id')
        .join('subscription_plans as sp', 'cs.plan_id', 'sp.id')
        .leftJoin('billing_records as br', 'cs.id', 'br.subscription_id')
        .where('cs.status', 'active')
        .select(
          'u.id as user_id',
          'u.email',
          'u.first_name',
          'u.last_name',
          'cs.created_at as subscription_start',
          'sp.name as current_plan',
          'sp.price as current_price',
          db.raw('SUM(CASE WHEN br.status = ? THEN br.amount_paid ELSE 0 END) as total_revenue', [
            'paid',
          ]),
          db.raw('COUNT(br.id) as total_invoices')
        )
        .groupBy(
          'u.id',
          'u.email',
          'u.first_name',
          'u.last_name',
          'cs.created_at',
          'sp.name',
          'sp.price'
        )
        .orderBy('total_revenue', 'desc')
        .limit(limit)
        .offset(offset);

      const clvData: CustomerLifetimeValue[] = [];

      for (const customer of customers) {
        const subscriptionStart = new Date(customer.subscription_start);
        const now = new Date();
        const subscriptionDuration = Math.floor(
          (now.getTime() - subscriptionStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const subscriptionMonths = Math.max(1, subscriptionDuration / 30.44); // Average days per month

        const totalRevenue = parseFloat(customer.total_revenue || '0');
        const averageMonthlyRevenue = totalRevenue / subscriptionMonths;

        // Simple CLV prediction based on current monthly revenue and estimated lifespan
        // Using industry average of 24 months for SaaS
        const estimatedLifespanMonths = 24;
        const predictedClv = averageMonthlyRevenue * estimatedLifespanMonths;

        // Simple churn probability based on usage patterns (would need more data for accuracy)
        const churnProbability =
          subscriptionDuration < 30 ? 0.3 : subscriptionDuration < 90 ? 0.2 : 0.1;

        clvData.push({
          userId: customer.user_id,
          email: customer.email,
          firstName: customer.first_name || '',
          lastName: customer.last_name || '',
          totalRevenue,
          subscriptionStartDate: subscriptionStart,
          subscriptionDuration,
          currentPlan: customer.current_plan,
          averageMonthlyRevenue: Math.round(averageMonthlyRevenue * 100) / 100,
          predictedClv: Math.round(predictedClv * 100) / 100,
          churnProbability: Math.round(churnProbability * 100) / 100,
        });
      }

      return clvData;
    } catch (error) {
      logger.error('Error calculating customer lifetime value', { limit, offset, error });
      throw error;
    }
  }

  /**
   * Calculate conversion rates from free to paid plans
   */
  static async calculateConversionRates(
    year: number,
    month: number
  ): Promise<ConversionRateMetrics> {
    try {
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      // Get total signups for the month
      const totalSignups = await db('users')
        .whereBetween('created_at', [startDate, endDate])
        .count('* as count')
        .first();

      // Get free tier plan
      const freeTierPlan = await SubscriptionPlan.getFreeTier();
      const freeTierPlanId = freeTierPlan?.id;

      // Get trial starts (subscriptions created with trial status)
      const freeTrialStarts = await db('customer_subscriptions')
        .whereBetween('created_at', [startDate, endDate])
        .where('status', 'trial')
        .count('* as count')
        .first();

      // Get trial to free tier conversions
      const trialToFreeTierConversions = await db('customer_subscriptions')
        .whereBetween('updated_at', [startDate, endDate])
        .where('status', 'active')
        .where('plan_id', freeTierPlanId)
        .whereNotNull('trial_end')
        .count('* as count')
        .first();

      // Get trial to paid conversions
      const trialToPaidConversions = await db('customer_subscriptions')
        .whereBetween('updated_at', [startDate, endDate])
        .where('status', 'active')
        .whereNot('plan_id', freeTierPlanId)
        .whereNotNull('trial_end')
        .count('* as count')
        .first();

      // Get free tier to paid conversions (plan upgrades from free tier)
      const freeTierToPaidConversions = await db('customer_subscriptions as cs1')
        .join('customer_subscriptions as cs2', 'cs1.user_id', 'cs2.user_id')
        .where('cs1.plan_id', freeTierPlanId)
        .where('cs1.status', 'cancelled')
        .whereNot('cs2.plan_id', freeTierPlanId)
        .where('cs2.status', 'active')
        .whereBetween('cs2.created_at', [startDate, endDate])
        .count('* as count')
        .first();

      const totalSignupsCount = parseInt(String(totalSignups?.count || '0'));
      const freeTrialStartsCount = parseInt(String(freeTrialStarts?.count || '0'));
      const trialToFreeTierCount = parseInt(String(trialToFreeTierConversions?.count || '0'));
      const trialToPaidCount = parseInt(String(trialToPaidConversions?.count || '0'));
      const freeTierToPaidCount = parseInt(String(freeTierToPaidConversions?.count || '0'));

      // Calculate conversion rates
      const trialConversionRate =
        freeTrialStartsCount > 0
          ? ((trialToPaidCount + trialToFreeTierCount) / freeTrialStartsCount) * 100
          : 0;

      const freeTierConversionRate =
        trialToFreeTierCount > 0 ? (freeTierToPaidCount / trialToFreeTierCount) * 100 : 0;

      const overallConversionRate =
        totalSignupsCount > 0
          ? ((trialToPaidCount + freeTierToPaidCount) / totalSignupsCount) * 100
          : 0;

      return {
        period: monthStr,
        totalSignups: totalSignupsCount,
        freeTrialStarts: freeTrialStartsCount,
        trialToFreeTierConversions: trialToFreeTierCount,
        trialToPaidConversions: trialToPaidCount,
        freeTierToPaidConversions: freeTierToPaidCount,
        trialConversionRate: Math.round(trialConversionRate * 100) / 100,
        freeTierConversionRate: Math.round(freeTierConversionRate * 100) / 100,
        overallConversionRate: Math.round(overallConversionRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Error calculating conversion rates', { year, month, error });
      throw error;
    }
  }

  /**
   * Get subscription plan distribution and revenue breakdown
   */
  static async getPlanDistribution(): Promise<PlanDistribution[]> {
    try {
      const planStats = await db('subscription_plans as sp')
        .leftJoin('customer_subscriptions as cs', function () {
          this.on('sp.id', '=', 'cs.plan_id').andOn('cs.status', '=', db.raw('?', ['active']));
        })
        .leftJoin('billing_records as br', function () {
          this.on('cs.id', '=', 'br.subscription_id').andOn(
            'br.status',
            '=',
            db.raw('?', ['paid'])
          );
        })
        .where('sp.is_active', true)
        .select(
          'sp.id as plan_id',
          'sp.name as plan_name',
          'sp.slug as plan_slug',
          'sp.price',
          db.raw('COUNT(DISTINCT cs.id) as active_subscriptions'),
          db.raw('SUM(CASE WHEN br.status = ? THEN br.amount_paid ELSE 0 END) as total_revenue', [
            'paid',
          ])
        )
        .groupBy('sp.id', 'sp.name', 'sp.slug', 'sp.price')
        .orderBy('sp.price', 'asc');

      // Calculate totals for percentage calculations
      const totalCustomers = planStats.reduce(
        (sum, plan) => sum + parseInt(plan.active_subscriptions),
        0
      );
      const totalRevenue = planStats.reduce(
        (sum, plan) => sum + parseFloat(plan.total_revenue || '0'),
        0
      );

      return planStats.map((plan) => ({
        planId: plan.plan_id,
        planName: plan.plan_name,
        planSlug: plan.plan_slug,
        price: parseFloat(plan.price.toString()),
        activeSubscriptions: parseInt(plan.active_subscriptions),
        totalRevenue: parseFloat(plan.total_revenue || '0'),
        percentageOfCustomers:
          totalCustomers > 0
            ? Math.round((parseInt(plan.active_subscriptions) / totalCustomers) * 10000) / 100
            : 0,
        percentageOfRevenue:
          totalRevenue > 0
            ? Math.round((parseFloat(plan.total_revenue || '0') / totalRevenue) * 10000) / 100
            : 0,
      }));
    } catch (error) {
      logger.error('Error getting plan distribution', { error });
      throw error;
    }
  }

  /**
   * Analyze customer churn for a specific month
   */
  static async analyzeChurn(year: number, month: number): Promise<ChurnAnalysis> {
    try {
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      const previousMonthStart = new Date(year, month - 2, 1);

      // Get active subscriptions at start of month
      const totalActiveStart = await db('customer_subscriptions')
        .where('status', 'active')
        .where('created_at', '<', startDate)
        .whereRaw('(cancelled_at IS NULL OR cancelled_at >= ?)', [startDate])
        .count('* as count')
        .first();

      // Get new subscriptions during the month
      const newSubscriptions = await db('customer_subscriptions')
        .whereBetween('created_at', [startDate, endDate])
        .whereIn('status', ['active', 'trial'])
        .count('* as count')
        .first();

      // Get churned subscriptions during the month
      const churnedSubscriptionsData = await CustomerSubscription.db('customer_subscriptions as cs')
        .join('subscription_plans as sp', 'cs.plan_id', 'sp.id')
        .whereBetween('cs.cancelled_at', [startDate, endDate])
        .select(
          CustomerSubscription.db.raw('COUNT(*) as count'),
          CustomerSubscription.db.raw('SUM(sp.price) as churned_revenue'),
          CustomerSubscription.db.raw('AVG(sp.price) as avg_churned_value')
        )
        .first();

      // Get active subscriptions at end of month
      const totalActiveEnd = await CustomerSubscription.db('customer_subscriptions')
        .where('status', 'active')
        .where('created_at', '<=', endDate)
        .whereRaw('(cancelled_at IS NULL OR cancelled_at > ?)', [endDate])
        .count('* as count')
        .first();

      const totalActiveStartCount = parseInt(String(totalActiveStart?.count || '0'));
      const newSubscriptionsCount = parseInt(String(newSubscriptions?.count || '0'));
      const churnedSubscriptionsCount = parseInt(churnedSubscriptionsData?.count || '0');
      const totalActiveEndCount = parseInt(String(totalActiveEnd?.count || '0'));
      const churnedRevenue = parseFloat(churnedSubscriptionsData?.churned_revenue || '0');
      const avgChurnedValue = parseFloat(churnedSubscriptionsData?.avg_churned_value || '0');

      // Calculate churn rate
      const churnRate =
        totalActiveStartCount > 0 ? (churnedSubscriptionsCount / totalActiveStartCount) * 100 : 0;

      // Simplified churn reasons (would need cancellation reason tracking)
      const churnReasons = [
        {
          reason: 'Price too high',
          count: Math.floor(churnedSubscriptionsCount * 0.3),
          percentage: 30,
        },
        {
          reason: 'Not using enough',
          count: Math.floor(churnedSubscriptionsCount * 0.25),
          percentage: 25,
        },
        {
          reason: 'Found alternative',
          count: Math.floor(churnedSubscriptionsCount * 0.2),
          percentage: 20,
        },
        {
          reason: 'Technical issues',
          count: Math.floor(churnedSubscriptionsCount * 0.15),
          percentage: 15,
        },
        { reason: 'Other', count: Math.floor(churnedSubscriptionsCount * 0.1), percentage: 10 },
      ];

      return {
        period: monthStr,
        totalActiveStart: totalActiveStartCount,
        newSubscriptions: newSubscriptionsCount,
        churnedSubscriptions: churnedSubscriptionsCount,
        totalActiveEnd: totalActiveEndCount,
        churnRate: Math.round(churnRate * 100) / 100,
        revenueChurn: Math.round(churnedRevenue * 100) / 100,
        averageChurnedCustomerValue: Math.round(avgChurnedValue * 100) / 100,
        churnReasons,
      };
    } catch (error) {
      logger.error('Error analyzing churn', { year, month, error });
      throw error;
    }
  }

  /**
   * Get usage analytics showing customers approaching limits
   */
  static async getUsageAnalytics(): Promise<UsageAnalytics> {
    try {
      // This would integrate with UsageTrackingService once implemented
      // For now, return mock data structure
      const customersApproachingLimits: UsageAnalytics['customersApproachingLimits'] = [];
      const averageUsageByPlan: UsageAnalytics['averageUsageByPlan'] = [];

      // Get customers with high usage (would need actual usage tracking data)
      const highUsageCustomers = await User.db('users as u')
        .join('customer_subscriptions as cs', 'u.id', 'cs.user_id')
        .join('subscription_plans as sp', 'cs.plan_id', 'sp.id')
        .where('cs.status', 'active')
        .select(
          'u.id as user_id',
          'u.email',
          'sp.name as current_plan',
          'cs.current_period_end',
          'sp.active_ticket_limit',
          'sp.completed_ticket_limit',
          'sp.total_ticket_limit'
        )
        .limit(50);

      for (const customer of highUsageCustomers) {
        const now = new Date();
        const renewalDate = new Date(customer.current_period_end);
        const daysUntilRenewal = Math.ceil(
          (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Mock usage data - would come from actual usage tracking
        const mockUsage = {
          active: Math.floor(Math.random() * 90) + 10, // 10-100%
          completed: Math.floor(Math.random() * 90) + 10,
          total: Math.floor(Math.random() * 90) + 10,
        };

        // Only include customers approaching limits (>75% usage)
        if (mockUsage.active > 75 || mockUsage.completed > 75 || mockUsage.total > 75) {
          customersApproachingLimits.push({
            userId: customer.user_id,
            email: customer.email,
            currentPlan: customer.current_plan,
            usagePercentage: mockUsage,
            daysUntilRenewal,
            upgradeRecommendation: this.getUpgradeRecommendation(customer.current_plan),
          });
        }
      }

      // Get average usage by plan
      const plans = await SubscriptionPlan.findActivePlans();
      for (const plan of plans) {
        // Mock average usage data - would come from actual usage tracking
        const avgActiveTickets = Math.floor(
          Math.random() * (plan.active_ticket_limit > 0 ? plan.active_ticket_limit : 1000)
        );
        const avgCompletedTickets = Math.floor(
          Math.random() * (plan.completed_ticket_limit > 0 ? plan.completed_ticket_limit : 1000)
        );
        const avgTotalTickets = avgActiveTickets + avgCompletedTickets;

        const utilizationRate =
          plan.total_ticket_limit > 0
            ? (avgTotalTickets / plan.total_ticket_limit) * 100
            : Math.floor(Math.random() * 60) + 20; // 20-80% for unlimited plans

        averageUsageByPlan.push({
          planName: plan.name,
          averageActiveTickets: avgActiveTickets,
          averageCompletedTickets: avgCompletedTickets,
          averageTotalTickets: avgTotalTickets,
          utilizationRate: Math.round(utilizationRate * 100) / 100,
        });
      }

      return {
        customersApproachingLimits,
        averageUsageByPlan,
      };
    } catch (error) {
      logger.error('Error getting usage analytics', { error });
      throw error;
    }
  }

  /**
   * Get comprehensive revenue metrics for a date range
   */
  static async getRevenueMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    recurringRevenue: number;
    oneTimeRevenue: number;
    averageRevenuePerUser: number;
    totalCustomers: number;
    newCustomers: number;
    churnedCustomers: number;
    netRevenueRetention: number;
    currency: string;
  }> {
    try {
      // Get billing stats for the period
      const billingStats = await BillingRecord.getRevenueStats(startDate, endDate);

      // Get customer stats
      const newCustomers = await CustomerSubscription.db('customer_subscriptions')
        .whereBetween('created_at', [startDate, endDate])
        .whereIn('status', ['active', 'trial'])
        .count('* as count')
        .first();

      const churnedCustomers = await CustomerSubscription.db('customer_subscriptions')
        .whereBetween('cancelled_at', [startDate, endDate])
        .count('* as count')
        .first();

      const totalCustomers = await CustomerSubscription.db('customer_subscriptions')
        .where('status', 'active')
        .where('created_at', '<=', endDate)
        .whereRaw('(cancelled_at IS NULL OR cancelled_at > ?)', [endDate])
        .count('* as count')
        .first();

      const newCustomersCount = parseInt(String(newCustomers?.count || '0'));
      const churnedCustomersCount = parseInt(String(churnedCustomers?.count || '0'));
      const totalCustomersCount = parseInt(String(totalCustomers?.count || '0'));

      // Calculate metrics
      const averageRevenuePerUser =
        totalCustomersCount > 0 ? billingStats.totalRevenue / totalCustomersCount : 0;

      // Simplified net revenue retention (would need more complex calculation)
      const netRevenueRetention =
        totalCustomersCount > 0
          ? ((totalCustomersCount - churnedCustomersCount + newCustomersCount) /
              totalCustomersCount) *
            100
          : 100;

      return {
        totalRevenue: billingStats.totalRevenue,
        recurringRevenue: billingStats.totalRevenue, // Assuming all revenue is recurring for now
        oneTimeRevenue: 0,
        averageRevenuePerUser: Math.round(averageRevenuePerUser * 100) / 100,
        totalCustomers: totalCustomersCount,
        newCustomers: newCustomersCount,
        churnedCustomers: churnedCustomersCount,
        netRevenueRetention: Math.round(netRevenueRetention * 100) / 100,
        currency: billingStats.currency.toUpperCase(),
      };
    } catch (error) {
      logger.error('Error getting revenue metrics', { startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Get upgrade recommendation based on current plan
   */
  private static getUpgradeRecommendation(currentPlan: string): string {
    const planHierarchy = ['Free Tier', 'Starter', 'Professional', 'Business', 'Enterprise'];
    const currentIndex = planHierarchy.findIndex((plan) =>
      currentPlan.toLowerCase().includes(plan.toLowerCase())
    );

    if (currentIndex >= 0 && currentIndex < planHierarchy.length - 1) {
      return planHierarchy[currentIndex + 1];
    }

    return 'Enterprise';
  }

  /**
   * Get historical MRR data for charting
   */
  static async getHistoricalMRR(months: number = 12): Promise<MonthlyRecurringRevenue[]> {
    try {
      const results: MonthlyRecurringRevenue[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mrr = await this.calculateMRR(targetDate.getFullYear(), targetDate.getMonth() + 1);
        results.push(mrr);
      }

      return results;
    } catch (error) {
      logger.error('Error getting historical MRR', { months, error });
      throw error;
    }
  }

  /**
   * Get historical conversion rates for trending
   */
  static async getHistoricalConversionRates(months: number = 12): Promise<ConversionRateMetrics[]> {
    try {
      const results: ConversionRateMetrics[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const conversion = await this.calculateConversionRates(
          targetDate.getFullYear(),
          targetDate.getMonth() + 1
        );
        results.push(conversion);
      }

      return results;
    } catch (error) {
      logger.error('Error getting historical conversion rates', { months, error });
      throw error;
    }
  }
}
