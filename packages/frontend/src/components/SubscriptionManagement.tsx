import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { SubscriptionDetails, SubscriptionPlan } from '../types';
import PlanComparisonModal from './PlanComparisonModal';
import TrialManagement from './TrialManagement';
import { ArchivalSuggestions } from './ArchivalSuggestions';
import ArchivalManagement from './ArchivalManagement';

interface SubscriptionManagementProps {
  className?: string;
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({ className = '' }) => {
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<SubscriptionPlan | null>(null);
  const [showBillingInfo, setShowBillingInfo] = useState(false);
  const [showPlanComparison, setShowPlanComparison] = useState(false);
  
  // const { usageStats, fetchUsageStats } = useUsageWarnings();

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subscriptionResponse, plansResponse] = await Promise.all([
        apiService.getUserSubscription(),
        apiService.getAvailablePlans()
      ]);

      setSubscriptionDetails(subscriptionResponse.data);
      setAvailablePlans(plansResponse.data.plans);
    } catch (err: any) {
      console.error('Failed to load subscription data:', err);
      setError(err.response?.data?.message || 'Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeClick = (plan: SubscriptionPlan) => {
    setSelectedUpgradePlan(plan);
    setShowUpgradeModal(true);
  };

  const confirmUpgrade = async () => {
    if (!subscriptionDetails?.subscription || !selectedUpgradePlan) return;

    try {
      setUpgrading(true);
      await apiService.upgradeSubscription(subscriptionDetails.subscription.id, selectedUpgradePlan.id);
      await loadSubscriptionData(); // Reload to get updated data
      setShowUpgradeModal(false);
      setSelectedUpgradePlan(null);
    } catch (err: any) {
      console.error('Failed to upgrade subscription:', err);
      setError(err.response?.data?.message || 'Failed to upgrade subscription');
    } finally {
      setUpgrading(false);
    }
  };

  const cancelUpgrade = () => {
    setShowUpgradeModal(false);
    setSelectedUpgradePlan(null);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUsageTextColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-700';
    if (percentage >= 75) return 'text-yellow-700';
    return 'text-green-700';
  };

  const renderUsageMeter = (
    label: string,
    current: number,
    limit: number,
    percentage: number
  ) => {
    const isUnlimited = limit === -1;
    
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-semibold ${getUsageTextColor(percentage)}`}>
            {isUnlimited ? `${current} (Unlimited)` : `${current} / ${limit}`}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isUnlimited ? 'bg-blue-500' : getUsageColor(percentage)
            }`}
            style={{ width: isUnlimited ? '100%' : `${Math.min(percentage, 100)}%` }}
          />
        </div>
        {!isUnlimited && percentage >= 75 && (
          <p className={`text-xs mt-1 ${getUsageTextColor(percentage)}`}>
            {percentage >= 90 
              ? 'You\'re approaching your limit. Consider upgrading your plan.'
              : 'You\'re using most of your allocation.'
            }
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-medium">Error loading subscription</p>
          <p className="text-sm mt-1">{error}</p>
          <button 
            onClick={loadSubscriptionData}
            className="mt-3 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!subscriptionDetails) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription</h2>
        <p className="text-gray-600">No subscription information available.</p>
      </div>
    );
  }

  const { subscription, plan, usage, limitStatus } = subscriptionDetails;

  return (
    <>
      {/* Archival Suggestions */}
      <ArchivalSuggestions />
      
      {/* Archival Management */}
      <ArchivalManagement className="mb-6" />
      
      <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Current Plan Section */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Plan</h2>
        
        {plan && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
              <p className="text-gray-600">
                {formatCurrency(plan.price)} per {plan.billingInterval}
              </p>
            </div>
            <div className="text-right">
              {subscription && (
                <>
                  <p className="text-sm text-gray-600">
                    Status: <span className="font-medium capitalize">{subscription.status}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {subscription.status === 'trial' && subscription.trialEnd
                      ? `Trial ends: ${formatDate(subscription.trialEnd)}`
                      : `Next billing: ${formatDate(subscription.currentPeriodEnd)}`
                    }
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Usage Meters */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Usage Overview</h4>
          
          {renderUsageMeter(
            'Active Tickets',
            usage.activeTickets,
            limitStatus.limits.activeTickets,
            limitStatus.percentageUsed.active
          )}
          
          {renderUsageMeter(
            'Completed Tickets',
            usage.completedTickets,
            limitStatus.limits.completedTickets,
            limitStatus.percentageUsed.completed
          )}
          
          {renderUsageMeter(
            'Total Tickets',
            usage.totalTickets,
            limitStatus.limits.totalTickets,
            limitStatus.percentageUsed.total
          )}
        </div>

        {/* Warning Messages */}
        {limitStatus.isAtLimit && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Limit Reached</p>
            <p className="text-sm mt-1">
              You've reached your plan limits. Upgrade to continue creating tickets.
            </p>
          </div>
        )}
        
        {limitStatus.isNearLimit && !limitStatus.isAtLimit && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
            <p className="font-medium">Approaching Limit</p>
            <p className="text-sm mt-1">
              You're approaching your plan limits. Consider upgrading soon.
            </p>
          </div>
        )}
      </div>

      {/* Plan Features */}
      {plan && plan.features && plan.features.length > 0 && (
        <div className="p-6 border-b border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-3">Plan Features</h4>
          <ul className="space-y-2">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upgrade Options */}
      {availablePlans.length > 0 && plan && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900">Upgrade Options</h4>
            <button
              onClick={() => setShowPlanComparison(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Compare All Plans
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availablePlans
              .filter(availablePlan => availablePlan.price > plan.price)
              .slice(0, 3) // Show only first 3 upgrade options
              .map(availablePlan => (
                <div key={availablePlan.id} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900">{availablePlan.name}</h5>
                  <p className="text-sm text-gray-600 mb-2">
                    {formatCurrency(availablePlan.price)} per {availablePlan.billingInterval}
                  </p>
                  <div className="text-xs text-gray-500 mb-3">
                    <p>Active: {availablePlan.limits.activeTickets === -1 ? 'Unlimited' : availablePlan.limits.activeTickets}</p>
                    <p>Completed: {availablePlan.limits.completedTickets === -1 ? 'Unlimited' : availablePlan.limits.completedTickets}</p>
                  </div>
                  <button
                    onClick={() => handleUpgradeClick(availablePlan)}
                    disabled={upgrading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                  >
                    {upgrading ? 'Processing...' : 'Upgrade'}
                  </button>
                </div>
              ))
            }
          </div>
          {availablePlans.filter(p => p.price > plan.price).length > 3 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowPlanComparison(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View {availablePlans.filter(p => p.price > plan.price).length - 3} more plans
              </button>
            </div>
          )}
        </div>
      )}

      {/* Billing Information Section */}
      {subscription && (
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-900">Billing Information</h4>
            <button
              onClick={() => setShowBillingInfo(!showBillingInfo)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showBillingInfo ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          
          {showBillingInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscription Status
                  </label>
                  <p className="text-sm text-gray-900 capitalize">{subscription.status}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Period
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                  </p>
                </div>
                
                {subscription.status === 'trial' && subscription.trialEnd && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trial Period
                    </label>
                    <p className="text-sm text-gray-900">
                      Ends {formatDate(subscription.trialEnd)}
                    </p>
                  </div>
                )}
                
                {subscription.paymentMethodId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-900">•••• •••• •••• {subscription.paymentMethodId.slice(-4)}</p>
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Update
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {subscription.cancelAtPeriodEnd && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
                  <p className="font-medium">Subscription Scheduled for Cancellation</p>
                  <p className="text-sm mt-1">
                    Your subscription will be cancelled at the end of the current billing period on {formatDate(subscription.currentPeriodEnd)}.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trial Management Section */}
      {subscription && subscription.status === 'trial' && (
        <div className="border-t border-gray-200">
          <TrialManagement
            subscriptionId={subscription.id}
            onTrialConverted={loadSubscriptionData}
            onTrialCancelled={loadSubscriptionData}
            className="p-6"
          />
        </div>
      )}
    </div>

    {/* Upgrade Confirmation Modal */}
    {showUpgradeModal && selectedUpgradePlan && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Confirm Plan Upgrade
          </h3>
          
          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Current Plan</h4>
              <p className="text-sm text-gray-600">
                {plan?.name} - {formatCurrency(plan?.price || 0)} per {plan?.billingInterval}
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">New Plan</h4>
              <p className="text-sm text-gray-600 mb-2">
                {selectedUpgradePlan.name} - {formatCurrency(selectedUpgradePlan.price)} per {selectedUpgradePlan.billingInterval}
              </p>
              <div className="text-xs text-gray-500">
                <p>Active Tickets: {selectedUpgradePlan.limits.activeTickets === -1 ? 'Unlimited' : selectedUpgradePlan.limits.activeTickets}</p>
                <p>Completed Tickets: {selectedUpgradePlan.limits.completedTickets === -1 ? 'Unlimited' : selectedUpgradePlan.limits.completedTickets}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="text-sm">
              <strong>Note:</strong> Your plan will be upgraded immediately and you'll be charged the prorated amount for the remainder of your current billing period.
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={cancelUpgrade}
              disabled={upgrading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmUpgrade}
              disabled={upgrading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              {upgrading ? 'Upgrading...' : 'Confirm Upgrade'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Plan Comparison Modal */}
    <PlanComparisonModal
      isOpen={showPlanComparison}
      onClose={() => setShowPlanComparison(false)}
      currentPlan={plan}
      availablePlans={availablePlans}
      onUpgrade={handleUpgradeClick}
      upgrading={upgrading}
    />
  </>
  );
};

export default SubscriptionManagement;