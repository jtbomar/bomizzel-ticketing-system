import React, { useState, useEffect } from 'react';
import { CustomField } from '../types';
import { apiService } from '../services/api';

interface CustomFieldConfigProps {
  teamId: string;
  onClose: () => void;
}

const CustomFieldConfig: React.FC<CustomFieldConfigProps> = ({
  teamId,
  onClose,
}) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadCustomFields();
  }, [teamId]);

  const loadCustomFields = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTeamCustomFields(teamId);
      setFields(response.data || response);
    } catch (err) {
      setError('Failed to load custom fields');
      console.error('Error loading custom fields:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveField = async (fieldData: Partial<CustomField>) => {
    try {
      setSaving(true);
      setError(null);

      if (editingField) {
        // Update existing field
        const updatedField = await apiService.updateCustomField(editingField.id, fieldData);
        setFields(prev => prev.map(f => f.id === editingField.id ? updatedField : f));
      } else {
        // Create new field
        const newField = await apiService.createCustomField({
          teamId,
          ...fieldData,
        } as any);
        setFields(prev => [...prev, newField]);
      }

      setEditingField(null);
      setShowAddForm(false);
    } catch (err) {
      setError('Failed to save custom field');
      console.error('Error saving custom field:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this custom field?')) {
      return;
    }

    try {
      await apiService.deleteCustomField(fieldId);
      setFields(prev => prev.filter(f => f.id !== fieldId));
    } catch (err) {
      setError('Failed to delete custom field');
      console.error('Error deleting custom field:', err);
    }
  };

  const CustomFieldForm: React.FC<{
    field?: CustomField;
    onSave: (data: Partial<CustomField>) => void;
    onCancel: () => void;
  }> = ({ field, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      name: field?.name || '',
      label: field?.label || '',
      type: field?.type || 'string',
      isRequired: field?.isRequired || false,
      options: field?.options?.join('\n') || '',
      validation: field?.validation || {},
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const data: Partial<CustomField> = {
        name: formData.name,
        label: formData.label,
        type: formData.type as any,
        isRequired: formData.isRequired,
      };

      if (formData.type === 'picklist' && formData.options) {
        data.options = formData.options.split('\n').filter(opt => opt.trim());
      }

      if (formData.validation && Object.keys(formData.validation).length > 0) {
        data.validation = formData.validation;
      }

      onSave(data);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Field Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Display Label
          </label>
          <input
            type="text"
            value={formData.label}
            onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Field Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'string' | 'number' | 'decimal' | 'integer' | 'picklist' }))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="string">Text</option>
            <option value="number">Number</option>
            <option value="integer">Integer</option>
            <option value="decimal">Decimal</option>
            <option value="picklist">Dropdown</option>
          </select>
        </div>

        {formData.type === 'picklist' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Options (one per line)
            </label>
            <textarea
              value={formData.options}
              onChange={(e) => setFormData(prev => ({ ...prev, options: e.target.value }))}
              rows={4}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Option 1&#10;Option 2&#10;Option 3"
            />
          </div>
        )}

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isRequired"
            checked={formData.isRequired}
            onChange={(e) => setFormData(prev => ({ ...prev, isRequired: e.target.checked }))}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isRequired" className="ml-2 block text-sm text-gray-900">
            Required field
          </label>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Custom Field Configuration
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Add New Field Button */}
        {!showAddForm && !editingField && (
          <div className="mb-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Custom Field
            </button>
          </div>
        )}

        {/* Add/Edit Form */}
        {(showAddForm || editingField) && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              {editingField ? 'Edit Custom Field' : 'Add New Custom Field'}
            </h4>
            <CustomFieldForm
              field={editingField || undefined}
              onSave={handleSaveField}
              onCancel={() => {
                setEditingField(null);
                setShowAddForm(false);
              }}
            />
          </div>
        )}

        {/* Existing Fields */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">Existing Fields</h4>
          
          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
              </svg>
              <p>No custom fields configured yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h5 className="text-sm font-medium text-gray-900">
                        {field.label}
                      </h5>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {field.type}
                      </span>
                      {field.isRequired && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Field name: {field.name}
                    </p>
                    {field.options && field.options.length > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        Options: {field.options.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingField(field)}
                      className="text-blue-600 hover:text-blue-900 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomFieldConfig;