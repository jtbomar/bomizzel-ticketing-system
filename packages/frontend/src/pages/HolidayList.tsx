import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Holiday {
  id?: number;
  holiday_list_id?: number;
  name: string;
  date: string; // YYYY-MM-DD format
  is_recurring: boolean;
  recurrence_pattern?: string;
  description?: string;
}

interface HolidayList {
  id?: number;
  company_id?: string;
  name: string;
  description?: string;
  region?: string;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  holidays: Holiday[];
}

const REGIONS = [
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'OTHER', label: 'Other' }
];

const HolidayListPage: React.FC = () => {
  const navigate = useNavigate();
  const [holidayLists, setHolidayLists] = useState<HolidayList[]>([]);
  const [selectedHolidayList, setSelectedHolidayList] = useState<HolidayList | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<HolidayList>({
    name: '',
    description: '',
    region: 'US',
    is_active: true,
    is_default: false,
    holidays: []
  });

  useEffect(() => {
    fetchHolidayLists();
  }, []);

  const fetchHolidayLists = async () => {
    try {
      setLoading(true);
      const holidayListsData = await apiService.getHolidayLists();
      setHolidayLists(holidayListsData);
      
      // Select the default one if available
      const defaultHL = holidayListsData.find((hl: HolidayList) => hl.is_default);
      if (defaultHL) {
        setSelectedHolidayList(defaultHL);
      } else if (holidayListsData.length > 0) {
        setSelectedHolidayList(holidayListsData[0]);
      }
    } catch (error) {
      console.error('Error fetching holiday lists:', error);
      alert('Failed to load holiday lists. Please check your authentication and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.name.trim()) {
      alert('Please enter a name for the holiday list.');
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        holidayList: {
          name: formData.name,
          description: formData.description,
          region: formData.region,
          is_active: formData.is_active,
          is_default: formData.is_default
        },
        holidays: formData.holidays
      };

      if (isCreating) {
        await apiService.createHolidayList(payload);
      } else if (selectedHolidayList?.id) {
        await apiService.updateHolidayList(selectedHolidayList.id, payload);
      }

      await fetchHolidayLists();
      setIsEditing(false);
      setIsCreating(false);
    } catch (error: any) {
      console.error('Error saving holiday list:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to save holiday list: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this holiday list?')) {
      return;
    }

    try {
      await apiService.deleteHolidayList(id);
      await fetchHolidayLists();
      
      if (selectedHolidayList?.id === id) {
        setSelectedHolidayList(holidayLists.length > 1 ? holidayLists[0] : null);
      }
    } catch (error) {
      console.error('Error deleting holiday list:', error);
      alert('Failed to delete holiday list. Please try again.');
    }
  };

  const startEditing = (holidayList?: HolidayList) => {
    if (holidayList) {
      setFormData({ ...holidayList });
      setSelectedHolidayList(holidayList);
      setIsEditing(true);
      setIsCreating(false);
    } else {
      // Create new
      setFormData({
        name: '',
        description: '',
        region: 'US',
        is_active: true,
        is_default: false,
        holidays: []
      });
      setIsCreating(true);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setIsCreating(false);
    setFormData({
      name: '',
      description: '',
      region: 'US',
      is_active: true,
      is_default: false,
      holidays: []
    });
  };

  const addHoliday = () => {
    const newHoliday: Holiday = {
      name: '',
      date: '',
      is_recurring: true,
      recurrence_pattern: 'yearly',
      description: ''
    };
    setFormData({
      ...formData,
      holidays: [...formData.holidays, newHoliday]
    });
  };

  const updateHoliday = (index: number, field: keyof Holiday, value: any) => {
    const newHolidays = [...formData.holidays];
    newHolidays[index] = {
      ...newHolidays[index],
      [field]: value
    };
    setFormData({ ...formData, holidays: newHolidays });
  };

  const removeHoliday = (index: number) => {
    const newHolidays = formData.holidays.filter((_, i) => i !== index);
    setFormData({ ...formData, holidays: newHolidays });
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
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/settings')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Settings
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Holiday Lists</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Manage holidays that affect business hours and SLA calculations
                </p>
              </div>
            </div>
            <button
              onClick={() => startEditing()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add New Holiday List
            </button>
          </div>
        </div>

        <div className="p-6">
          {holidayLists.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Holiday Lists Configured</h3>
              <p className="text-gray-600 mb-4">
                Create holiday lists to exclude specific dates from business hours calculations.
              </p>
              <button
                onClick={() => startEditing()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Holiday List
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Holiday Lists */}
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Holiday Lists</h3>
                <div className="space-y-2">
                  {holidayLists.map((hl) => (
                    <div
                      key={hl.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedHolidayList?.id === hl.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedHolidayList(hl)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{hl.name}</h4>
                          {hl.description && (
                            <p className="text-sm text-gray-600 mt-1">{hl.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {hl.region && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {hl.region}
                              </span>
                            )}
                            {hl.is_default && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Default
                              </span>
                            )}
                            {hl.is_active ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {hl.holidays.length} holiday{hl.holidays.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(hl);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          {!hl.is_default && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(hl.id!);
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Holiday List Details */}
              <div className="lg:col-span-2">
                {isEditing ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isCreating ? 'Create Holiday List' : 'Edit Holiday List'}
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

                    <div className="space-y-6">
                      {/* Basic Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., US Federal Holidays"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Region
                          </label>
                          <select
                            value={formData.region}
                            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {REGIONS.map(region => (
                              <option key={region.value} value={region.value}>{region.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional description for this holiday list"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.is_default}
                            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Set as Default</span>
                        </label>
                      </div>

                      {/* Holidays */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-md font-medium text-gray-900">Holidays</h4>
                          <button
                            onClick={addHoliday}
                            className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors text-sm"
                          >
                            Add Holiday
                          </button>
                        </div>
                        
                        {formData.holidays.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-600">No holidays added yet. Click "Add Holiday" to get started.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {formData.holidays.map((holiday, index) => (
                              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Holiday Name</label>
                                    <input
                                      type="text"
                                      value={holiday.name}
                                      onChange={(e) => updateHoliday(index, 'name', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="e.g., Christmas Day"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Date</label>
                                    <input
                                      type="date"
                                      value={holiday.date}
                                      onChange={(e) => updateHoliday(index, 'date', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <label className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={holiday.is_recurring}
                                        onChange={(e) => updateHoliday(index, 'is_recurring', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="ml-2 text-xs text-gray-700">Recurring</span>
                                    </label>
                                    <button
                                      onClick={() => removeHoliday(index)}
                                      className="text-red-600 hover:text-red-800 text-sm"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                {holiday.description !== undefined && (
                                  <div className="mt-2">
                                    <label className="block text-xs text-gray-600 mb-1">Description (Optional)</label>
                                    <input
                                      type="text"
                                      value={holiday.description}
                                      onChange={(e) => updateHoliday(index, 'description', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Optional description"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : selectedHolidayList ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {selectedHolidayList.name}
                      </h3>
                      <button
                        onClick={() => startEditing(selectedHolidayList)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="space-y-4">
                      {selectedHolidayList.description && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                          <p className="text-gray-600">{selectedHolidayList.description}</p>
                        </div>
                      )}

                      {selectedHolidayList.region && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Region</h4>
                          <p className="text-gray-600">{REGIONS.find(r => r.value === selectedHolidayList.region)?.label || selectedHolidayList.region}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Holidays ({selectedHolidayList.holidays.length})</h4>
                        {selectedHolidayList.holidays.length === 0 ? (
                          <p className="text-gray-500 italic">No holidays configured</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedHolidayList.holidays.map((holiday, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <span className="font-medium text-gray-900">{holiday.name}</span>
                                  <span className="text-sm text-gray-600 ml-2">
                                    {new Date(holiday.date).toLocaleDateString()}
                                  </span>
                                  {holiday.is_recurring && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">
                                      Recurring
                                    </span>
                                  )}
                                </div>
                                {holiday.description && (
                                  <span className="text-sm text-gray-500">{holiday.description}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-4xl mb-4">📅</div>
                    <p className="text-gray-600">Select a holiday list to view details</p>
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

export default HolidayListPage;