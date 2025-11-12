import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

const Agents: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [organizationalRoles, setOrganizationalRoles] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: 'Welcome123!', // Default starting password
    role: 'employee',
    phone: '',
    mobilePhone: '',
    extension: '',
    about: '',
    departmentIds: [] as number[],
    organizationalRoleId: null as number | null,
    userProfileId: null as number | null,
    mustChangePassword: true, // Force password change on first login
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchOrganizationalRoles();
    fetchUserProfiles();
  }, []);

  const fetchDepartments = async () => {
    try {
      console.log('Fetching departments...');
      const response = await apiService.getDepartments();
      console.log('Departments API response:', response);
      // The API returns the array directly, not wrapped in an object
      const depts = Array.isArray(response) ? response : (response.departments || []);
      console.log('Departments array:', depts);
      setDepartments(depts);
      console.log('Departments state set to:', depts.length, 'items');
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchOrganizationalRoles = async () => {
    try {
      const apiBaseUrl = `http://${window.location.hostname}:3001/api`;
      const response = await fetch(`${apiBaseUrl}/organizational-roles`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setOrganizationalRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching organizational roles:', error);
    }
  };

  const fetchUserProfiles = async () => {
    try {
      const apiBaseUrl = `http://${window.location.hostname}:3001/api`;
      const response = await fetch(`${apiBaseUrl}/user-profiles`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setUserProfiles(data.profiles || []);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching users...');
      const response = await apiService.getUsers();
      console.log('Users API response:', response);
      // Handle both formats: direct array or wrapped in object
      const usersList = Array.isArray(response) ? response : (response.users || response.data || []);
      console.log('Users list:', usersList);
      setUsers(usersList);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      alert(`Failed to load users: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Only send non-empty fields
      const userData: any = {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        mustChangePassword: newUser.mustChangePassword,
      };

      // Add optional fields only if they have values
      if (newUser.phone) userData.phone = newUser.phone;
      if (newUser.mobilePhone) userData.mobilePhone = newUser.mobilePhone;
      if (newUser.extension) userData.extension = newUser.extension;
      if (newUser.about) userData.about = newUser.about;
      if (newUser.organizationalRoleId) userData.organizationalRoleId = newUser.organizationalRoleId;
      if (newUser.userProfileId) userData.userProfileId = newUser.userProfileId;
      if (newUser.departmentIds && newUser.departmentIds.length > 0) userData.departmentIds = newUser.departmentIds;

      console.log('Creating user with data:', userData);
      await apiService.createUser(userData);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        password: 'Welcome123!',
        role: 'employee',
        phone: '',
        mobilePhone: '',
        extension: '',
        about: '',
        departmentIds: [],
        organizationalRoleId: null,
        userProfileId: null,
        mustChangePassword: true,
      });
      setShowAddModal(false);
      fetchUsers();
      alert('Agent created successfully!');
    } catch (error: any) {
      console.error('Error creating user:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.error?.message 
        || error.response?.data?.message 
        || error.message 
        || 'Failed to create agent';
      alert(`Failed to create agent: ${errorMessage}`);
    }
  };

  const openEditModal = async (agent: User) => {
    setEditingUser(agent);
    setShowEditModal(true);
    // TODO: Fetch full agent details including departments, roles, etc.
  };

  const updateUser = async () => {
    if (!editingUser) return;

    try {
      // Build update data
      const updateData: any = {
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        email: editingUser.email,
        role: editingUser.role,
      };

      console.log('Updating user:', editingUser.id, updateData);
      await apiService.updateUser(editingUser.id, updateData);
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
      alert('Agent updated successfully!');
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(`Failed to update agent: ${error.response?.data?.error?.message || error.message}`);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await apiService.updateUser(userId, { isActive: !currentStatus });
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert('Failed to update agent status');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this agent?')) return;

    try {
      await apiService.updateUser(userId, { isActive: false });
      fetchUsers();
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      alert('Failed to deactivate agent');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const agents = users.filter(u => u.role === 'employee' || u.role === 'team_lead');

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/settings')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Settings
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Agent Management</h1>
                <p className="text-sm text-gray-600 mt-1">Manage support agents and their access</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add Agent
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{agents.length}</div>
              <div className="text-sm text-blue-800">Total Agents</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {agents.filter(a => a.isActive).length}
              </div>
              <div className="text-sm text-green-800">Active Agents</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {agents.filter(a => !a.isActive).length}
              </div>
              <div className="text-sm text-gray-800">Inactive Agents</div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openEditModal(agent)}
                        className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        {agent.firstName} {agent.lastName}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {agent.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {agent.role === 'team_lead' ? 'Team Lead' : 'Agent'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleStatus(agent.id, agent.isActive)}
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          agent.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(agent)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center"
                          title="Edit agent"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(agent.id, agent.isActive)}
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            agent.isActive
                              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {agent.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteUser(agent.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {agents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No agents found. Add your first agent to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Agent</h3>
            
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name *</label>
                    <input
                      type="text"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                    <input
                      type="text"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mobile Phone</label>
                    <input
                      type="tel"
                      value={newUser.mobilePhone}
                      onChange={(e) => setNewUser({ ...newUser, mobilePhone: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="(555) 987-6543"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Extension</label>
                    <input
                      type="text"
                      value={newUser.extension}
                      onChange={(e) => setNewUser({ ...newUser, extension: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="1234"
                    />
                  </div>
                </div>
              </div>

              {/* Password Settings */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Password Settings</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Starting Password *</label>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Default: Welcome123!</p>
                </div>
                <div className="mt-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.mustChangePassword}
                      onChange={(e) => setNewUser({ ...newUser, mustChangePassword: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Require password change on first login</span>
                  </label>
                </div>
              </div>

              {/* Organizational Structure */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Organizational Structure</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">System Role *</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="employee">Agent</option>
                      <option value="team_lead">Team Lead</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">System access level</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Organizational Role</label>
                    <select
                      value={newUser.organizationalRoleId || ''}
                      onChange={(e) => setNewUser({ ...newUser, organizationalRoleId: e.target.value ? parseInt(e.target.value) : null })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select role...</option>
                      {organizationalRoles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Company hierarchy position</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">User Profile</label>
                  <select
                    value={newUser.userProfileId || ''}
                    onChange={(e) => setNewUser({ ...newUser, userProfileId: e.target.value ? parseInt(e.target.value) : null })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select profile...</option>
                    {userProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Functional role and permissions</p>
                </div>
              </div>

              {/* Departments */}
              <div className="border-b pb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Departments {departments.length > 0 && `(${departments.length})`}
                </h4>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center py-1">
                      <input
                        type="checkbox"
                        checked={newUser.departmentIds.includes(dept.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({ ...newUser, departmentIds: [...newUser.departmentIds, dept.id] });
                          } else {
                            setNewUser({ ...newUser, departmentIds: newUser.departmentIds.filter(id => id !== dept.id) });
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">{dept.name}</span>
                    </label>
                  ))}
                  {departments.length === 0 && (
                    <p className="text-sm text-gray-500">No departments available</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Select one or more departments</p>
              </div>

              {/* About */}
              <div>
                <label className="block text-sm font-medium text-gray-700">About</label>
                <textarea
                  value={newUser.about}
                  onChange={(e) => setNewUser({ ...newUser, about: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Brief description or bio..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewUser({
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: 'Welcome123!',
                    role: 'employee',
                    phone: '',
                    mobilePhone: '',
                    extension: '',
                    about: '',
                    departmentIds: [],
                    organizationalRoleId: null,
                    userProfileId: null,
                    mustChangePassword: true,
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={addUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Agent</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={editingUser.firstName}
                    onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={editingUser.lastName}
                    onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="employee">Agent</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Full edit functionality with all fields (departments, roles, contact info) will be available soon. For now, you can edit basic information.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={updateUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agents;
