import React, { useState } from 'react';
import axios from 'axios';
import ProvisionedCustomersList from '../components/ProvisionedCustomersList';

interface CustomLimits {
  maxUsers: number;
  maxActiveTickets: number;
  maxCompletedTickets: number;
  maxTotalTickets: number;
  storageQuotaGB: number;
  maxAttachmentSizeMB: number;
  maxCustomFields: number;
  maxQueues: number;
}

interface CustomPricing {
  monthlyPrice: number;
  annualPrice: number;
  setupFee: number;
}

interface ProvisioningFormData {
  companyName: string;
  companyDomain: string;
  companyDescription: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone: string;
  customLimits: CustomLimits;
  customPricing: CustomPricing;
  billingCycle: 'monthly' | 'annual';
  trialDays: number;
  notes: string;
}

const AdminCustomerProvisioning: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'provision' | 'list'>('provision');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provisionedCustomer, setProvisionedCustomer] = useState<any>(null);

  const [formData, setFormData] = useState<ProvisioningFormData>({
    companyName: '',
    companyDomain: '',
    companyDescription: '',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    adminPhone: '',
    customLimits: {
      maxUsers: 100,
      maxActiveTickets: 1000,
      maxCompletedTickets: 5000,
      maxTotalTickets: 10000,
      storageQuotaGB: 100,
      maxAttachmentSizeMB: 25,
      maxCustomFields: 50,
      maxQueues: 20,
    },
    customPricing: {
      monthlyPrice: 0,
      annualPrice: 0,
      setupFee: 0,
    },
    billingCycle: 'monthly',
    trialDays: 30,
    notes: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLimitChange = (field: keyof CustomLimits, value: number) => {
    setFormData((prev) => ({
      ...prev,
      customLimits: {
        ...prev.customLimits,
        [field]: value,
      },
    }));
  };

  const handlePricingChange = (field: keyof CustomPricing, value: number) => {
    setFormData((prev) => ({
      ...prev,
      customPricing: {
        ...prev.customPricing,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProvisionedCustomer(null);

    try {
      const token = localStorage.getItem('token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.post(
        `${apiUrl}/api/admin/provisioning/customers`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setSuccess('Customer provisioned successfully!');
      setProvisionedCustomer(response.data.data);
      
      // Reset form
      setFormData({
        companyName: '',
        companyDomain: '',
        companyDescription: '',
        adminEmail: '',
        adminFirstName: '',
        adminLastName: '',
        adminPhone: '',
        customLimits: {
          maxUsers: 100,
          maxActiveTickets: 1000,
          maxCompletedTickets: 5000,
          maxTotalTickets: 10000,
          storageQuotaGB: 100,
          maxAttachmentSizeMB: 25,
          maxCustomFields: 50,
          maxQueues: 20,
        },
        customPricing: {
          monthlyPrice: 0,
          annualPrice: 0,
          setupFee: 0,
        },
        billingCycle: 'monthly',
        trialDays: 30,
        notes: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to provision customer');
      console.error('Provisioning error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Customer Provisioning</h1>
          <p className="mt-2 text-sm text-gray-600">
            Provision new customers with custom subscriptions and limits
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('provision')}
              className={`${
                activeTab === 'provision'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Provision New Customer
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`${
                activeTab === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Provisioned Customers
            </button>
          </nav>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">{success}</h3>
                {provisionedCustomer && (
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      <strong>Company:</strong> {provisionedCustomer.company.name}
                    </p>
                    <p>
                      <strong>Admin Email:</strong> {provisionedCustomer.adminUser.email}
                    </p>
                    <p>
                      <strong>Temporary Password:</strong>{' '}
                      <code className="bg-green-100 px-2 py-1 rounded">
                        {provisionedCustomer.adminUser.temporaryPassword}
                      </code>
                    </p>
                    <p className="mt-2 text-xs">
                      ⚠️ Make sure to save this password - it won't be shown again!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Provision Form */}
        {activeTab === 'provision' && (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Company Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Company Information
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Company Domain
                  </label>
                  <input
                    type="text"
                    name="companyDomain"
                    value={formData.companyDomain}
                    onChange={handleInputChange}
                    placeholder="example.com"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Company Description
                  </label>
                  <textarea
                    name="companyDescription"
                    value={formData.companyDescription}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Admin User Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Administrator Information
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="adminFirstName"
                    value={formData.adminFirstName}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="adminLastName"
                    value={formData.adminLastName}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="adminEmail"
                    value={formData.adminEmail}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="adminPhone"
                    value={formData.adminPhone}
                    onChange={handleInputChange}
                    placeholder="+1-555-0123"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Subscription Limits */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Subscription Limits
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Users
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.maxUsers}
                    onChange={(e) =>
                      handleLimitChange('maxUsers', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Active Tickets
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.maxActiveTickets}
                    onChange={(e) =>
                      handleLimitChange('maxActiveTickets', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Completed Tickets
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.maxCompletedTickets}
                    onChange={(e) =>
                      handleLimitChange('maxCompletedTickets', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Total Tickets
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.maxTotalTickets}
                    onChange={(e) =>
                      handleLimitChange('maxTotalTickets', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Storage Quota (GB)
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.storageQuotaGB}
                    onChange={(e) =>
                      handleLimitChange('storageQuotaGB', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Attachment Size (MB)
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.maxAttachmentSizeMB}
                    onChange={(e) =>
                      handleLimitChange('maxAttachmentSizeMB', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Custom Fields
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.maxCustomFields}
                    onChange={(e) =>
                      handleLimitChange('maxCustomFields', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Queues
                  </label>
                  <input
                    type="number"
                    value={formData.customLimits.maxQueues}
                    onChange={(e) =>
                      handleLimitChange('maxQueues', parseInt(e.target.value))
                    }
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Billing */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Pricing & Billing
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Monthly Price ($)
                  </label>
                  <input
                    type="number"
                    value={formData.customPricing.monthlyPrice}
                    onChange={(e) =>
                      handlePricingChange('monthlyPrice', parseFloat(e.target.value))
                    }
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Annual Price ($)
                  </label>
                  <input
                    type="number"
                    value={formData.customPricing.annualPrice}
                    onChange={(e) =>
                      handlePricingChange('annualPrice', parseFloat(e.target.value))
                    }
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Setup Fee ($)
                  </label>
                  <input
                    type="number"
                    value={formData.customPricing.setupFee}
                    onChange={(e) =>
                      handlePricingChange('setupFee', parseFloat(e.target.value))
                    }
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Billing Cycle
                  </label>
                  <select
                    name="billingCycle"
                    value={formData.billingCycle}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Trial Days
                  </label>
                  <input
                    type="number"
                    name="trialDays"
                    value={formData.trialDays}
                    onChange={handleInputChange}
                    min="0"
                    max="90"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Additional Notes</h2>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                placeholder="Add any additional notes about this customer..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Provisioning...' : 'Provision Customer'}
              </button>
            </div>
          </form>
        )}

        {/* Provisioned Customers List */}
        {activeTab === 'list' && (
          <div className="bg-white shadow rounded-lg p-6">
            <ProvisionedCustomersList />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCustomerProvisioning;
