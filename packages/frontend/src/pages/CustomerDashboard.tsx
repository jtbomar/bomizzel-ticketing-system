import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import { apiService } from '../services/api';
import { Company, Ticket } from '../types';
import CustomerTicketList from '../components/CustomerTicketList';
import CustomerTicketDetail from '../components/CustomerTicketDetail';
import CreateTicketForm from '../components/CreateTicketForm';
import CustomerHeader from '../components/CustomerHeader';
import SubscriptionManagement from '../components/SubscriptionManagement';
import UsageWarning from '../components/UsageWarning';
import TrialStatus from '../components/TrialStatus';
import { useUsageWarnings } from '../hooks/useUsageWarnings';

const CustomerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Real-time notifications
  useRealTimeNotifications();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  const { dashboardWarnings } = useUsageWarnings();

  useEffect(() => {
    loadUserCompanies();
    loadSubscriptionInfo();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadTickets();
    }
  }, [selectedCompanyId]);

  const loadUserCompanies = async () => {
    try {
      const response = await apiService.getCompanies();
      const userCompanies = response.data || response;
      setCompanies(userCompanies);

      // Auto-select first company if only one exists
      if (userCompanies.length === 1) {
        setSelectedCompanyId(userCompanies[0].id);
      } else if (userCompanies.length > 1) {
        // Use the first company as default, but user can change
        setSelectedCompanyId(userCompanies[0].id);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError('Failed to load your companies');
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    if (!selectedCompanyId) return;

    try {
      setLoading(true);
      const response = await apiService.getTickets({
        companyId: selectedCompanyId,
      });
      setTickets(response.data || response);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionInfo = async () => {
    try {
      const response = await apiService.get('/subscriptions/current');
      const subscriptionData = response.data?.data;
      if (subscriptionData?.subscription?.id) {
        setSubscriptionId(subscriptionData.subscription.id);
      }
    } catch (err) {
      console.error('Failed to load subscription info:', err);
      // Don't show error for subscription info as it's not critical
    }
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
  };

  const handleTicketCreated = (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
    navigate('/customer');
  };

  const handleTicketUpdated = (updatedTicket: Ticket) => {
    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket))
    );
  };

  if (loading && companies.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && companies.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-medium">Error loading dashboard</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadUserCompanies} className="mt-3 btn-primary text-sm">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CustomerHeader
          user={user}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          onCompanyChange={handleCompanyChange}
          onLogout={logout}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-6 py-8 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">No Companies Found</h2>
              <p>
                You don't have access to any companies yet. Please contact your administrator to get
                access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader
        user={user}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onCompanyChange={handleCompanyChange}
        onLogout={logout}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Trial Status */}
        {subscriptionId && (
          <div className="mb-6">
            <TrialStatus
              subscriptionId={subscriptionId}
              onUpgradeClick={() => navigate('/customer/subscription')}
            />
          </div>
        )}

        {/* Usage Warnings */}
        {dashboardWarnings && dashboardWarnings.warnings.length > 0 && (
          <div className="mb-6 space-y-4">
            {dashboardWarnings.warnings.map((warning, index) => (
              <UsageWarning
                key={`${warning.limitType}-${warning.warningType}-${index}`}
                warning={{
                  message: `${warning.warningType === 'at_limit' ? 'You have reached' : 'You are approaching'} your ${warning.limitType} ticket limit (${warning.percentage}% used) on your ${warning.planName} plan.`,
                  severity:
                    warning.warningType === 'at_limit'
                      ? 'error'
                      : warning.warningType === 'approaching_90'
                        ? 'warning'
                        : 'info',
                  showUpgradePrompt: warning.percentage >= 90,
                  upgradeOptions: dashboardWarnings.shouldShowUpgradePrompt
                    ? ['Starter', 'Professional', 'Business', 'Enterprise']
                    : undefined,
                }}
                showDismiss={false}
              />
            ))}
            {dashboardWarnings.shouldShowUpgradePrompt && dashboardWarnings.upgradeMessage && (
              <UsageWarning
                warning={{
                  message: dashboardWarnings.upgradeMessage,
                  severity: 'warning',
                  showUpgradePrompt: true,
                }}
                showDismiss={false}
              />
            )}
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <CustomerTicketList
                tickets={tickets}
                loading={loading}
                error={error}
                onRefresh={loadTickets}
                selectedCompanyId={selectedCompanyId}
              />
            }
          />
          <Route
            path="/create"
            element={
              <CreateTicketForm
                companyId={selectedCompanyId}
                onTicketCreated={handleTicketCreated}
              />
            }
          />
          <Route
            path="/ticket/:ticketId"
            element={<CustomerTicketDetail onTicketUpdated={handleTicketUpdated} />}
          />
          <Route path="/subscription" element={<SubscriptionManagement />} />
        </Routes>
      </div>
    </div>
  );
};

export default CustomerDashboard;
