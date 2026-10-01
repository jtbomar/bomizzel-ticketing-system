import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RecordFields from '../components/RecordFields';
import {
  UserIcon,
  ArrowLeftIcon,
  TicketIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { ticketRef } from '../utils/ticketRef';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  emailVerified: boolean;
  companies?: Array<{
    companyId: string;
    role: string;
    company: {
      id: string;
      name: string;
      domain?: string;
    };
  }>;
  createdAt: string;
}

const AgentCustomerDetail: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    if (customerId) {
      loadCustomerDetails();
    }
  }, [customerId]);

  const loadCustomerDetails = async () => {
    try {
      setLoading(true);

      // Load customer details directly by ID
      const customerResponse = await apiService.getUserDetails(customerId!);
      const customerData = customerResponse.user || customerResponse;

      if (customerData) {
        setCustomer(customerData);

        // Initialize edit form

        // Load tickets for this customer
        if (customerData.companies && customerData.companies.length > 0) {
          const companyId = customerData.companies[0].companyId;
          const ticketsResponse = await apiService.getTickets({ companyId, limit: 50 });
          const ticketsList = ticketsResponse.data || ticketsResponse.tickets || [];
          // Filter tickets submitted by this customer
          const customerTickets = ticketsList.filter((t: any) => t.submitterId === customerId);
          setTickets(customerTickets);
        }
      }
    } catch (error) {
      console.error('Failed to load customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Customer not found</p>
          <button
            onClick={() => navigate('/agent/customers')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/agent/customers')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-300 text-lg font-medium">
                    {customer.firstName.charAt(0)}
                    {customer.lastName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {customer.firstName} {customer.lastName}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{customer.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {customer.isActive ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  <XCircleIcon className="h-4 w-4 mr-1" />
                  Inactive
                </span>
              )}
              {customer.emailVerified && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <TicketIcon className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tickets.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <TicketIcon className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Open Tickets</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tickets.filter((t) => t.status === 'open').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <TicketIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Resolved</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Fields from the contacts layout (Settings > Layouts), edited in place */}
          <div className="lg:col-span-1">
            <RecordFields
              module="contacts"
              recordId={customerId!}
              onSaved={() => loadCustomerDetails()}
            />
          </div>

          {/* Tickets */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tickets ({tickets.length})
                </h2>
                <button
                  onClick={() =>
                    navigate(`/agent/tickets/create?tab=ticket&customerId=${customer.id}`)
                  }
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Create Ticket
                </button>
              </div>
              {tickets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No tickets yet</p>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md cursor-pointer border border-gray-200 dark:border-gray-700"
                      onClick={() => {
                        navigate(`/agent/tickets/${encodeURIComponent(ticket.id)}`);
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.title}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {ticketRef(ticket)}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(ticket.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {ticket.assignedTo && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Assigned to {ticket.assignedTo.firstName}
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            ticket.status === 'open'
                              ? 'bg-yellow-100 text-yellow-800'
                              : ticket.status === 'closed'
                                ? 'bg-gray-100 text-gray-800'
                                : ticket.status === 'resolved'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentCustomerDetail;
