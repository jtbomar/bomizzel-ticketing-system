import React, { useState, useEffect } from 'react';
import { apiService as api } from '../../services/api';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

interface Company {
  id: string;
  name: string;
  domain: string;
  description: string;
  customerCount: number;
  createdAt: string;
}

interface CompanyFilters {
  search: string;
}

const CompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CompanyFilters>({
    search: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    domain: '',
    description: '',
  });

  useEffect(() => {
    fetchCompanies();
  }, [filters]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);

      // Mock companies data for now
      const mockCompanies = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          name: 'Acme Corporation',
          domain: 'acme.com',
          description: 'A leading technology company',
          customerCount: 15,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          name: 'TechStart Inc',
          domain: 'techstart.com',
          description: 'Innovative startup company',
          customerCount: 8,
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440003',
          name: 'Global Solutions Ltd',
          domain: 'globalsolutions.com',
          description: 'International consulting firm',
          customerCount: 25,
          createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      let filteredCompanies = mockCompanies;

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredCompanies = filteredCompanies.filter(
          (company) =>
            company.name.toLowerCase().includes(searchLower) ||
            company.domain.toLowerCase().includes(searchLower) ||
            company.description.toLowerCase().includes(searchLower)
        );
      }

      setCompanies(filteredCompanies);
    } catch (err) {
      setError('Failed to fetch companies');
      console.error('Fetch companies error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof CompanyFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // In a real app, this would call an API endpoint to create the company
      console.log('Adding company:', newCompany);

      // For now, just show success and refresh
      alert(`Company "${newCompany.name}" would be created with domain: ${newCompany.domain}`);

      setShowAddModal(false);
      setNewCompany({
        name: '',
        domain: '',
        description: '',
      });
      fetchCompanies();
    } catch (err) {
      setError('Failed to add company');
      console.error('Add company error:', err);
    }
  };

  if (loading && companies.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Company Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 rounded-lg hover:bg-cyan-500/30 transition-all duration-200"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Company
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-md p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Search</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search companies..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-cyan-400 focus:ring-cyan-400 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ search: '' });
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 border border-white/20 rounded-md hover:bg-white/20 transition-all duration-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div
            key={company.id}
            className="bg-white/5 rounded-lg p-6 border border-white/10 hover:bg-white/10 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-cyan-500/20 rounded-lg flex items-center justify-center mr-3">
                  <BuildingOfficeIcon className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{company.name}</h3>
                  <p className="text-sm text-white/60">{company.domain}</p>
                </div>
              </div>
              <button className="text-white/60 hover:text-white transition-colors duration-200">
                <PencilIcon className="h-4 w-4" />
              </button>
            </div>

            <p className="text-white/80 text-sm mb-4">{company.description}</p>

            <div className="flex justify-between items-center text-sm">
              <span className="text-white/60">{company.customerCount} customers</span>
              <span className="text-white/60">
                Created {new Date(company.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && !loading && (
        <div className="text-center py-12">
          <BuildingOfficeIcon className="h-16 w-16 text-white/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No companies found</h3>
          <p className="text-white/60">Get started by adding your first company</p>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Add Company</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/60 hover:text-white transition-colors duration-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompany.name}
                  onChange={(e) => setNewCompany((prev) => ({ ...prev, name: e.target.value }))}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-cyan-400 focus:ring-cyan-400 sm:text-sm px-3 py-2"
                  placeholder="Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Domain</label>
                <input
                  type="text"
                  required
                  value={newCompany.domain}
                  onChange={(e) => setNewCompany((prev) => ({ ...prev, domain: e.target.value }))}
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-cyan-400 focus:ring-cyan-400 sm:text-sm px-3 py-2"
                  placeholder="acme.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newCompany.description}
                  onChange={(e) =>
                    setNewCompany((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="block w-full rounded-md bg-white/10 border border-white/20 text-white placeholder-white/60 shadow-sm focus:border-cyan-400 focus:ring-cyan-400 sm:text-sm px-3 py-2"
                  placeholder="Brief description of the company..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 px-4 bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 rounded-lg hover:bg-cyan-500/30 transition-all duration-200"
                >
                  Add Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;
