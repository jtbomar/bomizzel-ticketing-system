import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  TicketIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

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
        setEditForm({
          firstName: customerData.firstName || '',
          lastName: customerData.lastName || '',
          email: customerData.email || '',
        });

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

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiService.updateUser(customerId!, editForm);
      
      // Reload customer details
      await loadCustomerDetails();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update customer:', error);
      alert('Failed to update customer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (customer) {
      setEditForm({
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email || '',
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
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                {isEditing ? 'Cancel' : 'Edit Customer'}
              </button>
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
          {/* Customer Info */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Customer Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">First Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {customer.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Last Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {customer.lastName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  ) : (
                    <div className="flex items-center mt-1">
                      <EnvelopeIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {customer.email}
                      </a>
                    </div>
                  )}
                </div>

                {customer.companies && customer.companies.length > 0 && (
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400">Company</label>
                    <div
                      className="flex items-center mt-1 cursor-pointer hover:text-primary-600"
                      onClick={() =>
                        navigate(`/agent/accounts/${customer.companies![0].companyId}`)
                      }
                    >
                      <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {customer.companies[0].company.name}
                      </span>
                    </div>
                    {customer.companies[0].company.domain && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                        {customer.companies[0].company.domain}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Status</label>
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center">
                      {customer.isActive ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-500 mr-2" />
                      )}
                      <span className="text-sm text-gray-900 dark:text-white">
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      {customer.emailVerified ? (
                        <CheckCircleIcon className="h-4 w-4 text-blue-500 mr-2" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-gray-400 mr-2" />
                      )}
                      <span className="text-sm text-gray-900 dark:text-white">
                        {customer.emailVerified ? 'Email Verified' : 'Email Not Verified'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Member Since</label>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {formatDate(customer.createdAt)}
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

          {/* Tickets */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tickets ({tickets.length})
                </h2>
                <button
                  onClick={() => navigate(`/agent/tickets/create?tab=ticket&customerId=${customer.id}`)}
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
                        // Store ticket data temporarily
                        sessionStorage.setItem('openTicket', JSON.stringify({
                          id: ticket.id,
                          title: ticket.title,
                          status: ticket.status,
                          priority: ticket.priority || 'medium',
                          customer: `${customer.firstName} ${customer.lastName}`,
                          assigned: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned',
                          created: formatDate(ticket.createdAt),
                          description: ticket.description || 'No description provided',
                          order: 1,
                          customerInfo: {
                            name: `${customer.firstName} ${customer.lastName}`,
                            email: customer.email,
                            phone: '',
                            company: customer.companies?.[0]?.company?.name || '',
                            website: customer.companies?.[0]?.company?.domain || '',
                          }
                        }));
                        navigate('/agent');
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.title}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            #{ticket.id.slice(-8)}
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
