import { Router } from 'express';
import { SubscriptionService } from '@/services/SubscriptionService';
import { UsageTrackingService } from '@/services/UsageTrackingService';
import { TrialManagementService } from '@/services/TrialManagementService';
import { authenticate, authorize } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';
import { AppError } from '@/middleware/errorHandler';

const router = Router();

// Validation schemas for subscription endpoints
const subscriptionValidation = {
  createSubscription: {
    body: {
      planId: { type: 'string' as const, required: true, format: 'uuid' as const },
      startTrial: { type: 'boolean' as const, required: false },
      paymentMethodId: { type: 'string' as const, required: false },
      metadata: { type: 'object' as const, required: false },
    },
  },
  upgradeSubscription: {
    body: {
      newPlanId: { type: 'string' as const, required: true, format: 'uuid' as const },
      effectiveDate: { type: 'string' as const, required: false },
      prorate: { type: 'boolean' as const, required: false },
    },
  },
  updatePaymentMethod: {
    body: {
      paymentMethodId: { type: 'string' as const, required: true },
    },
  },
  uuidParam: {
    params: {
      subscriptionId: { type: 'string' as const, required: true, format: 'uuid' as const },
    },
  },
  startTrial: {
    body: {
      planSlug: { type: 'string' as const, required: true },
      trialDays: { type: 'number' as const, required: false, min: 1, max: 30 },
      sendWelcomeEmail: { type: 'boolean' as const, required: false },
      metadata: { type: 'object' as const, required: false },
    },
  },
  convertTrial: {
    body: {
      paymentMethodId: { type: 'string' as const, required: true },
      stripeCustomerId: { type: 'string' as const, required: false },
      stripeSubscriptionId: { type: 'string' as const, required: false },
      sendWelcomeEmail: { type: 'boolean' as const, required: false },
    },
  },
  cancelTrial: {
    body: {
      reason: { type: 'string' as const, required: false },
    },
  },
  extendTrial: {
    body: {
      additionalDays: { type: 'number' as const, required: true, min: 1, max: 30 },
      reason: { type: 'string' as const, required: false },
    },
  },
};

/**
 * GET /subscriptions/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await SubscriptionService.getAvailablePlans();
    res.json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /subscriptions/plans/:planId
 * Get specific subscription plan details
 */
