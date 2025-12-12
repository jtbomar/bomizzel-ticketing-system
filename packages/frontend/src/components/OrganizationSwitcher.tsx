import React, { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useTheme } from '../contexts/ThemeContext';

export const OrganizationSwitcher: React.FC = () => {
  const { currentOrg, organizations, switchOrg, setDefaultOrg } = useOrganization();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  if (!currentOrg || organizations.length === 0) {
    return null;
  }

  const handleSetDefault = async (orgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setSettingDefault(orgId);
      await setDefaultOrg(orgId);
    } catch (error) {
      console.error('Failed to set default org:', error);
    } finally {
      setSettingDefault(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
          theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-900'
        }`}
      >
        {currentOrg.logoUrl ? (
          <img
            src={currentOrg.logoUrl}
            alt={currentOrg.name}
            className="w-8 h-8 rounded object-cover"
          />
        ) : (
          <div
            className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${
              theme === 'dark' ? 'bg-white/20' : 'bg-gray-200'
            }`}
          >
            {currentOrg.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 text-left">
          <div className="font-medium text-sm">{currentOrg.name}</div>
          <div className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
            {currentOrg.role}
          </div>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div
            className={`absolute top-full left-0 mt-2 w-80 rounded-lg shadow-lg border z-50 ${
              theme === 'dark' ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'
            }`}
          >
            <div className="p-2">
              <div
                className={`text-xs font-medium px-3 py-2 ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                }`}
              >
                Switch Organization
              </div>

              <div className="space-y-1">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className={`group relative flex items-center space-x-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                      org.id === currentOrg.id
                        ? theme === 'dark'
                          ? 'bg-blue-500/20'
                          : 'bg-blue-50'
                        : theme === 'dark'
                          ? 'hover:bg-white/5'
                          : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      if (org.id !== currentOrg.id) {
                        switchOrg(org.id);
                      }
                      setIsOpen(false);
                    }}
                  >
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded flex items-center justify-center font-bold ${
                          theme === 'dark' ? 'bg-white/20' : 'bg-gray-200'
                        }`}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <div className="font-medium text-sm truncate">{org.name}</div>
                        {org.isDefault && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              theme === 'dark'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            Default
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}
                      >
                        {org.role}
                      </div>
                    </div>

                    {org.id === currentOrg.id && (
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}

                    {/* Set as default button */}
                    {!org.isDefault && org.id !== currentOrg.id && (
                      <button
                        onClick={(e) => handleSetDefault(org.id, e)}
                        disabled={settingDefault === org.id}
                        className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded transition-opacity ${
                          theme === 'dark'
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                        title="Set as default"
                      >
                        {settingDefault === org.id ? '...' : 'Set Default'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
