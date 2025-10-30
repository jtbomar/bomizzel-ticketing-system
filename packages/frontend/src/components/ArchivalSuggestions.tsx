import React, { useState, useEffect } from 'react';
import { 
  ExclamationTriangleIcon, 
  ArchiveBoxIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { api } from '../services/api';

interface ArchivalSuggestion {
  ticketId: string;
  title: string;
  status: string;
  completedAt: Date;
  daysSinceCompletion: number;
  priority: 'high' | 'medium' | 'low';
}

interface ArchivalSuggestionsData {
  shouldSuggestArchival: boolean;
  reason: string;
  suggestions: ArchivalSuggestion[];
  usageInfo: {
    current: number;
    limit: number;
    percentage: number;
  };
  automationAvailable: boolean;
  automationConfig?: {
    enabled: boolean;
    daysAfterCompletion: number;
    nextRunDate?: Date;
  };
}

// Helper functions
const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high': return 'text-red-600 bg-red-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'low': return 'text-green-600 bg-green-50';
  }
};

const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high': return <ExclamationTriangleIcon className="h-4 w-4" />;
    case 'medium': return <ClockIcon className="h-4 w-4" />;
    case 'low': return <CheckCircleIcon className="h-4 w-4" />;
  }
};

export const ArchivalSuggestions: React.FC = () => {
  const [suggestionsData, setSuggestionsData] = useState<ArchivalSuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [showAutomationConfig, setShowAutomationConfig] = useState(false);
  const [automationConfig, setAutomationConfig] = useState({
    enabled: true,
    daysAfterCompletion: 30,
    maxTicketsPerRun: 50
  });
  const [configuringAutomation, setConfiguringAutomation] = useState(false);
  const [triggeringImmediate, setTriggeringImmediate] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tickets/archive/auto-suggestions');
      setSuggestionsData(response.data.data);
    } catch (error) {
      console.error('Error fetching archival suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveTicket = async (ticketId: string) => {
    try {
      setArchiving(prev => new Set(prev).add(ticketId));
      await api.post(`/tickets/${ticketId}/archive`);
      
      // Remove the archived ticket from suggestions
      setSuggestionsData(prev => prev ? {
        ...prev,
        suggestions: prev.suggestions.filter(s => s.ticketId !== ticketId)
      } : null);
    } catch (error) {
      console.error('Error archiving ticket:', error);
    } finally {
      setArchiving(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticketId);
        return newSet;
      });
    }
  };

  const handleBulkArchive = async (ticketIds: string[]) => {
    try {
      setArchiving(new Set(ticketIds));
      await api.post('/tickets/archive/bulk', { ticketIds });
      
      // Remove all archived tickets from suggestions
      setSuggestionsData(prev => prev ? {
        ...prev,
        suggestions: prev.suggestions.filter(s => !ticketIds.includes(s.ticketId))
      } : null);
    } catch (error) {
      console.error('Error bulk archiving tickets:', error);
    } finally {
      setArchiving(new Set());
    }
  };

  const handleConfigureAutomation = async () => {
    try {
      setConfiguringAutomation(true);
      await api.post('/tickets/archive/auto-config', automationConfig);
      
      // Refresh suggestions to get updated automation config
      await fetchSuggestions();
      setShowAutomationConfig(false);
    } catch (error) {
      console.error('Error configuring automation:', error);
    } finally {
      setConfiguringAutomation(false);
    }
  };

  const handleTriggerImmediate = async () => {
    try {
      setTriggeringImmediate(true);
      const response = await api.post('/tickets/archive/trigger-immediate', {
        daysAfterCompletion: automationConfig.daysAfterCompletion,
        maxTickets: automationConfig.maxTicketsPerRun
      });
      
      // Refresh suggestions after immediate archival
      await fetchSuggestions();
      
      // Show success message
      alert(`Successfully archived ${response.data.data.archivedCount} tickets`);
    } catch (error) {
      console.error('Error triggering immediate archival:', error);
      alert('Failed to trigger immediate archival');
    } finally {
      setTriggeringImmediate(false);
    }
  };



  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!suggestionsData || !suggestionsData.shouldSuggestArchival || dismissed) {
    return null;
  }

  const { suggestions, reason, usageInfo, automationAvailable, automationConfig: serverAutomationConfig } = suggestionsData;
  const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');
  const otherSuggestions = suggestions.filter(s => s.priority !== 'high');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <ArchiveBoxIcon className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Archival Suggestions
              </h3>
              <p className="text-sm text-gray-600 mt-1">{reason}</p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Usage Info */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Completed Tickets Usage:</span>
            <span className="font-medium">
              {usageInfo.current} / {usageInfo.limit === -1 ? '∞' : usageInfo.limit}
              {usageInfo.limit !== -1 && (
                <span className="text-gray-500 ml-1">
                  ({Math.round(usageInfo.percentage)}%)
                </span>
              )}
            </span>
          </div>
          {usageInfo.limit !== -1 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    usageInfo.percentage >= 95 ? 'bg-red-500' :
                    usageInfo.percentage >= 85 ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(usageInfo.percentage, 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* High Priority Suggestions */}
        {highPrioritySuggestions.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-red-600 flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                High Priority ({highPrioritySuggestions.length})
              </h4>
              <button
                onClick={() => handleBulkArchive(highPrioritySuggestions.map(s => s.ticketId))}
                disabled={archiving.size > 0}
                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
              >
                Archive All High Priority
              </button>
            </div>
            <div className="space-y-2">
              {highPrioritySuggestions.slice(0, 5).map((suggestion) => (
                <SuggestionItem
                  key={suggestion.ticketId}
                  suggestion={suggestion}
                  onArchive={handleArchiveTicket}
                  isArchiving={archiving.has(suggestion.ticketId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other Suggestions */}
        {otherSuggestions.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">
                Other Suggestions ({otherSuggestions.length})
              </h4>
              <button
                onClick={() => handleBulkArchive(otherSuggestions.slice(0, 10).map(s => s.ticketId))}
                disabled={archiving.size > 0}
                className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Archive Next 10
              </button>
            </div>
            <div className="space-y-2">
              {otherSuggestions.slice(0, 10).map((suggestion) => (
                <SuggestionItem
                  key={suggestion.ticketId}
                  suggestion={suggestion}
                  onArchive={handleArchiveTicket}
                  isArchiving={archiving.has(suggestion.ticketId)}
                />
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 15 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Showing top 15 suggestions. {suggestions.length - 15} more available.
            </p>
          </div>
        )}

        {/* Enterprise Automation Section */}
        {automationAvailable && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <h4 className="text-sm font-medium text-gray-900">
                  Enterprise Automation
                </h4>
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Available
                </span>
              </div>
              <button
                onClick={() => setShowAutomationConfig(!showAutomationConfig)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showAutomationConfig ? 'Hide Settings' : 'Configure'}
              </button>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                <div className="flex-1">
                  <p className="text-sm text-blue-800 font-medium">
                    Automatic Archival {serverAutomationConfig?.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {serverAutomationConfig?.enabled 
                      ? `Tickets older than ${serverAutomationConfig.daysAfterCompletion} days will be automatically archived`
                      : 'Configure automatic archival to manage your tickets effortlessly'
                    }
                  </p>
                  {serverAutomationConfig?.nextRunDate && (
                    <p className="text-xs text-blue-600 mt-1">
                      Next run: {new Date(serverAutomationConfig.nextRunDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleTriggerImmediate}
                disabled={triggeringImmediate}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              >
                {triggeringImmediate ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <ArchiveBoxIcon className="h-4 w-4 mr-2" />
                    Archive Now
                  </>
                )}
              </button>
              <button
                onClick={() => setShowAutomationConfig(true)}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Settings
              </button>
            </div>

            {/* Automation Configuration Modal */}
            {showAutomationConfig && (
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
                          checked={automationConfig.enabled}
                          onChange={(e) => setAutomationConfig(prev => ({
                            ...prev,
                            enabled: e.target.checked
                          }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Enable automatic archival
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Archive tickets after (days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={automationConfig.daysAfterCompletion}
                        onChange={(e) => setAutomationConfig(prev => ({
                          ...prev,
                          daysAfterCompletion: parseInt(e.target.value) || 30
                        }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum tickets per run
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={automationConfig.maxTicketsPerRun}
                        onChange={(e) => setAutomationConfig(prev => ({
                          ...prev,
                          maxTicketsPerRun: parseInt(e.target.value) || 50
                        }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setShowAutomationConfig(false)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfigureAutomation}
                      disabled={configuringAutomation}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
                    >
                      {configuringAutomation ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface SuggestionItemProps {
  suggestion: ArchivalSuggestion;
  onArchive: (ticketId: string) => void;
  isArchiving: boolean;
}

const SuggestionItem: React.FC<SuggestionItemProps> = ({
  suggestion,
  onArchive,
  isArchiving
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 ${
            getPriorityColor(suggestion.priority)
          }`}>
            {getPriorityIcon(suggestion.priority)}
            <span className="ml-1 capitalize">{suggestion.priority}</span>
          </span>
          <h5 className="text-sm font-medium text-gray-900 truncate">
            {suggestion.title}
          </h5>
        </div>
        <div className="mt-1 flex items-center text-xs text-gray-500">
          <span className="capitalize">{suggestion.status}</span>
          <span className="mx-2">•</span>
          <span>Completed {suggestion.daysSinceCompletion} days ago</span>
        </div>
      </div>
      <button
        onClick={() => onArchive(suggestion.ticketId)}
        disabled={isArchiving}
        className="ml-4 text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
      >
        {isArchiving ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
            Archiving...
          </>
        ) : (
          <>
            <ArchiveBoxIcon className="h-3 w-3 mr-1" />
            Archive
          </>
        )}
      </button>
    </div>
  );
};

