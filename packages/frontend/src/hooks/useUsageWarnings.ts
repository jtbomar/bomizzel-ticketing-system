import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export interface UsageWarning {
  userId: string;
  subscriptionId: string;
  warningType: 'approaching_75' | 'approaching_90' | 'at_limit';
  limitType: 'active' | 'completed' | 'total';
  currentUsage: number;
  limit: number;
  percentage: number;
  planName: string;
  timestamp: Date;
}

export interface DashboardWarnings {
  warnings: UsageWarning[];
  shouldShowUpgradePrompt: boolean;
  upgradeMessage?: string;
}

export interface TicketCreationWarning {
  canCreate: boolean;
  warning?: {
    message: string;
    severity: 'info' | 'warning' | 'error';
    showUpgradePrompt: boolean;
    upgradeOptions?: string[];
  };
}

export interface UsageStats {
  usage: {
    activeTickets: number;
    completedTickets: number;
    totalTickets: number;
    archivedTickets: number;
  };
  limitStatus: {
    isAtLimit: boolean;
    isNearLimit: boolean;
    percentageUsed: {
      active: number;
      completed: number;
      total: number;
    };
    limits: {
      activeTickets: number;
      completedTickets: number;
      totalTickets: number;
    };
    current: {
      activeTickets: number;
      completedTickets: number;
      totalTickets: number;
      archivedTickets: number;
    };
  };
  percentages: {
    active: number;
    completed: number;
    total: number;
  };
}

export const useUsageWarnings = () => {
  const [warnings, setWarnings] = useState<UsageWarning[]>([]);
  const [dashboardWarnings, setDashboardWarnings] = useState<DashboardWarnings | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUsageWarnings();
      setWarnings(response.data?.warnings || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch usage warnings');
      console.error('Error fetching usage warnings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboardWarnings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getDashboardWarnings();
      setDashboardWarnings(response.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch dashboard warnings');
      console.error('Error fetching dashboard warnings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsageStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUsageStats();
      setUsageStats(response.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch usage stats');
      console.error('Error fetching usage stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkTicketCreation = useCallback(async (): Promise<TicketCreationWarning> => {
    try {
      const response = await apiService.getTicketCreationWarning();
      return response.data || { canCreate: true };
    } catch (err: any) {
      console.error('Error checking ticket creation:', err);
      return { canCreate: true }; // Allow creation on error to prevent blocking
    }
  }, []);

  const checkCanCreateTicket = useCallback(async (): Promise<{
    canCreate: boolean;
    reason?: string;
    limitType?: 'active' | 'total';
    usage?: any;
    limits?: any;
  }> => {
    try {
      const response = await apiService.canCreateTicket();
      return response.data || { canCreate: true };
    } catch (err: any) {
      console.error('Error checking can create ticket:', err);
      return { canCreate: true }; // Allow creation on error to prevent blocking
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchWarnings(),
      fetchDashboardWarnings(),
      fetchUsageStats()
    ]);
  }, [fetchWarnings, fetchDashboardWarnings, fetchUsageStats]);

  // Auto-fetch on mount
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    warnings,
    dashboardWarnings,
    usageStats,
    loading,
    error,
    fetchWarnings,
    fetchDashboardWarnings,
    fetchUsageStats,
    checkTicketCreation,
    checkCanCreateTicket,
    refreshAll
  };
};