import { Request, Response, NextFunction } from 'express';
import { enhancedLogger } from '@/utils/logger';
import { CacheService, CacheConfigs } from '@/utils/cache';

interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  userAgent?: string;
  userId?: string;
  ip: string;
  timestamp: string;
}

interface SlowQueryAlert {
  query: string;
  duration: number;
  timestamp: string;
  userId?: string;
  requestId?: string;
}

/**
 * Performance monitoring middleware
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage();

    const metrics: PerformanceMetrics = {
      requestId: req.id || 'unknown',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
      },
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    };

    // Log performance metrics
    enhancedLogger.performance('Request completed', metrics);

    // Alert on slow requests (> 2 seconds)
    if (responseTime > 2000) {
      enhancedLogger.warn('Slow request detected', {
        ...metrics,
        category: 'performance_alert',
      });
    }

    // Alert on high memory usage (> 100MB increase)
    if (metrics.memoryUsage.heapUsed > 100 * 1024 * 1024) {
      enhancedLogger.warn('High memory usage detected', {
        ...metrics,
        category: 'memory_alert',
      });
    }

    // Store metrics in cache for monitoring dashboard
    storeMetricsInCache(metrics);

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Store performance metrics in cache for real-time monitoring
 */
async function storeMetricsInCache(metrics: PerformanceMetrics): Promise<void> {
  try {
    const timestamp = Math.floor(Date.now() / 60000); // Round to minute
    const key = `performance:${timestamp}`;

    // Get existing metrics for this minute
    const existing = (await CacheService.get<PerformanceMetrics[]>(key, CacheConfigs.SHORT)) || [];
    existing.push(metrics);

    // Keep only last 100 requests per minute
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }

    await CacheService.set(key, existing, { ttl: 300 }); // 5 minutes
  } catch (error) {
    enhancedLogger.error('Failed to store performance metrics in cache:', error);
  }
}

/**
 * Database query performance monitoring
 */
export class QueryPerformanceMonitor {
  private static slowQueryThreshold = 1000; // 1 second

  static async monitorQuery<T>(
    queryName: string,
    queryFunction: () => Promise<T>,
    context?: { userId?: string; requestId?: string }
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await queryFunction();
      const duration = Date.now() - startTime;

      // Log query performance
      enhancedLogger.database('Database query executed', {
        queryName,
        duration,
        ...context,
      });

      // Alert on slow queries
      if (duration > this.slowQueryThreshold) {
        const alert: SlowQueryAlert = {
          query: queryName,
          duration,
          timestamp: new Date().toISOString(),
          ...context,
        };

        enhancedLogger.warn('Slow database query detected', {
          ...alert,
          category: 'slow_query_alert',
        });

        // Store slow query alert in cache
        await this.storeSlowQueryAlert(alert);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      enhancedLogger.error('Database query failed', {
        queryName,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context,
      });

      throw error;
    }
  }

  private static async storeSlowQueryAlert(alert: SlowQueryAlert): Promise<void> {
    try {
      const key = 'slow_queries';
      const existing = (await CacheService.get<SlowQueryAlert[]>(key, CacheConfigs.MEDIUM)) || [];
      existing.push(alert);

      // Keep only last 50 slow queries
      if (existing.length > 50) {
        existing.splice(0, existing.length - 50);
      }

      await CacheService.set(key, existing, CacheConfigs.MEDIUM);
    } catch (error) {
      enhancedLogger.error('Failed to store slow query alert:', error);
    }
  }
}

/**
 * Memory usage monitoring
 */
export const memoryMonitoring = (): void => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    enhancedLogger.performance('Memory usage', {
      memoryUsage: memUsageMB,
      category: 'memory_monitoring',
    });

    // Alert on high memory usage
    if (memUsageMB.heapUsed > 500) {
      // 500MB
      enhancedLogger.warn('High memory usage alert', {
        memoryUsage: memUsageMB,
        category: 'memory_alert',
      });
    }
  }, 60000); // Check every minute
};

/**
 * CPU usage monitoring
 */
export const cpuMonitoring = (): void => {
  let lastCpuUsage = process.cpuUsage();

  setInterval(() => {
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);
    const cpuPercent = {
      user: Math.round((currentCpuUsage.user / 1000000) * 100) / 100, // Convert to seconds
      system: Math.round((currentCpuUsage.system / 1000000) * 100) / 100,
    };

    enhancedLogger.performance('CPU usage', {
      cpuUsage: cpuPercent,
      category: 'cpu_monitoring',
    });

    lastCpuUsage = process.cpuUsage();
  }, 60000); // Check every minute
};

/**
 * Get performance metrics from cache
 */
export const getPerformanceMetrics = async (): Promise<{
  recentRequests: PerformanceMetrics[];
  slowQueries: SlowQueryAlert[];
}> => {
  try {
    const currentMinute = Math.floor(Date.now() / 60000);
    const recentMinutes = Array.from({ length: 5 }, (_, i) => currentMinute - i);

    const recentRequests: PerformanceMetrics[] = [];
    for (const minute of recentMinutes) {
      const metrics =
        (await CacheService.get<PerformanceMetrics[]>(
          `performance:${minute}`,
          CacheConfigs.SHORT
        )) || [];
      recentRequests.push(...metrics);
    }

    const slowQueries =
      (await CacheService.get<SlowQueryAlert[]>('slow_queries', CacheConfigs.MEDIUM)) || [];

    return {
      recentRequests: recentRequests.slice(-100), // Last 100 requests
      slowQueries: slowQueries.slice(-20), // Last 20 slow queries
    };
  } catch (error) {
    enhancedLogger.error('Failed to get performance metrics:', error);
    return {
      recentRequests: [],
      slowQueries: [],
    };
  }
};
