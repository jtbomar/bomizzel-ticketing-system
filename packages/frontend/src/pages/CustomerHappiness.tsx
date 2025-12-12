import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface CustomerHappinessSetting {
  id: number;
  company_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  survey_config: {
    rating_scale: 'five_star' | 'ten_point' | 'thumbs' | 'emoji';
    rating_question: string;
    custom_questions: Array<{
      id: string;
      question: string;
      type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'scale';
      required: boolean;
      options?: string[];
    }>;
    include_comments: boolean;
    comments_required: boolean;
    comments_placeholder: string;
  };
  trigger_conditions: {
    on_ticket_resolved: boolean;
    on_ticket_closed: boolean;
    department_ids: number[];
    priority_levels: string[];
    ticket_types: string[];
    exclude_internal_tickets: boolean;
  };
  email_template: {
    subject: string;
    header_text: string;
    footer_text: string;
    button_text: string;
    company_logo?: string;
    primary_color: string;
    include_ticket_details: boolean;
  };
  delay_hours: number;
  reminder_hours: number;
  max_reminders: number;
  thank_you_message: string;
  follow_up_message?: string;
  low_rating_threshold: number;
  created_at: string;
  updated_at: string;
  stats: {
    total_surveys_sent: number;
    total_responses: number;
    completion_rate: number;
    average_rating: number;
    last_30_days: {
      surveys_sent: number;
      responses: number;
      average_rating: number;
    };
  };
}

