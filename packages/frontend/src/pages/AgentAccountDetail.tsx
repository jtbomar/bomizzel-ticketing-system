import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RecordFields from '../components/RecordFields';
import {
  BuildingOfficeIcon,
  ArrowLeftIcon,
  UserIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { ticketRef } from '../utils/ticketRef';

interface Account {
  id: string;
  name: string;
  domain?: string;
  primaryEmail?: string;
  primaryContact?: string;
  primaryPhone?: string;
  createdAt: string;
}

const AgentAccountDetail: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    if (accountId) {
      loadAccountDetails();
    }
  }, [accountId]);

  const loadAccountDetails = async () => {
    try {
      setLoading(true);

      // Load account details
      const accountResponse = await apiService.getCompany(accountId!);
      const accountData = accountResponse.company || accountResponse.data || accountResponse;
      setAccount(accountData);

      // Initialize edit form

      // Load customers for this account
      const customersResponse = await apiService.getUsers({
        role: 'customer',
        limit: 100,
        page: 1,
      });
      const allCustomers = customersResponse.data || [];
      const accountCustomers = allCustomers.filter((c: any) =>
        c.companies?.some((comp: any) => comp.companyId === accountId)
      );
      setCustomers(accountCustomers);

      // Load tickets for this account
      const ticketsResponse = await apiService.getTickets({ companyId: accountId, limit: 50 });
      const ticketsList = ticketsResponse.data || ticketsResponse.tickets || [];
      setTickets(ticketsList);
    } catch (error) {
      console.error('Failed to load account details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading account details...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Account not found</p>
          <button
            onClick={() => navigate('/agent/accounts')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Back to Accounts
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
              onClick={() => navigate('/agent/accounts')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <BuildingOfficeIcon className="h-8 w-8 text-gray-400" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {account.name}
                  </h1>
                  {account.domain && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{account.domain}</p>
                  )}
                </div>
              </div>
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
              <UserIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Customers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {customers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <TicketIcon className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Tickets</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tickets.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <TicketIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Open Tickets</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tickets.filter((t) => t.status === 'open').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Fields from the accounts layout (Settings > Layouts), edited in place */}
          <div className="lg:col-span-1">
            <RecordFields
              module="accounts"
              recordId={accountId!}
              onSaved={() => loadAccountDetails()}
            />
          </div>

          {/* Customers & Tickets */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customers */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Customers</h2>
                <button
                  onClick={() => navigate('/agent/tickets/create?tab=customer')}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Add Customer
                </button>
              </div>
              {customers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No customers yet</p>
              ) : (
                <div className="space-y-3">
                  {customers.slice(0, 5).map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md cursor-pointer"
                      onClick={() => navigate(`/agent/customers/${customer.id}`)}
                    >
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-300 text-sm font-medium">
                            {customer.firstName.charAt(0)}
                            {customer.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {customer.firstName} {customer.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {customer.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          customer.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                  {customers.length > 5 && (
                    <button
                      onClick={() => navigate('/agent/customers')}
                      className="text-sm text-primary-600 hover:text-primary-700 w-full text-center py-2"
                    >
                      View all {customers.length} customers
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recent Tickets */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Tickets
                </h2>
                <button
                  onClick={() => navigate('/agent/tickets/create?tab=ticket')}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Create Ticket
                </button>
              </div>
              {tickets.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No tickets yet</p>
              ) : (
                <div className="space-y-3">
                  {tickets.slice(0, 5).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md cursor-pointer"
                      onClick={() => {
                        navigate(`/agent/tickets/${encodeURIComponent(ticket.id)}`);
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {ticketRef(ticket)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          ticket.status === 'open'
                            ? 'bg-yellow-100 text-yellow-800'
                            : ticket.status === 'closed'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  ))}
                  {tickets.length > 5 && (
                    <button
                      onClick={() => navigate('/agent')}
                      className="text-sm text-primary-600 hover:text-primary-700 w-full text-center py-2"
                    >
                      View all {tickets.length} tickets
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentAccountDetail;
