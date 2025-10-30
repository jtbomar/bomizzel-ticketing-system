import React from 'react';
import { ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

export interface UsageWarningData {
  message: string;
  severity: 'info' | 'warning' | 'error';
  showUpgradePrompt: boolean;
  upgradeOptions?: string[];
}

interface UsageWarningProps {
  warning: UsageWarningData;
  onDismiss?: () => void;
  showDismiss?: boolean;
  className?: string;
}

const UsageWarning: React.FC<UsageWarningProps> = ({
  warning,
  onDismiss,
  showDismiss = false,
  className = ''
}) => {
  const getIcon = () => {
    switch (warning.severity) {
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />;
      case 'info':
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-400" />;
    }
  };

  const getBackgroundColor = () => {
    switch (warning.severity) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = () => {
    switch (warning.severity) {
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
      default:
        return 'text-blue-800';
    }
  };

  return (
    <div className={`rounded-md border p-4 ${getBackgroundColor()} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${getTextColor()}`}>
            {warning.message}
          </p>
          
          {warning.showUpgradePrompt && (
            <div className="mt-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  to="/pricing"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View Upgrade Options
                </Link>
                
                {warning.upgradeOptions && warning.upgradeOptions.length > 0 && (
                  <div className="text-xs text-gray-600 mt-1 sm:mt-0 sm:ml-2 flex items-center">
                    Available plans: {warning.upgradeOptions.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {showDismiss && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  warning.severity === 'error' 
                    ? 'text-red-500 hover:bg-red-100 focus:ring-red-500'
                    : warning.severity === 'warning'
                    ? 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-500'
                    : 'text-blue-500 hover:bg-blue-100 focus:ring-blue-500'
                }`}
              >
                <span className="sr-only">Dismiss</span>
                <XCircleIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsageWarning;