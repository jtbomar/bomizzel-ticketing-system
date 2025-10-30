/**
 * Browser notification utilities for the Bomizzel ticketing system
 */

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

class BrowserNotificationService {
  private permission: NotificationPermission = 'default';

  constructor() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request notification permission from the user
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Show a browser notification
   */
  show(options: BrowserNotificationOptions): Notification | null {
    if (!this.canShow()) {
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
      });

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  /**
   * Check if notifications can be shown
   */
  canShow(): boolean {
    return 'Notification' in window && this.permission === 'granted';
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Show notification for high-priority ticket events
   */
  showTicketNotification(type: string, ticketTitle: string, message: string): Notification | null {
    const isHighPriority = [
      'ticket:assigned',
      'user:ticket_assigned',
    ].includes(type);

    if (!isHighPriority) {
      return null;
    }

    return this.show({
      title: 'Bomizzel - New Assignment',
      body: `${ticketTitle}: ${message}`,
      tag: `ticket-${type}`,
      requireInteraction: true,
    });
  }

  /**
   * Show notification for urgent status changes
   */
  showUrgentNotification(title: string, message: string, tag?: string): Notification | null {
    return this.show({
      title: `Bomizzel - ${title}`,
      body: message,
      tag: tag || 'urgent',
      requireInteraction: true,
    });
  }
}

export const browserNotificationService = new BrowserNotificationService();
export default browserNotificationService;