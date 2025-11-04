import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { browserNotificationService } from '../utils/browserNotifications';

export const useRealTimeNotifications = () => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    // Authenticate with the server
    const token = localStorage.getItem('token');
    if (token) {
      socket.emit('authenticate', { userId: user.id, token });
    }

    const handleNotification = (notification: any) => {
      const { type, data } = notification;

      // Determine if this notification is relevant to the current user
      const isRelevant =
        notification.userId === user.id || // Direct user notification
        (user.role !== 'customer' && notification.teamId) || // Team notification for employees
        (user.role !== 'customer' && notification.queueId); // Queue notification for employees

      if (!isRelevant) return;

      // Show toast notification for relevant updates
      let toastType: 'success' | 'info' | 'warning' | 'error' = 'info';
      let title = '';
      let message = '';

      switch (type) {
        case 'ticket:created':
          toastType = 'info';
          title = 'New Ticket';
          message = `"${data.ticket.title}" has been created`;
          break;

        case 'ticket:assigned':
          if (data.ticket.assignedToId === user.id) {
            toastType = 'warning';
            title = 'Ticket Assigned';
            message = `You have been assigned "${data.ticket.title}"`;

            // Show browser notification for assignments
            browserNotificationService.showTicketNotification(type, data.ticket.title, message);
          } else {
            toastType = 'info';
            title = 'Ticket Assigned';
            message = `"${data.ticket.title}" has been assigned`;
          }
          break;

        case 'ticket:status_changed':
          toastType = 'success';
          title = 'Status Updated';
          message = `"${data.ticket.title}" is now ${data.changes?.status?.new}`;
          break;

        case 'ticket:priority_changed':
          toastType = 'warning';
          title = 'Priority Updated';
          message = `"${data.ticket.title}" priority changed to ${data.changes?.priority?.new}`;
          break;

        case 'ticket:updated':
          toastType = 'info';
          title = 'Ticket Updated';
          message = `"${data.ticket.title}" has been updated`;
          break;

        case 'queue:metrics_updated':
          // Don't show toast for metrics updates (too frequent)
          return;

        case 'user:ticket_assigned':
          toastType = 'warning';
          title = 'New Assignment';
          message = `You have been assigned "${data.ticket?.title}"`;

          // Show browser notification for direct assignments
          browserNotificationService.showUrgentNotification(
            title,
            message,
            `assignment-${data.ticket?.id}`
          );
          break;

        default:
          return; // Don't show toast for unknown notification types
      }

      // Show toast notification
      showToast({
        type: toastType,
        title,
        message,
        duration: 5000,
      });
    };

    const handleAuthenticated = (response: { success: boolean; error?: string }) => {
      if (response.success) {
        console.log('Real-time notifications authenticated');
      } else {
        console.error('Real-time authentication failed:', response.error);
        showToast({
          type: 'error',
          title: 'Connection Error',
          message: 'Failed to connect to real-time updates',
          duration: 5000,
        });
      }
    };

    socket.on('notification', handleNotification);
    socket.on('authenticated', handleAuthenticated);

    return () => {
      socket.off('notification', handleNotification);
      socket.off('authenticated', handleAuthenticated);
    };
  }, [socket, isConnected, user, showToast]);

  return {
    isConnected,
  };
};
