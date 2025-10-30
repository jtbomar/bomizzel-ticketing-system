import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { browserNotificationService } from '../utils/browserNotifications';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface RealTimeNotification {
  type: string;
  data: any;
  userId?: string;
  teamId?: string;
  queueId?: string;
  timestamp: Date;
}

export const useNotifications = () => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Convert real-time notification to display notification
  const convertToDisplayNotification = useCallback((rtNotification: RealTimeNotification): Notification => {
    const id = `${Date.now()}-${Math.random()}`;
    let title = '';
    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'medium';

    switch (rtNotification.type) {
      case 'ticket:created':
        title = 'New Ticket Created';
        message = `Ticket "${rtNotification.data.ticket.title}" has been created`;
        priority = 'medium';
        break;
      
      case 'ticket:assigned':
        title = 'Ticket Assigned';
        if (rtNotification.data.ticket.assignedToId === user?.id) {
          message = `You have been assigned ticket "${rtNotification.data.ticket.title}"`;
          priority = 'high';
        } else {
          message = `Ticket "${rtNotification.data.ticket.title}" has been assigned`;
          priority = 'low';
        }
        break;
      
      case 'ticket:status_changed':
        title = 'Ticket Status Updated';
        message = `Ticket "${rtNotification.data.ticket.title}" status changed to ${rtNotification.data.changes?.status?.new}`;
        priority = 'medium';
        break;
      
      case 'ticket:priority_changed':
        title = 'Ticket Priority Updated';
        message = `Ticket "${rtNotification.data.ticket.title}" priority changed to ${rtNotification.data.changes?.priority?.new}`;
        priority = 'medium';
        break;
      
      case 'ticket:updated':
        title = 'Ticket Updated';
        message = `Ticket "${rtNotification.data.ticket.title}" has been updated`;
        priority = 'low';
        break;
      
      case 'queue:metrics_updated':
        title = 'Queue Metrics Updated';
        message = `Metrics for queue "${rtNotification.data.queue.name}" have been updated`;
        priority = 'low';
        break;
      
      case 'user:ticket_assigned':
        title = 'New Assignment';
        message = `You have been assigned ticket "${rtNotification.data.ticket?.title}"`;
        priority = 'high';
        break;
      
      default:
        title = 'System Notification';
        message = 'You have a new notification';
        priority = 'low';
    }

    return {
      id,
      type: rtNotification.type,
      title,
      message,
      data: rtNotification.data,
      timestamp: new Date(rtNotification.timestamp),
      read: false,
      priority,
    };
  }, [user?.id]);

  // Show browser notification
  const showBrowserNotification = useCallback((notification: Notification) => {
    // Show browser notification for high priority items
    if (notification.priority === 'high') {
      browserNotificationService.showTicketNotification(
        notification.type,
        notification.data?.ticket?.title || 'Ticket',
        notification.message
      );
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    return await browserNotificationService.requestPermission();
  }, []);

  // Add notification
  const addNotification = useCallback((rtNotification: RealTimeNotification) => {
    const notification = convertToDisplayNotification(rtNotification);
    
    setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep max 50 notifications
    setUnreadCount(prev => prev + 1);

    // Show browser notification for high priority items
    if (notification.priority === 'high') {
      showBrowserNotification(notification);
    }
  }, [convertToDisplayNotification, showBrowserNotification]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Remove specific notification
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    // Authenticate with the server
    const token = localStorage.getItem('token');
    if (token) {
      socket.emit('authenticate', { userId: user.id, token });
    }

    // Listen for notifications
    const handleNotification = (rtNotification: RealTimeNotification) => {
      console.log('Received real-time notification:', rtNotification);
      addNotification(rtNotification);
    };

    socket.on('notification', handleNotification);

    // Handle authentication response
    const handleAuthenticated = (response: { success: boolean; error?: string }) => {
      if (response.success) {
        console.log('Socket authenticated successfully');
      } else {
        console.error('Socket authentication failed:', response.error);
      }
    };

    socket.on('authenticated', handleAuthenticated);

    return () => {
      socket.off('notification', handleNotification);
      socket.off('authenticated', handleAuthenticated);
    };
  }, [socket, isConnected, user, addNotification]);

  // Join team and queue rooms when user data is available
  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    // Join user's teams (if employee)
    if (user.role === 'employee' || user.role === 'team_lead' || user.role === 'admin') {
      // TODO: Get user's teams and join those rooms
      // This would require an API call to get user's team memberships
    }
  }, [socket, isConnected, user]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
    requestNotificationPermission,
    isConnected,
  };
};