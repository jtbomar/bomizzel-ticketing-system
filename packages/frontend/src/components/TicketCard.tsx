import React from 'react';
import { Ticket } from '../types';

interface TicketCardProps {
  ticket: Ticket;
  isDragging?: boolean;
  onClick?: (ticket: Ticket) => void;
  showAssignee?: boolean;
  showCompany?: boolean;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  isDragging = false,
  onClick,
  showAssignee = true,
  showCompany = true,
}) => {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 80) return 'bg-red-100 text-red-800 border-red-200';
    if (priority >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (priority >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 80) return 'High';
    if (priority >= 60) return 'Medium';
    if (priority >= 40) return 'Low';
    return 'Lowest';
  };

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer
        ${isDragging ? 'opacity-50 rotate-2' : ''}
      `}
      onClick={() => onClick?.(ticket)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">{ticket.title}</h3>
          <p className="text-xs text-gray-500 mt-1">
            #{ticket.id.slice(-8)} • {formatDate(ticket.createdAt)}
          </p>
        </div>
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}
        >
          {getPriorityLabel(ticket.priority)}
        </div>
      </div>

      {/* Description */}
      <p
        className="text-sm text-gray-600 mb-3 overflow-hidden"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
      >
        {ticket.description}
      </p>

      {/* Custom Fields */}
      {Object.keys(ticket.customFieldValues || {}).length > 0 && (
        <div className="mb-3">
          {Object.entries(ticket.customFieldValues)
            .slice(0, 2)
            .map(([key, value]) => (
              <div key={key} className="text-xs text-gray-500 mb-1">
                <span className="font-medium">{key}:</span> {String(value)}
              </div>
            ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-3">
          {showCompany && ticket.company && (
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-6a1 1 0 00-1-1H9a1 1 0 00-1 1v6a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 8a1 1 0 011-1h4a1 1 0 011 1v4H7v-4z"
                  clipRule="evenodd"
                />
              </svg>
              {ticket.company.name}
            </span>
          )}

          {ticket.submitter && (
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              {ticket.submitter.firstName} {ticket.submitter.lastName}
            </span>
          )}
        </div>

        {showAssignee && (
          <div className="flex items-center">
            {ticket.assignedTo ? (
              <span className="flex items-center text-blue-600">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
                {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
              </span>
            ) : (
              <span className="text-gray-400">Unassigned</span>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span
            className={`
            px-2 py-1 rounded-full text-xs font-medium
            ${
              ticket.status === 'open'
                ? 'bg-blue-100 text-blue-800'
                : ticket.status === 'resolved'
                  ? 'bg-green-100 text-green-800'
                  : ticket.status === 'closed'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-purple-100 text-purple-800'
            }
          `}
          >
            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
          </span>

          {(ticket.notes?.length || 0) > 0 && (
            <span className="flex items-center text-gray-400">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                  clipRule="evenodd"
                />
              </svg>
              {ticket.notes?.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketCard;
