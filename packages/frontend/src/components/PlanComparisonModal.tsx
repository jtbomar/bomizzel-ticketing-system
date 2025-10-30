import React from 'react';
import { SubscriptionPlan } from '../types';

interface PlanComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: SubscriptionPlan | null;
  availablePlans: SubscriptionPlan[];
  onUpgrade: (plan: SubscriptionPlan) => void;
  upgrading: boolean;
}

const PlanComparisonModal: React.FC<PlanComparisonModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  availablePlans,
  onUpgrade,
  upgrading
}) => {
  if (!isOpen) return null;

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatLimit = (limit: number) => {
    return limit === -1 ? 'Unlimited' : limit.toLocaleString();
  };

  // Get all plans including current plan for comparison
  const allPlans = currentPlan 
    ? [currentPlan, ...availablePlans.filter(p => p.id !== currentPlan.id)]
    : availablePlans;

  // Sort plans by price
  const sortedPlans = allPlans.sort((a, b) => a.price - b.price);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">Compare Plans</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sortedPlans.map((plan) => {
              const isCurrentPlan = currentPlan?.id === plan.id;
              const canUpgrade = currentPlan && plan.price > currentPlan.price;
              
              return (
                <div
                  key={plan.id}
                  className={`border rounded-lg p-6 relative ${
                    isCurrentPlan 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">
                        {formatCurrency(plan.price)}
                      </span>
                      <span className="text-gray-600">/{plan.billingInterval}</span>
                    </div>
                    {plan.description && (
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    )}
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Ticket Limits</h4>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li className="flex justify-between">
                          <span>Active Tickets:</span>
                          <span className="font-medium">{formatLimit(plan.limits.activeTickets)}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Completed Tickets:</span>
                          <span className="font-medium">{formatLimit(plan.limits.completedTickets)}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Total Tickets:</span>
                          <span className="font-medium">{formatLimit(plan.limits.totalTickets)}</span>
                        </li>
                      </ul>
                    </div>

                    {plan.features && plan.features.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Features</h4>
                        <ul className="space-y-1">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start text-sm text-gray-600">
                              <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {plan.trialDays > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">Trial Period</h4>
                        <p className="text-sm text-gray-600">{plan.trialDays} days free trial</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto">
                    {isCurrentPlan ? (
                      <div className="w-full bg-gray-100 text-gray-500 text-center py-2 px-4 rounded font-medium">
                        Current Plan
                      </div>
                    ) : canUpgrade ? (
                      <button
                        onClick={() => onUpgrade(plan)}
                        disabled={upgrading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
                      >
                        {upgrading ? 'Processing...' : 'Upgrade'}
                      </button>
                    ) : (
                      <div className="w-full bg-gray-100 text-gray-500 text-center py-2 px-4 rounded font-medium">
                        {plan.price < (currentPlan?.price || 0) ? 'Downgrade' : 'Not Available'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Need help choosing?</h3>
            <p className="text-sm text-gray-600 mb-3">
              All plans include full access to our ticketing system with real-time updates, 
              file attachments, and email integration. Higher tiers provide more capacity 
              and advanced features for growing teams.
            </p>
            <div className="text-xs text-gray-500">
              <p>• Upgrades take effect immediately with prorated billing</p>
              <p>• All data and settings are preserved during plan changes</p>
              <p>• Cancel anytime with no long-term commitments</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanComparisonModal;