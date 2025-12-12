import React, { useState, useEffect } from 'react';
import {
  // ChartBarIcon, // TODO: Implement chart functionality
  CurrencyDollarIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';

interface MRRData {
  month: string;
  mrr: number;
  currency: string;
  activeSubscriptions: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  netMrrGrowth: number;
}

interface ConversionRates {
  period: string;
  totalSignups: number;
  freeTrialStarts: number;
  trialToPaidConversions: number;
  freeTierToPaidConversions: number;
  trialConversionRate: number;
  freeTierConversionRate: number;
  overallConversionRate: number;
}

interface PlanDistribution {
  planId: string;
  planName: string;
  planSlug: string;
  price: number;
  activeSubscriptions: number;
  totalRevenue: number;
  percentageOfCustomers: number;
  percentageOfRevenue: number;
}

interface ChurnAnalysis {
  period: string;
  totalActiveStart: number;
  newSubscriptions: number;
  churnedSubscriptions: number;
  totalActiveEnd: number;
  churnRate: number;
  revenueChurn: number;
  averageChurnedCustomerValue: number;
}

interface UsageAnalytics {
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
    utilizationRate: number;
  }>;
}

interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  averageRevenuePerUser: number;
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  netRevenueRetention: number;
  currency: string;
}

const SubscriptionAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  // Analytics data state
  const [mrrData, setMrrData] = useState<MRRData | null>(null);
  const [historicalMrr, setHistoricalMrr] = useState<MRRData[]>([]);
  const [conversionRates, setConversionRates] = useState<ConversionRates | null>(null);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [churnAnalysis, setChurnAnalysis] = useState<ChurnAnalysis | null>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all analytics data in parallel
      const [dashboardResponse, historicalMrrResponse] = await Promise.all([
        api.get('/subscription-analytics/dashboard'),
        api.get('/subscription-analytics/mrr/historical?months=6'),
      ]);

      if (dashboardResponse.data.success) {
        const data = dashboardResponse.data.data;
        setMrrData(data.overview.mrr);
        setRevenueMetrics(data.overview.revenueMetrics);
        setConversionRates(data.overview.conversionRates);
        setChurnAnalysis(data.overview.churnAnalysis);
        setPlanDistribution(data.charts.planDistribution);
        setUsageAnalytics(data.insights.usageAnalytics);
      }

      if (historicalMrrResponse.data.success) {
        setHistoricalMrr(historicalMrrResponse.data.data);
      }
    } catch (err: any) {
      console.error('Error loading analytics data:', err);
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getGrowthIcon = (value: number) => {
    if (value > 0) {
      return <ArrowUpIcon className="h-4 w-4 text-green-400" />;
    } else if (value < 0) {
      return <ArrowDownIcon className="h-4 w-4 text-red-400" />;
    }
    return null;
  };

  const getGrowthColor = (value: number) => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-white/60';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Subscription Analytics</h2>
        </div>
        <div className="bg-white/5 p-8 rounded-lg border border-white/10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-white/60 mt-4">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Subscription Analytics</h2>
        </div>
        <div className="bg-red-500/10 p-8 rounded-lg border border-red-500/20 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Error Loading Analytics</h3>
          <p className="text-red-300">{error}</p>
          <button
            onClick={loadAnalyticsData}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-white">Subscription Analytics</h2>
          <p className="text-sm text-white/60">Revenue tracking and business metrics</p>
        </div>
        <div className="flex space-x-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="current">Current Month</option>
            <option value="last">Last Month</option>
            <option value="quarter">This Quarter</option>
          </select>
          <button
            onClick={loadAnalyticsData}
            className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MRR Card */}
        {mrrData && (
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(mrrData.mrr, mrrData.currency)}
                </p>
              </div>
              <CurrencyDollarIcon className="h-8 w-8 text-green-400" />
            </div>
            <div className="mt-4 flex items-center">
              {getGrowthIcon(mrrData.netMrrGrowth)}
              <span className={`ml-1 text-sm ${getGrowthColor(mrrData.netMrrGrowth)}`}>
                {formatCurrency(Math.abs(mrrData.netMrrGrowth), mrrData.currency)} vs last month
              </span>
            </div>
          </div>
        )}

        {/* Active Subscriptions */}
        {mrrData && (
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Active Subscriptions</p>
                <p className="text-2xl font-bold text-white">{mrrData.activeSubscriptions}</p>
              </div>
              <UsersIcon className="h-8 w-8 text-blue-400" />
            </div>
            <div className="mt-4 flex items-center">
              {getGrowthIcon(mrrData.newSubscriptions - mrrData.churnedSubscriptions)}
              <span
                className={`ml-1 text-sm ${getGrowthColor(mrrData.newSubscriptions - mrrData.churnedSubscriptions)}`}
              >
                {Math.abs(mrrData.newSubscriptions - mrrData.churnedSubscriptions)} net growth
              </span>
            </div>
          </div>
        )}

        {/* Conversion Rate */}
        {conversionRates && (
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Overall Conversion Rate</p>
                <p className="text-2xl font-bold text-white">
                  {formatPercentage(conversionRates.overallConversionRate)}
                </p>
              </div>
              <ArrowTrendingUpIcon className="h-8 w-8 text-purple-400" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-white/60">
                {conversionRates.totalSignups} signups this month
              </span>
            </div>
          </div>
        )}

        {/* Churn Rate */}
        {churnAnalysis && (
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Churn Rate</p>
                <p className="text-2xl font-bold text-white">
                  {formatPercentage(churnAnalysis.churnRate)}
                </p>
              </div>
              <ArrowTrendingDownIcon className="h-8 w-8 text-red-400" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-white/60">
                {churnAnalysis.churnedSubscriptions} customers churned
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR Trend Chart */}
        <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <h3 className="text-lg font-medium text-white mb-4">MRR Trend (Last 6 Months)</h3>
          <div className="space-y-3">
            {historicalMrr.map((data, index) => (
              <div key={data.month} className="flex items-center justify-between">
                <span className="text-sm text-white/60">{data.month}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-white">
                    {formatCurrency(data.mrr, data.currency)}
                  </span>
                  {index > 0 && (
                    <span className={`text-xs ${getGrowthColor(data.netMrrGrowth)}`}>
                      ({data.netMrrGrowth > 0 ? '+' : ''}
                      {formatCurrency(data.netMrrGrowth, data.currency)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <h3 className="text-lg font-medium text-white mb-4">Plan Distribution</h3>
          <div className="space-y-3">
            {planDistribution.map((plan) => (
              <div key={plan.planId} className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">{plan.planName}</span>
                  <span className="text-xs text-white/60 ml-2">
                    ({plan.activeSubscriptions} customers)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">
                    {formatPercentage(plan.percentageOfRevenue)}
                  </div>
                  <div className="text-xs text-white/60">{formatCurrency(plan.totalRevenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Usage Analytics */}
      {usageAnalytics && (
        <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <h3 className="text-lg font-medium text-white mb-4">Usage Analytics</h3>

          {/* Customers Approaching Limits */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-white/80 mb-3">
              Customers Approaching Limits ({usageAnalytics.customersApproachingLimits.length})
            </h4>
            {usageAnalytics.customersApproachingLimits.length > 0 ? (
              <div className="space-y-2">
                {usageAnalytics.customersApproachingLimits.slice(0, 5).map((customer) => (
                  <div
                    key={customer.userId}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div>
                      <span className="text-sm text-white">{customer.email}</span>
                      <span className="text-xs text-white/60 ml-2">({customer.currentPlan})</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-xs text-white/60">
                        Usage:{' '}
                        {Math.max(
                          customer.usagePercentage.active,
                          customer.usagePercentage.completed,
                          customer.usagePercentage.total
                        ).toFixed(0)}
                        %
                      </div>
                      <div className="text-xs text-blue-300">
                        Suggest: {customer.upgradeRecommendation}
                      </div>
                    </div>
                  </div>
                ))}
                {usageAnalytics.customersApproachingLimits.length > 5 && (
                  <p className="text-xs text-white/60 text-center">
                    +{usageAnalytics.customersApproachingLimits.length - 5} more customers
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                No customers currently approaching their limits.
              </p>
            )}
          </div>

          {/* Average Usage by Plan */}
          <div>
            <h4 className="text-md font-medium text-white/80 mb-3">Average Usage by Plan</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usageAnalytics.averageUsageByPlan.map((planUsage) => (
                <div key={planUsage.planName} className="p-4 bg-white/5 rounded-lg">
                  <h5 className="text-sm font-medium text-white mb-2">{planUsage.planName}</h5>
                  <div className="space-y-1 text-xs text-white/60">
                    <div>Active: {planUsage.averageActiveTickets}</div>
                    <div>Completed: {planUsage.averageCompletedTickets}</div>
                    <div>Total: {planUsage.averageTotalTickets}</div>
                    <div className="text-white/80">
                      Utilization: {formatPercentage(planUsage.utilizationRate)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conversion Funnel */}
      {conversionRates && (
        <div className="bg-white/5 p-6 rounded-lg border border-white/10">
          <h3 className="text-lg font-medium text-white mb-4">Conversion Funnel</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{conversionRates.totalSignups}</div>
              <div className="text-sm text-white/60">Total Signups</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-300">
                {conversionRates.freeTrialStarts}
              </div>
              <div className="text-sm text-white/60">Trial Starts</div>
              <div className="text-xs text-white/40">
                {conversionRates.totalSignups > 0
                  ? formatPercentage(
                      (conversionRates.freeTrialStarts / conversionRates.totalSignups) * 100
                    )
                  : '0%'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-300">
                {conversionRates.trialToPaidConversions}
              </div>
              <div className="text-sm text-white/60">Trial → Paid</div>
              <div className="text-xs text-white/40">
                {formatPercentage(conversionRates.trialConversionRate)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-300">
                {conversionRates.freeTierToPaidConversions}
              </div>
              <div className="text-sm text-white/60">Free → Paid</div>
              <div className="text-xs text-white/40">
                {formatPercentage(conversionRates.freeTierConversionRate)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionAnalytics;
