import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useTickets, useQueues } from '../hooks/useTickets';
import { useRealTimeQueue } from '../hooks/useRealTimeQueue';
import { useRealTimeMetrics } from '../hooks/useRealTimeMetrics';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import { Ticket, Queue, TicketStatus, Team } from '../types';
import { apiService } from '../services/api';
import KanbanBoard from '../components/KanbanBoard';
import TicketListView from '../components/TicketListView';
import DashboardMetrics from '../components/DashboardMetrics';
import CustomFieldConfig from '../components/CustomFieldConfig';
import ProfileManagement from '../components/ProfileManagement';
import TicketDetailModal from '../components/TicketDetailModal';
import NotificationCenter from '../components/NotificationCenter';
import BulkOperations from '../components/BulkOperations';
import TicketHistory from '../components/TicketHistory';
import AdvancedSearch from '../components/AdvancedSearch';

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { preferences, updateDashboardView } = useUserPreferences();
  const { queues, loading: queuesLoading } = useQueues();
  
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);
  
  // Real-time connections
  useRealTimeQueue({
    queueId: selectedQueue?.id,
    teamId: selectedQueue?.teamId,
  });
  useRealTimeNotifications();
  
  const [currentView, setCurrentView] = useState<'kanban' | 'list'>('kanban');
  const [showMetrics, setShowMetrics] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [ticketStatuses, setTicketStatuses] = useState<TicketStatus[]>([]);
  // Real-time metrics for all queues
  const { metrics: allMetrics } = useRealTimeMetrics(queues.map(q => q.id));
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showTicketHistory, setShowTicketHistory] = useState(false);
  const [historyTicketId, setHistoryTicketId] = useState<string | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Ticket[] | null>(null);

  const {
    tickets,
    loading: ticketsLoading,
    updateTicketStatus,
    updateTicketPriority,
    reload: reloadTickets,
  } = useTickets({
    queueId: selectedQueue?.id,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // Set initial view from preferences
  useEffect(() => {
    if (preferences.dashboard?.defaultView) {
      setCurrentView(preferences.dashboard.defaultView);
    }
  }, [preferences]);

  // Set default queue when queues load
  useEffect(() => {
    if (queues.length > 0 && !selectedQueue) {
      // Find user's personal queue or first available queue
      const personalQueue = queues.find(q => q.assignedToId === user?.id);
      setSelectedQueue(personalQueue || queues[0]);
    }
  }, [queues, selectedQueue, user]);

  // Load team statuses when queue changes
  useEffect(() => {
    if (selectedQueue?.teamId) {
      loadTeamStatuses(selectedQueue.teamId);
    }
  }, [selectedQueue]);

  const loadTeamStatuses = async (teamId: string) => {
    try {
      const response = await apiService.getTeamStatuses(teamId);
      setTicketStatuses(response.data || response);
    } catch (err) {
      console.error('Error loading team statuses:', err);
      // Fallback to default statuses
      setTicketStatuses([
        { id: '1', teamId, name: 'open', label: 'Open', color: '#3B82F6', order: 1, isDefault: true, isClosed: false, isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', teamId, name: 'in_progress', label: 'In Progress', color: '#F59E0B', order: 2, isDefault: false, isClosed: false, isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: '3', teamId, name: 'resolved', label: 'Resolved', color: '#10B981', order: 3, isDefault: false, isClosed: true, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ]);
    }
  };

  const handleViewChange = async (view: 'kanban' | 'list') => {
    setCurrentView(view);
    await updateDashboardView(view);
  };

  const handleTicketMove = async (ticketId: string, newStatus: string, newPriority: number) => {
    try {
      // Find the current ticket to check what needs updating
      const currentTicket = tickets.find(t => t.id === ticketId);
      if (!currentTicket) return;

      // Only update status if it changed
      if (currentTicket.status !== newStatus) {
        await updateTicketStatus(ticketId, newStatus);
      }
      
      // Only update priority if it changed
      if (currentTicket.priority !== newPriority) {
        await updateTicketPriority(ticketId, newPriority);
      }
    } catch (err) {
      console.error('Error moving ticket:', err);
      // Reload tickets to revert optimistic update
      reloadTickets();
    }
  };

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const handleTicketSelect = (ticketId: string, selected: boolean) => {
    if (selected) {
      setSelectedTickets(prev => [...prev, ticketId]);
    } else {
      setSelectedTickets(prev => prev.filter(id => id !== ticketId));
    }
  };

  const handleSelectAll = (tickets: Ticket[]) => {
    const allSelected = tickets.every(t => selectedTickets.includes(t.id));
    if (allSelected) {
      setSelectedTickets(prev => prev.filter(id => !tickets.some(t => t.id === id)));
    } else {
      const newSelections = tickets.map(t => t.id).filter(id => !selectedTickets.includes(id));
      setSelectedTickets(prev => [...prev, ...newSelections]);
    }
  };

  const handleShowHistory = (ticketId: string) => {
    setHistoryTicketId(ticketId);
    setShowTicketHistory(true);
  };

  const handleSearchResults = (results: any) => {
    setSearchResults(results.data || []);
    setShowAdvancedSearch(false);
  };

  const clearSearch = () => {
    setSearchResults(null);
  };

  const isTeamLead = user?.role === 'team_lead' || user?.role === 'admin';

  if (queuesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Employee Dashboard</h1>
              {user && (
                <span className="ml-4 text-sm text-gray-500">
                  Welcome back, {user.firstName}!
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewChange('kanban')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => handleViewChange('list')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  List
                </button>
              </div>

              {/* Metrics Toggle */}
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  showMetrics
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {showMetrics ? 'Hide Metrics' : 'Show Metrics'}
              </button>

              {/* Custom Fields (Team Leads only) */}
              {isTeamLead && selectedQueue && (
                <button
                  onClick={() => {
                    setSelectedTeam({ id: selectedQueue.teamId } as Team);
                    setShowCustomFields(true);
                  }}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Configure Fields
                </button>
              )}

              {/* Advanced Search */}
              <button
                onClick={() => setShowAdvancedSearch(true)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Advanced Search
              </button>

              {/* Bulk Operations */}
              {selectedTickets.length > 0 && (
                <button
                  onClick={() => setShowBulkOperations(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Bulk Actions ({selectedTickets.length})
                </button>
              )}

              {/* Notification Center */}
              <NotificationCenter />

              {/* Profile Button */}
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Queue Selector */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Queue:</label>
            <select
              value={selectedQueue?.id || ''}
              onChange={(e) => {
                const queue = queues.find(q => q.id === e.target.value);
                setSelectedQueue(queue || null);
              }}
              className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name} ({queue.ticketCount || 0} tickets)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics Dashboard */}
        {showMetrics && (
          <div className="mb-8">
            <DashboardMetrics metrics={allMetrics} />
          </div>
        )}

        {/* Search Results */}
        {searchResults && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Search Results ({searchResults.length} tickets)
              </h3>
              <button
                onClick={clearSearch}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Search
              </button>
            </div>
            <TicketListView
              tickets={searchResults}
              onTicketClick={handleTicketClick}
              loading={false}
              selectedTickets={selectedTickets}
              onTicketSelect={handleTicketSelect}
              onSelectAll={handleSelectAll}
              onShowHistory={handleShowHistory}
            />
          </div>
        )}

        {/* Main Content */}
        {!searchResults && (
          <>
            {selectedQueue ? (
              <div className="space-y-6">
                {currentView === 'kanban' ? (
                  <KanbanBoard
                    tickets={tickets}
                    statuses={ticketStatuses}
                    onTicketMove={handleTicketMove}
                    onTicketClick={handleTicketClick}
                    loading={ticketsLoading}
                  />
                ) : (
                  <TicketListView
                    tickets={tickets}
                    onTicketClick={handleTicketClick}
                    loading={ticketsLoading}
                    selectedTickets={selectedTickets}
                    onTicketSelect={handleTicketSelect}
                    onSelectAll={handleSelectAll}
                    onShowHistory={handleShowHistory}
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No queues available</h3>
                <p className="text-gray-500">Contact your administrator to set up queues.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom Field Configuration Modal */}
      {showCustomFields && selectedTeam && (
        <CustomFieldConfig
          teamId={selectedTeam.id}
          onClose={() => {
            setShowCustomFields(false);
            setSelectedTeam(null);
          }}
        />
      )}

      {/* Profile Management Modal */}
      {showProfile && (
        <ProfileManagement
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Bulk Operations Modal */}
      {showBulkOperations && selectedTickets.length > 0 && (
        <BulkOperations
          selectedTickets={tickets.filter(t => selectedTickets.includes(t.id))}
          onOperationComplete={() => {
            setSelectedTickets([]);
            reloadTickets();
          }}
          onClose={() => setShowBulkOperations(false)}
          availableQueues={queues}
        />
      )}

      {/* Ticket History Modal */}
      {showTicketHistory && historyTicketId && (
        <TicketHistory
          ticketId={historyTicketId}
          onClose={() => {
            setShowTicketHistory(false);
            setHistoryTicketId(null);
          }}
        />
      )}

      {/* Advanced Search Modal */}
      {showAdvancedSearch && selectedQueue && (
        <AdvancedSearch
          teamId={selectedQueue.teamId}
          onSearch={handleSearchResults}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={() => {
            // Update the ticket in the list
            reloadTickets();
          }}
        />
      )}
    </div>
  );
};

export default EmployeeDashboard;