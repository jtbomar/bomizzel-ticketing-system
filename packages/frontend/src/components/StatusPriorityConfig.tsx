import React, { useState, useEffect } from 'react';

interface StatusOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
}

interface PriorityOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
}

interface StatusPriorityConfigProps {
  teamId: string;
  onSave?: () => void;
}

const AVAILABLE_COLORS = [
  { name: 'Red', value: 'red', preview: 'bg-red-100 text-red-800 border-red-200' },
  { name: 'Orange', value: 'orange', preview: 'bg-orange-100 text-orange-800 border-orange-200' },
  { name: 'Yellow', value: 'yellow', preview: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { name: 'Green', value: 'green', preview: 'bg-green-100 text-green-800 border-green-200' },
  { name: 'Blue', value: 'blue', preview: 'bg-blue-100 text-blue-800 border-blue-200' },
  { name: 'Purple', value: 'purple', preview: 'bg-purple-100 text-purple-800 border-purple-200' },
  { name: 'Pink', value: 'pink', preview: 'bg-pink-100 text-pink-800 border-pink-200' },
  { name: 'Teal', value: 'teal', preview: 'bg-teal-100 text-teal-800 border-teal-200' },
  { name: 'Indigo', value: 'indigo', preview: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { name: 'Gray', value: 'gray', preview: 'bg-gray-100 text-gray-800 border-gray-200' },
];

const StatusPriorityConfig: React.FC<StatusPriorityConfigProps> = ({ teamId, onSave }) => {
  const [statuses, setStatuses] = useState<StatusOption[]>([
    { id: '1', label: 'Open', value: 'open', color: 'red', order: 1, isActive: true },
    {
      id: '2',
      label: 'In Progress',
      value: 'in_progress',
      color: 'yellow',
      order: 2,
      isActive: true,
    },
    { id: '3', label: 'Waiting', value: 'waiting', color: 'purple', order: 3, isActive: true },
    { id: '4', label: 'Testing', value: 'testing', color: 'orange', order: 4, isActive: true },
    { id: '5', label: 'Review', value: 'review', color: 'blue', order: 5, isActive: true },
    { id: '6', label: 'Resolved', value: 'resolved', color: 'green', order: 6, isActive: true },
  ]);

  const [priorities, setPriorities] = useState<PriorityOption[]>([
    { id: '1', label: 'Critical', value: 'critical', color: 'purple', order: 1, isActive: true },
    { id: '2', label: 'High', value: 'high', color: 'red', order: 2, isActive: true },
    { id: '3', label: 'Medium', value: 'medium', color: 'yellow', order: 3, isActive: true },
    { id: '4', label: 'Low', value: 'low', color: 'green', order: 4, isActive: true },
  ]);

  const [activeTab, setActiveTab] = useState<'statuses' | 'priorities'>('statuses');
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddPriority, setShowAddPriority] = useState(false);

  // Load configuration from localStorage (in production, this would be from API)
  useEffect(() => {
    const savedStatuses = localStorage.getItem(`team-${teamId}-statuses`);
    const savedPriorities = localStorage.getItem(`team-${teamId}-priorities`);

    if (savedStatuses) {
      try {
        setStatuses(JSON.parse(savedStatuses));
      } catch (error) {
        console.error('Error loading saved statuses:', error);
      }
    }

    if (savedPriorities) {
      try {
        setPriorities(JSON.parse(savedPriorities));
      } catch (error) {
        console.error('Error loading saved priorities:', error);
      }
    }
  }, [teamId]);

  const saveConfiguration = () => {
    // Save to localStorage (in production, this would be API call)
    localStorage.setItem(`team-${teamId}-statuses`, JSON.stringify(statuses));
    localStorage.setItem(`team-${teamId}-priorities`, JSON.stringify(priorities));

    if (onSave) {
      onSave();
    }

    // Show success message
    alert('Configuration saved successfully!');
  };

  const addNewStatus = () => {
    const newStatus: StatusOption = {
      id: Date.now().toString(),
      label: 'New Status',
      value: 'new_status',
      color: 'gray',
      order: statuses.length + 1,
      isActive: true,
    };
    setStatuses([...statuses, newStatus]);
    setShowAddStatus(false);
  };

  const addNewPriority = () => {
    const newPriority: PriorityOption = {
      id: Date.now().toString(),
      label: 'New Priority',
      value: 'new_priority',
      color: 'gray',
      order: priorities.length + 1,
      isActive: true,
    };
    setPriorities([...priorities, newPriority]);
    setShowAddPriority(false);
  };

  const updateStatus = (id: string, updates: Partial<StatusOption>) => {
    setStatuses(statuses.map((status) => (status.id === id ? { ...status, ...updates } : status)));
  };

  const updatePriority = (id: string, updates: Partial<PriorityOption>) => {
    setPriorities(
      priorities.map((priority) => (priority.id === id ? { ...priority, ...updates } : priority))
    );
  };

  const deleteStatus = (id: string) => {
    if (statuses.filter((s) => s.isActive).length <= 1) {
      alert('You must have at least one active status');
      return;
    }
    setStatuses(statuses.filter((status) => status.id !== id));
  };

  const deletePriority = (id: string) => {
    setPriorities(priorities.filter((priority) => priority.id !== id));
  };

  const moveStatus = (id: string, direction: 'up' | 'down') => {
    const index = statuses.findIndex((s) => s.id === id);
    if (index === -1) return;

    const newStatuses = [...statuses];
    if (direction === 'up' && index > 0) {
      [newStatuses[index], newStatuses[index - 1]] = [newStatuses[index - 1], newStatuses[index]];
    } else if (direction === 'down' && index < newStatuses.length - 1) {
      [newStatuses[index], newStatuses[index + 1]] = [newStatuses[index + 1], newStatuses[index]];
    }

    // Update order numbers
    newStatuses.forEach((status, idx) => {
      status.order = idx + 1;
    });

    setStatuses(newStatuses);
  };

  const movePriority = (id: string, direction: 'up' | 'down') => {
    const index = priorities.findIndex((p) => p.id === id);
    if (index === -1) return;

    const newPriorities = [...priorities];
    if (direction === 'up' && index > 0) {
      [newPriorities[index], newPriorities[index - 1]] = [
        newPriorities[index - 1],
        newPriorities[index],
      ];
    } else if (direction === 'down' && index < newPriorities.length - 1) {
      [newPriorities[index], newPriorities[index + 1]] = [
        newPriorities[index + 1],
        newPriorities[index],
      ];
    }

    // Update order numbers
    newPriorities.forEach((priority, idx) => {
      priority.order = idx + 1;
    });

    setPriorities(newPriorities);
  };

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
      orange:
        'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
      yellow:
        'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
      green:
        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
      blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
      purple:
        'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
      pink: 'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-700',
      teal: 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700',
      indigo:
        'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600',
    };
    return colorMap[color] || colorMap.gray;
  };

  const renderStatusList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Ticket Statuses</h3>
        <button
          onClick={() => setShowAddStatus(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span>Add Status</span>
        </button>
      </div>

      <div className="space-y-3">
        {statuses.map((status, index) => (
          <div
            key={status.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                {/* Preview */}
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${getColorClasses(status.color)}`}
                >
                  {status.label}
                </div>

                {/* Edit Fields */}
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={status.label}
                      onChange={(e) => updateStatus(status.id, { label: e.target.value })}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Value
                    </label>
                    <input
                      type="text"
                      value={status.value}
                      onChange={(e) =>
                        updateStatus(status.id, {
                          value: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                        })
                      }
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Color
                    </label>
                    <select
                      value={status.color}
                      onChange={(e) => updateStatus(status.id, { color: e.target.value })}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                    >
                      {AVAILABLE_COLORS.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => moveStatus(status.id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveStatus(status.id, 'down')}
                  disabled={index === statuses.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => updateStatus(status.id, { isActive: !status.isActive })}
                  className={`p-1 ${status.isActive ? 'text-green-600' : 'text-gray-400'}`}
                  title={status.isActive ? 'Disable' : 'Enable'}
                >
                  {status.isActive ? '✓' : '○'}
                </button>
                <button
                  onClick={() => deleteStatus(status.id)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPriorityList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Ticket Priorities</h3>
        <button
          onClick={() => setShowAddPriority(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span>Add Priority</span>
        </button>
      </div>

      <div className="space-y-3">
        {priorities.map((priority, index) => (
          <div
            key={priority.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                {/* Preview */}
                <div
                  className={`px-3 py-1 rounded text-sm font-medium text-${priority.color}-600 dark:text-${priority.color}-400`}
                >
                  {priority.label}
                </div>

                {/* Edit Fields */}
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={priority.label}
                      onChange={(e) => updatePriority(priority.id, { label: e.target.value })}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Value
                    </label>
                    <input
                      type="text"
                      value={priority.value}
                      onChange={(e) =>
                        updatePriority(priority.id, {
                          value: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                        })
                      }
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Color
                    </label>
                    <select
                      value={priority.color}
                      onChange={(e) => updatePriority(priority.id, { color: e.target.value })}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                    >
                      {AVAILABLE_COLORS.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => movePriority(priority.id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => movePriority(priority.id, 'down')}
                  disabled={index === priorities.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => updatePriority(priority.id, { isActive: !priority.isActive })}
                  className={`p-1 ${priority.isActive ? 'text-green-600' : 'text-gray-400'}`}
                  title={priority.isActive ? 'Disable' : 'Enable'}
                >
                  {priority.isActive ? '✓' : '○'}
                </button>
                <button
                  onClick={() => deletePriority(priority.id)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Status & Priority Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configure ticket statuses and priorities for your team
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('statuses')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'statuses'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Statuses ({statuses.filter((s) => s.isActive).length})
            </button>
            <button
              onClick={() => setActiveTab('priorities')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'priorities'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Priorities ({priorities.filter((p) => p.isActive).length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="mb-8">
          {activeTab === 'statuses' ? renderStatusList() : renderPriorityList()}
        </div>

        {/* Save Button */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={saveConfiguration}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Save Configuration
          </button>
        </div>

        {/* Add Status Modal */}
        {showAddStatus && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Add New Status
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                A new status will be added with default settings. You can customize it after
                creation.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddStatus(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={addNewStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Status
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Priority Modal */}
        {showAddPriority && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Add New Priority
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                A new priority will be added with default settings. You can customize it after
                creation.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddPriority(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={addNewPriority}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Priority
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusPriorityConfig;
