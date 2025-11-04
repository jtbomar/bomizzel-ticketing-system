import React, { useState, useEffect } from 'react';
import { 
  TicketLayoutResponse, 
  LayoutField, 
  PicklistOption 
} from '../types/ticketLayout';
import { ticketLayoutApi } from '../services/ticketLayoutApi';

interface DynamicTicketFormProps {
  teamId: string;
  layoutId?: string;
  initialValues?: Record<string, any>;
  onSubmit: (formData: Record<string, any>) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

const DynamicTicketForm: React.FC<DynamicTicketFormProps> = ({
  teamId,
  layoutId,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Create Ticket'
}) => {
  const [layout, setLayout] = useState<TicketLayoutResponse | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLayout();
  }, [teamId, layoutId]);

  const loadLayout = async () => {
    try {
      setLoading(true);
      let layoutData: TicketLayoutResponse;
      
      if (layoutId) {
        layoutData = await ticketLayoutApi.getLayoutById(layoutId);
      } else {
        layoutData = await ticketLayoutApi.getDefaultLayout(teamId);
      }
      
      setLayout(layoutData);
      
      // Set default values from field configuration
      const defaultValues: Record<string, any> = {
        // Set default core field values
        status: 'open', // Default status
        priority: 'medium' // Default priority
      };
      
      layoutData.fields.forEach(field => {
        if (field.fieldConfig.defaultValue !== undefined) {
          defaultValues[field.fieldName] = field.fieldConfig.defaultValue;
        }
        // Set default picklist values
        if (field.fieldType === 'picklist' && field.fieldConfig.options) {
          const defaultOption = field.fieldConfig.options.find(opt => opt.isDefault);
          if (defaultOption) {
            defaultValues[field.fieldName] = defaultOption.value;
          }
        }
      });
      
      setFormData(prev => ({ ...defaultValues, ...prev }));
    } catch (error) {
      console.error('Error loading layout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  const validateForm = (): boolean => {
    if (!layout) return false;
    
    const newErrors: Record<string, string> = {};
    
    // Always validate required core fields
    if (!formData.title || formData.title.trim() === '') {
      newErrors.title = 'Title is required';
    }
    if (!formData.description || formData.description.trim() === '') {
      newErrors.description = 'Description is required';
    }
    if (!formData.status || formData.status.trim() === '') {
      newErrors.status = 'Status is required';
    }
    
    // Validate custom fields
    layout.fields.forEach(field => {
      const value = formData[field.fieldName];
      
      // Required field validation
      if (field.isRequired && (!value || value === '')) {
        newErrors[field.fieldName] = `${field.fieldLabel} is required`;
        return;
      }
      
      // Skip validation if field is empty and not required
      if (!value && !field.isRequired) return;
      
      // Field-specific validation
      if (field.validationRules) {
        const rules = field.validationRules;
        
        // String length validation
        if (rules.minLength && value.length < rules.minLength) {
          newErrors[field.fieldName] = `${field.fieldLabel} must be at least ${rules.minLength} characters`;
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          newErrors[field.fieldName] = `${field.fieldLabel} must be no more than ${rules.maxLength} characters`;
        }
        
        // Number validation
        if (rules.min !== undefined && value < rules.min) {
          newErrors[field.fieldName] = `${field.fieldLabel} must be at least ${rules.min}`;
        }
        if (rules.max !== undefined && value > rules.max) {
          newErrors[field.fieldName] = `${field.fieldLabel} must be no more than ${rules.max}`;
        }
        
        // Pattern validation
        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          newErrors[field.fieldName] = `${field.fieldLabel} format is invalid`;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const renderField = (field: LayoutField) => {
    const value = formData[field.fieldName] || '';
    const error = errors[field.fieldName];
    const hasError = !!error;

    const baseInputClasses = `
      w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500
      ${hasError ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}
    `;

    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            placeholder={field.fieldConfig.placeholder}
            className={baseInputClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            placeholder={field.fieldConfig.placeholder}
            rows={3}
            className={baseInputClasses}
          />
        );

      case 'rich_text':
        // For now, use a textarea. In production, you'd integrate a rich text editor
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            placeholder={field.fieldConfig.placeholder || 'Enter formatted text...'}
            rows={5}
            className={baseInputClasses}
          />
        );

      case 'number':
        const numberConfig = field.fieldConfig.numberConfig;
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, parseFloat(e.target.value) || 0)}
            min={numberConfig?.min}
            max={numberConfig?.max}
            step={numberConfig?.step}
            className={baseInputClasses}
          />
        );

      case 'currency':
        const currencyConfig = field.fieldConfig.currency;
        return (
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">
              {currencyConfig?.symbol || '$'}
            </span>
            <input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.fieldName, parseFloat(e.target.value) || 0)}
              step={currencyConfig?.precision ? `0.${'0'.repeat(currencyConfig.precision - 1)}1` : '0.01'}
              className={`${baseInputClasses} pl-8`}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            className={baseInputClasses}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            className={baseInputClasses}
          />
        );

      case 'picklist':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            className={baseInputClasses}
          >
            <option value="">Select an option...</option>
            {field.fieldConfig.options?.map((option: PicklistOption) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multi_picklist':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {field.fieldConfig.options?.map((option: PicklistOption) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter(v => v !== option.value);
                    handleFieldChange(field.fieldName, newValues);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(field.fieldName, e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">{field.fieldLabel}</span>
          </label>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.fieldConfig.options?.map((option: PicklistOption) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name={field.fieldName}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            className={baseInputClasses}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No ticket layout found for this team.</p>
      </div>
    );
  }

  // Sort fields by grid position for proper rendering order
  const sortedFields = [...layout.fields].sort((a, b) => {
    if (a.gridPositionY !== b.gridPositionY) {
      return a.gridPositionY - b.gridPositionY;
    }
    return a.gridPositionX - b.gridPositionX;
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{layout.layout.name}</h2>
        {layout.layout.description && (
          <p className="text-sm text-gray-600 mt-1">{layout.layout.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Required Fields Section */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Ticket Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title Field */}
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Enter a brief title for this ticket"
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.title ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                required
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Status Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status || ''}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.status ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                required
              >
                <option value="">Select status...</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="testing">Testing</option>
                <option value="review">Review</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              {errors.status && (
                <p className="text-sm text-red-600">{errors.status}</p>
              )}
            </div>

            {/* Priority Field (optional, can be overridden by custom fields) */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Priority
              </label>
              <select
                value={formData.priority || ''}
                onChange={(e) => handleFieldChange('priority', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select priority...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Description Field */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Provide a detailed description of the issue or request"
              rows={4}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
              }`}
              required
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description}</p>
            )}
          </div>
        </div>

        {/* Custom Fields Section */}
        {sortedFields.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Additional Information</h3>
            <div 
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${layout.layout.layoutConfig.gridColumns}, 1fr)`
              }}
            >
              {sortedFields.map((field) => (
                <div
                  key={field.id}
                  style={{
                    gridColumn: `${field.gridPositionX + 1} / span ${field.gridWidth}`,
                    gridRow: `${field.gridPositionY + 1} / span ${field.gridHeight}`
                  }}
                >
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      {field.fieldLabel}
                      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {renderField(field)}
                    {errors[field.fieldName] && (
                      <p className="text-sm text-red-600">{errors[field.fieldName]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DynamicTicketForm;