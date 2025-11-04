import { Router } from 'express';
import { UsageAlertService } from '@/services/UsageAlertService';
import { UsageTrackingService } from '@/services/UsageTrackingService';
import { authenticate } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * Get current usage warnings for the authenticated user
 */
router.get('/warnings', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const warnings = await UsageAlertService.checkUserUsage(userId);

    res.json({
      success: true,
      data: {
        warnings,
        count: warnings.length,
      },
    });
  } catch (error) {
    logger.error('Error getting usage warnings', { userId: req.user?.id, error });
    next(error);
  }
});

/**
 * Get dashboard warnings with upgrade prompts
 */
router.get('/dashboard-warnings', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const dashboardWarnings = await UsageAlertService.getUserDashboardWarnings(userId);

    res.json({
      success: true,
      data: dashboardWarnings,
    });
  } catch (error) {
    logger.error('Error getting dashboard warnings', { userId: req.user?.id, error });
    next(error);
  }
});

/**
 * Get ticket creation warning
 */
router.get('/ticket-creation-warning', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const creationWarning = await UsageAlertService.getTicketCreationWarning(userId);

    res.json({
      success: true,
      data: creationWarning,
    });
  } catch (error) {
    logger.error('Error getting ticket creation warning', { userId: req.user?.id, error });
    next(error);
  }
});

/**
 * Get current usage statistics
 */
router.get('/usage-stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const usage = await UsageTrackingService.getCurrentUsage(userId);
    const limitStatus = await UsageTrackingService.checkLimitStatus(userId);
    const percentages = await UsageTrackingService.getUsagePercentages(userId);

    res.json({
      success: true,
      data: {
        usage,
        limitStatus,
        percentages,
      },
    });
  } catch (error) {
    logger.error('Error getting usage statistics', { userId: req.user?.id, error });
    next(error);
  }
});

/**
 * Check if user can create a ticket
 */
router.get('/can-create-ticket', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const canCreate = await UsageTrackingService.canCreateTicket(userId);

    res.json({
      success: true,
      data: canCreate,
    });
  } catch (error) {
    logger.error('Error checking if user can create ticket', { userId: req.user?.id, error });
    next(error);
  }
});

/**
 * Check if user can complete a ticket
 */
router.get('/can-complete-ticket', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const canComplete = await UsageTrackingService.canCompleteTicket(userId);

    res.json({
      success: true,
      data: canComplete,
    });
  } catch (error) {
    logger.error('Error checking if user can complete ticket', { userId: req.user?.id, error });
    next(error);
  }
});

/**
 * Trigger manual usage check (admin only)
 */
router.post('/check-all-users', authenticate, async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'team_lead') {
      throw new AppError('Insufficient permissions', 403);
    }

    // Run usage check in background
    UsageAlertService.checkAllUsersUsage().catch((error) => {
      logger.error('Background usage check failed', { error });
    });

    res.json({
      success: true,
      message: 'Usage check initiated for all users',
    });
  } catch (error) {
    logger.error('Error initiating usage check', { userId: req.user?.id, error });
    next(error);
  }
});

export default router;
