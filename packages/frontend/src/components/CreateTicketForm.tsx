import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { Team, CustomField, Ticket } from '../types';
import UsageWarning from './UsageWarning';
import SubscriptionBenefitsHelp from './SubscriptionBenefitsHelp';
import { useUsageWarnings } from '../hooks/useUsageWarnings';

interface CreateTicketFormProps {
  companyId: string;
  onTicketCreated: (ticket: Ticket) => void;
}

const CreateTicketForm: React.FC<CreateTicketFormProps> = ({
  companyId,
  onTicketCreated,
}) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    teamId: '',
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [showUsageWarning, setShowUsageWarning] = useState(false);
  const [usageWarningData, setUsageWarningData] = useState<any>(null);
  
  const { checkTicketCreation, checkCanCreateTicket } = useUsageWarnings();

  useEffect(() => {
    loadTeams();
    checkUsageWarnings();
  }, []);

  const checkUsageWarnings = async () => {
    try {
      const warningResult = await checkTicketCreation();
      if (warningResult.warning) {
        setUsageWarningData(warningResult.warning);
        setShowUsageWarning(true);
      }
    } catch (error) {
      console.error('Error checking usage warnings:', error);
    }
  };

  useEffect(() => {
    if (selectedTeamId) {
      loadCustomFields(selectedTeamId);
    } else {
      setCustomFields([]);
      setCustomFieldValues({});
    }
  }, [selectedTeamId]);

  const loadTeams = async () => {
    try {
      setTeamsLoading(true);
      const response = await apiService.getTeams();
      const availableTeams = response.data || response;
      setTeams(availableTeams);
      
      // Auto-select first team if only one exists
      if (availableTeams.length === 1) {
        setSelectedTeamId(availableTeams[0].id);
        setFormData(prev => ({ ...prev, teamId: availableTeams[0].id }));
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
      setErrors({ teams: 'Failed to load available teams' });
    } finally {
      setTeamsLoading(false);
    }
  };

  const loadCustomFields = async (teamId: string) => {
    try {
      const response = await apiService.getTeamCustomFields(teamId);
      const fields = response.data || response;
      setCustomFields(fields);
      
      // Initialize custom field values
      const initialValues: Record<string, any> = {};
      fields.forEach((field: CustomField) => {
        if (field.type === 'picklist' && field.options && field.options.length > 0) {
          initialValues[field.name] = field.isRequired ? field.options[0] : '';
        } else {
          initialValues[field.name] = '';
        }
      });
      setCustomFieldValues(initialValues);
    } catch (err) {
      console.error('Failed to load custom fields:', err);
      setErrors({ customFields: 'Failed to load custom fields for this team' });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value;
    setSelectedTeamId(teamId);
    setFormData(prev => ({ ...prev, teamId }));
    
    if (errors.teamId) {
      setErrors(prev => ({ ...prev, teamId: '' }));
    }
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error when user changes value
    if (errors[`customField_${fieldName}`]) {
      setErrors(prev => ({ ...prev, [`customField_${fieldName}`]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.teamId) {
      newErrors.teamId = 'Please select a team';
    }

    // Validate custom fields
    customFields.forEach(field => {
      const value = customFieldValues[field.name];
      
      if (field.isRequired && (!value || value.toString().trim() === '')) {
        newErrors[`customField_${field.name}`] = `${field.label} is required`;
      }

      if (value && field.validation) {
        const { min, max, pattern } = field.validation;
        
        if (field.type === 'number' || field.type === 'integer' || field.type === 'decimal') {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            newErrors[`customField_${field.name}`] = `${field.label} must be a valid number`;
          } else {
            if (min !== undefined && numValue < min) {
              newErrors[`customField_${field.name}`] = `${field.label} must be at least ${min}`;
            }
            if (max !== undefined && numValue > max) {
              newErrors[`customField_${field.name}`] = `${field.label} must be at most ${max}`;
            }
          }
        }

        if (field.type === 'string' && pattern) {
          const regex = new RegExp(pattern);
          if (!regex.test(value.toString())) {
            newErrors[`customField_${field.name}`] = field.validation.message || `${field.label} format is invalid`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Check if user can create a ticket
      const canCreateResult = await checkCanCreateTicket();
      if (!canCreateResult.canCreate) {
        setErrors({ 
          submit: canCreateResult.reason || 'You have reached your ticket limit. Please upgrade your plan to continue.' 
        });
        setLoading(false);
        return;
      }

      // Create the ticket
      const ticketData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        companyId,
        teamId: formData.teamId,
        customFieldValues,
      };

      const response = await apiService.createTicket(ticketData);
      const newTicket = response.ticket || response;

      // Upload attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          try {
            await apiService.uploadFile(newTicket.id, file);
          } catch (err) {
            console.error('Failed to upload attachment:', file.name, err);
          }
        }
      }

      onTicketCreated(newTicket);
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error?.message || 'Failed to create ticket' });
    } finally {
      setLoading(false);
    }
  };

  const renderCustomField = (field: CustomField) => {
    const value = customFieldValues[field.name] || '';
    const error = errors[`customField_${field.name}`];

    switch (field.type) {
      case 'string':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={`input ${error ? 'border-red-300' : ''}`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'number':
      case 'decimal':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              step={field.type === 'decimal' ? '0.01' : '1'}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={`input ${error ? 'border-red-300' : ''}`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'integer':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              step="1"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, parseInt(e.target.value) || '')}
              className={`input ${error ? 'border-red-300' : ''}`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'picklist':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={`input ${error ? 'border-red-300' : ''}`}
            >
              {!field.isRequired && <option value="">Select {field.label.toLowerCase()}</option>}
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (teamsLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate('/customer')}
          className="btn-secondary flex items-center space-x-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Tickets</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
      </div>

      {/* Usage Warning */}
      {showUsageWarning && usageWarningData && (
        <div className="mb-6">
          <UsageWarning
            warning={usageWarningData}
            onDismiss={() => setShowUsageWarning(false)}
            showDismiss={usageWarningData.severity !== 'error'}
          />
          {usageWarningData.showUpgradePrompt && (
            <div className="mt-3 text-center">
              <SubscriptionBenefitsHelp />
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.submit}
            </div>
          )}

          {errors.teams && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.teams}
            </div>
          )}

          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTeamId}
              onChange={handleTeamChange}
              className={`input ${errors.teamId ? 'border-red-300' : ''}`}
              disabled={teams.length <= 1}
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {errors.teamId && <p className="mt-1 text-sm text-red-600">{errors.teamId}</p>}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`input ${errors.title ? 'border-red-300' : ''}`}
              placeholder="Brief description of your issue"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              rows={6}
              value={formData.description}
              onChange={handleInputChange}
              className={`input ${errors.description ? 'border-red-300' : ''}`}
              placeholder="Provide detailed information about your issue, including steps to reproduce, expected behavior, and any error messages"
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
              {customFields
                .sort((a, b) => a.order - b.order)
                .map(renderCustomField)}
            </div>
          )}

          {/* File Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>
            <div className="space-y-3">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-2">
                        <PaperClipIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/customer')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Ticket...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicketForm;