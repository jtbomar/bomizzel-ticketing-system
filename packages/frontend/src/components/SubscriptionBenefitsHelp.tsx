import React, { useState } from 'react';
import { QuestionMarkCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';

interface SubscriptionBenefitsHelpProps {
  currentPlan?: string;
  className?: string;
}

const SubscriptionBenefitsHelp: React.FC<SubscriptionBenefitsHelpProps> = ({
  currentPlan = 'Free',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const planBenefits = {
    Free: {
      tickets: '200 total tickets (100 active + 100 completed)',
      features: ['Basic ticket management', 'Email notifications', 'File attachments'],
    },
    Starter: {
      tickets: '1,000 total tickets',
      features: ['Everything in Free', 'Priority support', 'Custom fields', 'Basic reporting'],
    },
    Professional: {
      tickets: '10,000 total tickets',
      features: ['Everything in Starter', 'Advanced reporting', 'Team collaboration', 'API access'],
    },
    Business: {
      tickets: '50,000 total tickets',
      features: [
        'Everything in Professional',
        'Advanced analytics',
        'Custom integrations',
        'SLA management',
      ],
    },
    Enterprise: {
      tickets: 'Unlimited tickets',
      features: [
        'Everything in Business',
        'Dedicated support',
        'Custom deployment',
        'Advanced security',
      ],
    },
  };

  const upgradeReasons = [
    {
      title: 'Scale Your Operations',
      description: 'Handle more customer requests without worrying about limits',
    },
    {
      title: 'Advanced Features',
      description: 'Access powerful tools for team collaboration and reporting',
    },
    {
      title: 'Better Support',
      description: 'Get priority support and faster response times',
    },
    {
      title: 'Future-Proof',
      description: 'Grow your business without platform constraints',
    },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center text-sm text-blue-600 hover:text-blue-700 ${className}`}
      >
        <QuestionMarkCircleIcon className="h-4 w-4 mr-1" />
        Why upgrade?
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={() => setIsOpen(false)}
        />

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Subscription Benefits</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-500">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Current Plan Benefits */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Your Current Plan: {currentPlan}</h4>
              <p className="text-sm text-blue-800 mb-3">
                {planBenefits[currentPlan as keyof typeof planBenefits]?.tickets}
              </p>
              <ul className="space-y-1">
                {planBenefits[currentPlan as keyof typeof planBenefits]?.features.map(
                  (feature, index) => (
                    <li key={index} className="flex items-center text-sm text-blue-800">
                      <CheckIcon className="h-4 w-4 text-blue-600 mr-2" />
                      {feature}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Why Upgrade */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Why Upgrade?</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {upgradeReasons.map((reason, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <h5 className="font-medium text-gray-900 text-sm">{reason.title}</h5>
                    <p className="text-xs text-gray-600 mt-1">{reason.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Comparison */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Available Plans</h4>
              <div className="space-y-3">
                {Object.entries(planBenefits).map(([planName, benefits]) => {
                  if (planName === currentPlan) return null;

                  const isHigherTier =
                    ['Starter', 'Professional', 'Business', 'Enterprise'].indexOf(planName) >
                    ['Free', 'Starter', 'Professional', 'Business', 'Enterprise'].indexOf(
                      currentPlan
                    );

                  if (!isHigherTier) return null;

                  return (
                    <div key={planName} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900">{planName}</h5>
                        <span className="text-sm text-gray-600">{benefits.tickets}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {benefits.features.slice(0, 3).map((feature, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {feature}
                          </span>
                        ))}
                        {benefits.features.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            +{benefits.features.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to pricing page
                  window.location.href = '/pricing';
                }}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                View All Plans
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionBenefitsHelp;
