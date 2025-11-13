import React, { useState } from 'react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  BriefcaseIcon,
  CodeBracketIcon,
  AcademicCapIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<any>;
  color: string;
  columns: Array<{
    name: string;
    color: string;
  }>;
  sampleTickets?: Array<{
    title: string;
    description: string;
    column: string;
  }>;
}

const templates: Template[] = [
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Track and resolve customer issues efficiently',
    category: 'Support',
    icon: UserGroupIcon,
    color: 'blue',
    columns: [
      { name: 'New', color: 'red' },
      { name: 'In Progress', color: 'yellow' },
      { name: 'Waiting on Customer', color: 'orange' },
      { name: 'Resolved', color: 'green' },
    ],
    sampleTickets: [
      { title: 'Login issue', description: 'Customer cannot access account', column: 'New' },
      { title: 'Feature request', description: 'Request for dark mode', column: 'In Progress' },
    ],
  },
  {
    id: 'bug-tracking',
    name: 'Bug Tracking',
    description: 'Manage and fix software bugs',
    category: 'Engineering',
    icon: CodeBracketIcon,
    color: 'purple',
    columns: [
      { name: 'Reported', color: 'red' },
      { name: 'Investigating', color: 'yellow' },
      { name: 'In Development', color: 'blue' },
      { name: 'Testing', color: 'purple' },
      { name: 'Fixed', color: 'green' },
    ],
  },
  {
    id: 'sales-pipeline',
    name: 'Sales Pipeline',
    description: 'Track deals from lead to close',
    category: 'Business',
    icon: ChartBarIcon,
    color: 'green',
    columns: [
      { name: 'Lead', color: 'gray' },
      { name: 'Qualified', color: 'blue' },
      { name: 'Proposal', color: 'yellow' },
      { name: 'Negotiation', color: 'orange' },
      { name: 'Closed Won', color: 'green' },
    ],
  },
  {
    id: 'project-management',
    name: 'Project Management',
    description: 'Organize tasks and track project progress',
    category: 'Project',
    icon: BriefcaseIcon,
    color: 'indigo',
    columns: [
      { name: 'Backlog', color: 'gray' },
      { name: 'To Do', color: 'blue' },
      { name: 'In Progress', color: 'yellow' },
      { name: 'Review', color: 'purple' },
      { name: 'Done', color: 'green' },
    ],
  },
  {
    id: 'onboarding',
    name: 'Employee Onboarding',
    description: 'Guide new hires through onboarding process',
    category: 'HR',
    icon: AcademicCapIcon,
    color: 'pink',
    columns: [
      { name: 'Pre-boarding', color: 'blue' },
      { name: 'First Day', color: 'yellow' },
      { name: 'First Week', color: 'orange' },
      { name: 'First Month', color: 'purple' },
      { name: 'Completed', color: 'green' },
    ],
  },
  {
    id: 'ecommerce-orders',
    name: 'E-commerce Orders',
    description: 'Track order fulfillment and shipping',
    category: 'Business',
    icon: ShoppingCartIcon,
    color: 'orange',
    columns: [
      { name: 'New Order', color: 'blue' },
      { name: 'Processing', color: 'yellow' },
      { name: 'Shipped', color: 'purple' },
      { name: 'Delivered', color: 'green' },
    ],
  },
];

const categories = ['All', 'Support', 'Engineering', 'Business', 'Project', 'HR'];

interface KanbanTemplatesProps {
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
}

const KanbanTemplates: React.FC<KanbanTemplatesProps> = ({ onClose, onSelectTemplate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a Template</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Start with a pre-built board or create your own
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search and Categories */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Categories */}
            <div className="flex space-x-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  className="group text-left bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all"
                >
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 bg-${template.color}-100 dark:bg-${template.color}-900/30 rounded-lg flex items-center justify-center mb-4`}
                  >
                    <Icon className={`w-6 h-6 text-${template.color}-600 dark:text-${template.color}-400`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {template.description}
                  </p>

                  {/* Columns Preview */}
                  <div className="flex flex-wrap gap-2">
                    {template.columns.map((column, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        {column.name}
                      </span>
                    ))}
                  </div>

                  {/* Hover Effect */}
                  <div className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Use this template →
                  </div>
                </button>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No templates found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default KanbanTemplates;
export type { Template };
