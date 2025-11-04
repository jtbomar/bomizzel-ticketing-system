import React, { useState, useEffect } from 'react';
import SimpleColorPicker from './SimpleColorPicker';

interface StatusOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
  isDefault: boolean; // Core statuses that cannot be deleted
}

interface PriorityOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
  isDefault: boolean; // Core priorities that cannot be deleted
}

const AVAILABLE_COLORS = [
  // Primary Colors
  {
    name: 'Red',
    value: 'red',
    bg: 'bg-red-500',
    preview: 'bg-red-100 text-red-800 border-red-200',
  },
  {
    name: 'Orange',
    value: 'orange',
    bg: 'bg-orange-500',
    preview: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    name: 'Yellow',
    value: 'yellow',
    bg: 'bg-yellow-500',
    preview: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  {
    name: 'Green',
    value: 'green',
    bg: 'bg-green-500',
    preview: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    name: 'Blue',
    value: 'blue',
    bg: 'bg-blue-500',
    preview: 'bg-blue-100 text-blue-800 border-blue-200',
  },

  // Secondary Colors
  {
    name: 'Purple',
    value: 'purple',
    bg: 'bg-purple-500',
    preview: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    name: 'Pink',
    value: 'pink',
    bg: 'bg-pink-500',
    preview: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  {
    name: 'Teal',
    value: 'teal',
    bg: 'bg-teal-500',
    preview: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  {
    name: 'Indigo',
    value: 'indigo',
    bg: 'bg-indigo-500',
    preview: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    name: 'Cyan',
    value: 'cyan',
    bg: 'bg-cyan-500',
    preview: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },

  // Extended Colors
  {
    name: 'Emerald',
    value: 'emerald',
    bg: 'bg-emerald-500',
    preview: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    name: 'Lime',
    value: 'lime',
    bg: 'bg-lime-500',
    preview: 'bg-lime-100 text-lime-800 border-lime-200',
  },
  {
    name: 'Amber',
    value: 'amber',
    bg: 'bg-amber-500',
    preview: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    name: 'Rose',
    value: 'rose',
    bg: 'bg-rose-500',
    preview: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    name: 'Violet',
    value: 'violet',
    bg: 'bg-violet-500',
    preview: 'bg-violet-100 text-violet-800 border-violet-200',
  },

  // Neutral Colors
  {
    name: 'Slate',
    value: 'slate',
    bg: 'bg-slate-500',
    preview: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  {
    name: 'Gray',
    value: 'gray',
    bg: 'bg-gray-500',
    preview: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  {
    name: 'Zinc',
    value: 'zinc',
    bg: 'bg-zinc-500',
    preview: 'bg-zinc-100 text-zinc-800 border-zinc-200',
  },
  {
    name: 'Stone',
    value: 'stone',
    bg: 'bg-stone-500',
    preview: 'bg-stone-100 text-stone-800 border-stone-200',
  },
  {
    name: 'Neutral',
    value: 'neutral',
    bg: 'bg-neutral-500',
    preview: 'bg-neutral-100 text-neutral-800 border-neutral-200',
  },
];

const AdminStatusConfig: React.FC = () => {
  // Default core statuses (cannot be deleted)
  const [statuses, setStatuses] = useState<StatusOption[]>([
    {
      id: '1',
      label: 'Open',
      value: 'open',
      color: 'red',
      order: 1,
      isActive: true,
      isDefault: true,
    },
    {
      id: '2',
      label: 'In Progress',
      value: 'in_progress',
      color: 'yellow',
      order: 2,
      isActive: true,
      isDefault: true,
    },
    {
      id: '3',
      label: 'Review',
      value: 'review',
      color: 'blue',
      order: 3,
      isActive: true,
      isDefault: true,
    },
    {
      id: '4',
      label: 'Resolved',
      value: 'resolved',
      color: 'green',
      order: 4,
      isActive: true,
      isDefault: true,
    },
  ]);

  // Default core priorities (cannot be deleted)
  const [priorities, setPriorities] = useState<PriorityOption[]>([
    {
      id: '1',
      label: 'Low',
      value: 'low',
      color: 'green',
      order: 1,
      isActive: true,
      isDefault: true,
    },
    {
      id: '2',
      label: 'Medium',
      value: 'medium',
      color: 'yellow',
      order: 2,
      isActive: true,
      isDefault: true,
    },
    {
      id: '3',
      label: 'High',
      value: 'high',
      color: 'red',
      order: 3,
      isActive: true,
      isDefault: true,
    },
    {
      id: '4',
      label: 'Critical',
      value: 'critical',
      color: 'purple',
      order: 4,
      isActive: true,
      isDefault: true,
    },
  ]);

  const [activeTab, setActiveTab] = useState<'statuses' | 'priorities'>('statuses');
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('gray');
  const [newPriorityLabel, setNewPriorityLabel] = useState('');
  const [newPriorityColor, setNewPriorityColor] = useState('gray');

  // Load from localStorage on mount
  useEffect(() => {
    const savedStatuses = localStorage.getItem('admin-statuses');
    const savedPriorities = localStorage.getItem('admin-priorities');

    if (savedStatuses) {
      try {
        setStatuses(JSON.parse(savedStatuses));
      } catch (error) {
        console.error('Error loading statuses:', error);
      }
    }

    if (savedPriorities) {
      try {
        setPriorities(JSON.parse(savedPriorities));
      } catch (error) {
        console.error('Error loading priorities:', error);
      }
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('admin-statuses', JSON.stringify(statuses));
  }, [statuses]);

  useEffect(() => {
    localStorage.setItem('admin-priorities', JSON.stringify(priorities));
  }, [priorities]);

  const getColorClass = (color: string) => {
    const colorObj = AVAILABLE_COLORS.find((c) => c.value === color);
    if (colorObj) {
      return colorObj.preview;
    }

    // Handle custom colors
    if (color.startsWith('custom-')) {
      return 'bg-gray-100 text-gray-800 border-gray-200'; // Fallback for custom colors
    }

    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Use the SimpleColorPicker component directly
  const ColorPicker = SimpleColorPicker;

  const addNewStatus = () => {
    if (!newStatusLabel.trim()) return;

    const newStatus: StatusOption = {
      id: Date.now().toString(),
      label: newStatusLabel.trim(),
      value: newStatusLabel.toLowerCase().replace(/\s+/g, '_'),
      color: newStatusColor,
      order: statuses.length + 1,
      isActive: true,
      isDefault: false,
    };

    setStatuses([...statuses, newStatus]);
    setNewStatusLabel('');
    setNewStatusColor('gray');
  };

  const addNewPriority = () => {
    if (!newPriorityLabel.trim()) return;

    const newPriority: PriorityOption = {
      id: Date.now().toString(),
      label: newPriorityLabel.trim(),
      value: newPriorityLabel.toLowerCase().replace(/\s+/g, '_'),
      color: newPriorityColor,
      order: priorities.length + 1,
      isActive: true,
      isDefault: false,
    };

    setPriorities([...priorities, newPriority]);
    setNewPriorityLabel('');
    setNewPriorityColor('gray');
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
    const status = statuses.find((s) => s.id === id);
    if (status?.isDefault) {
      alert('Cannot delete core status fields');
      return;
    }
    setStatuses(statuses.filter((s) => s.id !== id));
  };

  const deletePriority = (id: string) => {
    const priority = priorities.find((p) => p.id === id);
    if (priority?.isDefault) {
      alert('Cannot delete core priority fields');
      return;
    }
    setPriorities(priorities.filter((p) => p.id !== id));
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

    newPriorities.forEach((priority, idx) => {
      priority.order = idx + 1;
    });

    setPriorities(newPriorities);
  };

  return (
    <div className="bg-transparent">
      <div className="max-w-full">
        {/* Removed header since it's now in the parent component */}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('statuses')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'statuses'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Ticket Statuses ({statuses.filter((s) => s.isActive).length})
            </button>
            <button
              onClick={() => setActiveTab('priorities')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'priorities'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Ticket Priorities ({priorities.filter((p) => p.isActive).length})
            </button>
          </nav>
        </div>

        {/* Status Configuration */}
        {activeTab === 'statuses' && (
          <div className="space-y-6">
            {/* Add New Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Add New Status
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                      placeholder="e.g., Waiting for Approval"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color
                    </label>
                    <ColorPicker selectedColor={newStatusColor} onColorSelect={setNewStatusColor} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {newStatusLabel && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Preview:</span>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getColorClass(newStatusColor)}`}
                      >
                        {newStatusLabel}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={addNewStatus}
                    disabled={!newStatusLabel.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Status List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {statuses.map((status, index) => (
                  <div
                    key={status.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        {/* Preview Badge */}
                        <div
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getColorClass(status.color)} min-w-0`}
                        >
                          {status.isDefault && <span className="mr-1 text-xs">🔒</span>}
                          <span className="truncate">{status.label}</span>
                        </div>

                        {/* Edit Fields */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={status.label}
                              onChange={(e) => updateStatus(status.id, { label: e.target.value })}
                              disabled={status.isDefault}
                              placeholder="Display name"
                              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <ColorPicker
                              selectedColor={status.color}
                              onColorSelect={(color) => updateStatus(status.id, { color })}
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1 ml-4">
                        <button
                          onClick={() => moveStatus(status.id, 'up')}
                          disabled={index === 0}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Move up"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveStatus(status.id, 'down')}
                          disabled={index === statuses.length - 1}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Move down"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => updateStatus(status.id, { isActive: !status.isActive })}
                          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            status.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                          }`}
                          title={status.isActive ? 'Disable' : 'Enable'}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={
                                status.isActive
                                  ? 'M5 13l4 4L19 7'
                                  : 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                              }
                            />
                          </svg>
                        </button>
                        {!status.isDefault && (
                          <button
                            onClick={() => deleteStatus(status.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Priority Configuration */}
        {activeTab === 'priorities' && (
          <div className="space-y-6">
            {/* Add New Priority */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Add New Priority
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newPriorityLabel}
                      onChange={(e) => setNewPriorityLabel(e.target.value)}
                      placeholder="e.g., Urgent"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color
                    </label>
                    <ColorPicker
                      selectedColor={newPriorityColor}
                      onColorSelect={setNewPriorityColor}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {newPriorityLabel && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Preview:</span>
                      <span
                        className={`font-medium text-${newPriorityColor}-600 dark:text-${newPriorityColor}-400`}
                      >
                        {newPriorityLabel}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={addNewPriority}
                    disabled={!newPriorityLabel.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Priority List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {priorities.map((priority, index) => (
                  <div
                    key={priority.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        {/* Preview */}
                        <div
                          className={`font-medium text-${priority.color}-600 dark:text-${priority.color}-400 min-w-0 flex items-center`}
                        >
                          {priority.isDefault && <span className="mr-1 text-xs">🔒</span>}
                          <span className="truncate">{priority.label}</span>
                        </div>

                        {/* Edit Fields */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              value={priority.label}
                              onChange={(e) =>
                                updatePriority(priority.id, { label: e.target.value })
                              }
                              disabled={priority.isDefault}
                              placeholder="Display name"
                              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <ColorPicker
                              selectedColor={priority.color}
                              onColorSelect={(color) => updatePriority(priority.id, { color })}
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-1 ml-4">
                        <button
                          onClick={() => movePriority(priority.id, 'up')}
                          disabled={index === 0}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Move up"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => movePriority(priority.id, 'down')}
                          disabled={index === priorities.length - 1}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="Move down"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            updatePriority(priority.id, { isActive: !priority.isActive })
                          }
                          className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            priority.isActive
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-400'
                          }`}
                          title={priority.isActive ? 'Disable' : 'Enable'}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={
                                priority.isActive
                                  ? 'M5 13l4 4L19 7'
                                  : 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                              }
                            />
                          </svg>
                        </button>
                        {!priority.isDefault && (
                          <button
                            onClick={() => deletePriority(priority.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStatusConfig;
