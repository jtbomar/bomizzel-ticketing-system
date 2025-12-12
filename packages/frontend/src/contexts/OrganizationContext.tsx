import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  role: string;
  isDefault: boolean;
  lastAccessedAt?: string;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  switchOrg: (orgId: string) => void;
  setDefaultOrg: (orgId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getUserOrganizations();
      const orgs = response.data || [];
      setOrganizations(orgs);

      // Determine current org
      const savedOrgId = localStorage.getItem('currentOrgId');
      const urlOrgId = extractOrgIdFromUrl();

      let current: Organization | null = null;

      // Priority: URL > localStorage > default > first
      if (urlOrgId) {
        current = orgs.find((o: Organization) => o.id === urlOrgId) || null;
      } else if (savedOrgId) {
        current = orgs.find((o: Organization) => o.id === savedOrgId) || null;
      }

      if (!current) {
        current = orgs.find((o: Organization) => o.isDefault) || orgs[0] || null;
      }

      if (current) {
        setCurrentOrg(current);
        localStorage.setItem('currentOrgId', current.id);
      }

      console.log('📦 Organizations loaded:', orgs.length);
      console.log('✅ Current org:', current?.name);
    } catch (err: any) {
      console.error('Failed to load organizations:', err);
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganizations = async () => {
    await loadOrganizations();
  };

  const extractOrgIdFromUrl = (): string | null => {
    const match = window.location.pathname.match(/^\/org\/([^\/]+)/);
    return match ? match[1] : null;
  };

  const switchOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem('currentOrgId', orgId);

      // Navigate to org-scoped dashboard
      window.location.href = `/org/${orgId}/dashboard`;
    }
  };

  const setDefaultOrg = async (orgId: string) => {
    try {
      await apiService.setDefaultOrganization(orgId);

      // Update local state
      setOrganizations((orgs) =>
        orgs.map((o) => ({
          ...o,
          isDefault: o.id === orgId,
        }))
      );

      console.log('✅ Default organization updated');
    } catch (err: any) {
      console.error('Failed to set default organization:', err);
      throw err;
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        organizations,
        switchOrg,
        setDefaultOrg,
        loading,
        error,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};
