import React from 'react';
import { QueueMetrics } from '../types';

interface DashboardMetricsProps {
  metrics: QueueMetrics[];
  loading?: boolean;
}

const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  metrics,
  loading = false,
}) => {
  const totalMetrics = metrics.reduce(
    (acc, metric) => ({
      totalTickets: acc.totalTickets + metric.totalTickets,
      openTickets: acc.openTickets + metric.openTickets,
      assignedTickets: acc.assignedTickets + metric.assignedTickets,
      resolvedTickets: acc.resolvedTickets + metric.resolvedTickets,
      averageResolutionTime: acc.averageResolutionTime + metric.averageResolutionTime,
    }),
    {
      totalTickets: 0,
      openTickets: 0,
      assignedTickets: 0,
      resolvedTickets: 0,
      averageResolutionTime: 0,
    }
  );

  // Calculate average resolution time across all queues
  const avgResolutionTime = metrics.length > 0 
    ? totalMetrics.averageResolutionTime / metrics.length 
    : 0;

  const formatTime = (hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const MetricCard: React.FC<{
    title: string;
    value: number;
    subtitle?: string;
    color: string;
    icon: React.ReactNode;
  }> = ({ title, value, subtitle, color, icon }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-md ${color}`}>
              {icon}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value.toLocaleString()}
              </dd>
              {subtitle && (
                <dd className="text-sm text-gray-500">
                  {subtitle}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gray-200 rounded-md"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tickets"
          value={totalMetrics.totalTickets}
          color="bg-blue-500"
          icon={
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        
        <MetricCard
          title="Open Tickets"
          value={totalMetrics.openTickets}
          color="bg-yellow-500"
          icon={
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        
        <MetricCard
          title="Assigned Tickets"
          value={totalMetrics.assignedTickets}
          color="bg-purple-500"
          icon={
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        
        <MetricCard
          title="Resolved Tickets"
          value={totalMetrics.resolvedTickets}
          color="bg-green-500"
          icon={
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Average Resolution Time */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Average Resolution Time
          </h3>
          <div className="text-3xl font-bold text-gray-900">
            {formatTime(avgResolutionTime)}
          </div>
        </div>
      </div>

      {/* Queue Breakdown */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Queue Breakdown
          </h3>
          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.queueId} className="border-l-4 border-blue-400 pl-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">
                    {metric.queueName}
                  </h4>
                  <span className="text-sm text-gray-500">
                    {formatTime(metric.averageResolutionTime)} avg
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Total:</span>
                    <span className="ml-1 font-medium">{metric.totalTickets}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Open:</span>
                    <span className="ml-1 font-medium text-yellow-600">{metric.openTickets}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Assigned:</span>
                    <span className="ml-1 font-medium text-purple-600">{metric.assignedTickets}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Resolved:</span>
                    <span className="ml-1 font-medium text-green-600">{metric.resolvedTickets}</span>
                  </div>
                </div>
                
                {/* Status Breakdown */}
                {Object.keys(metric.statusBreakdown).length > 0 && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(metric.statusBreakdown).map(([status, count]) => (
                        <span
                          key={status}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {status}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardMetrics;