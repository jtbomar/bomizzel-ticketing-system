import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  UserIcon,
  BuildingOfficeIcon,
  TicketIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

interface SearchResult {
  type: 'customer' | 'account' | 'ticket';
  id: string;
  title: string;
  subtitle?: string;
  metadata?: string;
}

const AgentGlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search with debounce
  useEffect(() => {
    if (query.length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
      setIsOpen(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      // Ensure search query is at least 2 characters for searchUsers
      const customerSearchQuery = searchQuery.length >= 2 ? searchQuery : 'aa';

      const [customersRes, accountsRes, ticketsRes] = await Promise.all([
        apiService
          .searchUsers(customerSearchQuery, { limit: 5, role: 'customer' })
          .catch(() => ({ users: [] })),
        apiService.searchCompanies(searchQuery, { limit: 5 }).catch(() => ({ companies: [] })),
        apiService.getTickets({ search: searchQuery, limit: 5 }).catch(() => ({ data: [] })),
      ]);

      const allResults: SearchResult[] = [];

      // Add customers
      const customers = customersRes.users || customersRes.data || [];
      customers.forEach((customer: any) => {
        allResults.push({
          type: 'customer',
          id: customer.id,
          title: `${customer.firstName} ${customer.lastName}`,
          subtitle: customer.email,
          metadata: customer.companies?.[0]?.company?.name,
        });
      });

      // Add accounts
      const accounts = accountsRes.companies || accountsRes.data || [];
      accounts.forEach((account: any) => {
        allResults.push({
          type: 'account',
          id: account.id,
          title: account.name,
          subtitle: account.domain,
          metadata: `${account.userCount || 0} users`,
        });
      });

      // Add tickets
      const tickets = ticketsRes.data || ticketsRes.tickets || [];
      tickets.forEach((ticket: any) => {
        allResults.push({
          type: 'ticket',
          id: ticket.id,
          title: ticket.title,
          subtitle: `#${ticket.id.slice(-8)} • ${ticket.status}`,
          metadata: ticket.company?.name,
        });
      });

      setResults(allResults);
      setIsOpen(allResults.length > 0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery('');
    setIsOpen(false);
    setResults([]);

    switch (result.type) {
      case 'customer':
        // Navigate to customer detail page (you'll need to create this)
        navigate(`/agent/customers/${result.id}`);
        break;
      case 'account':
        // Navigate to account detail page
        navigate(`/agent/accounts/${result.id}`);
        break;
      case 'ticket':
        // Navigate to ticket detail page
        navigate(`/agent/tickets/${result.id}`);
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return <UserIcon className="h-5 w-5 text-blue-500" />;
      case 'account':
        return <BuildingOfficeIcon className="h-5 w-5 text-green-500" />;
      case 'ticket':
        return <TicketIcon className="h-5 w-5 text-purple-500" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'customer':
        return 'Customer';
      case 'account':
        return 'Account';
      case 'ticket':
        return 'Ticket';
      default:
        return '';
    }
  };

  return (
    <div ref={searchRef} className="relative flex-1 max-w-2xl">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          placeholder="Search customers, accounts, or tickets..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No results found</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-start space-x-3 text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex-shrink-0 mt-1">{getIcon(result.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {result.title}
                    </p>
                    {result.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {result.subtitle}
                      </p>
                    )}
                    {result.metadata && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                        {result.metadata}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Search Tips */}
          {!loading && results.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Press Enter to see all results • Click to view details
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentGlobalSearch;
