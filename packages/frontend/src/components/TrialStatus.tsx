import React, { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

interface TrialStatusData {
  isInTrial: boolean;
  trialStart?: string;
  trialEnd?: string;
  daysRemaining?: number;
  hoursRemaining?: number;
  hasExpired?: boolean;
  canConvert?: boolean;
  canExtend?: boolean;
}

interface TrialStatusProps {
  subscriptionId?: string;
  onUpgradeClick?: () => void;
  className?: string;
}

export const TrialStatus: React.FC<TrialStatusProps> = ({
  subscriptionId,
  onUpgradeClick,
  className = '',
}) => {
  const [trialStatus, setTrialStatus] = useState<TrialStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subscriptionId) {
      fetchTrialStatus();
    } else {
      setLoading(false);
    }
  }, [subscriptionId]);

  const fetchTrialStatus = async () => {
    if (!subscriptionId) return;

    try {
      setLoading(true);
      const response = await apiService.getTrialStatus(subscriptionId);
      setTrialStatus(response.data.data.trialStatus);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch trial status');
      console.error('Error fetching trial status:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!trialStatus?.isInTrial) return 'gray';
    if (trialStatus.hasExpired) return 'red';
    if (trialStatus.daysRemaining && trialStatus.daysRemaining <= 1) return 'red';
    if (trialStatus.daysRemaining && trialStatus.daysRemaining <= 3) return 'yellow';
    return 'green';
  };

  const getStatusIcon = () => {
    const color = getStatusColor();
    const iconClass = `h-5 w-5 ${
      color === 'red'
        ? 'text-red-500'
        : color === 'yellow'
          ? 'text-yellow-500'
          : color === 'green'
            ? 'text-green-500'
            : 'text-gray-500'
    }`;

    if (!trialStatus?.isInTrial) {
      return <CheckCircleIcon className={iconClass} />;
    }

    if (trialStatus.hasExpired || (trialStatus.daysRemaining && trialStatus.daysRemaining <= 1)) {
      return <ExclamationTriangleIcon className={iconClass} />;
    }

    return <ClockIcon className={iconClass} />;
  };

  const getStatusMessage = () => {
    if (!trialStatus?.isInTrial) {
      return 'Not in trial';
    }

    if (trialStatus.hasExpired) {
      return 'Trial has expired';
    }

    if (trialStatus.daysRemaining === 0) {
      return `Trial expires in ${trialStatus.hoursRemaining} hours`;
    }

    if (trialStatus.daysRemaining === 1) {
      return 'Trial expires tomorrow';
    }

    return `${trialStatus.daysRemaining} days remaining`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="bg-gray-200 rounded-lg p-4">
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!trialStatus?.isInTrial) {
    return null; // Don't show anything if not in trial
  }

  const statusColor = getStatusColor();
  const bgColor =
    statusColor === 'red'
      ? 'bg-red-50 border-red-200'
      : statusColor === 'yellow'
        ? 'bg-yellow-50 border-yellow-200'
        : statusColor === 'green'
          ? 'bg-green-50 border-green-200'
          : 'bg-gray-50 border-gray-200';

  const textColor =
    statusColor === 'red'
      ? 'text-red-800'
      : statusColor === 'yellow'
        ? 'text-yellow-800'
        : statusColor === 'green'
          ? 'text-green-800'
          : 'text-gray-800';

  return (
    <div className={`border rounded-lg p-4 ${bgColor} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          {getStatusIcon()}
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${textColor}`}>Trial Status</h3>
            <p className={`text-sm ${textColor} opacity-90`}>{getStatusMessage()}</p>
            {trialStatus.trialEnd && (
              <p className={`text-xs ${textColor} opacity-75 mt-1`}>
                Ends on {formatDate(trialStatus.trialEnd)}
              </p>
            )}
          </div>
        </div>

        {trialStatus.canConvert && onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusColor === 'red'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : statusColor === 'yellow'
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Upgrade Now
          </button>
        )}
      </div>

      {/* Progress bar for visual representation */}
      {trialStatus.daysRemaining !== undefined && trialStatus.daysRemaining >= 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className={`${textColor} opacity-75`}>Trial Progress</span>
            <span className={`${textColor} opacity-75`}>
              {Math.max(0, trialStatus.daysRemaining)} days left
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                statusColor === 'red'
                  ? 'bg-red-500'
                  : statusColor === 'yellow'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{
                width: `${Math.max(5, Math.min(100, ((14 - Math.max(0, trialStatus.daysRemaining)) / 14) * 100))}%`,
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Urgent call-to-action for expiring trials */}
      {trialStatus.daysRemaining !== undefined &&
        trialStatus.daysRemaining <= 1 &&
        trialStatus.canConvert && (
          <div className="mt-3 p-3 bg-white rounded-md border border-red-200">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mr-2" />
              <span className="text-sm text-red-800 font-medium">
                Don't lose access to premium features!
              </span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              Upgrade now to continue with unlimited access.
            </p>
          </div>
        )}
    </div>
  );
};

export default TrialStatus;
