import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { getPerformanceMetrics } from '@/middleware/performanceMonitoring';
import { CacheService, CacheConfigs } from '@/utils/cache';
import { enhancedLogger } from '@/utils/logger';

const router = Router();

// Apply authentication and admin authorization to all monitoring routes
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get performance metrics
 * GET /monitoring/performance
 */
router.get('/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await getPerformanceMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get system health status
 * GET /monitoring/health
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      cpu: {
        user: Math.round((cpuUsage.user / 1000000) * 100) / 100,
        system: Math.round((cpuUsage.system / 1000000) * 100) / 100,
      },
    };

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get cache statistics
 * GET /monitoring/cache
 */
router.get('/cache', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This would require Redis INFO command implementation
    // For now, return basic cache status
    const cacheStatus = {
      status: 'connected',
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: cacheStatus,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear cache by pattern
 * DELETE /monitoring/cache/:pattern
 */
router.delete('/cache/:pattern', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pattern } = req.params;

    if (!pattern || pattern.length < 3) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PATTERN',
          message: 'Pattern must be at least 3 characters long',
        },
      });
    }

    const deletedCount = await CacheService.delPattern(pattern);

    enhancedLogger.security('Cache cleared by admin', {
      pattern,
      deletedCount,
      adminId: req.user?.id,
      ip: req.ip,
    });

    res.json({
      success: true,
      data: {
        pattern,
        deletedCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get security logs (last 100 entries)
 * GET /monitoring/security-logs
 */
router.get('/security-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real implementation, you would read from log files or a logging service
    // For now, return a placeholder response
    const logs = {
      message: 'Security logs would be retrieved from log files or logging service',
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
