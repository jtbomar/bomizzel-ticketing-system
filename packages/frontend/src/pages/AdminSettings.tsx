import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface SettingItem {
  name: string;
  description: string;
  path: string;
  icon: string;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

const AdminSettings: React.FC = () => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const sections: SettingSection[] = [
    {
      title: 'ORGANIZATION',
      items: [
        { name: 'Company Profile', description: 'Manage company information and settings', path: '/admin/settings/company-profile', icon: '🏢' },
        { name: 'Rebranding', description: 'Customize your company logo and branding', path: '/admin/settings/rebranding', icon: '🎨' },
        { name: 'Business Hours', description: 'Set your operating hours', path: '/admin/settings/business-hours', icon: '🕐' },
        { name: 'Holiday List', description: 'Manage company holidays', path: '/admin/settings/holidays', icon: '📅' },
        { name: 'Departments', description: 'Organize your teams into departments', path: '/admin/settings/departments', icon: '🏢' },
        { name: 'Customer Happiness', description: 'Customer satisfaction settings', path: '/admin/settings/customer-happiness', icon: '😊' },
        { name: 'Game Scope', description: 'Gamification and rewards', path: '/admin/settings/game-scope', icon: '🎮' },
        { name: 'Products', description: 'Manage your product catalog', path: '/admin/settings/products', icon: '📦' },
      ],
    },
    {
      title: 'USER MANAGEMENT',
      items: [
        { name: 'Agents', description: 'Manage support agents', path: '/admin/settings/agents', icon: '👤' },
        { name: 'Teams', description: 'Organize agents into teams', path: '/admin/settings/teams', icon: '👥' },
        { name: 'Roles', description: 'Define user roles and permissions', path: '/admin/settings/roles', icon: '🔑' },
        { name: 'Profiles', description: 'User profile settings', path: '/admin/settings/profiles', icon: '📋' },
        { name: 'Data Sharing', description: 'Control data access and sharing', path: '/admin/settings/data-sharing', icon: '🔗' },
      ],
    },
    {
      title: 'CHANNELS',
      items: [
        { name: 'Email', description: 'Email channel configuration', path: '/admin/settings/email', icon: '📧' },
        { name: 'Phone', description: 'Phone support settings', path: '/admin/settings/phone', icon: '📞' },
        { name: 'Chat', description: 'Live chat configuration', path: '/admin/settings/chat', icon: '💬' },
        { name: 'Help Center', description: 'Self-service help center', path: '/admin/settings/help-center', icon: '❓' },
        { name: 'Instant Messaging', description: 'IM integrations', path: '/admin/settings/instant-messaging', icon: '💭' },
        { name: 'Social', description: 'Social media channels', path: '/admin/settings/social', icon: '📱' },
        { name: 'Web Forms', description: 'Custom web forms', path: '/admin/settings/web-forms', icon: '📝' },
        { name: 'Community', description: 'Community forum settings', path: '/admin/settings/community', icon: '🌐' },
        { name: 'Agent Scripts', description: 'Predefined agent responses', path: '/admin/settings/agent-scripts', icon: '📜' },
        { name: 'Knowledge Base', description: 'Knowledge base articles', path: '/admin/settings/knowledge-base', icon: '📚' },
      ],
    },
    {
      title: 'CUSTOMIZATION',
      items: [
        { name: 'Ticket Statuses', description: 'Manage Kanban board columns', path: '/admin/settings/ticket-statuses', icon: '🎯' },
        { name: 'Buttons', description: 'Custom action buttons', path: '/admin/settings/buttons', icon: '🔘' },
        { name: 'Modules And Tabs', description: 'Customize interface modules', path: '/admin/settings/modules-tabs', icon: '📑' },
        { name: 'Layouts and Fields', description: 'Custom ticket layouts', path: '/admin/layouts', icon: '🎯' },
        { name: 'General Settings', description: 'System-wide settings', path: '/admin/settings/general', icon: '⚙️' },
        { name: 'Notifications', description: 'Notification preferences', path: '/admin/settings/notifications', icon: '🔔' },
        { name: 'Email Templates', description: 'Customize email templates', path: '/admin/settings/email-templates', icon: '✉️' },
        { name: 'Ticket Templates', description: 'Predefined ticket templates', path: '/admin/settings/ticket-templates', icon: '🎫' },
        { name: 'Time Tracking', description: 'Track time spent on tickets', path: '/admin/settings/time-tracking', icon: '⏱️' },
      ],
    },
    {
      title: 'AUTOMATION',
      items: [
        { name: 'Assignment Rules', description: 'Auto-assign tickets to agents', path: '/admin/settings/assignment-rules', icon: '🎯' },
        { name: 'Workflows', description: 'Automated workflows', path: '/admin/settings/workflows', icon: '🔄' },
        { name: 'Macros', description: 'Quick action macros', path: '/admin/settings/macros', icon: '⚡' },
        { name: 'Service Level Agreements', description: 'SLA management', path: '/admin/settings/sla', icon: '📊' },
        { name: 'Support Plans', description: 'Customer support plans', path: '/admin/settings/support-plans', icon: '📋' },
        { name: 'Schedules', description: 'Automated scheduling', path: '/admin/settings/schedules', icon: '📆' },
      ],
    },
    {
      title: 'DATA ADMINISTRATION',
      items: [
        { name: 'Import', description: 'Import data from files', path: '/data-management?tab=import', icon: '📥' },
        { name: 'Export', description: 'Export your data', path: '/data-management?tab=export', icon: '📤' },
        { name: 'Data Backup', description: 'Backup and restore', path: '/data-management', icon: '💾' },
        { name: 'Recycle Bin', description: 'Recover deleted items', path: '/admin/settings/recycle-bin', icon: '🗑️' },
      ],
    },
    {
      title: 'INTEGRATIONS',
      items: [
        { name: 'Marketplace', description: 'Browse and install integrations', path: '/admin/settings/marketplace', icon: '🛒' },
      ],
    },
    {
      title: 'DEVELOPER SPACE',
      items: [
        { name: 'APIs', description: 'API documentation and keys', path: '/admin/settings/apis', icon: '🔌' },
        { name: 'Connections', description: 'External connections', path: '/admin/settings/connections', icon: '🔗' },
        { name: 'Functions', description: 'Custom functions', path: '/admin/settings/functions', icon: '⚙️' },
        { name: 'Webhooks', description: 'Webhook configuration', path: '/admin/settings/webhooks', icon: '🪝' },
      ],
    },
    {
      title: 'PRIVACY AND SECURITY',
      items: [
        { name: 'Read Receipts', description: 'Email read tracking', path: '/admin/settings/read-receipts', icon: '👁️' },
        { name: 'Audit Logs', description: 'System activity logs', path: '/admin/settings/audit-logs', icon: '📋' },
        { name: 'Attachment Control', description: 'File upload restrictions', path: '/admin/settings/attachment-control', icon: '📎' },
      ],
    },
    {
      title: 'PERSONALIZATION',
      items: [
        { name: 'My Profile', description: 'Your profile settings', path: '/admin/settings/my-profile', icon: '👤' },
        { name: 'My Information', description: 'Personal information', path: '/admin/settings/my-information', icon: 'ℹ️' },
        { name: 'Preferences', description: 'Your preferences', path: '/admin/settings/preferences', icon: '⚙️' },
      ],
    },
  ];

  // Filter sections based on search
  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(section => section.items.length > 0);

  return (
    <div className={`min-h-screen transition-colors ${
      theme === 'dark'
        ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
        : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`backdrop-blur-sm border-b transition-colors ${
        theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className={`text-3xl font-bold transition-colors ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Settings
              </h1>
              <p className={`text-sm mt-1 transition-colors ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>
                Configure your ticketing system
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to="/employee"
                className={`px-4 py-2 rounded-md transition-colors border ${
                  theme === 'dark'
                    ? 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                }`}
              >
                Agent View
              </Link>
              <Link
                to="/reports"
                className={`px-4 py-2 rounded-md transition-colors border ${
                  theme === 'dark'
                    ? 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                }`}
              >
                📊 Reports
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-4 py-3 pl-12 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'bg-white/10 border-white/20 text-white placeholder-white/40'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          <svg
            className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-white/40' : 'text-gray-400'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {filteredSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-12">
            <h2 className={`text-xl font-bold mb-4 transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {section.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map((item, itemIndex) => (
                <Link
                  key={itemIndex}
                  to={item.path}
                  className={`p-6 rounded-lg border transition-all hover:shadow-lg ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-blue-100'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-3xl">{item.icon}</div>
                    <div className="flex-1">
                      <h3 className={`font-semibold mb-1 transition-colors ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {item.name}
                      </h3>
                      <p className={`text-sm transition-colors ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>
                        {item.description}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 transition-colors ${
                        theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {filteredSections.length === 0 && (
          <div className={`text-center py-12 ${
            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
          }`}>
            <p className="text-lg">No settings found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
