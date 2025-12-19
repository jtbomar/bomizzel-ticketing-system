import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import CompanyProfileSettings from '../components/CompanyProfileSettings';
import AdminStatusConfig from '../components/AdminStatusConfig';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

const SimpleAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'employee',
    isActive: true,
  });

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const tabs = [
    { id: 'users', name: 'User Management' },
    { id: 'companies', name: 'Company Management' },
    { id: 'teams', name: 'Team Management' },
    { id: 'layouts', name: 'Ticket Layouts' },
    { id: 'profile', name: 'Company Profile' },
    { id: 'data', name: 'Data Management' },
    { id: 'reports', name: 'Reports & Analytics' },
    { id: 'settings', name: 'System Settings' },
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUsers();
      setUsers(response.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      console.error('Error details:', error.response?.data);
      alert(
        `Failed to load users: ${error.response?.data?.message || error.message || 'Please try again.'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const addUser = async () => {
    if (newUser.firstName && newUser.lastName && newUser.email && newUser.password) {
      try {
        await apiService.createUser(newUser);
        setNewUser({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          role: 'employee',
          isActive: true,
        });
        setShowAddUserModal(false);
        fetchUsers(); // Refresh the list
        alert('User created successfully!');
      } catch (error: any) {
        console.error('Error creating user:', error);
        console.error('Error details:', error.response?.data);
        alert(
          error.response?.data?.error?.message ||
            error.response?.data?.message ||
            'Failed to create user. Please try again.'
        );
      }
    } else {
      alert('Please fill in all required fields including password.');
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await apiService.updateUser(userId, { isActive: !currentStatus });
      fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating user status:', error);
      console.error('Error details:', error.response?.data);
      alert(
        `Failed to update user status: ${error.response?.data?.message || error.message || 'Please try again.'}`
      );
    }
  };

  const deleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to deactivate this user?')) {
      try {
        await apiService.updateUser(userId, { isActive: false });
        fetchUsers(); // Refresh the list
        alert('User deactivated successfully!');
      } catch (error) {
        console.error('Error deactivating user:', error);
        alert('Failed to deactivate user. Please try again.');
      }
    }
  };

  const renderUserManagement = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2
              className={`text-lg font-medium transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              User Management
            </h2>
            <p
              className={`text-sm transition-colors ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Manage system users and their permissions
            </p>
          </div>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Add User
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div
            className={`backdrop-blur-sm rounded-lg p-4 border transition-colors ${
              theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div
              className={`text-2xl font-bold transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {users.length}
            </div>
            <div
              className={`text-sm transition-colors ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Total Users
            </div>
          </div>
          <div
            className={`backdrop-blur-sm rounded-lg p-4 border transition-colors ${
              theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div
              className={`text-2xl font-bold transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {users.filter((u) => u.role === 'admin').length}
            </div>
            <div
              className={`text-sm transition-colors ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Admins
            </div>
          </div>
          <div
            className={`backdrop-blur-sm rounded-lg p-4 border transition-colors ${
              theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div
              className={`text-2xl font-bold transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {users.filter((u) => u.role === 'employee').length}
            </div>
            <div
              className={`text-sm transition-colors ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Agents
            </div>
          </div>
          <div
            className={`backdrop-blur-sm rounded-lg p-4 border transition-colors ${
              theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div
              className={`text-2xl font-bold transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {users.filter((u) => u.isActive).length}
            </div>
            <div
              className={`text-sm transition-colors ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Active Users
            </div>
          </div>
        </div>

        <div
          className={`backdrop-blur-sm rounded-lg border transition-colors ${
            theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-white border-gray-200'
          }`}
        >
          <div className="overflow-x-auto">
            <table
              className={`min-w-full divide-y transition-colors ${
                theme === 'dark' ? 'divide-white/20' : 'divide-gray-200'
              }`}
            >
              <thead
                className={`transition-colors ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}
              >
                <tr>
                  <th
                    className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    Name
                  </th>
                  <th
                    className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    Email
                  </th>
                  <th
                    className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    Role
                  </th>
                  <th
                    className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    Status
                  </th>
                  <th
                    className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y transition-colors ${
                  theme === 'dark' ? 'divide-white/10' : 'divide-gray-200'
                }`}
              >
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm transition-colors ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {user.firstName} {user.lastName}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm transition-colors ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-600'
                      }`}
                    >
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'employee'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {user.role === 'employee' ? 'agent' : user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleUserStatus(user.id, user.isActive)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer transition-colors ${
                          user.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleUserStatus(user.id, user.isActive)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            user.isActive
                              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCompanyManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2
          className={`text-lg font-medium transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Company Management
        </h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Add Company
        </button>
      </div>
      <div
        className={`p-8 rounded-lg border text-center transition-colors ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <h3
          className={`text-lg font-medium mb-2 transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Company Management
        </h3>
        <p className={`transition-colors ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
          Manage customer companies and their settings.
        </p>
        <p
          className={`text-sm mt-2 transition-colors ${
            theme === 'dark' ? 'text-white/40' : 'text-gray-500'
          }`}
        >
          Feature coming soon.
        </p>
      </div>
    </div>
  );

  const renderTeamManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2
          className={`text-lg font-medium transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Team Management
        </h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Add Team
        </button>
      </div>
      <div
        className={`p-8 rounded-lg border text-center transition-colors ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <h3
          className={`text-lg font-medium mb-2 transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Team Management
        </h3>
        <p className={`transition-colors ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
          Configure teams and assign agents.
        </p>
        <p
          className={`text-sm mt-2 transition-colors ${
            theme === 'dark' ? 'text-white/40' : 'text-gray-500'
          }`}
        >
          Feature coming soon.
        </p>
      </div>
    </div>
  );

  const renderCompanyProfile = () => (
    <div className="space-y-6">
      <CompanyProfileSettings />
    </div>
  );

  const renderTicketLayouts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2
          className={`text-lg font-medium transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Ticket Layouts
        </h2>
        <Link
          to="/admin/layouts"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Manage Layouts
        </Link>
      </div>
      <div
        className={`p-8 rounded-lg border text-center transition-colors ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="text-6xl mb-4">🎨</div>
        <h3
          className={`text-lg font-medium mb-2 transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Custom Ticket Forms
        </h3>
        <p
          className={`transition-colors mb-4 ${
            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
          }`}
        >
          Create drag-and-drop ticket forms with custom fields, picklists, and validation rules.
        </p>
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left ${
            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
          }`}
        >
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
            <div className="text-2xl mb-2">📝</div>
            <h4 className="font-medium mb-1">Field Types</h4>
            <p className="text-sm opacity-75">
              Text, dropdowns, currency, dates, rich text, and more
            </p>
          </div>
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
            <div className="text-2xl mb-2">🎯</div>
            <h4 className="font-medium mb-1">Drag & Drop</h4>
            <p className="text-sm opacity-75">Visual layout builder with grid positioning</p>
          </div>
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
            <div className="text-2xl mb-2">✅</div>
            <h4 className="font-medium mb-1">Validation</h4>
            <p className="text-sm opacity-75">Required fields, patterns, and custom rules</p>
          </div>
        </div>
        <Link
          to="/admin/layouts"
          className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Get Started with Layouts
        </Link>
      </div>
    </div>
  );

  const renderSystemSettings = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2
          className={`text-lg font-medium transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          System Settings
        </h2>
      </div>

      {/* Status & Priority Configuration */}
      <div
        className={`rounded-lg border transition-colors ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
        }`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3
            className={`text-lg font-medium transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Status & Priority Configuration
          </h3>
          <p
            className={`text-sm mt-1 transition-colors ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}
          >
            Configure ticket statuses and priorities with custom colors. Core fields are protected
            and cannot be deleted.
          </p>
        </div>

        <div className="p-0">
          <AdminStatusConfig />
        </div>
      </div>

      {/* Additional System Settings */}
      <div
        className={`p-6 rounded-lg border transition-colors ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <h3
          className={`text-lg font-medium mb-2 transition-colors ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Additional System Configuration
        </h3>
        <p className={`transition-colors ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
          Other system-wide settings and preferences.
        </p>
        <p
          className={`text-sm mt-2 transition-colors ${
            theme === 'dark' ? 'text-white/40' : 'text-gray-500'
          }`}
        >
          More features coming soon.
        </p>
      </div>
    </div>
  );

  const renderDataManagement = () => (
    <div className="space-y-6">
      <div className="text-center py-12">
        <svg
          className="mx-auto h-16 w-16 text-blue-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <h3
          className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          Data Management
        </h3>
        <p className={`mb-6 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
          Export and import your company data for backup and migration purposes
        </p>
        <Link
          to="/data-management"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Go to Data Management
        </Link>
        <div
          className={`mt-8 max-w-2xl mx-auto text-left ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}
        >
          <h4 className="font-semibold mb-3">What you can do:</h4>
          <ul className="space-y-2">
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-green-500 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>Export Data:</strong> Create backups of users, tickets, attachments, and
                custom fields
              </span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-green-500 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>Import Data:</strong> Restore from previous backups or migrate from other
                systems
              </span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-green-500 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>View History:</strong> Track all export and import activities
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderReportsAnalytics = () => (
    <div className="space-y-6">
      <div className="text-center py-12">
        <svg
          className="mx-auto h-16 w-16 text-purple-500 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h3
          className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          Reports & Analytics
        </h3>
        <p className={`mb-6 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
          Run custom reports and analyze your ticket data
        </p>
        <Link
          to="/reports"
          className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Go to Reports
        </Link>
        <div
          className={`mt-8 max-w-2xl mx-auto text-left ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}
        >
          <h4 className="font-semibold mb-3">Available Reports:</h4>
          <ul className="space-y-2">
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-purple-500 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>Ticket Reports:</strong> Analyze tickets by status, priority, category
              </span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-purple-500 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>User Activity:</strong> View user lists and activity
              </span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-purple-500 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>Custom Queries:</strong> Write your own SQL queries
              </span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-5 h-5 text-purple-500 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>Export to CSV:</strong> Download reports for analysis
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return renderUserManagement();
      case 'companies':
        return renderCompanyManagement();
      case 'teams':
        return renderTeamManagement();
      case 'layouts':
        return renderTicketLayouts();
      case 'profile':
        return renderCompanyProfile();
      case 'data':
        return renderDataManagement();
      case 'reports':
        return renderReportsAnalytics();
      case 'settings':
        return renderSystemSettings();
      default:
        return renderUserManagement();
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
          : 'bg-gray-50'
      }`}
    >
      <div
        className={`backdrop-blur-sm border-b transition-colors ${
          theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1
                className={`text-2xl font-bold transition-colors ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Administration
              </h1>
              <p
                className={`text-sm transition-colors ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                Welcome back, {user?.firstName}! Manage users, teams, and system configuration
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-md transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Toggle theme"
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                )}
              </button>

              <Link
                to="/admin"
                className={`px-4 py-2 rounded-md transition-colors border ${
                  theme === 'dark'
                    ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
                }`}
              >
                ⚙️ Settings
              </Link>
              <Link
                to="/employee"
                className={`px-4 py-2 rounded-md transition-colors border ${
                  theme === 'dark'
                    ? 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                }`}
              >
                Agent View
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          className={`backdrop-blur-lg rounded-xl shadow-2xl transition-colors ${
            theme === 'dark'
              ? 'bg-white/5 border border-white/10'
              : 'bg-white border border-gray-200'
          }`}
        >
          {/* Tab Navigation */}
          <div
            className={`border-b transition-colors ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}
          >
            <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? theme === 'dark'
                        ? 'border-blue-400 text-blue-300'
                        : 'border-blue-500 text-blue-600'
                      : theme === 'dark'
                        ? 'border-transparent text-white/60 hover:text-white hover:border-white/30'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">{renderTabContent()}</div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New User</h3>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="john.doe@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="customer">Customer</option>
                    <option value="employee">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={newUser.isActive}
                    onChange={(e) => setNewUser({ ...newUser, isActive: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Active User
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUser({
                      firstName: '',
                      lastName: '',
                      email: '',
                      password: '',
                      role: 'employee',
                      isActive: true,
                    });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleAdminDashboard;
