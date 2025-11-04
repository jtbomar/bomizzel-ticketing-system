import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface SearchFilter {
  field: string;
  operator: string;
  value?: any;
  values?: any[];
}

interface SearchableField {
  name: string;
  label: string;
  type: string;
  options?: string[];
  searchable: boolean;
  sortable: boolean;
}

interface AdvancedSearchProps {
  teamId: string;
  onSearch: (results: any) => void;
  onClose: () => void;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ teamId, onSearch, onClose }) => {
  const [searchableFields, setSearchableFields] = useState<SearchableField[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  useEffect(() => {
    loadSearchableFields();
  }, [teamId]);

  const loadSearchableFields = async () => {
    try {
      setFieldsLoading(true);
      const response = await apiService.getSearchableFields(teamId);
      setSearchableFields(response.data || []);
    } catch (error) {
      console.error('Error loading searchable fields:', error);
    } finally {
      setFieldsLoading(false);
    }
  };

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };

  const updateFilter = (index: number, updates: Partial<SearchFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const searchRequest = {
        query: query.trim() || undefined,
        filters: filters.filter((f) => f.field && f.operator),
        sortBy,
        sortOrder,
        teamId,
      };

      const results = await apiService.advancedSearch(searchRequest);
      onSearch(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOperatorsForField = (field: SearchableField) => {
    const baseOperators = [
      { value: 'equals', label: 'Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'is_null', label: 'Is Empty' },
      { value: 'is_not_null', label: 'Is Not Empty' },
    ];

    if (field.type === 'string') {
      return [
        ...baseOperators,
        { value: 'starts_with', label: 'Starts With' },
        { value: 'ends_with', label: 'Ends With' },
      ];
    }

    if (field.type === 'number' || field.type === 'date') {
      return [
        ...baseOperators,
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
      ];
    }

    if (field.type === 'select' || field.options) {
      return [
        ...baseOperators,
        { value: 'in', label: 'In List' },
        { value: 'not_in', label: 'Not In List' },
      ];
    }

    return baseOperators;
  };

  const renderFilterValue = (filter: SearchFilter, index: number) => {
    const field = searchableFields.find((f) => f.name === filter.field);
    if (!field) return null;

    const needsValue = !['is_null', 'is_not_null'].includes(filter.operator);
    if (!needsValue) return null;

    const needsList = ['in', 'not_in'].includes(filter.operator);

    if (field.options && !needsList) {
      return (
        <select
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select value...</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (needsList) {
      return (
        <textarea
          value={filter.values?.join('\n') || ''}
          onChange={(e) =>
            updateFilter(index, { values: e.target.value.split('\n').filter((v) => v.trim()) })
          }
          placeholder="Enter values (one per line)"
          rows={3}
          className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      );
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      );
    }

    return (
      <input
        type="text"
        value={filter.value || ''}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        placeholder="Enter value..."
      />
    );
  };

  if (fieldsLoading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Advanced Search</h3>
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

        <div className="space-y-6">
          {/* General Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">General Search</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in title, description, submitter, assignee, company..."
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Filters</label>
              <button
                onClick={addFilter}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Filter
              </button>
            </div>

            {filters.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No filters added yet.</p>
            ) : (
              <div className="space-y-3">
                {filters.map((filter, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-3">
                      <select
                        value={filter.field}
                        onChange={(e) =>
                          updateFilter(index, { field: e.target.value, value: '', values: [] })
                        }
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select field...</option>
                        {searchableFields
                          .filter((f) => f.searchable)
                          .map((field) => (
                            <option key={field.name} value={field.name}>
                              {field.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <select
                        value={filter.operator}
                        onChange={(e) =>
                          updateFilter(index, { operator: e.target.value, value: '', values: [] })
                        }
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        disabled={!filter.field}
                      >
                        {filter.field && searchableFields.find((f) => f.name === filter.field) ? (
                          getOperatorsForField(
                            searchableFields.find((f) => f.name === filter.field)!
                          ).map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))
                        ) : (
                          <option value="">Select operator...</option>
                        )}
                      </select>
                    </div>

                    <div className="col-span-6">{renderFilterValue(filter, index)}</div>

                    <div className="col-span-1">
                      <button
                        onClick={() => removeFilter(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sorting */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {searchableFields
                  .filter((f) => f.sortable)
                  .map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearch;
