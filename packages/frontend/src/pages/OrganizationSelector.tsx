import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { useTheme } from '../contexts/ThemeContext';

const OrganizationSelector: React.FC = () => {
  const { organizations, loading, error, switchOrg } = useOrganization();
  const { theme } = useTheme();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
            : 'bg-gray-50'
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
            Loading organizations...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
            : 'bg-gray-50'
        }`}
      >
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Error Loading Organizations
          </h2>
          <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>{error}</p>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
            : 'bg-gray-50'
        }`}
      >
        <div className="text-center">
          <div className={`text-6xl mb-4`}>🏢</div>
          <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            No Organizations Found
          </h2>
          <p className={`mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
            You don't have access to any organizations yet.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Organization
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
          : 'bg-gray-50'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Select Organization
          </h1>
          <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>
            Choose which organization you'd like to work in
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => switchOrg(org.id)}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 hover:border-blue-500 hover:bg-white/10'
                  : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-lg'
              }`}
            >
              <div className="flex items-start space-x-4">
                {org.logoUrl ? (
                  <img
                    src={org.logoUrl}
                    alt={org.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                ) : (
                  <div
                    className={`w-16 h-16 rounded flex items-center justify-center text-2xl font-bold ${
                      theme === 'dark' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3
                      className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {org.name}
                    </h3>
                    {org.isDefault && (
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          theme === 'dark'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        Default
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}
                  >
                    Role: {org.role}
                  </p>
                  {org.lastAccessedAt && (
                    <p
                      className={`text-xs mt-2 ${
                        theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                      }`}
                    >
                      Last accessed: {new Date(org.lastAccessedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <svg
                  className={`w-6 h-6 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrganizationSelector;
