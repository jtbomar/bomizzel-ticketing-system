import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface OrganizationalRole {
  id: number;
  company_id: string;
  name: string;
  description?: string;
  hierarchy_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const OrganizationalRoles: React.FC = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<OrganizationalRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OrganizationalRole | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hierarchy_level: 1,
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await apiService.getOrganizationalRoles();
      setRoles(response.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (role?: OrganizationalRole) => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        hierarchy_level: role.hierarchy_level,
      });
      setSelectedRole(role);
      setIsEditing(true);
      setIsCreating(false);
    } else {
      setFormData({
        name: '',
        description: '',
        hierarchy_level: roles.length + 1,
      });
      setSelectedRole(null);
      setIsCreating(true);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setIsCreating(false);
    setSelectedRole(null);
    setFormData({
      name: '',
      description: '',
      hierarchy_level: 1,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a role name.');
      return;
    }

    try {
      setSaving(true);

      if (isCreating) {
        await apiService.createOrganizationalRole(formData);
      } else if (selectedRole) {
        await apiService.updateOrganizationalRole(selectedRole.id, formData);
      }

      await fetchRoles();
      cancelEditing();
    } catch (error: any) {
      console.error('Error saving role:', error);
      alert(`Failed to save role: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this role?')) {
      return;
    }

    try {
      await apiService.deleteOrganizationalRole(id);
      await fetchRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert(`Failed to delete role: ${error.response?.data?.error || error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading roles...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/admin/settings')}
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
              >
                ← Back to Settings
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Organizational Roles</h2>
              <p className="text-sm text-gray-600 mt-1">
                Define custom roles with hierarchy levels for your organization
              </p>
            </div>
            {!isEditing && (
              <button
                onClick={() => startEditing()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add New Role
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {roles.length === 0 && !isEditing ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔑</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Roles Configured</h3>
              <p className="text-gray-600 mb-4">
                Create organizational roles to define hierarchy and permissions in your team.
              </p>
              <button
                onClick={() => startEditing()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Role
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Roles List */}
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Roles</h3>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedRole?.id === role.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedRole(role)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{role.name}</h4>
                          <p className="text-sm text-gray-600">Level {role.hierarchy_level}</p>
                          {role.description && (
                            <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(role);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(role.id);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Role Details/Form */}
              <div className="lg:col-span-2">
                {isEditing ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isCreating ? 'Create Role' : 'Edit Role'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role Name *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Support Manager, Technical Lead"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional description of this role"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hierarchy Level
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.hierarchy_level}
                          onChange={(e) =>
                            setFormData({ ...formData, hierarchy_level: parseInt(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Lower numbers indicate higher authority (1 = highest)
                        </p>
                      </div>
                    </div>
                  </div>
                ) : selectedRole ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Role Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="mt-1 text-gray-900">{selectedRole.name}</p>
                      </div>
                      {selectedRole.description && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Description
                          </label>
                          <p className="mt-1 text-gray-900">{selectedRole.description}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Hierarchy Level
                        </label>
                        <p className="mt-1 text-gray-900">{selectedRole.hierarchy_level}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <p className="mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              selectedRole.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {selectedRole.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Select a role to view details
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationalRoles;