router.get(
  '/plans/:planId',
  validateRequest({
    params: {
      planId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const { planId } = req.params;
      const plan = await SubscriptionService.getPlanById(planId);

      if (!plan) {
        throw new AppError('Subscription plan not found', 404, 'PLAN_NOT_FOUND');
      }

      res.json({
        success: true,
        data: { plan },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /subscriptions/current
 * Get current user's subscription details with usage statistics
 */
router.get('/current', authenticate, async (req, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const subscriptionDetails = await SubscriptionService.getUserSubscription(userId);

    if (!subscriptionDetails) {
      // Return default free tier information if no subscription exists
      const freePlans = await SubscriptionService.getAvailablePlans();
      const freePlan = freePlans.find((plan) => plan.slug === 'free-tier');

      res.json({
        success: true,
        data: {
          subscription: null,
          plan: freePlan || null,
          usage: {
            activeTickets: 0,
            completedTickets: 0,
            totalTickets: 0,
            archivedTickets: 0,
          },
          limitStatus: {
            isAtLimit: false,
            isNearLimit: false,
            percentageUsed: { active: 0, completed: 0, total: 0 },
            limits: freePlan?.limits || {
              activeTickets: 100,
              completedTickets: 100,
              totalTickets: 200,
            },
            current: { activeTickets: 0, completedTickets: 0, totalTickets: 0, archivedTickets: 0 },
          },
        },
      });
      return;
    }

    res.json({
      success: true,
      data: subscriptionDetails,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /subscriptions
 * Create a new subscription for the current user
 */
router.post(
  '/',
  authenticate,
  validateRequest(subscriptionValidation.createSubscription),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { planId, startTrial, paymentMethodId, metadata } = req.body;

      const subscription = await SubscriptionService.createSubscription(userId, planId, {
        startTrial,
        paymentMethodId,
        metadata,
      });

      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: { subscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /subscriptions/:subscriptionId/upgrade
 * Upgrade subscription to a new plan
 */
router.put(
  '/:subscriptionId/upgrade',
  authenticate,
  validateRequest(subscriptionValidation.uuidParam),
  validateRequest(subscriptionValidation.upgradeSubscription),
  async (req, res, next) => {
    try {
      const { subscriptionId } = req.params;
      const { newPlanId, effectiveDate, prorate } = req.body;

      // Verify subscription belongs to current user
      const currentSubscription = await SubscriptionService.getUserSubscription(req.user!.id);
      if (!currentSubscription || currentSubscription.subscription.id !== subscriptionId) {
        throw new AppError(
          'Subscription not found or access denied',
          404,
          'SUBSCRIPTION_NOT_FOUND'
        );
      }

      const upgradedSubscription = await SubscriptionService.upgradeSubscription(
        subscriptionId,
        newPlanId,
        {
          effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
          prorate,
        }
      );

      res.json({
        success: true,
        message: 'Subscription upgraded successfully',
        data: { subscription: upgradedSubscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /subscriptions/:subscriptionId/cancel
 * Cancel subscription
 */
router.post(
  '/:subscriptionId/cancel',
  authenticate,
  validateRequest(subscriptionValidation.uuidParam),
  validateRequest({
    body: {
      cancelAtPeriodEnd: { type: 'boolean', required: false },
    },
  }),
  async (req, res, next) => {
    try {
      const { subscriptionId } = req.params;
      const { cancelAtPeriodEnd = true } = req.body;

      // Verify subscription belongs to current user
      const currentSubscription = await SubscriptionService.getUserSubscription(req.user!.id);
      if (!currentSubscription || currentSubscription.subscription.id !== subscriptionId) {
        throw new AppError(
          'Subscription not found or access denied',
          404,
          'SUBSCRIPTION_NOT_FOUND'
        );
      }

      const cancelledSubscription = await SubscriptionService.cancelSubscription(
        subscriptionId,
        cancelAtPeriodEnd
      );

      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        data: { subscription: cancelledSubscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /subscriptions/:subscriptionId/payment-method
 * Update payment method for subscription
 */
router.put(
  '/:subscriptionId/payment-method',
  authenticate,
  validateRequest(subscriptionValidation.uuidParam),
  validateRequest(subscriptionValidation.updatePaymentMethod),
  async (req, res, next) => {
    try {
      const { subscriptionId } = req.params;
      const { paymentMethodId } = req.body;

      // Verify subscription belongs to current user
      const currentSubscription = await SubscriptionService.getUserSubscription(req.user!.id);
      if (!currentSubscription || currentSubscription.subscription.id !== subscriptionId) {
        throw new AppError(
          'Subscription not found or access denied',
          404,
          'SUBSCRIPTION_NOT_FOUND'
        );
      }

      const updatedSubscription = await SubscriptionService.updatePaymentMethod(
        subscriptionId,
        paymentMethodId
      );

      res.json({
        success: true,
        message: 'Payment method updated successfully',
        data: { subscription: updatedSubscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /subscriptions/usage
 * Get current usage statistics for the authenticated user
 */
router.get('/usage', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const usage = await UsageTrackingService.getCurrentUsage(userId);
    const limitStatus = await UsageTrackingService.checkLimitStatus(userId);

    res.json({
      success: true,
      data: {
        usage,
        limitStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /subscriptions/usage/history
 * Get usage history for the authenticated user
 */
router.get(
  '/usage/history',
  authenticate,
  validateRequest({
    query: {
      limit: { type: 'number', required: false, min: 1, max: 100 },
      period: { type: 'string', required: false },
    },
  }),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { limit = 50, period } = req.query as any;

      if (period) {
        // Get usage for specific period (YYYY-MM format)
        const usage = await UsageTrackingService.getUsageForPeriod(userId, period);
        res.json({
          success: true,
          data: { usage, period },
        });
      } else {
        // Get recent activity
        const activity = await UsageTrackingService.getRecentActivity(userId, limit);
        res.json({
          success: true,
          data: { activity },
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /subscriptions/usage/can-create-ticket
 * Check if user can create a new ticket
 */
router.get('/usage/can-create-ticket', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const result = await UsageTrackingService.canCreateTicket(userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /subscriptions/usage/can-complete-ticket
 * Check if user can complete a ticket
 */
router.get('/usage/can-complete-ticket', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const result = await UsageTrackingService.canCompleteTicket(userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /subscriptions/trial/start
 * Start a trial subscription
 */
router.post(
  '/trial/start',
  authenticate,
  validateRequest(subscriptionValidation.startTrial),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { planSlug, trialDays, sendWelcomeEmail = true, metadata } = req.body;

      const subscription = await TrialManagementService.startTrial(userId, planSlug, {
        trialDays,
        sendWelcomeEmail,
        metadata,
      });

      res.status(201).json({
        success: true,
        message: 'Trial subscription started successfully',
        data: { subscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /subscriptions/:subscriptionId/trial/convert
 * Convert trial to paid subscription
 */
router.post(
  '/:subscriptionId/trial/convert',
  authenticate,
  validateRequest(subscriptionValidation.uuidParam),
  validateRequest(subscriptionValidation.convertTrial),
  async (req, res, next) => {
    try {
      const { subscriptionId } = req.params;
      const {
        paymentMethodId,
        stripeCustomerId,
        stripeSubscriptionId,
        sendWelcomeEmail = true,
      } = req.body;

      // Verify subscription belongs to current user
      const currentSubscription = await SubscriptionService.getUserSubscription(req.user!.id);
      if (!currentSubscription || currentSubscription.subscription.id !== subscriptionId) {
        throw new AppError(
          'Subscription not found or access denied',
          404,
          'SUBSCRIPTION_NOT_FOUND'
        );
      }

      const convertedSubscription = await TrialManagementService.convertTrialToPaid(
        subscriptionId,
        {
          paymentMethodId,
          stripeCustomerId,
          stripeSubscriptionId,
          sendWelcomeEmail,
        }
      );

      res.json({
        success: true,
        message: 'Trial converted to paid subscription successfully',
        data: { subscription: convertedSubscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /subscriptions/:subscriptionId/trial/cancel
 * Cancel trial subscription
 */
router.post(
  '/:subscriptionId/trial/cancel',
  authenticate,
  validateRequest(subscriptionValidation.uuidParam),
  validateRequest(subscriptionValidation.cancelTrial),
  async (req, res, next) => {
    try {
      const { subscriptionId } = req.params;
      const { reason } = req.body;

      // Verify subscription belongs to current user
      const currentSubscription = await SubscriptionService.getUserSubscription(req.user!.id);
      if (!currentSubscription || currentSubscription.subscription.id !== subscriptionId) {
        throw new AppError(
          'Subscription not found or access denied',
          404,
          'SUBSCRIPTION_NOT_FOUND'
        );
      }

      const cancelledSubscription = await TrialManagementService.cancelTrial(
        subscriptionId,
        reason
      );

      res.json({
        success: true,
        message: 'Trial cancelled successfully',
        data: { subscription: cancelledSubscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /subscriptions/:subscriptionId/trial/status
 * Get trial status
 */
router.get(
  '/:subscriptionId/trial/status',
  authenticate,
  validateRequest(subscriptionValidation.uuidParam),
  async (req, res, next) => {
    try {
      const { subscriptionId } = req.params;

      // Verify subscription belongs to current user
      const currentSubscription = await SubscriptionService.getUserSubscription(req.user!.id);
      if (!currentSubscription || currentSubscription.subscription.id !== subscriptionId) {
        throw new AppError(
          'Subscription not found or access denied',
          404,
          'SUBSCRIPTION_NOT_FOUND'
        );
      }

      const trialStatus = await TrialManagementService.getTrialStatus(subscriptionId);

      res.json({
        success: true,
        data: { trialStatus },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /subscriptions/:subscriptionId/trial/extend
 * Extend trial period (Admin only)
 */
router.post(
  '/:subscriptionId/trial/extend',
  authenticate,
  authorize('admin'),
  validateRequest(subscriptionValidation.uuidParam),
  validateRequest(subscriptionValidation.extendTrial),
  async (req, res, next) => {
    try {
      const { subscriptionId } = req.params;
      const { additionalDays, reason } = req.body;

      const extendedSubscription = await TrialManagementService.extendTrial(
        subscriptionId,
        additionalDays,
        reason
      );

      res.json({
        success: true,
        message: 'Trial extended successfully',
        data: { subscription: extendedSubscription },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin-only routes
/**
 * GET /subscriptions/admin/stats
 * Get subscription statistics (Admin only)
 */
router.get('/admin/stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Get expired trials
    const expiredTrials = await SubscriptionService.getExpiredTrials();

    // Get expiring subscriptions
    const expiringSubscriptions = await SubscriptionService.getExpiringSubscriptions(7);

    // Get users approaching limits
    const usersApproachingLimits = await UsageTrackingService.getUsersApproachingLimits(75);

    res.json({
      success: true,
      data: {
        expiredTrials: expiredTrials.length,
        expiringSubscriptions: expiringSubscriptions.length,
        usersApproachingLimits: usersApproachingLimits.length,
        details: {
          expiredTrials,
          expiringSubscriptions,
          usersApproachingLimits,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /subscriptions/admin/users-approaching-limits
 * Get users approaching their subscription limits (Admin only)
 */
router.get(
  '/admin/users-approaching-limits',
  authenticate,
  authorize('admin'),
  validateRequest({
    query: {
      threshold: { type: 'number', required: false, min: 50, max: 100 },
    },
  }),
  async (req, res, next) => {
    try {
      const { threshold = 75 } = req.query as any;
      const users = await UsageTrackingService.getUsersApproachingLimits(threshold);

      res.json({
        success: true,
        data: { users, threshold },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /subscriptions/admin/process-expired-trials
 * Process expired trials (Admin only)
 */
router.post(
  '/admin/process-expired-trials',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await TrialManagementService.processExpiredTrials();

      res.json({
        success: true,
        message: 'Expired trials processed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /subscriptions/admin/send-trial-reminders
 * Send trial reminder emails (Admin only)
 */
router.post(
  '/admin/send-trial-reminders',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await TrialManagementService.sendTrialReminders();

      res.json({
        success: true,
        message: 'Trial reminders sent successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
