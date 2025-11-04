import React, { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import ToastNotification, { Toast } from './ToastNotification';

const ToastContainer: React.FC = () => {
  const { notifications } = useNotifications();
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Convert notifications to toasts for high-priority items
  useEffect(() => {
    const newNotifications = notifications.filter(
      (n) => n.priority === 'high' && !toasts.some((t) => t.id === n.id)
    );

    newNotifications.forEach((notification) => {
      const toast: Toast = {
        id: notification.id,
        type: getToastType(notification.type),
        title: notification.title,
        message: notification.message,
        duration: 5000,
      };

      setToasts((prev) => [...prev, toast]);
    });
  }, [notifications, toasts]);

  const getToastType = (notificationType: string): Toast['type'] => {
    switch (notificationType) {
      case 'ticket:assigned':
      case 'user:ticket_assigned':
        return 'success';
      case 'ticket:created':
        return 'info';
      case 'ticket:status_changed':
        return 'warning';
      default:
        return 'info';
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;
