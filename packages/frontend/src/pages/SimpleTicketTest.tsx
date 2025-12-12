import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const SimpleTicketTest: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) {
        setError('User not logged in');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching tickets for user:', user.email);
        const response = await apiService.getTickets({ limit: 100 });
        const apiTickets = response.data || response.tickets || [];
        console.log('Received tickets:', apiTickets.length);
        setTickets(apiTickets);
      } catch (err: any) {
        console.error('Error fetching tickets:', err);
        setError(err.message || 'Failed to fetch tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">🔧 Simple Ticket Test for Shane</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p>
              <strong>User:</strong> {user ? `${user.email} (${user.role})` : 'Not logged in'}
            </p>
            <p>
              <strong>Tickets loaded:</strong> {tickets.length}
            </p>
            <p>
              <strong>Loading state:</strong> {loading ? 'Loading...' : 'Complete'}
            </p>
            <p>
              <strong>Error:</strong> {error || 'None'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Tickets ({tickets.length})</h2>

          {tickets.length === 0 ? (
            <p className="text-gray-500">No tickets found.</p>
          ) : (
            <div className="space-y-4">
              {tickets.slice(0, 20).map((ticket, index) => (
                <div key={ticket.id || index} className="border border-gray-200 rounded p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        #{ticket.id}: {ticket.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
                      <div className="flex space-x-4 mt-2 text-xs text-gray-500">
                        <span>Status: {ticket.status}</span>
                        <span>Priority: {ticket.priority}</span>
                        <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-600">
                        Assigned:{' '}
                        {ticket.assignedTo
                          ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                          : 'Unassigned'}
                      </p>
                      <p className="text-gray-600">
                        Customer:{' '}
                        {ticket.submitter
                          ? `${ticket.submitter.firstName} ${ticket.submitter.lastName}`
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {tickets.length > 20 && (
                <div className="text-center text-gray-500 py-4">
                  ... and {tickets.length - 20} more tickets
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <a
            href="/agent"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Agent Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};

export default SimpleTicketTest;
