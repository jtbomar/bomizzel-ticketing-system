import React, { useState, useEffect } from 'react';

interface TicketFormData {
  title: string;
  description: string;
  status: string;
  priority: string;
  customer?: string;
  assignedTo?: string;
}

interface StatusOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
  isDefault: boolean;
}

interface PriorityOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
  isDefault: boolean;
}

interface DefaultTicketFormProps {
  onSubmit: (data: TicketFormData) => void;
  onCancel?: () => void;
  initialData?: Partial<TicketFormData>;
  submitLabel?: string;
}

const DefaultTicketForm: React.FC<DefaultTicketFormProps> = ({
  onSubmit,
  onCancel,
  initialData = {},
  submitLabel = 'Create Ticket',
}) => {
  const [formData, setFormData] = useState<TicketFormData>({
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    customer: '',
    assignedTo: 'unassigned',
    ...initialData,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);

  // Load configured statuses and priorities
  useEffect(() => {
    // Load from localStorage (in production, this would be from API)
    const savedStatuses = localStorage.getItem('admin-statuses');
    const savedPriorities = localStorage.getItem('admin-priorities');

    // Default fallback statuses
    const defaultStatuses: StatusOption[] = [
      {
        id: '1',
        label: 'Open',
        value: 'open',
        color: 'red',
        order: 1,
        isActive: true,
        isDefault: true,
      },
      {
        id: '2',
        label: 'In Progress',
        value: 'in_progress',
        color: 'yellow',
        order: 2,
        isActive: true,
        isDefault: true,
      },
      {
        id: '3',
        label: 'Review',
        value: 'review',
        color: 'blue',
        order: 3,
        isActive: true,
        isDefault: true,
      },
      {
        id: '4',
        label: 'Resolved',
        value: 'resolved',
        color: 'green',
        order: 4,
        isActive: true,
        isDefault: true,
      },
    ];

    // Default fallback priorities
    const defaultPriorities: PriorityOption[] = [
      {
        id: '1',
        label: 'Low',
        value: 'low',
        color: 'green',
        order: 1,
        isActive: true,
        isDefault: true,
      },
      {
        id: '2',
        label: 'Medium',
        value: 'medium',
        color: 'yellow',
        order: 2,
        isActive: true,
        isDefault: true,
      },
      {
        id: '3',
        label: 'High',
        value: 'high',
        color: 'red',
        order: 3,
        isActive: true,
        isDefault: true,
      },
      {
        id: '4',
        label: 'Critical',
        value: 'critical',
        color: 'purple',
        order: 4,
        isActive: true,
        isDefault: true,
      },
    ];

    try {
      if (savedStatuses) {
        const parsed = JSON.parse(savedStatuses);
        setStatuses(
          parsed
            .filter((s: StatusOption) => s.isActive)
            .sort((a: StatusOption, b: StatusOption) => a.order - b.order)
        );
      } else {
        setStatuses(defaultStatuses);
      }

      if (savedPriorities) {
        const parsed = JSON.parse(savedPriorities);
        setPriorities(
          parsed
            .filter((p: PriorityOption) => p.isActive)
            .sort((a: PriorityOption, b: PriorityOption) => a.order - b.order)
        );
      } else {
        setPriorities(defaultPriorities);
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      setStatuses(defaultStatuses);
      setPriorities(defaultPriorities);
    }
  }, []);

  const handleChange = (field: keyof TicketFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required field validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.status) {
      newErrors.status = 'Status is required';
    }

    if (!formData.priority) {
      newErrors.priority = 'Priority is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const getStatusColor = (statusValue: string) => {
    const status = statuses.find((s) => s.value === statusValue);
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';

    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800 border-red-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      pink: 'bg-pink-100 text-pink-800 border-pink-200',
      teal: 'bg-teal-100 text-teal-800 border-teal-200',
      indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return colorMap[status.color] || colorMap.gray;
  };

  const getPriorityColor = (priorityValue: string) => {
    const priority = priorities.find((p) => p.value === priorityValue);
    if (!priority) return 'text-gray-600';

    const colorMap: Record<string, string> = {
      red: 'text-red-600',
      orange: 'text-orange-600',
      yellow: 'text-yellow-600',
      green: 'text-green-600',
      blue: 'text-blue-600',
      purple: 'text-purple-600',
      pink: 'text-pink-600',
      teal: 'text-teal-600',
      indigo: 'text-indigo-600',
      gray: 'text-gray-600',
    };

    return colorMap[priority.color] || colorMap.gray;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Default Ticket Layout
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Core fields: Title, Description, Status, and Priority are required and cannot be removed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Required Fields Section */}
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-lg">🔒</span>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Core Ticket Information (Required)
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Title Field - Cannot be removed */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Enter a brief title for this ticket"
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.title
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                }`}
                required
              />
              {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* Description Field - Cannot be removed */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Provide a detailed description of the issue or request"
                rows={4}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.description
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                }`}
                required
              />
              {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status Field - Cannot be removed */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors.status
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                  }`}
                  required
                >
                  <option value="">Select status...</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                {errors.status && <p className="text-sm text-red-600">{errors.status}</p>}
                {formData.status && (
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(formData.status)}`}
                    >
                      {statuses.find((s) => s.value === formData.status)?.label || formData.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Priority Field - Cannot be removed */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors.priority
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                  }`}
                  required
                >
                  <option value="">Select priority...</option>
                  {priorities.map((priority) => (
                    <option key={priority.id} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
                {errors.priority && <p className="text-sm text-red-600">{errors.priority}</p>}
                {formData.priority && (
                  <div className="mt-2">
                    <span className={`font-medium ${getPriorityColor(formData.priority)}`}>
                      {priorities.find((p) => p.value === formData.priority)?.label ||
                        formData.priority}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Optional Fields Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Additional Information (Optional)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Customer
              </label>
              <input
                type="text"
                value={formData.customer || ''}
                onChange={(e) => handleChange('customer', e.target.value)}
                placeholder="Customer name or company"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white focus:border-blue-500"
              />
            </div>

            {/* Assigned To Field */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Assigned To
              </label>
              <select
                value={formData.assignedTo || ''}
                onChange={(e) => handleChange('assignedTo', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white focus:border-blue-500"
              >
                <option value="unassigned">Unassigned</option>
                <option value="you">You</option>
                <option value="alice_johnson">Alice Johnson</option>
                <option value="bob_smith">Bob Smith</option>
                <option value="carol_davis">Carol Davis</option>
              </select>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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

export default DefaultTicketForm;
