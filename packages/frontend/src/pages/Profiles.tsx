import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface ProfileField {
  id: number;
  name: string;
  type: string;
  required: boolean;
  enabled: boolean;
  field_name: string;
  display_order: number;
}

const Profiles: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'fields' | 'layouts'>('fields');
  const [profileFields, setProfileFields] = useState<ProfileField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfileFields();
  }, []);

  const fetchProfileFields = async () => {
    try {
      setLoading(true);
      const response = await apiService.getProfileFields();
      const fields = response.fields || [];

      // Convert backend format to frontend format
      const formattedFields = fields.map((field: any, index: number) => ({
        id: index + 1,
        name: formatFieldName(field.field_name),
        type: field.field_type,
        required: field.is_required,
        enabled: field.is_enabled,
        field_name: field.field_name,
        display_order: field.display_order,
      }));

      setProfileFields(formattedFields);
    } catch (error: any) {
      console.error('Error fetching profile fields:', error);
      alert(`Failed to load profile fields: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatFieldName = (fieldName: string) => {
    return fieldName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const toggleFieldEnabled = (fieldId: number) => {
    setProfileFields((fields) =>
      fields.map((field) => {
        if (field.id === fieldId && !field.required) {
          return { ...field, enabled: !field.enabled };
        }
        return field;
      })
    );
  };

  const saveProfileFields = async () => {
    try {
      setSaving(true);

      // Convert back to backend format
      const fieldsToSave = profileFields.map((field) => ({
        field_name: field.field_name,
        is_enabled: field.enabled,
        is_required: field.required,
        display_order: field.display_order,
      }));

      await apiService.updateProfileFields(fieldsToSave);
      alert('Profile field settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving profile fields:', error);
      alert(`Failed to save profile fields: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <h2 className="text-2xl font-bold text-gray-900">User Profiles</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure user profile fields and layouts
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px px-6">
              <button
                onClick={() => setActiveTab('fields')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'fields'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Profile Fields
              </button>
              <button
                onClick={() => setActiveTab('layouts')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'layouts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Profile Layouts
              </button>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading profile fields...</div>
              </div>
            ) : activeTab === 'fields' ? (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Fields</h3>
                    <p className="text-sm text-gray-600">
                      Configure which fields are available and required in user profiles
                    </p>
                  </div>
                  <button
                    onClick={saveProfileFields}
                    disabled={saving}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                <div className="space-y-2">
                  {profileFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 6h16M4 12h16M4 18h16"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{field.name}</div>
                          <div className="text-sm text-gray-500">
                            Type: <span className="capitalize">{field.type}</span>
                            {field.required && (
                              <span className="ml-2 text-red-600">• Required</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {field.required ? (
                          <span className="text-xs text-gray-500 italic">Always enabled</span>
                        ) : (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.enabled}
                              onChange={() => toggleFieldEnabled(field.id)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-blue-600 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">
                        Profile Field Management
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Enable or disable fields to customize what information is collected in user
                        profiles. Required fields cannot be disabled.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Layouts</h3>
                  <p className="text-sm text-gray-600">
                    Customize how profile information is displayed
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 border-2 border-blue-500 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Standard Layout</h4>
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                        Active
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Default profile layout with all standard fields
                    </p>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div>• Personal Information</div>
                      <div>• Contact Details</div>
                      <div>• Work Information</div>
                      <div>• Preferences</div>
                    </div>
                  </div>

                  <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Compact Layout</h4>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Activate
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Minimal profile layout with essential fields only
                    </p>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div>• Basic Information</div>
                      <div>• Contact Details</div>
                    </div>
                  </div>

                  <div className="p-6 border border-gray-200 rounded-lg hover:border-gray-300">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Detailed Layout</h4>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Activate
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Comprehensive profile layout with all available fields
                    </p>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div>• Personal Information</div>
                      <div>• Contact Details</div>
                      <div>• Work Information</div>
                      <div>• Preferences</div>
                      <div>• Additional Details</div>
                      <div>• Custom Fields</div>
                    </div>
                  </div>

                  <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 flex items-center justify-center cursor-pointer">
                    <div className="text-center">
                      <div className="text-gray-400 text-4xl mb-2">+</div>
                      <div className="text-sm font-medium text-gray-600">Create Custom Layout</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profiles;
