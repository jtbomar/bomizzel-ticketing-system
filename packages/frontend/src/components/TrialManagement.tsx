import React, { useState } from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { TrialStatus } from './TrialStatus';

interface TrialManagementProps {
  subscriptionId?: string;
  onTrialConverted?: () => void;
  onTrialCancelled?: () => void;
  className?: string;
}

interface ConvertTrialData {
  paymentMethodId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  sendWelcomeEmail?: boolean;
}

export const TrialManagement: React.FC<TrialManagementProps> = ({
  subscriptionId,
  onTrialConverted,
  onTrialCancelled,
  className = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleStartTrial = async (planSlug: string) => {
    try {
      setLoading(true);
      setError(null);

      await apiService.startTrial(planSlug, {
        sendWelcomeEmail: true,
      });

      setSuccess('Trial started successfully!');

      // Refresh the page or call a callback to update the UI
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start trial');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertTrial = async (paymentData: ConvertTrialData) => {
    if (!subscriptionId) return;

    try {
      setLoading(true);
      setError(null);

      await apiService.convertTrial(subscriptionId, paymentData);

      setSuccess('Trial converted to paid subscription successfully!');
      setShowConvertModal(false);

      if (onTrialConverted) {
        onTrialConverted();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to convert trial');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTrial = async () => {
    if (!subscriptionId) return;

    try {
      setLoading(true);
      setError(null);

      await apiService.cancelTrial(subscriptionId, cancelReason || 'No reason provided');

      setSuccess('Trial cancelled successfully');
      setShowCancelConfirm(false);
      setCancelReason('');

      if (onTrialCancelled) {
        onTrialCancelled();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel trial');
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
            <button onClick={clearMessages} className="text-red-500 hover:text-red-700">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-green-700 text-sm">{success}</span>
            </div>
            <button onClick={clearMessages} className="text-green-500 hover:text-green-700">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Trial Status Display */}
      {subscriptionId && (
        <TrialStatus
          subscriptionId={subscriptionId}
          onUpgradeClick={() => setShowConvertModal(true)}
        />
      )}

      {/* Trial Actions */}
      {subscriptionId && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Trial Management</h3>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowConvertModal(true)}
              disabled={loading}
              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowUpIcon className="h-4 w-4 mr-2" />
              Convert to Paid
            </button>

            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
              className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Cancel Trial
            </button>
          </div>
        </div>
      )}

      {/* Start Trial Options (if no subscription) */}
      {!subscriptionId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Start Your Free Trial</h3>
          <p className="text-gray-600 mb-6">
            Try any of our premium plans for 14 days, completely free. No credit card required.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {['starter', 'professional', 'business'].map((plan) => (
              <button
                key={plan}
                onClick={() => handleStartTrial(plan)}
                disabled={loading}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <h4 className="font-medium text-gray-900 capitalize">{plan}</h4>
                <p className="text-sm text-gray-600 mt-1">Start 14-day free trial</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Convert Trial Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Convert Trial to Paid Subscription
            </h3>

            <p className="text-gray-600 mb-6">
              To convert your trial to a paid subscription, you'll need to provide payment
              information. This will activate your monthly billing cycle.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-blue-800 text-sm font-medium">
                  Your trial benefits will continue uninterrupted
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  // This would typically integrate with Stripe or another payment processor
                  // For now, we'll simulate the conversion
                  handleConvertTrial({
                    paymentMethodId: 'pm_simulated',
                    sendWelcomeEmail: true,
                  });
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Converting...' : 'Add Payment & Convert'}
              </button>

              <button
                onClick={() => setShowConvertModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cancel Trial</h3>

            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel your trial? This action cannot be undone.
            </p>

            <div className="mb-4">
              <label
                htmlFor="cancelReason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reason for cancellation (optional)
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Help us improve by sharing why you're cancelling..."
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCancelTrial}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Cancelling...' : 'Yes, Cancel Trial'}
              </button>

              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  setCancelReason('');
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Keep Trial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrialManagement;
