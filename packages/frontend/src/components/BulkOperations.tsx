import React, { useState } from 'react';
import { Ticket, User, Queue } from '../types';
import { apiService } from '../services/api';

interface BulkOperationsProps {
  selectedTickets: Ticket[];
  onOperationComplete: () => void;
  onClose: () => void;
  availableUsers?: User[];
  availableQueues?: Queue[];
  availableStatuses?: string[];
}

const BulkOperations: React.FC<BulkOperationsProps> = ({
  selectedTickets,
  onOperationComplete,
  onClose,
  availableUsers = [],
  availableQueues = [],
  availableStatuses = ['open', 'in_progress', 'resolved', 'closed'],
}) => {
  const [operation, setOperation] = useState<
    'assign' | 'status' | 'priority' | 'move' | 'delete' | null
  >(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState(50);
  const [queueId, setQueueId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const ticketIds = selectedTickets.map((t) => t.id);

  const handleOperation = async () => {
    if (!operation) return;

    setLoading(true);
    setResult(null);

    try {
      let response;

      switch (operation) {
        case 'assign':
          if (!assigneeId) {
            throw new Error('Please select an assignee');
          }
          response = await apiService.bulkAssignTickets(ticketIds, assigneeId);
          break;

        case 'status':
          if (!status) {
            throw new Error('Please select a status');
          }
          response = await apiService.bulkUpdateStatus(ticketIds, status);
          break;

        case 'priority':
          response = await apiService.bulkUpdatePriority(ticketIds, priority);
          break;

        case 'move':
          if (!queueId) {
            throw new Error('Please select a queue');
          }
          response = await apiService.bulkMoveTickets(ticketIds, queueId);
          break;

        case 'delete':
          if (
            !confirm(
              `Are you sure you want to delete ${ticketIds.length} tickets? This action cannot be undone.`
            )
          ) {
            return;
          }
          response = await apiService.bulkDeleteTickets(ticketIds);
          break;

        default:
          throw new Error('Invalid operation');
      }

      setResult(response);
      onOperationComplete();
    } catch (error) {
      console.error('Bulk operation failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderOperationForm = () => {
    switch (operation) {
      case 'assign':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign to:</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select an assignee...</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'status':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Update status to:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a status...</option>
                {availableStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'priority':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Set priority to: {priority}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low (0)</span>
                <span>Medium (50)</span>
                <span>High (100)</span>
              </div>
            </div>
          </div>
        );

      case 'move':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Move to queue:</label>
              <select
                value={queueId}
                onChange={(e) => setQueueId(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a queue...</option>
                {availableQueues.map((queue) => (
                  <option key={queue.id} value={queue.id}>
                    {queue.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'delete':
        return (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Warning: This action cannot be undone
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    You are about to delete {ticketIds.length} tickets. This will permanently remove
                    them from the system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Bulk Operations ({selectedTickets.length} tickets)
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {!result ? (
          <div className="space-y-6">
            {/* Operation Selection */}
            {!operation && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Choose an operation:</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOperation('assign')}
                    className="p-3 border border-gray-300 rounded-md hover:bg-gray-50 text-left"
                  >
                    <div className="font-medium text-sm">Assign</div>
                    <div className="text-xs text-gray-500">Assign to employee</div>
                  </button>
                  <button
                    onClick={() => setOperation('status')}
                    className="p-3 border border-gray-300 rounded-md hover:bg-gray-50 text-left"
                  >
                    <div className="font-medium text-sm">Update Status</div>
                    <div className="text-xs text-gray-500">Change ticket status</div>
                  </button>
                  <button
                    onClick={() => setOperation('priority')}
                    className="p-3 border border-gray-300 rounded-md hover:bg-gray-50 text-left"
                  >
                    <div className="font-medium text-sm">Set Priority</div>
                    <div className="text-xs text-gray-500">Update priority level</div>
                  </button>
                  <button
                    onClick={() => setOperation('move')}
                    className="p-3 border border-gray-300 rounded-md hover:bg-gray-50 text-left"
                  >
                    <div className="font-medium text-sm">Move Queue</div>
                    <div className="text-xs text-gray-500">Move to different queue</div>
                  </button>
                  <button
                    onClick={() => setOperation('delete')}
                    className="p-3 border border-red-300 rounded-md hover:bg-red-50 text-left col-span-2"
                  >
                    <div className="font-medium text-sm text-red-700">Delete Tickets</div>
                    <div className="text-xs text-red-500">Permanently delete tickets</div>
                  </button>
                </div>
              </div>
            )}

            {/* Operation Form */}
            {operation && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setOperation(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <h4 className="text-sm font-medium text-gray-700">
                    {operation.charAt(0).toUpperCase() + operation.slice(1)} {ticketIds.length}{' '}
                    tickets
                  </h4>
                </div>

                {renderOperationForm()}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setOperation(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleOperation}
                    disabled={loading}
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                      operation === 'delete'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {loading
                      ? 'Processing...'
                      : `${operation.charAt(0).toUpperCase() + operation.slice(1)} Tickets`}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Results */
          <div className="space-y-4">
            <div
              className={`p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
            >
              <div className="flex">
                <svg
                  className={`w-5 h-5 mr-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {result.success ? (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                <div>
                  <h3
                    className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}
                  >
                    {result.success ? 'Operation Completed' : 'Operation Failed'}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {result.message || result.error}
                  </p>
                </div>
              </div>
            </div>

            {result.data && result.data.summary && (
              <div className="text-sm text-gray-600">
                <p>Successful: {result.data.summary.successful}</p>
                <p>Failed: {result.data.summary.failed}</p>
                <p>Total: {result.data.summary.total}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOperations;
