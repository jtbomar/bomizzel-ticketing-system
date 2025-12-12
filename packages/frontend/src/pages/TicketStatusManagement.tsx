import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface TicketStatus {
  id: string;
  name: string;
  label: string;
  color: string;
  order: number;
  is_default: boolean;
  is_closed: boolean;
  is_active: boolean;
}

const TicketStatusManagement: React.FC = () => {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<TicketStatus | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    color: '#6B7280',
    order: 0,
    is_closed: false,
  });

  useEffect(() => {
    fetchTeamAndStatuses();
  }, []);

  const fetchTeamAndStatuses = async () => {
    try {
      // Get user's team from first ticket
      const ticketsResponse = await apiService.getTickets({ limit: 1 });
      const tickets = ticketsResponse.data || ticketsResponse.tickets || [];

      if (tickets.length > 0 && tickets[0].teamId) {
        const tid = tickets[0].teamId;
        setTeamId(tid);
        await fetchStatuses(tid);
      } else {
        setLoading(false);
        alert('No team found. Please create a ticket first.');
      }
    } catch (error) {
      console.error('Failed to fetch team:', error);
      setLoading(false);
    }
  };

  const fetchStatuses = async (tid: string) => {
    try {
      const response = await apiService.getTeamStatuses(tid);
      const statusList = response.statuses || [];
      setStatuses(statusList.sort((a: TicketStatus, b: TicketStatus) => a.order - b.order));
    } catch (error) {
      console.error('Failed to fetch statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!teamId || !formData.name || !formData.label) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await apiService.createTeamStatus(teamId, {
        name: formData.name.toLowerCase().replace(/\s+/g, '_'),
        label: formData.label,
        color: formData.color,
        order: statuses.length + 1,
        isClosed: formData.is_closed,
      });

      setShowAddModal(false);
      setFormData({ name: '', label: '', color: '#6B7280', order: 0, is_closed: false });
      await fetchStatuses(teamId);
      alert('Status created successfully!');
    } catch (error: any) {
      alert('Failed to create status: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleEdit = async () => {
    if (!teamId || !editingStatus) return;

    try {
      await apiService.updateTeamStatus(teamId, editingStatus.id, {
        label: formData.label,
        color: formData.color,
        isClosed: formData.is_closed,
      });

      setEditingStatus(null);
      setFormData({ name: '', label: '', color: '#6B7280', order: 0, is_closed: false });
      await fetchStatuses(teamId);
      alert('Status updated successfully!');
    } catch (error: any) {
      alert('Failed to update status: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (statusId: string, statusName: string) => {
    if (!teamId) return;

    if (!confirm(`Are you sure you want to delete "${statusName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteTeamStatus(teamId, statusId);
      await fetchStatuses(teamId);
      alert('Status deleted successfully!');
    } catch (error: any) {
      alert('Failed to delete status: ' + (error.response?.data?.message || error.message));
    }
  };

  const openEditModal = (status: TicketStatus) => {
    setEditingStatus(status);
    setFormData({
      name: status.name,
      label: status.label,
      color: status.color,
      order: status.order,
      is_closed: status.is_closed,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/admin/settings')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Settings
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Ticket Status Management</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage your Kanban board columns and ticket statuses
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add Status
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statuses.map((status) => (
              <div
                key={status.id}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: status.color }}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900">{status.label}</h3>
                      <p className="text-xs text-gray-500">{status.name}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">#{status.order}</span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {status.is_default && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      Default
                    </span>
                  )}
                  {status.is_closed && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                      Closed
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(status)}
                    className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  {!status.is_default && (
                    <button
                      onClick={() => handleDelete(status.id, status.label)}
                      className="flex-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {statuses.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                No statuses found. Add your first status to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingStatus) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingStatus ? 'Edit Status' : 'Add New Status'}
            </h3>

            <div className="space-y-4">
              {!editingStatus && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status Name (internal) *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., in_review"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lowercase, use underscores for spaces
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Label *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., In Review"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_closed}
                    onChange={(e) => setFormData({ ...formData, is_closed: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    Mark as closed status (for resolved tickets)
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStatus(null);
                  setFormData({
                    name: '',
                    label: '',
                    color: '#6B7280',
                    order: 0,
                    is_closed: false,
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={editingStatus ? handleEdit : handleAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingStatus ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketStatusManagement;
