import React from 'react';
import {
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline';

const ReportsAndExports: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Reports & Export</h2>
      </div>
      <div className="bg-white/5 p-8 rounded-lg border border-white/10 text-center">
        <DocumentChartBarIcon className="h-12 w-12 text-white/40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Analytics & Reports</h3>
        <p className="text-white/60">Generate detailed reports on tickets, agents, and system performance.</p>
        <p className="text-white/40 text-sm mt-2">This feature will be available soon.</p>
      </div>
    </div>
  );
};

export default ReportsAndExports;