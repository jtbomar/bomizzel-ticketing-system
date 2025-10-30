import React, { useState, useEffect } from 'react';
import { 
  ArchiveBoxIcon,
  Cog6ToothIcon,
  ClockIcon,
  ChartBarIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import { api } from '../services/api';

interface ArchivalStats {
  totalArchived: number;
  archivedThisMonth: number;
  archivedThisYear: number;
  oldestArchived?: string;
  newestArchived?: string;
}

interface AutomationStatus {
  isRunning: boolean;
  nextRun?: string;
  lastRun?: string;
  lastRunResults?: {
    processedSubscriptions: number;
    totalTicketsArchived: number;
    errors: number;
  };
  available: boolean;
}

interface AutomationConfig {
  available: boolean;
  enabled: boolean;
  config?: {
    enabled: boolean;
    daysAfterCompletion: number;
    maxTicketsPerRun: number;
    onlyWhenApproachingLimits: boolean;
    limitThreshold: number;
  };
  planName?: string;
}

interface ArchivalManagementProps {
  className?: string;
}

const ArchivalManagement: React.FC<ArchivalManagementProps> = ({ className = '' }) => {
  const [stats, setStats] = useState<ArchivalStats | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    enabled: true,
    daysAfterCompletion: 30,
    maxTicketsPerRun: 50
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadArchivalData();
  }, []);

  const loadArchivalData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsResponse, statusResponse, configResponse] = await Promise.all([
        api.get('/tickets/archive/stats'),
        api.get('/tickets/archive/automation-status'),
        api.get('/tickets/archive/auto-config')
      ]);

      setStats(statsResponse.data.data);
      setAutomationStatus(statusResponse.data.data);
      setAutomationConfig(configResponse.data.data);

      if (configResponse.data.data.config) {
        setConfigForm({
          enabled: configResponse.data.data.config.enabled,
          daysAfterCompletion: configResponse.data.data.config.daysAfterCompletion,
          maxTicketsPerRun: configResponse.data.data.config.maxTicketsPerRun
        });
      }
    } catch (err: any) {
      console.error('Failed to load archival data:', err);
      setError(err.response?.data?.message || 'Failed to load archival information');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await api.post('/tickets/archive/auto-config', configForm);
      await loadArchivalData();
      setShowConfigModal(false);
    } catch (err: any) {
      console.error('Failed to save configuration:', err);
      alert(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerImmediate = async () => {
    try {
      const response = await api.post('/tickets/archive/trigger-immediate', {
        daysAfterCompletion: configForm.daysAfterCompletion,
        maxTickets: configForm.maxTicketsPerRun
      });
      
      alert(`Successfully archived ${response.data.data.archivedCount} tickets`);
      await loadArchivalData();
    } catch (err: any) {
      console.error('Failed to trigger immediate archival:', err);
      alert(err.response?.data?.message || 'Failed to trigger immediate archival');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <p className="font-medium">Error loading archival data</p>
          <p className="text-sm mt-1">{error}</p>
          <button 
            onClick={loadArchivalData}
            className="mt-3 text-sm bg-red-100 hover:bg-red-200 px-3 py-1 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`bg-white rounded-lg shadow ${className}`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ArchiveBoxIcon className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Archival Management
                </h3>
                <p className="text-sm text-gray-600">
                  Manage your ticket archival settings and view statistics
                </p>
              </div>
            </div>
            {automationConfig?.available && (
              <button
                onClick={() => setShowConfigModal(true)}
                className="flex items-center text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Cog6ToothIcon className="h-4 w-4 mr-1" />
                Configure
              </button>
            )}
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="p-6 border-b border-gray-200">
            <h4 className="text-md font-medium text-gray-900 mb-4">Archival Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-gray-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Total Archived</p>
                    <p className="text-lg font-semibold text-gray-900">{stats.totalArchived}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-lg font-semibold text-gray-900">{stats.archivedThisMonth}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <ChartBarIcon className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">This Year</p>
                    <p className="text-lg font-semibold text-gray-900">{stats.archivedThisYear}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Automation Status */}
        {automationConfig?.available && automationStatus && (
          <div className="p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Automation Status</h4>
            
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start">
                  {automationStatus.isRunning ? (
                    <PlayIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                  ) : (
                    <PauseIcon className="h-5 w-5 text-gray-600 mt-0.5 mr-3" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Automation {automationStatus.isRunning ? 'Active' : 'Inactive'}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {automationStatus.isRunning 
                        ? `Next run: ${formatDate(automationStatus.nextRun)}`
                        : 'Automation is currently disabled'
                      }
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  automationStatus.isRunning 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {automationStatus.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>

            {automationStatus.lastRunResults && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Last Run Results</h5>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Processed</p>
                    <p className="font-medium">{automationStatus.lastRunResults.processedSubscriptions} subscriptions</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Archived</p>
                    <p className="font-medium">{automationStatus.lastRunResults.totalTicketsArchived} tickets</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Errors</p>
                    <p className="font-medium">{automationStatus.lastRunResults.errors}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Last run: {formatDate(automationStatus.lastRun)}
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleTriggerImmediate}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Run Now
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        )}

        {/* Non-Enterprise Message */}
        {!automationConfig?.available && (
          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <ArchiveBoxIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Automatic Archival Not Available
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Upgrade to Enterprise plan to enable automatic ticket archival and advanced management features.
                  </p>
                  <p className="text-xs text-yellow-600 mt-2">
                    Current plan: {automationConfig?.planName || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configure Automatic Archival
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={configForm.enabled}
                    onChange={(e) => setConfigForm(prev => ({
                      ...prev,
                      enabled: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Enable automatic archival
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Automatically archive old completed tickets to free up space
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archive tickets after (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={configForm.daysAfterCompletion}
                  onChange={(e) => setConfigForm(prev => ({
                    ...prev,
                    daysAfterCompletion: parseInt(e.target.value) || 30
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tickets completed more than this many days ago will be archived
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum tickets per run
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={configForm.maxTicketsPerRun}
                  onChange={(e) => setConfigForm(prev => ({
                    ...prev,
                    maxTicketsPerRun: parseInt(e.target.value) || 50
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Limit the number of tickets archived in each automated run
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-800">
                <strong>Enterprise Feature:</strong> Automatic archival runs daily and helps maintain optimal performance by managing your ticket history.
              </p>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ArchivalManagement;