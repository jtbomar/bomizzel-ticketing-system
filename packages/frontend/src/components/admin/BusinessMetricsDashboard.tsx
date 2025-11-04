import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChartPieIcon,
  BanknotesIcon,
  UserGroupIcon,
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
  churnReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
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

interface CustomerLifetimeValue {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  totalRevenue: number;
  subscriptionStartDate: string;
  subscriptionDuration: number;
  currentPlan: string;
  averageMonthlyRevenue: number;
  predictedClv: number;
  churnProbability: number;
}

const BusinessMetricsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [selectedMetric, setSelectedMetric] = useState('overview');

  // Analytics data state
  const [mrrData, setMrrData] = useState<MRRData | null>(null);
  const [historicalMrr, setHistoricalMrr] = useState<MRRData[]>([]);
  const [conversionRates, setConversionRates] = useState<ConversionRates | null>(null);
  const [historicalConversion, setHistoricalConversion] = useState<ConversionRates[]>([]);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [churnAnalysis, setChurnAnalysis] = useState<ChurnAnalysis | null>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [topCustomers, setTopCustomers] = useState<CustomerLifetimeValue[]>([]);

  useEffect(() => {
    loadBusinessMetrics();
  }, [selectedPeriod]);

  const loadBusinessMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load comprehensive business metrics
      const [dashboardResponse, historicalMrrResponse, historicalConversionResponse, clvResponse] =
        await Promise.all([
          api.get('/subscription-analytics/dashboard'),
          api.get('/subscription-analytics/mrr/historical?months=12'),
          api.get('/subscription-analytics/conversion-rates/historical?months=6'),
          api.get('/subscription-analytics/clv?limit=10'),
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

      if (historicalConversionResponse.data.success) {
        setHistoricalConversion(historicalConversionResponse.data.data);
      }

      if (clvResponse.data.success) {
        setTopCustomers(clvResponse.data.data);
      }
    } catch (err: any) {
      console.error('Error loading business metrics:', err);
      setError(err.response?.data?.message || 'Failed to load business metrics');
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

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 75) return 'text-yellow-400';
    return 'text-green-400';
  };

  const renderRevenueCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* MRR Trend Chart */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Monthly Recurring Revenue Trend</h3>
          <CurrencyDollarIcon className="h-6 w-6 text-green-400" />
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {historicalMrr.map((data, index) => {
            const previousMrr = index > 0 ? historicalMrr[index - 1].mrr : data.mrr;
            const growth = data.mrr - previousMrr;
            const growthPercentage = previousMrr > 0 ? (growth / previousMrr) * 100 : 0;

            return (
              <div
                key={data.month}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div>
                  <span className="text-sm font-medium text-white">{data.month}</span>
                  <div className="text-xs text-white/60">
                    {data.activeSubscriptions} active subscriptions
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">
                    {formatCurrency(data.mrr, data.currency)}
                  </div>
                  {index > 0 && (
                    <div className={`text-xs flex items-center ${getGrowthColor(growth)}`}>
                      {getGrowthIcon(growth)}
                      <span className="ml-1">{formatPercentage(Math.abs(growthPercentage))}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Revenue Breakdown</h3>
          <ChartPieIcon className="h-6 w-6 text-blue-400" />
        </div>
        {revenueMetrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-green-400">
                  {formatCurrency(revenueMetrics.totalRevenue, revenueMetrics.currency)}
                </div>
                <div className="text-sm text-white/60">Total Revenue</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">
                  {formatCurrency(revenueMetrics.averageRevenuePerUser, revenueMetrics.currency)}
                </div>
                <div className="text-sm text-white/60">ARPU</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-white">{revenueMetrics.totalCustomers}</div>
                <div className="text-xs text-white/60">Total Customers</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-400">
                  +{revenueMetrics.newCustomers}
                </div>
                <div className="text-xs text-white/60">New This Month</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-400">
                  -{revenueMetrics.churnedCustomers}
                </div>
                <div className="text-xs text-white/60">Churned</div>
              </div>
            </div>
            <div className="text-center p-3 bg-white/5 rounded-lg">
              <div className="text-lg font-bold text-purple-400">
                {formatPercentage(revenueMetrics.netRevenueRetention)}
              </div>
              <div className="text-sm text-white/60">Net Revenue Retention</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSubscriptionDistribution = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Plan Distribution Chart */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Subscription Plan Distribution</h3>
          <ChartBarIcon className="h-6 w-6 text-purple-400" />
        </div>
        <div className="space-y-3">
          {planDistribution.map((plan, index) => {
            const colors = [
              'bg-blue-500',
              'bg-green-500',
              'bg-yellow-500',
              'bg-purple-500',
              'bg-red-500',
            ];
            const color = colors[index % colors.length];

            return (
              <div key={plan.planId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${color}`}></div>
                    <span className="text-sm font-medium text-white">{plan.planName}</span>
                    <span className="text-xs text-white/60">
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
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${plan.percentageOfRevenue}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Upgrade Patterns */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Customer Upgrade Patterns</h3>
          <ArrowTrendingUpIcon className="h-6 w-6 text-green-400" />
        </div>
        <div className="space-y-4">
          {/* Conversion Funnel */}
          {conversionRates && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-white">Total Signups</span>
                <span className="text-lg font-bold text-white">{conversionRates.totalSignups}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-500/20 rounded-lg">
                <span className="text-sm text-blue-300">Free Trial Starts</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-blue-300">
                    {conversionRates.freeTrialStarts}
                  </span>
                  <div className="text-xs text-blue-400">
                    {conversionRates.totalSignups > 0
                      ? formatPercentage(
                          (conversionRates.freeTrialStarts / conversionRates.totalSignups) * 100
                        )
                      : '0%'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-500/20 rounded-lg">
                <span className="text-sm text-green-300">Trial → Paid</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-green-300">
                    {conversionRates.trialToPaidConversions}
                  </span>
                  <div className="text-xs text-green-400">
                    {formatPercentage(conversionRates.trialConversionRate)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-500/20 rounded-lg">
                <span className="text-sm text-purple-300">Free → Paid</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-purple-300">
                    {conversionRates.freeTierToPaidConversions}
                  </span>
                  <div className="text-xs text-purple-400">
                    {formatPercentage(conversionRates.freeTierConversionRate)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderChurnAnalysis = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Churn Metrics */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Churn Analysis</h3>
          <ArrowTrendingDownIcon className="h-6 w-6 text-red-400" />
        </div>
        {churnAnalysis && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <div className="text-2xl font-bold text-red-400">
                  {formatPercentage(churnAnalysis.churnRate)}
                </div>
                <div className="text-sm text-white/60">Churn Rate</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-white">
                  {churnAnalysis.churnedSubscriptions}
                </div>
                <div className="text-sm text-white/60">Churned Customers</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-white/5 rounded-lg">
                <div className="text-lg font-bold text-white">
                  {formatCurrency(churnAnalysis.revenueChurn)}
                </div>
                <div className="text-xs text-white/60">Revenue Lost</div>
              </div>
              <div className="text-center p-3 bg-white/5 rounded-lg">
                <div className="text-lg font-bold text-white">
                  {formatCurrency(churnAnalysis.averageChurnedCustomerValue)}
                </div>
                <div className="text-xs text-white/60">Avg Customer Value</div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-white/80">Churn Reasons</h4>
              {churnAnalysis.churnReasons.map((reason) => (
                <div
                  key={reason.reason}
                  className="flex items-center justify-between p-2 bg-white/5 rounded"
                >
                  <span className="text-sm text-white/80">{reason.reason}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white">{reason.count}</span>
                    <span className="text-xs text-white/60">({reason.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Historical Conversion Trends */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Conversion Rate Trends</h3>
          <ChartBarIcon className="h-6 w-6 text-blue-400" />
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {historicalConversion.map((data) => (
            <div
              key={data.period}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <div>
                <span className="text-sm font-medium text-white">{data.period}</span>
                <div className="text-xs text-white/60">{data.totalSignups} signups</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white">
                  {formatPercentage(data.overallConversionRate)}
                </div>
                <div className="text-xs text-white/60">Overall conversion</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUsageAnalytics = () => (
    <div className="space-y-6">
      {/* Customers Approaching Limits */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">
            Customers Approaching Limits ({usageAnalytics?.customersApproachingLimits.length || 0})
          </h3>
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
        </div>
        {usageAnalytics && usageAnalytics.customersApproachingLimits.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {usageAnalytics.customersApproachingLimits.map((customer) => {
              const maxUsage = Math.max(
                customer.usagePercentage.active,
                customer.usagePercentage.completed,
                customer.usagePercentage.total
              );

              return (
                <div
                  key={customer.userId}
                  className="p-4 bg-white/5 rounded-lg border border-yellow-500/20"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-white">{customer.email}</span>
                      <span className="text-xs text-white/60 ml-2">({customer.currentPlan})</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${getUsageColor(maxUsage)}`}>
                        {maxUsage.toFixed(0)}% usage
                      </div>
                      <div className="text-xs text-white/60">
                        {customer.daysUntilRenewal} days to renewal
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-white/5 rounded">
                      <div className="text-white">
                        {customer.usagePercentage.active.toFixed(0)}%
                      </div>
                      <div className="text-white/60">Active</div>
                    </div>
                    <div className="text-center p-2 bg-white/5 rounded">
                      <div className="text-white">
                        {customer.usagePercentage.completed.toFixed(0)}%
                      </div>
                      <div className="text-white/60">Completed</div>
                    </div>
                    <div className="text-center p-2 bg-blue-500/20 rounded">
                      <div className="text-blue-300">{customer.upgradeRecommendation}</div>
                      <div className="text-blue-400">Suggested</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <UserGroupIcon className="h-12 w-12 text-white/40 mx-auto mb-4" />
            <p className="text-white/60">No customers currently approaching their limits</p>
          </div>
        )}
      </div>

      {/* Average Usage by Plan */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Average Usage by Plan</h3>
          <ChartBarIcon className="h-6 w-6 text-green-400" />
        </div>
        {usageAnalytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usageAnalytics.averageUsageByPlan.map((planUsage) => (
              <div
                key={planUsage.planName}
                className="p-4 bg-white/5 rounded-lg border border-white/10"
              >
                <h5 className="text-sm font-medium text-white mb-3">{planUsage.planName}</h5>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Active Tickets:</span>
                    <span className="text-white">{planUsage.averageActiveTickets}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Completed:</span>
                    <span className="text-white">{planUsage.averageCompletedTickets}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Total:</span>
                    <span className="text-white">{planUsage.averageTotalTickets}</span>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/80">Utilization:</span>
                      <span className={`font-bold ${getUsageColor(planUsage.utilizationRate)}`}>
                        {formatPercentage(planUsage.utilizationRate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Customers by CLV */}
      <div className="bg-white/5 p-6 rounded-lg border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Top Customers by Lifetime Value</h3>
          <BanknotesIcon className="h-6 w-6 text-gold-400" />
        </div>
        {topCustomers.length > 0 ? (
          <div className="space-y-3">
            {topCustomers.slice(0, 5).map((customer, index) => (
              <div
                key={customer.userId}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {customer.firstName} {customer.lastName}
                    </div>
                    <div className="text-xs text-white/60">{customer.email}</div>
                    <div className="text-xs text-white/60">{customer.currentPlan}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-400">
                    {formatCurrency(customer.totalRevenue)}
                  </div>
                  <div className="text-xs text-white/60">
                    {formatCurrency(customer.averageMonthlyRevenue)}/mo
                  </div>
                  <div className="text-xs text-green-400">
                    CLV: {formatCurrency(customer.predictedClv)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BanknotesIcon className="h-12 w-12 text-white/40 mx-auto mb-4" />
            <p className="text-white/60">No customer data available</p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Business Metrics Dashboard</h2>
        </div>
        <div className="bg-white/5 p-8 rounded-lg border border-white/10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-white/60 mt-4">Loading business metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Business Metrics Dashboard</h2>
        </div>
        <div className="bg-red-500/10 p-8 rounded-lg border border-red-500/20 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Error Loading Metrics</h3>
          <p className="text-red-300">{error}</p>
          <button
            onClick={loadBusinessMetrics}
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
          <h2 className="text-lg font-medium text-white">Business Metrics Dashboard</h2>
          <p className="text-sm text-white/60">
            Revenue charts, subscription distribution, and customer analytics
          </p>
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
            <option value="year">This Year</option>
          </select>
          <button
            onClick={loadBusinessMetrics}
            className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MRR Card */}
        {mrrData && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-6 rounded-lg border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-300">Monthly Recurring Revenue</p>
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
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 p-6 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-300">Active Subscriptions</p>
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
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-6 rounded-lg border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-300">Overall Conversion Rate</p>
                <p className="text-2xl font-bold text-white">
                  {formatPercentage(conversionRates.overallConversionRate)}
                </p>
              </div>
              <ArrowTrendingUpIcon className="h-8 w-8 text-purple-400" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-purple-300">
                {conversionRates.totalSignups} signups this month
              </span>
            </div>
          </div>
        )}

        {/* Churn Rate */}
        {churnAnalysis && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 p-6 rounded-lg border border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-300">Churn Rate</p>
                <p className="text-2xl font-bold text-white">
                  {formatPercentage(churnAnalysis.churnRate)}
                </p>
              </div>
              <ArrowTrendingDownIcon className="h-8 w-8 text-red-400" />
            </div>
            <div className="mt-4">
              <span className="text-sm text-red-300">
                {churnAnalysis.churnedSubscriptions} customers churned
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Metric Selection Tabs */}
      <div className="bg-white/5 rounded-lg border border-white/10">
        <div className="border-b border-white/10">
          <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
            {[
              { id: 'overview', name: 'Revenue Charts', icon: CurrencyDollarIcon },
              { id: 'distribution', name: 'Subscription Distribution', icon: ChartPieIcon },
              { id: 'churn', name: 'Churn Analysis', icon: ArrowTrendingDownIcon },
              { id: 'usage', name: 'Usage Analytics', icon: ChartBarIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMetric(tab.id)}
                  className={`${
                    selectedMetric === tab.id
                      ? 'border-blue-400 text-blue-300'
                      : 'border-transparent text-white/60 hover:text-white hover:border-white/30'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-all duration-200`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {selectedMetric === 'overview' && renderRevenueCharts()}
          {selectedMetric === 'distribution' && renderSubscriptionDistribution()}
          {selectedMetric === 'churn' && renderChurnAnalysis()}
          {selectedMetric === 'usage' && renderUsageAnalytics()}
        </div>
      </div>
    </div>
  );
};

export default BusinessMetricsDashboard;
