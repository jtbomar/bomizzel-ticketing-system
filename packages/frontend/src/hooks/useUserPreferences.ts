import { useState, useEffect } from 'react';
import { UserPreferences } from '../types';
import { apiService } from '../services/api';

const defaultPreferences: UserPreferences = {
  theme: 'light',
  notifications: {
    email: true,
    browser: true,
    ticketAssigned: true,
    ticketUpdated: true,
    ticketResolved: true,
  },
  dashboard: {
    defaultView: 'kanban',
    ticketsPerPage: 20,
  },
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const profile = await apiService.getProfile();
      setPreferences(profile.preferences || defaultPreferences);
    } catch (err) {
      setError('Failed to load user preferences');
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPreferences: Partial<UserPreferences>) => {
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      await apiService.updateUserPreferences(updatedPreferences);
      setPreferences(updatedPreferences);
      return true;
    } catch (err) {
      setError('Failed to update preferences');
      console.error('Error updating preferences:', err);
      return false;
    }
  };

  const updateDashboardView = async (view: 'kanban' | 'list') => {
    return updatePreferences({
      dashboard: {
        ...preferences.dashboard,
        defaultView: view,
      },
    });
  };

  const updateTicketsPerPage = async (ticketsPerPage: number) => {
    return updatePreferences({
      dashboard: {
        ...preferences.dashboard,
        ticketsPerPage,
      },
    });
  };

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    updateDashboardView,
    updateTicketsPerPage,
    reload: loadPreferences,
  };
};
