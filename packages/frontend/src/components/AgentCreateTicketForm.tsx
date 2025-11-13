import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  UserIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { Team, CustomField, Ticket, User } from '../types';

interface CustomerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: {
    id: string;
    name: string;
    domain?: string;
  };
}

const AgentCreateTicketForm: React.FC = () => {
  const navigate = useNavigate();
  
  // Get tab and customerId from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const urlTab = searchParams.get('tab') as 'ticket' | 'account' | 'customer' | null;
  const urlCustomerId = searchParams.get('customerId');
  
  const [activeTab, setActiveTab] = useState<'ticket' | 'account' | 'customer'>(
    urlTab || 'ticket'
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Account search for new customer
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<any[]>([]);
  const [showAccountResults, setShowAccountResults] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const accountSearchTimeoutRef = useRef<NodeJS.Timeout>();

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    teamId: '',
  });
  
  // New account form
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    domain: '',
    primaryContact: '',
    primaryEmail: '',
    primaryPhone: '',
  });

  // New customer form
  const [customerFormData, setCustomerFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [sendInvitation, setSendInvitation] = useState(true);

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);

  useEffect(() => {
    loadTeams();
    
    // Pre-populate customer if customerId is in URL
    if (urlCustomerId) {
      loadCustomerById(urlCustomerId);
    }
  }, []);

  const loadCustomerById = async (customerId: string) => {
    try {
      console.log('[CreateTicket] Loading customer by ID:', customerId);
      const response = await apiService.getUserDetails(customerId);
      console.log('[CreateTicket] Customer response:', response);
      const customerData = response.user || response;
      console.log('[CreateTicket] Customer data:', customerData);
      
      if (customerData && customerData.companies && customerData.companies.length > 0) {
        const customer = {
          id: customerData.id,
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          email: customerData.email,
          company: {
            id: customerData.companies[0].companyId,
            name: customerData.companies[0].company.name,
            domain: customerData.companies[0].company.domain,
          },
        };
        console.log('[CreateTicket] Setting selected customer:', customer);
        setSelectedCustomer(customer);
      } else {
        console.warn('[CreateTicket] Customer has no companies:', customerData);
      }
    } catch (error) {
      console.error('[CreateTicket] Failed to load customer:', error);
    }
  };

  useEffect(() => {
    if (selectedTeamId) {
      loadCustomFields(selectedTeamId);
    } else {
      setCustomFields([]);
      setCustomFieldValues({});
    }
  }, [selectedTeamId]);

  // Customer search with debounce
  useEffect(() => {
    if (customerSearch.length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        searchCustomers(customerSearch);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [customerSearch]);

  // Account search with debounce
  useEffect(() => {
    if (accountSearch.length >= 2) {
      if (accountSearchTimeoutRef.current) {
        clearTimeout(accountSearchTimeoutRef.current);
      }

      accountSearchTimeoutRef.current = setTimeout(() => {
        searchAccounts(accountSearch);
      }, 300);
    } else {
      setAccountResults([]);
      setShowAccountResults(false);
    }

    return () => {
      if (accountSearchTimeoutRef.current) {
        clearTimeout(accountSearchTimeoutRef.current);
      }
    };
  }, [accountSearch]);

  const loadTeams = async () => {
    try {
      setTeamsLoading(true);
      const response = await apiService.getTeams();
      const availableTeams = response.data || response;
      setTeams(availableTeams);

      if (availableTeams.length === 1) {
        setSelectedTeamId(availableTeams[0].id);
        setFormData((prev) => ({ ...prev, teamId: availableTeams[0].id }));
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
      setErrors({ teams: 'Failed to load available teams' });
    } finally {
      setTeamsLoading(false);
    }
  };

  const loadCustomFields = async (teamId: string) => {
    try {
      const response = await apiService.getTeamCustomFields(teamId);
      const fields = response.data || response;
      setCustomFields(fields);

      const initialValues: Record<string, any> = {};
      fields.forEach((field: CustomField) => {
        if (field.type === 'picklist' && field.options && field.options.length > 0) {
          initialValues[field.name] = field.isRequired ? field.options[0] : '';
        } else {
          initialValues[field.name] = '';
        }
      });
      setCustomFieldValues(initialValues);
    } catch (err) {
      console.error('Failed to load custom fields:', err);
      setErrors({ customFields: 'Failed to load custom fields for this team' });
    }
  };

  const searchCustomers = async (query: string) => {
    try {
      const response = await apiService.searchUsers(query, { limit: 10, role: 'customer' });
      const users = response.users || response.data || response;

      // Get company info for each user
      const customersWithCompanies = await Promise.all(
        users.map(async (user: User) => {
          if (user.companies && user.companies.length > 0) {
            return {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              company: user.companies[0].company,
            };
          }
          return null;
        })
      );

      setSearchResults(customersWithCompanies.filter((c) => c !== null) as CustomerSearchResult[]);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Failed to search customers:', err);
    }
  };

  const searchAccounts = async (query: string) => {
    try {
      const response = await apiService.searchCompanies(query, { limit: 10 });
      const companies = response.companies || response.data || response;
      setAccountResults(companies);
      setShowAccountResults(true);
    } catch (err) {
      console.error('Failed to search accounts:', err);
    }
  };

  const selectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setShowSearchResults(false);
    setSearchResults([]);
    
    // Clear any customer-related errors
    const newErrors = { ...errors };
    delete newErrors.customer;
    setErrors(newErrors);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
  };

  const selectAccount = (account: any) => {
    setSelectedAccount(account);
    setAccountSearch('');
    setShowAccountResults(false);
    setAccountResults([]);
    
    const newErrors = { ...errors };
    delete newErrors.account;
    setErrors(newErrors);
  };

  const clearAccount = () => {
    setSelectedAccount(null);
    setAccountSearch('');
  };

  const handleAccountFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountFormData((prev) => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      const newErrors = { ...errors };
      delete newErrors[name];
      setErrors(newErrors);
    }
  };

  const handleCustomerFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerFormData((prev) => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      const newErrors = { ...errors };
      delete newErrors[name];
      setErrors(newErrors);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value;
    setSelectedTeamId(teamId);
    setFormData((prev) => ({ ...prev, teamId }));

    if (errors.teamId) {
      setErrors((prev) => ({ ...prev, teamId: '' }));
    }
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldName]: value }));

    if (errors[`customField_${fieldName}`]) {
      setErrors((prev) => ({ ...prev, [`customField_${fieldName}`]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedCustomer) {
      newErrors.customer = 'Please select a customer';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.teamId) {
      newErrors.teamId = 'Please select a team';
    }

    // Validate custom fields
    customFields.forEach((field) => {
      const value = customFieldValues[field.name];

      if (field.isRequired && (!value || value.toString().trim() === '')) {
        newErrors[`customField_${field.name}`] = `${field.label} is required`;
      }

      if (value && field.validation) {
        const { min, max, pattern } = field.validation;

        if (field.type === 'number' || field.type === 'integer' || field.type === 'decimal') {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            newErrors[`customField_${field.name}`] = `${field.label} must be a valid number`;
          } else {
            if (min !== undefined && numValue < min) {
              newErrors[`customField_${field.name}`] = `${field.label} must be at least ${min}`;
            }
            if (max !== undefined && numValue > max) {
              newErrors[`customField_${field.name}`] = `${field.label} must be at most ${max}`;
            }
          }
        }

        if (field.type === 'string' && pattern) {
          const regex = new RegExp(pattern);
          if (!regex.test(value.toString())) {
            newErrors[`customField_${field.name}`] =
              field.validation.message || `${field.label} format is invalid`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!accountFormData.name.trim()) newErrors.name = 'Company name is required';
    if (!accountFormData.primaryEmail.trim()) newErrors.primaryEmail = 'Primary email is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.createCompany(accountFormData);
      const newCompany = response.company || response.data || response;
      
      // Show success and navigate back
      alert(`Account "${newCompany.name}" created successfully!`);
      navigate('/agent');
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error?.message || 'Failed to create account' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!selectedAccount) newErrors.account = 'Please select an account';
    if (!customerFormData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!customerFormData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!customerFormData.email.trim()) newErrors.email = 'Email is required';
    // Password is optional - will be set when they accept invitation
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // Create customer with temporary password (they'll set real one via invitation)
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
      
      const response = await apiService.register({
        firstName: customerFormData.firstName,
        lastName: customerFormData.lastName,
        email: customerFormData.email,
        password: tempPassword,
        role: 'customer',
      });
      const newUser = response.user || response.data || response;
      
      // Associate user with company
      await apiService.addUserToCompany(newUser.id, selectedAccount.id, 'member');
      
      // Send invitation email if requested
      if (sendInvitation) {
        try {
          await apiService.sendCustomerInvitation(newUser.id);
          alert(
            `Customer "${newUser.firstName} ${newUser.lastName}" created successfully!\n\n` +
            `An invitation email has been sent to ${newUser.email}.\n` +
            `They can use it to set their password and access the support portal.`
          );
        } catch (inviteError) {
          alert(
            `Customer created but invitation email failed to send.\n` +
            `You can resend the invitation from the customer management page.`
          );
        }
      } else {
        alert(
          `Customer "${newUser.firstName} ${newUser.lastName}" created successfully!\n\n` +
          `No invitation sent. You can send it later from the customer management page.`
        );
      }
      
      navigate('/agent');
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error?.message || 'Failed to create customer' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const ticketData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        companyId: selectedCustomer!.company.id,
        teamId: formData.teamId,
        customFieldValues,
        submitterId: selectedCustomer!.id, // Set the customer as the submitter
      };

      const response = await apiService.createTicket(ticketData);
      const newTicket = response.ticket || response.data || response;

      // Show success message
      alert(`Ticket #${newTicket.id.slice(-8)} created successfully!`);
      
      // Navigate back to dashboard
      navigate('/agent');
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error?.message || 'Failed to create ticket' });
    } finally {
      setLoading(false);
    }
  };

  const renderCustomField = (field: CustomField) => {
    const value = customFieldValues[field.name] || '';
    const error = errors[`customField_${field.name}`];

    switch (field.type) {
      case 'string':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={`input ${error ? 'border-red-300' : ''}`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'number':
      case 'decimal':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              step={field.type === 'decimal' ? '0.01' : '1'}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={`input ${error ? 'border-red-300' : ''}`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'integer':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              step="1"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, parseInt(e.target.value) || '')}
              className={`input ${error ? 'border-red-300' : ''}`}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      case 'picklist':
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={`input ${error ? 'border-red-300' : ''}`}
            >
              {!field.isRequired && <option value="">Select {field.label.toLowerCase()}</option>}
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (teamsLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New</h1>

      {/* Tabs */}
      <div className="bg-white rounded-t-lg shadow-sm border border-gray-200 border-b-0">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('ticket')}
            className={`flex-1 px-6 py-4 text-sm font-medium ${
              activeTab === 'ticket'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            New Ticket
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`flex-1 px-6 py-4 text-sm font-medium ${
              activeTab === 'account'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            New Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`flex-1 px-6 py-4 text-sm font-medium ${
              activeTab === 'customer'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            New Customer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-b-lg shadow-sm border border-gray-200 p-6">
        {/* Ticket Form */}
        {activeTab === 'ticket' && (
          <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.submit}
            </div>
          )}

          {/* Customer Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            
            {selectedCustomer ? (
              <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {selectedCustomer.firstName} {selectedCustomer.lastName}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                      <EnvelopeIcon className="h-4 w-4" />
                      <span>{selectedCustomer.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <BuildingOfficeIcon className="h-4 w-4" />
                      <span className="font-medium">{selectedCustomer.company.name}</span>
                      {selectedCustomer.company.domain && (
                        <span className="text-gray-400">({selectedCustomer.company.domain})</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={`input pl-10 ${errors.customer ? 'border-red-300' : ''}`}
                    placeholder="Search by name or email..."
                  />
                </div>

                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </div>
                        <div className="text-sm text-gray-600">{customer.email}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          <BuildingOfficeIcon className="inline h-3 w-3 mr-1" />
                          {customer.company.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showSearchResults && searchResults.length === 0 && customerSearch.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
                    No customers found
                  </div>
                )}
              </div>
            )}
            {errors.customer && <p className="mt-1 text-sm text-red-600">{errors.customer}</p>}
          </div>

          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTeamId}
              onChange={handleTeamChange}
              className={`input ${errors.teamId ? 'border-red-300' : ''}`}
              disabled={teams.length <= 1}
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {errors.teamId && <p className="mt-1 text-sm text-red-600">{errors.teamId}</p>}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`input ${errors.title ? 'border-red-300' : ''}`}
              placeholder="Brief description of the issue"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              rows={6}
              value={formData.description}
              onChange={handleInputChange}
              className={`input ${errors.description ? 'border-red-300' : ''}`}
              placeholder="Detailed information about the issue"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
              {customFields.sort((a, b) => a.order - b.order).map(renderCustomField)}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Ticket...' : 'Create Ticket'}
            </button>
          </div>
        </form>
        )}

        {/* Account Form */}
        {activeTab === 'account' && (
          <form onSubmit={handleSubmitAccount} className="space-y-6">
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {errors.submit}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={accountFormData.name}
                  onChange={handleAccountFormChange}
                  className={`input ${errors.name ? 'border-red-300' : ''}`}
                  placeholder="Acme Corporation"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  name="domain"
                  value={accountFormData.domain}
                  onChange={handleAccountFormChange}
                  className="input"
                  placeholder="acme.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Contact
                </label>
                <input
                  type="text"
                  name="primaryContact"
                  value={accountFormData.primaryContact}
                  onChange={handleAccountFormChange}
                  className="input"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="primaryEmail"
                  value={accountFormData.primaryEmail}
                  onChange={handleAccountFormChange}
                  className={`input ${errors.primaryEmail ? 'border-red-300' : ''}`}
                  placeholder="contact@acme.com"
                />
                {errors.primaryEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.primaryEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Phone
                </label>
                <input
                  type="tel"
                  name="primaryPhone"
                  value={accountFormData.primaryPhone}
                  onChange={handleAccountFormChange}
                  className="input"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}

        {/* Customer Form */}
        {activeTab === 'customer' && (
          <form onSubmit={handleSubmitCustomer} className="space-y-6">
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {errors.submit}
              </div>
            )}

            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account (Company) <span className="text-red-500">*</span>
              </label>

              {selectedAccount ? (
                <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{selectedAccount.name}</span>
                      </div>
                      {selectedAccount.domain && (
                        <div className="text-sm text-gray-600">{selectedAccount.domain}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearAccount}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      className={`input pl-10 ${errors.account ? 'border-red-300' : ''}`}
                      placeholder="Search for company..."
                    />
                  </div>

                  {showAccountResults && accountResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {accountResults.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => selectAccount(account)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{account.name}</div>
                          {account.domain && (
                            <div className="text-sm text-gray-500">{account.domain}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {showAccountResults && accountResults.length === 0 && accountSearch.length >= 2 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
                      No accounts found
                    </div>
                  )}
                </div>
              )}
              {errors.account && <p className="mt-1 text-sm text-red-600">{errors.account}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={customerFormData.firstName}
                  onChange={handleCustomerFormChange}
                  className={`input ${errors.firstName ? 'border-red-300' : ''}`}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={customerFormData.lastName}
                  onChange={handleCustomerFormChange}
                  className={`input ${errors.lastName ? 'border-red-300' : ''}`}
                  placeholder="Doe"
                />
                {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={customerFormData.email}
                onChange={handleCustomerFormChange}
                className={`input ${errors.email ? 'border-red-300' : ''}`}
                placeholder="john.doe@company.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Send Invitation Option */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="sendInvitation"
                  checked={sendInvitation}
                  onChange={(e) => setSendInvitation(e.target.checked)}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <label htmlFor="sendInvitation" className="font-medium text-gray-900 cursor-pointer">
                    Send invitation email
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Customer will receive an email to set their password and access the support portal.
                    If unchecked, you can send the invitation later.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Customer...' : 'Create Customer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AgentCreateTicketForm;
