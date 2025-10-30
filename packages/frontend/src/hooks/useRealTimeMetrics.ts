import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { QueueMetrics } from '../types';
import { apiService } from '../services/api';

export const useRealTimeMetrics = (queueIds: string[] = []) => {
  const { socket, isConnected } = useSocket();
  const [metrics, setMetrics] = useState<QueueMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (queueIds.length === 0) {
      setMetrics([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const metricsPromises = queueIds.map(queueId => 
        apiService.getQueueMetrics(queueId).catch(() => null)
      );
      
      const results = await Promise.all(metricsPromises);
      const validMetrics = results.filter(Boolean) as QueueMetrics[];
      
      setMetrics(validMetrics);
    } catch (err) {
      setError('Failed to load metrics');
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [queueIds]);

  // Initial load
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Listen for real-time metrics updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMetricsUpdate = (notification: any) => {
      if (notification.type === 'queue:metrics_updated') {
        const { queue, metrics: updatedMetrics } = notification.data;
        
        // Update metrics for the specific queue
        setMetrics(prev => {
          const existingIndex = prev.findIndex(m => m.queueId === queue.id);
          
          if (existingIndex >= 0) {
            // Update existing metrics
            const newMetrics = [...prev];
            newMetrics[existingIndex] = updatedMetrics;
            return newMetrics;
          } else if (queueIds.includes(queue.id)) {
            // Add new metrics if queue is in our watch list
            return [...prev, updatedMetrics];
          }
          
          return prev;
        });
      }
    };

    socket.on('notification', handleMetricsUpdate);

    return () => {
      socket.off('notification', handleMetricsUpdate);
    };
  }, [socket, isConnected, queueIds]);

  // Join queue rooms for metrics updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    queueIds.forEach(queueId => {
      socket.emit('join_queue', queueId);
    });

    return () => {
      queueIds.forEach(queueId => {
        socket.emit('leave_queue', queueId);
      });
    };
  }, [socket, isConnected, queueIds]);

  return {
    metrics,
    loading,
    error,
    reload: loadMetrics,
  };
};