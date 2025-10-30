import { useState, useEffect, useCallback } from 'react';
import { Ticket, Queue, QueueMetrics, PaginatedResponse } from '../types';
import { apiService } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

interface UseTicketsOptions {
  queueId?: string;
  status?: string;
  page?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useTickets = (options: UseTicketsOptions = {}) => {
  const { socket, isConnected } = useSocket();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const {
    queueId,
    status,
    page = 1,
    limit = 20,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response: PaginatedResponse<Ticket>;

      if (queueId) {
        response = await apiService.getQueueTickets(queueId, {
          status,
          page,
          limit,
        });
      } else {
        response = await apiService.getTickets({
          status,
          page,
          limit,
        });
      }

      setTickets(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError('Failed to load tickets');
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [queueId, status, page, limit]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadTickets, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, loadTickets]);

  // Listen for real-time ticket updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleTicketNotification = (notification: any) => {
      const { type, data } = notification;
      
      switch (type) {
        case 'ticket:created':
          // Add new ticket if it belongs to current queue
          if (!queueId || data.ticket.queueId === queueId) {
            setTickets(prev => [data.ticket, ...prev]);
          }
          break;
          
        case 'ticket:updated':
        case 'ticket:assigned':
        case 'ticket:status_changed':
        case 'ticket:priority_changed':
          // Update existing ticket
          setTickets(prev => 
            prev.map(ticket => 
              ticket.id === data.ticket.id ? data.ticket : ticket
            )
          );
          break;
          
        default:
          break;
      }
    };

    socket.on('notification', handleTicketNotification);

    return () => {
      socket.off('notification', handleTicketNotification);
    };
  }, [socket, isConnected, queueId]);

  const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      const updatedTicket = await apiService.updateTicket(ticketId, updates);
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? { ...ticket, ...updatedTicket } : ticket
        )
      );
      return updatedTicket;
    } catch (err) {
      console.error('Error updating ticket:', err);
      throw err;
    }
  };

  const assignTicket = async (ticketId: string, assignedToId: string) => {
    try {
      const updatedTicket = await apiService.assignTicket(ticketId, assignedToId);
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? { ...ticket, ...updatedTicket } : ticket
        )
      );
      return updatedTicket;
    } catch (err) {
      console.error('Error assigning ticket:', err);
      throw err;
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const updatedTicket = await apiService.updateTicketStatus(ticketId, newStatus);
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? { ...ticket, ...updatedTicket } : ticket
        )
      );
      return updatedTicket;
    } catch (err) {
      console.error('Error updating ticket status:', err);
      throw err;
    }
  };

  const updateTicketPriority = async (ticketId: string, priority: number) => {
    try {
      const updatedTicket = await apiService.updateTicketPriority(ticketId, priority);
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? { ...ticket, ...updatedTicket } : ticket
        )
      );
      return updatedTicket;
    } catch (err) {
      console.error('Error updating ticket priority:', err);
      throw err;
    }
  };

  return {
    tickets,
    loading,
    error,
    pagination,
    reload: loadTickets,
    updateTicket,
    assignTicket,
    updateTicketStatus,
    updateTicketPriority,
  };
};

export const useQueues = () => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getQueues();
      setQueues(response.data || response);
    } catch (err) {
      setError('Failed to load queues');
      console.error('Error loading queues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  return {
    queues,
    loading,
    error,
    reload: loadQueues,
  };
};

export const useQueueMetrics = (queueId: string) => {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!queueId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getQueueMetrics(queueId);
      setMetrics(response);
    } catch (err) {
      setError('Failed to load queue metrics');
      console.error('Error loading queue metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    metrics,
    loading,
    error,
    reload: loadMetrics,
  };
};