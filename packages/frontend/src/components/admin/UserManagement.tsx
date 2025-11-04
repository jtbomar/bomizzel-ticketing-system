import React, { useState, useEffect } from 'react';
import { apiService as api } from '../../services/api';
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'employee' | 'admin';
  isActive: boolean;
  teamCount: number;
  createdAt: string;
}

interface UserFilters {
  search: string;
  role: string;
  isActive: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '',
    isActive: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'employee' as 'customer' | 'employee' | 'admin',
    password: '',
    teamId: '',
  });
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, [filters, pagination.page]);

  const fetchTeams = async () => {
    try {
      const response = await api.getTeams();
      setTeams(response.data.map((team: any) => ({ id: team.id, name: team.name })));
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      // Fallback to mock data if API fails
      setTeams([
        { id: '1', name: 'Technical Support' },
        { id: '2', name: 'Customer Success' },
        { id: '3', name: 'Sales Team' },
      ]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Try to fetch from API first
      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
        });

        if (filters.search) params.append('search', filters.search);
        if (filters.role) params.append('role', filters.role);
        if (filters.isActive) params.append('isActive', filters.isActive);

        const response = await api.getUsers({
          page: pagination.page,
          limit: pagination.limit,
          search: filters.search || undefined,
          role: filters.role || undefined,
          isActive: filters.isActive ? filters.isActive === 'true' : undefined,
        });
        setUsers(response.data);
        setPagination((prev) => ({
          ...prev,
          ...response.pagination,
        }));
      } catch (apiError) {
        console.warn('API failed, using mock data:', apiError);

        // Fallback to mock data
        const mockUsers: User[] = [
          {
            id: '1',
            email: 'admin@bomizzel.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            isActive: true,
            teamCount: 0,
            createdAt: '2024-01-15T10:00:00Z',
          },
          {
            id: '2',
            email: 'john.doe@bomizzel.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'employee',
            isActive: true,
            teamCount: 2,
            createdAt: '2024-01-10T09:30:00Z',
          },
          {
            id: '3',
            email: 'jane.smith@bomizzel.com',
            firstName: 'Jane',
            lastName: 'Smith',
            role: 'employee',
            isActive: true,
            teamCount: 1,
            createdAt: '2024-01-08T14:20:00Z',
          },
          {
            id: '4',
            email: 'customer@example.com',
            firstName: 'Customer',
            lastName: 'Test',
            role: 'customer',
            isActive: true,
            teamCount: 0,
            createdAt: '2024-01-05T11:15:00Z',
          },
          {
            id: '5',
            email: 'inactive.user@bomizzel.com',
            firstName: 'Inactive',
            lastName: 'User',
            role: 'employee',
            isActive: false,
            teamCount: 0,
            createdAt: '2024-01-01T08:00:00Z',
          },
        ];

        // Apply filters to mock data
        let filteredUsers = mockUsers;

        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredUsers = filteredUsers.filter(
            (user) =>
              user.firstName.toLowerCase().includes(searchLower) ||
              user.lastName.toLowerCase().includes(searchLower) ||
              user.email.toLowerCase().includes(searchLower)
          );
        }

        if (filters.role) {
          filteredUsers = filteredUsers.filter((user) => user.role === filters.role);
        }

        if (filters.isActive) {
          filteredUsers = filteredUsers.filter(
            (user) => user.isActive === (filters.isActive === 'true')
          );
        }

        setUsers(filteredUsers);
        setPagination((prev) => ({
          ...prev,
          total: filteredUsers.length,
          totalPages: Math.ceil(filteredUsers.length / prev.limit),
        }));
      }
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      fetchUsers();
    } catch (err) {
      setError('Failed to update user role');
      console.error('Update user role error:', err);
    }
  };

  const handleUpdateUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await api.updateUserStatus(userId, isActive);
      fetchUsers();
    } catch (err) {
      setError('Failed to update user status');
      console.error('Update user status error:', err);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleAddUser called with:', newUser);

    // Basic validation
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      // Call the API to create the user
      const response = await api.createUser({
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        teamId: newUser.teamId || undefined,
      });

      console.log('User created successfully:', response);

      // Show success message
      alert(`Agent ${newUser.firstName} ${newUser.lastName} has been added successfully!`);

      // Reset form and close modal
      setShowAddModal(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        role: 'employee',
        password: '',
        teamId: '',
      });
      setError(null);

      // Refresh the users list
      fetchUsers();
    } catch (err: any) {
      console.error('Add user error:', err);

      // Handle specific error messages from the API
      let errorMessage = 'Failed to add user';
      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      console.log('Updating user:', editingUser);

      // Call the API to update the user
      const response = await api.updateUser(editingUser.id, {
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        email: editingUser.email,
        role: editingUser.role,
        isActive: editingUser.isActive,
        teamId: (editingUser as any).teamId || undefined,
      });

      console.log('User updated successfully:', response);

      // Show success message
      alert(
        `Agent ${editingUser.firstName} ${editingUser.lastName} has been updated successfully!`
      );

      setShowEditModal(false);
      setEditingUser(null);
      setError(null);

      // Refresh the users list
      fetchUsers();
    } catch (err: any) {
      console.error('Update user error:', err);

      // Handle specific error messages from the API
      let errorMessage = 'Failed to update user';
      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  const handleFilterChange = (key: keyof UserFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Agent Management</h2>
        <button
          onClick={() => {
            console.log('Add Agent button clicked');
            setShowAddModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-500/20 text-blue-200 border border-blue-400/50 rounded-lg hover:bg-blue-500/30 transition-all duration-200"
        >
          <UserPlusIcon className="h-4 w-4 mr-2" />
          Add Agent
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-md p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Search</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Role</label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="block w-full rounded-md bg-white/10 border border-white/20 text-white shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm"
            >
              <option value="">All Roles</option>
              <option value="customer">Customer</option>
              <option value="employee">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Status</label>
            <select
              value={filters.isActive}
              onChange={(e) => handleFilterChange('isActive', e.target.value)}
              className="block w-full rounded-md bg-white/10 border border-white/20 text-white shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ search: '', role: '', isActive: '' });
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 border border-white/20 rounded-md hover:bg-white/20 transition-all duration-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/5 shadow overflow-hidden sm:rounded-md border border-white/10">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                Teams
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-white/80 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/5 divide-y divide-white/10">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-white/10 transition-all duration-200">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-white">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-sm text-white/60">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                    className="text-xs font-medium rounded-md px-3 py-2 bg-white/10 border border-white/20 text-white hover:bg-white/20 focus:border-blue-400 focus:ring-blue-400 transition-all duration-200"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                  >
                    <option value="customer" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                      Customer
                    </option>
                    <option value="employee" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                      Agent
                    </option>
                    <option value="admin" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                      Admin
                    </option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleUpdateUserStatus(user.id, !user.isActive)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {user.isActive ? (
                      <>
                        <CheckIcon className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                  {user.teamCount} teams
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => {
                      setEditingUser(user);
                      setShowEditModal(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 mr-3 transition-colors duration-200"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/80">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{' '}
            results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-2 text-sm font-medium text-white bg-white/10 border border-white/20 rounded-md hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-2 text-sm font-medium text-white bg-white/10 border border-white/20 rounded-md hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Add Agent</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/60 hover:text-white transition-colors duration-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.firstName}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.lastName}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  placeholder="john.doe@bomizzel.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: e.target.value as 'customer' | 'employee' | 'admin',
                    }))
                  }
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="customer" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Customer
                  </option>
                  <option value="employee" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Agent
                  </option>
                  <option value="admin" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Admin
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Team Assignment</label>
                <select
                  value={newUser.teamId}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, teamId: e.target.value }))}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    No Team (Admin Only)
                  </option>
                  {teams.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      style={{ backgroundColor: '#1e293b', color: 'white' }}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  placeholder="Enter password"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 px-4 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-500/20 text-blue-200 border border-blue-400/50 rounded-lg hover:bg-blue-500/30 transition-all duration-200"
                >
                  Add Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Edit Agent</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="text-white/60 hover:text-white transition-colors duration-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editingUser.firstName}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, firstName: e.target.value } : null
                      )
                    }
                    className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editingUser.lastName}
                    onChange={(e) =>
                      setEditingUser((prev) =>
                        prev ? { ...prev, lastName: e.target.value } : null
                      )
                    }
                    className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser((prev) => (prev ? { ...prev, email: e.target.value } : null))
                  }
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  placeholder="john.doe@bomizzel.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => {
                    console.log('Role changing to:', e.target.value);
                    setEditingUser((prev) =>
                      prev
                        ? { ...prev, role: e.target.value as 'customer' | 'employee' | 'admin' }
                        : null
                    );
                  }}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white shadow-sm focus:border-blue-400 focus:ring-blue-400 hover:bg-white/20 transition-all duration-200 sm:text-sm px-3 py-2 cursor-pointer"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="customer" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Customer
                  </option>
                  <option value="employee" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Agent
                  </option>
                  <option value="admin" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Admin
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Team Assignment</label>
                <select
                  value={(editingUser as any).teamId || ''}
                  onChange={(e) =>
                    setEditingUser((prev) =>
                      prev ? ({ ...prev, teamId: e.target.value } as any) : null
                    )
                  }
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    No Team (Admin Only)
                  </option>
                  {teams.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      style={{ backgroundColor: '#1e293b', color: 'white' }}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Status</label>
                <select
                  value={editingUser.isActive ? 'true' : 'false'}
                  onChange={(e) =>
                    setEditingUser((prev) =>
                      prev ? { ...prev, isActive: e.target.value === 'true' } : null
                    )
                  }
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white shadow-sm focus:border-blue-400 focus:ring-blue-400 sm:text-sm px-3 py-2"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="true" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Active
                  </option>
                  <option value="false" style={{ backgroundColor: '#1e293b', color: 'white' }}>
                    Inactive
                  </option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 py-2 px-4 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-500/20 text-blue-200 border border-blue-400/50 rounded-lg hover:bg-blue-500/30 transition-all duration-200"
                >
                  Update Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
