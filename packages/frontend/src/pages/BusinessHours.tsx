import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface BusinessHoursSchedule {
  id?: number;
  business_hours_id?: number;
  day_of_week: number;
  is_working_day: boolean;
  start_time?: string;
  end_time?: string;
  break_start?: string;
  break_end?: string;
}

interface BusinessHours {
  id?: number;
  company_id?: string;
  title: string;
  description?: string;
  timezone: string;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  schedule: BusinessHoursSchedule[];
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC'
];

const BusinessHours: React.FC = () => {
  const navigate = useNavigate();
  const [businessHoursList, setBusinessHoursList] = useState<BusinessHours[]>([]);
  const [selectedBusinessHours, setSelectedBusinessHours] = useState<BusinessHours | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<BusinessHours>({
    title: '',
    description: '',
    timezone: 'America/New_York',
    is_active: true,
    is_default: false,
    schedule: DAYS_OF_WEEK.map((_, index) => ({
      day_of_week: index,
      is_working_day: index >= 1 && index <= 5, // Monday to Friday
      start_time: index >= 1 && index <= 5 ? '09:00' : '',
      end_time: index >= 1 && index <= 5 ? '17:00' : '',
      break_start: '',
      break_end: ''
    }))
  });

  // Track which days have breaks enabled
  const [breaksEnabled, setBreaksEnabled] = useState<boolean[]>(
    DAYS_OF_WEEK.map(() => false)
  );

  useEffect(() => {
    fetchBusinessHours();
  }, []);

  const fetchBusinessHours = async () => {
    try {
      setLoading(true);
      const businessHoursData = await apiService.getBusinessHours();
      setBusinessHoursList(businessHoursData);
      
      // Select the default one if available
      const defaultBH = businessHoursData.find((bh: BusinessHours) => bh.is_default);
      if (defaultBH) {
        setSelectedBusinessHours(defaultBH);
      } else if (businessHoursData.length > 0) {
        setSelectedBusinessHours(businessHoursData[0]);
      }
    } catch (error) {
      console.error('Error fetching business hours:', error);
      alert('Failed to load business hours. Please check your authentication and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.title.trim()) {
      alert('Please enter a title for the business hours configuration.');
      return;
    }

    try {
      setSaving(true);
      
      // Convert time format from HH:MM to HH:MM:SS for backend
      const scheduleData = formData.schedule.map(s => ({
        ...s,
        start_time: s.start_time && s.start_time.trim() ? `${s.start_time}:00` : null,
        end_time: s.end_time && s.end_time.trim() ? `${s.end_time}:00` : null,
        break_start: s.break_start && s.break_start.trim() ? `${s.break_start}:00` : null,
        break_end: s.break_end && s.break_end.trim() ? `${s.break_end}:00` : null
      }));

      const payload = {
        businessHours: {
          title: formData.title,
          description: formData.description,
          timezone: formData.timezone,
          is_active: formData.is_active,
          is_default: formData.is_default
        },
        schedule: scheduleData
      };

      if (isCreating) {
        await apiService.createBusinessHours(payload);
      } else if (selectedBusinessHours?.id) {
        await apiService.updateBusinessHours(selectedBusinessHours.id, payload);
      }

      await fetchBusinessHours();
      setIsEditing(false);
      setIsCreating(false);
    } catch (error: any) {
      console.error('Error saving business hours:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to save business hours: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this business hours configuration?')) {
      return;
    }

    try {
      await apiService.deleteBusinessHours(id);
      await fetchBusinessHours();
      
      if (selectedBusinessHours?.id === id) {
        setSelectedBusinessHours(businessHoursList.length > 1 ? businessHoursList[0] : null);
      }
    } catch (error) {
      console.error('Error deleting business hours:', error);
      alert('Failed to delete business hours. Please try again.');
    }
  };

  const startEditing = (businessHours?: BusinessHours) => {
    if (businessHours) {
      // Convert time format from HH:MM:SS to HH:MM for form inputs
      const scheduleData = businessHours.schedule.map(s => ({
        ...s,
        start_time: s.start_time ? s.start_time.substring(0, 5) : '',
        end_time: s.end_time ? s.end_time.substring(0, 5) : '',
        break_start: s.break_start ? s.break_start.substring(0, 5) : '',
        break_end: s.break_end ? s.break_end.substring(0, 5) : ''
      }));

      // Set breaks enabled state based on existing data
      const breaksEnabledState = businessHours.schedule.map(s => 
        !!(s.break_start && s.break_end)
      );

      setFormData({
        ...businessHours,
        schedule: scheduleData
      });
      setBreaksEnabled(breaksEnabledState);
      setSelectedBusinessHours(businessHours);
      setIsEditing(true);
      setIsCreating(false);
    } else {
      // Create new
      setFormData({
        title: '',
        description: '',
        timezone: 'America/New_York',
        is_active: true,
        is_default: false,
        schedule: DAYS_OF_WEEK.map((_, index) => ({
          day_of_week: index,
          is_working_day: index >= 1 && index <= 5,
          start_time: index >= 1 && index <= 5 ? '09:00' : '',
          end_time: index >= 1 && index <= 5 ? '17:00' : '',
          break_start: '',
          break_end: ''
        }))
      });
      setBreaksEnabled(DAYS_OF_WEEK.map(() => false));
      setIsCreating(true);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setIsCreating(false);
    setFormData({
      title: '',
      description: '',
      timezone: 'America/New_York',
      is_active: true,
      is_default: false,
      schedule: []
    });
  };

  const updateScheduleDay = (dayIndex: number, field: keyof BusinessHoursSchedule, value: any) => {
    const newSchedule = [...formData.schedule];
    newSchedule[dayIndex] = {
      ...newSchedule[dayIndex],
      [field]: value
    };
    setFormData({ ...formData, schedule: newSchedule });
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
                <h1 className="text-2xl font-semibold text-gray-900">Business Hours</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Set your operating hours for SLA calculations and automations
                </p>
              </div>
            </div>
            <button
              onClick={() => startEditing()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add New Hours
            </button>
          </div>
        </div>

        <div className="p-6">
          {businessHoursList.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🕐</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Business Hours Configured</h3>
              <p className="text-gray-600 mb-4">
                Set up your business hours to enable SLA calculations and time-based automations.
              </p>
              <button
                onClick={() => startEditing()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Business Hours
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Business Hours List */}
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Configurations</h3>
                <div className="space-y-2">
                  {businessHoursList.map((bh) => (
                    <div
                      key={bh.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedBusinessHours?.id === bh.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedBusinessHours(bh)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{bh.title}</h4>
                          {bh.description && (
                            <p className="text-sm text-gray-600 mt-1">{bh.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {bh.is_default && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Default
                              </span>
                            )}
                            {bh.is_active ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(bh);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          {!bh.is_default && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(bh.id!);
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

              {/* Business Hours Details/Edit Form */}
              <div className="lg:col-span-2">
                {isEditing ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isCreating ? 'Create Business Hours' : 'Edit Business Hours'}
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
                            Title *
                          </label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Standard Business Hours"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Timezone
                          </label>
                          <select
                            value={formData.timezone}
                            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {TIMEZONES.map(tz => (
                              <option key={tz} value={tz}>{tz}</option>
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
                          placeholder="Optional description for this business hours configuration"
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

                      {/* Schedule */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-4">Weekly Schedule</h4>
                        <div className="space-y-3">
                          {formData.schedule.map((day, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                              <div className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-2">
                                  <span className="text-sm font-medium text-gray-700">
                                    {DAYS_OF_WEEK[index]}
                                  </span>
                                </div>
                                <div className="col-span-2">
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={day.is_working_day}
                                      onChange={(e) => updateScheduleDay(index, 'is_working_day', e.target.checked)}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Working Day</span>
                                  </label>
                                </div>
                                {day.is_working_day && (
                                  <>
                                    <div className="col-span-2">
                                      <input
                                        type="time"
                                        value={day.start_time}
                                        onChange={(e) => updateScheduleDay(index, 'start_time', e.target.value)}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <input
                                        type="time"
                                        value={day.end_time}
                                        onChange={(e) => updateScheduleDay(index, 'end_time', e.target.value)}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="col-span-4">
                                      <label className="flex items-center">
                                        <input
                                          type="checkbox"
                                          checked={breaksEnabled[index]}
                                          onChange={(e) => {
                                            const newBreaksEnabled = [...breaksEnabled];
                                            newBreaksEnabled[index] = e.target.checked;
                                            setBreaksEnabled(newBreaksEnabled);
                                            
                                            // Clear break times if unchecked
                                            if (!e.target.checked) {
                                              updateScheduleDay(index, 'break_start', '');
                                              updateScheduleDay(index, 'break_end', '');
                                            }
                                          }}
                                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">Add Break</span>
                                      </label>
                                    </div>
                                  </>
                                )}
                              </div>
                              
                              {day.is_working_day && breaksEnabled[index] && (
                                <div className="grid grid-cols-12 gap-3 items-center mt-2">
                                  <div className="col-span-6"></div>
                                  <div className="col-span-3">
                                    <label className="block text-xs text-gray-600 mb-1">Break Start</label>
                                    <input
                                      type="time"
                                      value={day.break_start}
                                      onChange={(e) => updateScheduleDay(index, 'break_start', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="col-span-3">
                                    <label className="block text-xs text-gray-600 mb-1">Break End</label>
                                    <input
                                      type="time"
                                      value={day.break_end}
                                      onChange={(e) => updateScheduleDay(index, 'break_end', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-2">Day</div>
                            <div className="col-span-2">Working</div>
                            <div className="col-span-2">Start Time</div>
                            <div className="col-span-2">End Time</div>
                            <div className="col-span-4">Break Options</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedBusinessHours ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {selectedBusinessHours.title}
                      </h3>
                      <button
                        onClick={() => startEditing(selectedBusinessHours)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="space-y-4">
                      {selectedBusinessHours.description && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                          <p className="text-gray-600">{selectedBusinessHours.description}</p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Timezone</h4>
                        <p className="text-gray-600">{selectedBusinessHours.timezone}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Weekly Schedule</h4>
                        <div className="space-y-2">
                          {selectedBusinessHours.schedule.map((day, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="font-medium text-gray-700 w-20">
                                {DAYS_OF_WEEK[index]}
                              </span>
                              {day.is_working_day ? (
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>{day.start_time?.substring(0, 5)} - {day.end_time?.substring(0, 5)}</span>
                                  {day.break_start && day.break_end && (
                                    <span className="text-orange-600">
                                      Break: {day.break_start.substring(0, 5)} - {day.break_end.substring(0, 5)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">Closed</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-4xl mb-4">📅</div>
                    <p className="text-gray-600">Select a business hours configuration to view details</p>
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

export default BusinessHours;