const CustomerHappiness: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CustomerHappinessSetting[]>([]);
  const [selectedSetting, setSelectedSetting] = useState<CustomerHappinessSetting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const settingsData = await apiService.getCustomerHappinessSettings();
      setSettings(settingsData);

      // Select the default one if available
      const defaultSetting = settingsData.find(
        (setting: CustomerHappinessSetting) => setting.is_default
      );
      if (defaultSetting) {
        setSelectedSetting(defaultSetting);
      } else if (settingsData.length > 0) {
        setSelectedSetting(settingsData[0]);
      }
    } catch (error) {
      console.error('Error fetching customer happiness settings:', error);
      alert(
        'Failed to load customer happiness settings. Please check your authentication and try again.'
      );
    } finally {
      setLoading(false);
    }
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Settings
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Customer Happiness</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Configure customer satisfaction surveys and feedback collection
                </p>
              </div>
            </div>
            <button
              onClick={() => alert('Create new survey configuration coming soon!')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add New Survey
            </button>
          </div>
        </div>

        <div className="p-6">
          {settings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">😊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Customer Happiness Settings Configured
              </h3>
              <p className="text-gray-600 mb-4">
                Create customer satisfaction surveys to collect feedback after ticket resolution.
              </p>
              <button
                onClick={() => alert('Create survey configuration coming soon!')}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Survey Configuration
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Settings List */}
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Survey Configurations</h3>
                <div className="space-y-2">
                  {settings.map((setting) => (
                    <div
                      key={setting.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedSetting?.id === setting.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedSetting(setting)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{setting.name}</h4>
                          {setting.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {setting.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {setting.is_default && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Default
                              </span>
                            )}
                            {setting.is_active ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
                            <div>
                              <span className="font-medium">
                                {setting.stats.total_surveys_sent}
                              </span>{' '}
                              surveys sent
                            </div>
                            <div>
                              <span className="font-medium">{setting.stats.completion_rate}%</span>{' '}
                              completion
                            </div>
                            <div>
                              <span className="font-medium">{setting.stats.total_responses}</span>{' '}
                              responses
                            </div>
                            <div>
                              <span className="font-medium">
                                {setting.stats.average_rating.toFixed(1)}
                              </span>{' '}
                              avg rating
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert('Edit survey configuration coming soon!');
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          {!setting.is_default && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('Delete survey configuration coming soon!');
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

              {/* Setting Details */}
              <div className="lg:col-span-2">
                {selectedSetting ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {selectedSetting.name}
                        </h3>
                        {selectedSetting.description && (
                          <p className="text-gray-600">{selectedSetting.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => alert('Edit survey configuration coming soon!')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Edit Configuration
                      </button>
                    </div>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedSetting.stats.total_surveys_sent}
                        </div>
                        <div className="text-sm text-blue-800">Surveys Sent</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedSetting.stats.total_responses}
                        </div>
                        <div className="text-sm text-green-800">Responses</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {selectedSetting.stats.completion_rate}%
                        </div>
                        <div className="text-sm text-purple-800">Completion Rate</div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">
                          {selectedSetting.stats.average_rating.toFixed(1)}
                        </div>
                        <div className="text-sm text-yellow-800">Average Rating</div>
                      </div>
                    </div>

                    {/* Configuration Overview */}
                    <div className="space-y-6">
                      {/* Survey Configuration */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">
                          Survey Configuration
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Rating Scale:</span>
                            <span className="ml-2 text-sm text-gray-600 capitalize">
                              {selectedSetting.survey_config.rating_scale.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">
                              Rating Question:
                            </span>
                            <span className="ml-2 text-sm text-gray-600">
                              {selectedSetting.survey_config.rating_question}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">
                              Custom Questions:
                            </span>
                            <span className="ml-2 text-sm text-gray-600">
                              {selectedSetting.survey_config.custom_questions.length} questions
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Comments:</span>
                            <span className="ml-2 text-sm text-gray-600">
                              {selectedSetting.survey_config.include_comments
                                ? 'Enabled'
                                : 'Disabled'}
                              {selectedSetting.survey_config.include_comments &&
                                selectedSetting.survey_config.comments_required &&
                                ' (Required)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Trigger Conditions */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">
                          Trigger Conditions
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedSetting.trigger_conditions.on_ticket_resolved}
                                disabled
                                className="rounded border-gray-300 text-blue-600"
                              />
                              <span className="ml-2 text-sm text-gray-700">On Ticket Resolved</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedSetting.trigger_conditions.on_ticket_closed}
                                disabled
                                className="rounded border-gray-300 text-blue-600"
                              />
                              <span className="ml-2 text-sm text-gray-700">On Ticket Closed</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={
                                  selectedSetting.trigger_conditions.exclude_internal_tickets
                                }
                                disabled
                                className="rounded border-gray-300 text-blue-600"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                Exclude Internal Tickets
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Email Template */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">Email Template</h4>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Subject:</span>
                            <span className="ml-2 text-sm text-gray-600">
                              {selectedSetting.email_template.subject}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Header Text:</span>
                            <span className="ml-2 text-sm text-gray-600">
                              {selectedSetting.email_template.header_text}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Button Text:</span>
                            <span className="ml-2 text-sm text-gray-600">
                              {selectedSetting.email_template.button_text}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">
                              Primary Color:
                            </span>
                            <span className="ml-2 inline-flex items-center">
                              <div
                                className="w-4 h-4 rounded border border-gray-300 mr-2"
                                style={{
                                  backgroundColor: selectedSetting.email_template.primary_color,
                                }}
                              ></div>
                              <span className="text-sm text-gray-600">
                                {selectedSetting.email_template.primary_color}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timing Settings */}
                      <div>
                        <h4 className="text-md font-medium text-gray-900 mb-3">Timing Settings</h4>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Delay:</span>
                              <div className="text-gray-600">
                                {selectedSetting.delay_hours} hours
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Reminder:</span>
                              <div className="text-gray-600">
                                {selectedSetting.reminder_hours} hours
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Max Reminders:</span>
                              <div className="text-gray-600">{selectedSetting.max_reminders}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-4xl mb-4">📊</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Select a Survey Configuration
                    </h3>
                    <p className="text-gray-600">
                      Choose a survey configuration from the list to view its details and
                      statistics.
                    </p>
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

export default CustomerHappiness;
