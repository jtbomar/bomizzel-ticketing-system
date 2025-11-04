import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { apiService } from '../services/api';

interface ProfileManagementProps {
  onClose: () => void;
}

const ProfileManagement: React.FC<ProfileManagementProps> = ({ onClose }) => {
  const { user, updateProfile: updateUser } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences();

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');
  const [loading, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });

  const [preferencesData, setPreferencesData] = useState({
    theme: preferences.theme || 'light',
    notifications: {
      email: preferences.notifications?.email ?? true,
      browser: preferences.notifications?.browser ?? true,
      ticketAssigned: preferences.notifications?.ticketAssigned ?? true,
      ticketUpdated: preferences.notifications?.ticketUpdated ?? true,
      ticketResolved: preferences.notifications?.ticketResolved ?? true,
    },
    dashboard: {
      defaultView: preferences.dashboard?.defaultView || 'kanban',
      ticketsPerPage: preferences.dashboard?.ticketsPerPage || 20,
    },
  });

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedUser = await apiService.updateProfile(profileData);
      updateUser(updatedUser);
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError('Failed to update profile');
      console.error('Error updating profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updatePreferences(preferencesData);
      setSuccess('Preferences updated successfully');
    } catch (err) {
      setError('Failed to update preferences');
      console.error('Error updating preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Profile & Preferences</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'preferences'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Preferences
            </button>
          </nav>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <form onSubmit={handlePreferencesSave} className="space-y-6">
            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="light"
                    checked={preferencesData.theme === 'light'}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        theme: e.target.value as 'light' | 'dark',
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Light</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="dark"
                    checked={preferencesData.theme === 'dark'}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        theme: e.target.value as 'light' | 'dark',
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Dark</span>
                </label>
              </div>
            </div>

            {/* Dashboard Preferences */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Dashboard</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Default View</label>
                  <select
                    value={preferencesData.dashboard.defaultView}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        dashboard: {
                          ...prev.dashboard,
                          defaultView: e.target.value as 'kanban' | 'list',
                        },
                      }))
                    }
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="kanban">Kanban Board</option>
                    <option value="list">List View</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Tickets Per Page</label>
                  <select
                    value={preferencesData.dashboard.ticketsPerPage}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        dashboard: { ...prev.dashboard, ticketsPerPage: parseInt(e.target.value) },
                      }))
                    }
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Notifications</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesData.notifications.email}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, email: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email notifications</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesData.notifications.browser}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, browser: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Browser notifications</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesData.notifications.ticketAssigned}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, ticketAssigned: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Ticket assigned to me</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesData.notifications.ticketUpdated}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, ticketUpdated: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Ticket updates</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferencesData.notifications.ticketResolved}
                    onChange={(e) =>
                      setPreferencesData((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, ticketResolved: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Ticket resolved</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileManagement;
