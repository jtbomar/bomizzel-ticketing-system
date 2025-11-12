import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Customer {
  subscriptionId: string;
  status: string;
  limits: {
    maxUsers: number;
    maxActiveTickets: number;
    storageQuotaGB: number;
  };
  currentPeriod: {
    start: string;
    end: string;
  };
  company: {
    id: string;
    name: string;
  };
  admin: {
    id: string;
    email: string;
    name: string;
  };
}

const ProvisionedCustomersList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateLimits, setUpdateLimits] = useState({
    maxUsers: 0,
    storageQuotaGB: 0,
    maxActiveTickets: 0,
    reason: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(
        `${apiUrl}/api/admin/provisioning/customers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setCustomers(response.data.data.customers);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimits = async (subscriptionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      await axios.put(
        `${apiUrl}/api/admin/provisioning/subscriptions/${subscriptionId}/limits`,
        updateLimits,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setShowUpdateModal(false);
      fetchCustomers(); // Refresh list
      alert('Limits updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update limits');
    }
  };

  const handleDisableCustomer = async (subscriptionId: string) => {
    const reason = prompt('Reason for disabling this customer?');
    if (!reason) return;

    if (!confirm('Are you sure you want to disable this customer? All their users will be blocked from accessing the system.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      await axios.post(
        `${apiUrl}/api/admin/provisioning/subscriptions/${subscriptionId}/disable`,
        { reason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchCustomers(); // Refresh list
      alert('Customer disabled successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disable customer');
    }
  };

  const handleEnableCustomer = async (subscriptionId: string) => {
    const reason = prompt('Reason for enabling this customer?');
    if (!reason) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      await axios.post(
        `${apiUrl}/api/admin/provisioning/subscriptions/${subscriptionId}/enable`,
        { reason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchCustomers(); // Refresh list
      alert('Customer enabled successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to enable customer');
    }
  };

  const handleDeleteCustomer = async (subscriptionId: string) => {
    const reason = prompt('Reason for deleting this customer?');
    if (!reason) return;

    if (!confirm('⚠️ WARNING: This will PERMANENTLY delete the customer, all their users, and all their data. This cannot be undone. Are you absolutely sure?')) {
      return;
    }

    if (!confirm('Final confirmation: Type DELETE to confirm')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      await axios.delete(
        `${apiUrl}/api/admin/provisioning/subscriptions/${subscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: { reason }
        }
      );
      fetchCustomers(); // Refresh list
      alert('Customer deleted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const openUpdateModal = (customer: Customer) => {
    setSelectedCustomer(customer.subscriptionId);
    setUpdateLimits({
      maxUsers: customer.limits.maxUsers,
      storageQuotaGB: customer.limits.storageQuotaGB,
      maxActiveTickets: customer.limits.maxActiveTickets,
      reason: '',
    });
    setShowUpdateModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">
          {customers.length} Provisioned Customer{customers.length !== 1 ? 's' : ''}
        </h2>
        <button
          onClick={fetchCustomers}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg
            className="h-4 w-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No customers yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by provisioning your first customer.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                  Company
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Admin
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Limits
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Period
                </th>
                <th className="relative py-3.5 pl-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {customers.map((customer) => (
                <tr key={customer.subscriptionId}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="font-medium text-gray-900">
                      {customer.company.name}
                    </div>
                    <div className="text-gray-500">{customer.company.id}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div>{customer.admin.name}</div>
                    <div className="text-gray-400">{customer.admin.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        customer.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : customer.status === 'trial'
                          ? 'bg-blue-100 text-blue-800'
                          : customer.status === 'suspended'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div>Users: {customer.limits.maxUsers}</div>
                    <div>Tickets: {customer.limits.maxActiveTickets}</div>
                    <div>Storage: {customer.limits.storageQuotaGB}GB</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div>
                      {new Date(customer.currentPeriod.start).toLocaleDateString()}
                    </div>
                    <div className="text-gray-400">
                      to {new Date(customer.currentPeriod.end).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => openUpdateModal(customer)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Update
                    </button>
                    {customer.status === 'suspended' ? (
                      <button
                        onClick={() => handleEnableCustomer(customer.subscriptionId)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDisableCustomer(customer.subscriptionId)}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Disable
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCustomer(customer.subscriptionId)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Update Limits Modal */}
      {showUpdateModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowUpdateModal(false)}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Update Subscription Limits
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Users
                    </label>
                    <input
                      type="number"
                      value={updateLimits.maxUsers}
                      onChange={(e) =>
                        setUpdateLimits({
                          ...updateLimits,
                          maxUsers: parseInt(e.target.value),
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Active Tickets
                    </label>
                    <input
                      type="number"
                      value={updateLimits.maxActiveTickets}
                      onChange={(e) =>
                        setUpdateLimits({
                          ...updateLimits,
                          maxActiveTickets: parseInt(e.target.value),
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Storage Quota (GB)
                    </label>
                    <input
                      type="number"
                      value={updateLimits.storageQuotaGB}
                      onChange={(e) =>
                        setUpdateLimits({
                          ...updateLimits,
                          storageQuotaGB: parseInt(e.target.value),
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Reason for Update
                    </label>
                    <textarea
                      value={updateLimits.reason}
                      onChange={(e) =>
                        setUpdateLimits({ ...updateLimits, reason: e.target.value })
                      }
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="e.g., Customer requested storage upgrade"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  onClick={() => selectedCustomer && handleUpdateLimits(selectedCustomer)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                >
                  Update Limits
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvisionedCustomersList;
