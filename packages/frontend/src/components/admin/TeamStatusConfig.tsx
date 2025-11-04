import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

interface TicketStatus {
  id: string;
  name: string;
  label: string;
  color: string;
  order: number;
  isDefault: boolean;
  isClosed: boolean;
  isActive: boolean;
}

interface Team {
  id: string;
  name: string;
}

interface TeamStatusConfigProps {
  team: Team;
  onClose: () => void;
}

const TeamStatusConfig: React.FC<TeamStatusConfigProps> = ({ team, onClose }) => {
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<TicketStatus | null>(null);
  const [newStatus, setNewStatus] = useState({
    name: '',
    label: '',
    color: '#6B7280',
    isDefault: false,
    isClosed: false,
  });

  useEffect(() => {
    fetchStatuses();
  }, [team.id]);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/teams/${team.id}/statuses`);
      setStatuses(response.data.statuses);
    } catch (err) {
      setError('Failed to fetch statuses');
      console.error('Fetch statuses error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/teams/${team.id}/statuses`, newStatus);
      setNewStatus({
        name: '',
        label: '',
        color: '#6B7280',
        isDefault: false,
        isClosed: false,
      });
      setShowCreateModal(false);
      fetchStatuses();
    } catch (err) {
      setError('Failed to create status');
      console.error('Create status error:', err);
    }
  };

  const handleUpdateStatus = async (statusId: string, updates: Partial<TicketStatus>) => {
    try {
      await api.put(`/teams/${team.id}/statuses/${statusId}`, updates);
      fetchStatuses();
    } catch (err) {
      setError('Failed to update status');
      console.error('Update status error:', err);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Are you sure you want to delete this status?')) return;

    try {
      await api.delete(`/teams/${team.id}/statuses/${statusId}`);
      fetchStatuses();
    } catch (err) {
      setError('Failed to delete status');
      console.error('Delete status error:', err);
    }
  };

  const handleReorderStatuses = async (newOrder: TicketStatus[]) => {
    try {
      const statusOrders = newOrder.map((status, index) => ({
        id: status.id,
        order: index,
      }));

      await api.put(`/teams/${team.id}/statuses/reorder`, { statusOrders });
      setStatuses(newOrder);
    } catch (err) {
      setError('Failed to reorder statuses');
      console.error('Reorder statuses error:', err);
    }
  };

  const moveStatus = (index: number, direction: 'up' | 'down') => {
    const newStatuses = [...statuses];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newStatuses.length) {
      [newStatuses[index], newStatuses[targetIndex]] = [
        newStatuses[targetIndex],
        newStatuses[index],
      ];
      handleReorderStatuses(newStatuses);
    }
  };

  const colorOptions = [
    { value: '#6B7280', label: 'Gray' },
    { value: '#EF4444', label: 'Red' },
    { value: '#F59E0B', label: 'Yellow' },
    { value: '#10B981', label: 'Green' },
    { value: '#3B82F6', label: 'Blue' },
    { value: '#8B5CF6', label: 'Purple' },
    { value: '#F97316', label: 'Orange' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">Ticket Statuses - {team.name}</h3>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Status
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {statuses.map((status, index) => (
              <div
                key={status.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => moveStatus(index, 'up')}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStatus(index, 'down')}
                      disabled={index === statuses.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>

                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }} />

                  <div>
                    <div className="font-medium text-gray-900">{status.label}</div>
                    <div className="text-sm text-gray-500">Key: {status.name}</div>
                  </div>

                  <div className="flex space-x-2">
                    {status.isDefault && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                    {status.isClosed && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Closed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingStatus(status)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteStatus(status.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {statuses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No statuses configured for this team
              </div>
            )}
          </div>
        )}

        {/* Create Status Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Status</h3>
                <form onSubmit={handleCreateStatus} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status Key
                    </label>
                    <input
                      type="text"
                      required
                      value={newStatus.name}
                      onChange={(e) => setNewStatus((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., in_progress"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Label
                    </label>
                    <input
                      type="text"
                      required
                      value={newStatus.label}
                      onChange={(e) => setNewStatus((prev) => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g., In Progress"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <select
                      value={newStatus.color}
                      onChange={(e) => setNewStatus((prev) => ({ ...prev, color: e.target.value }))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      {colorOptions.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newStatus.isDefault}
                        onChange={(e) =>
                          setNewStatus((prev) => ({ ...prev, isDefault: e.target.checked }))
                        }
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">Default status</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newStatus.isClosed}
                        onChange={(e) =>
                          setNewStatus((prev) => ({ ...prev, isClosed: e.target.checked }))
                        }
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">Closed status</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                    >
                      Create Status
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamStatusConfig;
