import { useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

export interface UseRealTimeQueueOptions {
  queueId?: string;
  teamId?: string;
  onTicketCreated?: (ticket: any) => void;
  onTicketUpdated?: (ticket: any) => void;
  onTicketAssigned?: (ticket: any) => void;
  onTicketStatusChanged?: (ticket: any) => void;
  onTicketPriorityChanged?: (ticket: any) => void;
  onQueueMetricsUpdated?: (metrics: any) => void;
}

export const useRealTimeQueue = (options: UseRealTimeQueueOptions) => {
  const { socket, isConnected } = useSocket();
  const {
    queueId,
    teamId,
    onTicketCreated,
    onTicketUpdated,
    onTicketAssigned,
    onTicketStatusChanged,
    onTicketPriorityChanged,
    onQueueMetricsUpdated,
  } = options;

  // Handle real-time notifications
  const handleNotification = useCallback(
    (notification: any) => {
      const { type, data } = notification;

      switch (type) {
        case 'ticket:created':
          if (onTicketCreated && (!queueId || data.ticket.queueId === queueId)) {
            onTicketCreated(data.ticket);
          }
          break;

        case 'ticket:updated':
          if (onTicketUpdated && (!queueId || data.ticket.queueId === queueId)) {
            onTicketUpdated(data.ticket);
          }
          break;

        case 'ticket:assigned':
          if (onTicketAssigned && (!queueId || data.ticket.queueId === queueId)) {
            onTicketAssigned(data.ticket);
          }
          break;

        case 'ticket:status_changed':
          if (onTicketStatusChanged && (!queueId || data.ticket.queueId === queueId)) {
            onTicketStatusChanged(data.ticket);
          }
          break;

        case 'ticket:priority_changed':
          if (onTicketPriorityChanged && (!queueId || data.ticket.queueId === queueId)) {
            onTicketPriorityChanged(data.ticket);
          }
          break;

        case 'queue:metrics_updated':
          if (onQueueMetricsUpdated && (!queueId || data.queue.id === queueId)) {
            onQueueMetricsUpdated(data.metrics);
          }
          break;

        default:
          break;
      }
    },
    [
      queueId,
      onTicketCreated,
      onTicketUpdated,
      onTicketAssigned,
      onTicketStatusChanged,
      onTicketPriorityChanged,
      onQueueMetricsUpdated,
    ]
  );

  // Subscribe to socket events
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, isConnected, handleNotification]);

  // Join/leave rooms based on queue and team
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join queue room if queueId is provided
    if (queueId) {
      socket.emit('join_queue', queueId);
    }

    // Join team room if teamId is provided
    if (teamId) {
      socket.emit('join_team', teamId);
    }

    return () => {
      // Leave rooms on cleanup
      if (queueId) {
        socket.emit('leave_queue', queueId);
      }
      if (teamId) {
        socket.emit('leave_team', teamId);
      }
    };
  }, [socket, isConnected, queueId, teamId]);

  return {
    isConnected,
  };
};
