import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDownIcon, PlusIcon, UserIcon, ArrowRightOnRectangleIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { Company, User } from '../types';

interface CustomerHeaderProps {
  user: User | null;
  companies: Company[];
  selectedCompanyId: string;
  onCompanyChange: (companyId: string) => void;
  onLogout: () => void;
}

const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  user,
  companies,
  selectedCompanyId,
  onCompanyChange,
  onLogout,
}) => {
  const location = useLocation();
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const isActive = (path: string) => {
    if (path === '/customer' && location.pathname === '/customer') return true;
    if (path !== '/customer' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <Link to="/customer" className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Bomizzel</h1>
            </Link>
            
            <nav className="hidden md:flex space-x-6">
              <Link
                to="/customer"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive('/customer')
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                My Tickets
              </Link>
              <Link
                to="/customer/create"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive('/customer/create')
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Create Ticket
              </Link>
              <Link
                to="/customer/subscription"
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive('/customer/subscription')
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Subscription
              </Link>
            </nav>
          </div>

          {/* Company Selector and User Menu */}
          <div className="flex items-center space-x-4">
            {/* Company Selector */}
            {companies.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <span>{selectedCompany?.name || 'Select Company'}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                
                {showCompanyDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Select Company
                      </div>
                      {companies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => {
                            onCompanyChange(company.id);
                            setShowCompanyDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                            company.id === selectedCompanyId
                              ? 'text-primary-600 bg-primary-50'
                              : 'text-gray-700'
                          }`}
                        >
                          <div className="font-medium">{company.name}</div>
                          {company.domain && (
                            <div className="text-xs text-gray-500">{company.domain}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Create Ticket Button */}
            <Link
              to="/customer/create"
              className="btn-primary flex items-center space-x-2"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">New Ticket</span>
            </Link>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <UserIcon className="h-5 w-5" />
                <span className="hidden sm:inline">
                  {user?.firstName} {user?.lastName}
                </span>
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-gray-500">
                      {user?.email}
                    </div>
                    <hr className="my-1" />
                    <Link
                      to="/customer/subscription"
                      onClick={() => setShowUserDropdown(false)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                    >
                      <CreditCardIcon className="h-4 w-4" />
                      <span>Subscription</span>
                    </Link>
                    <button
                      onClick={() => {
                        onLogout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex space-x-4 py-2 overflow-x-auto">
            <Link
              to="/customer"
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive('/customer')
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              My Tickets
            </Link>
            <Link
              to="/customer/create"
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive('/customer/create')
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Create Ticket
            </Link>
            <Link
              to="/customer/subscription"
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive('/customer/subscription')
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Subscription
            </Link>
          </div>
        </div>
      </div>

      {/* Click outside handlers */}
      {(showCompanyDropdown || showUserDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowCompanyDropdown(false);
            setShowUserDropdown(false);
          }}
        />
      )}
    </header>
  );
};

export default CustomerHeader;