import React, { useState } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import { Navigate } from 'react-router-dom';
import TeamManagement from '../components/admin/TeamManagement';
import UserManagement from '../components/admin/UserManagement';
import SystemSettings from '../components/admin/SystemSettings';
import ReportsAndExports from '../components/admin/ReportsAndExports';
import SubscriptionAnalytics from '../components/admin/SubscriptionAnalytics';
import BusinessMetricsDashboard from '../components/admin/BusinessMetricsDashboard'; 

import CompanyManagement from '../components/admin/CompanyManagement';
import {
  UsersIcon,
  UserGroupIcon,
  CogIcon,
  DocumentChartBarIcon,
  AdjustmentsHorizontalIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  PresentationChartLineIcon,
} from '@heroicons/react/24/outline';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { id: 'users', name: 'Agent Management', icon: UsersIcon },
    { id: 'companies', name: 'Company Management', icon: BuildingOfficeIcon },
    { id: 'teams', name: 'Team Management', icon: UserGroupIcon },
    { id: 'analytics', name: 'Subscription Analytics', icon: ChartBarIcon },
    { id: 'business-metrics', name: 'Business Metrics', icon: PresentationChartLineIcon },
    { id: 'custom-fields', name: 'Custom Fields', icon: AdjustmentsHorizontalIcon },
    { id: 'settings', name: 'System Settings', icon: CogIcon },
    { id: 'reports', name: 'Reports & Export', icon: DocumentChartBarIcon },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'companies':
        return <CompanyManagement />;
      case 'teams':
        return <TeamManagement />;
      case 'analytics':
        return <SubscriptionAnalytics />;
      case 'business-metrics':
        return <BusinessMetricsDashboard />;
      case 'custom-fields':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-white">Custom Fields Management</h2>
            </div>
            <div className="bg-white/5 p-8 rounded-lg border border-white/10 text-center">
              <AdjustmentsHorizontalIcon className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Custom Fields Configuration</h3>
              <p className="text-white/60">Configure custom fields for different teams and ticket types.</p>
              <p className="text-white/40 text-sm mt-2">This feature will be available soon.</p>
            </div>
          </div>
        );
      case 'settings':
        return <SystemSettings />;
      case 'reports':
        return <ReportsAndExports />;
      default:
        return <UserManagement />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Administration</h1>
              <p className="text-sm text-white/60">Manage agents, teams, and system configuration</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        
        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 shadow-2xl">
          {/* Tab Navigation */}
          <div className="border-b border-white/10">
            <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-blue-400 text-blue-300'
                        : 'border-transparent text-white/60 hover:text-white hover:border-white/30'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-all duration-200`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;