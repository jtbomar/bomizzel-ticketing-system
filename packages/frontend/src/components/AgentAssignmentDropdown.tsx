import React, { useState, useEffect } from 'react';
import { UserIcon, CheckIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { User } from '../types';

interface AgentAssignmentDropdownProps {
  ticketId: string;
  currentAssignee?: User | null;
  onAssignmentChange?: (assignee: User | null) => void;
  disabled?: boolean;
}

const AgentAssignmentDropdown: React.FC<AgentAssignmentDropdownProps> = ({
  ticketId,
  currentAssignee,
  onAssignmentChange,
  disabled = false,
}) => {
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAgents();
      const agentList = response.data || response.agents || response;
      // Filter for active agents (isActive field from User type)
      setAgents(agentList.filter((agent: User) => agent.isActive));
    } catch (err: any) {
      console.error('Failed to load agents:', err);
      setError('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (agentId: string) => {
    try {
      setAssigning(true);
      setError(null);
      const result = await apiService.assignTicket(ticketId, agentId);
      const updatedTicket = result.data || result.ticket || result;
      
      if (onAssignmentChange) {
        onAssignmentChange(updatedTicket.assignedTo || null);
      }
      
      setIsOpen(false);
    } catch (err: any) {
      console.error('Failed to assign ticket:', err);
      setError(err.response?.data?.error?.message || 'Failed to assign ticket');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    try {
      setAssigning(true);
      setError(null);
      const response = await apiService.unassignTicket(ticketId);
      
      if (onAssignmentChange) {
        onAssignmentChange(null);
      }
      
      setIsOpen(false);
    } catch (err: any) {
      console.error('Failed to unassign ticket:', err);
      setError(err.response?.data?.error?.message || 'Failed to unassign ticket');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
        <span>Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || assigning}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UserIcon className="h-4 w-4" />
        <span>
          {assigning
            ? 'Updating...'
            : currentAssignee
              ? `${currentAssignee.firstName} ${currentAssignee.lastName}`
              : 'Unassigned'}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
            {error && (
              <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
                {error}
              </div>
            )}

            {/* Unassign option */}
            {currentAssignee && (
              <button
                onClick={handleUnassign}
                disabled={assigning}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between border-b border-gray-100"
              >
                <span className="flex items-center space-x-2">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span>Unassign</span>
                </span>
              </button>
            )}

            {/* Agent list */}
            {agents.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">No agents available</div>
            ) : (
              agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleAssign(agent.id)}
                  disabled={assigning || currentAssignee?.id === agent.id}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center space-x-2">
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="font-medium">
                        {agent.firstName} {agent.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{agent.email}</div>
                    </div>
                  </span>
                  {currentAssignee?.id === agent.id && (
                    <CheckIcon className="h-4 w-4 text-primary-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AgentAssignmentDropdown;
