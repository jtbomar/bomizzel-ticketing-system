import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BuildingOfficeIcon,
  ArrowLeftIcon,
  UserIcon,
  TicketIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    domain: '',
    primaryContact: '',
    primaryEmail: '',
    primaryPhone: '',
  });
  const [saving, setSaving] = useState(false);

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
      setEditForm({
        name: accountData.name || '',
        domain: accountData.domain || '',
        primaryContact: accountData.primaryContact || '',
        primaryEmail: accountData.primaryEmail || '',
        primaryPhone: accountData.primaryPhone || '',
      });

      // Load customers for this account
      const customersResponse = await apiService.getUsers({ role: 'customer', limit: 100, page: 1 });
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

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiService.updateCompany(accountId!, editForm);
      
      // Reload account details
      await loadAccountDetails();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update account:', error);
      alert('Failed to update account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (account) {
      setEditForm({
        name: account.name || '',
        domain: account.domain || '',
        primaryContact: account.primaryContact || '',
        primaryEmail: account.primaryEmail || '',
        primaryPhone: account.primaryPhone || '',
      });
    }
    setIsEditing(false);
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
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              {isEditing ? 'Cancel' : 'Edit Account'}
            </button>
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
          {/* Account Info */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Account Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Company Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {account.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Domain</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.domain}
                      onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      placeholder="example.com"
                    />
                  ) : account.domain ? (
                    <div className="flex items-center mt-1">
                      <GlobeAltIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-white">{account.domain}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Not set</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Primary Contact
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.primaryContact}
                      onChange={(e) => setEditForm({ ...editForm, primaryContact: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      placeholder="John Doe"
                    />
                  ) : account.primaryContact ? (
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {account.primaryContact}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Not set</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.primaryEmail}
                      onChange={(e) => setEditForm({ ...editForm, primaryEmail: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      placeholder="contact@example.com"
                    />
                  ) : account.primaryEmail ? (
                    <div className="flex items-center mt-1">
                      <EnvelopeIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <a
                        href={`mailto:${account.primaryEmail}`}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {account.primaryEmail}
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Not set</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.primaryPhone}
                      onChange={(e) => setEditForm({ ...editForm, primaryPhone: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      placeholder="+1 (555) 123-4567"
                    />
                  ) : account.primaryPhone ? (
                    <div className="flex items-center mt-1">
                      <PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <a
                        href={`tel:${account.primaryPhone}`}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {account.primaryPhone}
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Not set</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Created</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {formatDate(account.createdAt)}
                  </p>
                </div>

                {isEditing && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>
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
                        // Store ticket data temporarily
                        sessionStorage.setItem('openTicket', JSON.stringify({
                          id: ticket.id,
                          title: ticket.title,
                          status: ticket.status,
                          priority: ticket.priority || 'medium',
                          customer: ticket.submitter ? `${ticket.submitter.firstName} ${ticket.submitter.lastName}` : 'Unknown',
                          assigned: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned',
                          created: new Date(ticket.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }),
                          description: ticket.description || 'No description provided',
                          order: 1,
                          customerInfo: ticket.submitter ? {
                            name: `${ticket.submitter.firstName} ${ticket.submitter.lastName}`,
                            email: ticket.submitter.email,
                            phone: '',
                            company: account?.name || '',
                            website: account?.domain || '',
                          } : undefined
                        }));
                        navigate('/agent');
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          #{ticket.id.slice(-8)}
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
