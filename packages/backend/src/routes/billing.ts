import express from 'express';
import { StripeService } from '@/services/StripeService';
import { StripeWebhookService } from '@/services/StripeWebhookService';
import { SubscriptionService } from '@/services/SubscriptionService';
import { BillingService } from '@/services/BillingService';
import { BillingScheduledJobs } from '@/services/BillingScheduledJobs';
import { CustomerSubscription } from '@/models/CustomerSubscription';
import { stripe } from '@/config/stripe';
import { User } from '@/models/User';
import { authenticate } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { validateRequest, validate } from '@/utils/validation';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createSetupIntentSchema = Joi.object({
  // No body parameters needed - uses authenticated user
});

const createCheckoutSessionSchema = Joi.object({
  priceId: Joi.string().required(),
  trialPeriodDays: Joi.number().integer().min(0).max(365).optional(),
  successUrl: Joi.string().uri().optional(),
  cancelUrl: Joi.string().uri().optional(),
});

const updatePaymentMethodSchema = Joi.object({
  paymentMethodId: Joi.string().required(),
});

const retryPaymentSchema = Joi.object({
  invoiceId: Joi.string().required(),
});

/**
 * Create setup intent for payment method collection
 * POST /api/billing/setup-intent
 */
router.post(
  '/setup-intent',
  authenticate,
  validate(createSetupIntentSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Create or get Stripe customer
      const customer = await StripeService.createOrGetCustomer(userId, user.email, {
        name: `${user.first_name} ${user.last_name}`.trim(),
        metadata: { userId },
      });

      // Create setup intent
      const setupIntent = await StripeService.createSetupIntent(customer.id);

      res.json({
        success: true,
        data: {
          clientSecret: setupIntent.clientSecret,
          customerId: customer.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create checkout session for subscription
 * POST /api/billing/checkout-session
 */
router.post(
  '/checkout-session',
  authenticate,
  validate(createCheckoutSessionSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { priceId, trialPeriodDays, successUrl, cancelUrl } = req.body;

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check if user already has an active subscription
      const existingSubscription = await CustomerSubscription.findByUserId(userId);
      if (existingSubscription) {
        throw new AppError('User already has an active subscription', 400);
      }

      // Create or get Stripe customer
      const customer = await StripeService.createOrGetCustomer(userId, user.email, {
        name: `${user.first_name} ${user.last_name}`.trim(),
        metadata: { userId },
      });

      // Create checkout session
      const session = await StripeService.createCheckoutSession(customer.id, priceId, {
        trialPeriodDays,
        successUrl,
        cancelUrl,
        metadata: { userId },
      });

      res.json({
        success: true,
        data: {
          url: session.url,
          sessionId: session.sessionId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get customer payment methods
 * GET /api/billing/payment-methods
 */
router.get('/payment-methods', authenticate, async (req, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get user's subscription to find Stripe customer ID
    const subscription = await CustomerSubscription.findByUserId(userId);
    if (!subscription?.stripe_customer_id) {
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    // Get payment methods from Stripe
    const paymentMethods = await StripeService.getCustomerPaymentMethods(
      subscription.stripe_customer_id
    );

    const formattedPaymentMethods = paymentMethods.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : null,
      created: new Date(pm.created * 1000),
    }));

    res.json({
      success: true,
      data: formattedPaymentMethods,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update default payment method
 * PUT /api/billing/payment-method
 */
router.put(
  '/payment-method',
  authenticate,
  validate(updatePaymentMethodSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { paymentMethodId } = req.body;

      // Get user's subscription
      const subscription = await CustomerSubscription.findByUserId(userId);
      if (!subscription) {
        throw new AppError('No active subscription found', 404);
      }

      // Update payment method in Stripe
      if (subscription.stripe_subscription_id) {
        await StripeService.updateSubscription(subscription.stripe_subscription_id, {
          paymentMethodId,
        });
      }

      // Update payment method in our database
      await SubscriptionService.updatePaymentMethod(subscription.id, paymentMethodId);

      res.json({
        success: true,
        message: 'Payment method updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Remove payment method
 * DELETE /api/billing/payment-method/:paymentMethodId
 */
router.delete('/payment-method/:paymentMethodId', authenticate, async (req, res, next) => {
  try {
    const { paymentMethodId } = req.params;

    // Detach payment method from Stripe
    await StripeService.detachPaymentMethod(paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get billing history (invoices)
 * GET /api/billing/invoices
 */
router.get('/invoices', authenticate, async (req, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    // Get user's subscription to find Stripe customer ID
    const subscription = await CustomerSubscription.findByUserId(userId);
    if (!subscription?.stripe_customer_id) {
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    // Get invoices from Stripe
    const invoices = await StripeService.getCustomerInvoices(
      subscription.stripe_customer_id,
      limit
    );

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get upcoming invoice
 * GET /api/billing/upcoming-invoice
 */
router.get('/upcoming-invoice', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    // Get user's subscription
    const subscription = await CustomerSubscription.findByUserId(userId);
    if (!subscription?.stripe_subscription_id) {
      throw new AppError('No active subscription found', 404);
    }

    // Get upcoming invoice from Stripe
    const upcomingInvoice = await StripeService.getUpcomingInvoice(
      subscription.stripe_subscription_id
    );

    res.json({
      success: true,
      data: upcomingInvoice,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Retry failed payment
 * POST /api/billing/retry-payment
 */
router.post(
  '/retry-payment',
  authenticate,
  validate(retryPaymentSchema),
  async (req, res, next) => {
    try {
      const { invoiceId } = req.body;

      // Retry payment
      const result = await StripeService.retryInvoicePayment(invoiceId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create customer portal session
 * POST /api/billing/customer-portal
 */
router.post('/customer-portal', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { returnUrl } = req.body;

    // Get user's subscription to find Stripe customer ID
    const subscription = await CustomerSubscription.findByUserId(userId);
    if (!subscription?.stripe_customer_id) {
      throw new AppError('No billing account found', 404);
    }

    // Create customer portal session
    const session = await StripeService.createCustomerPortalSession(
      subscription.stripe_customer_id,
      returnUrl
    );

    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Stripe webhook endpoint
 * POST /api/billing/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new AppError('Missing Stripe signature', 400);
    }

    // Process webhook
    const result = await StripeWebhookService.processWebhook(req.body, signature);

    if (result.processed) {
      logger.info('Webhook processed successfully', {
        eventType: result.eventType,
        eventId: result.eventId,
        message: result.message,
      });
    } else {
      logger.warn('Webhook not processed', {
        eventType: result.eventType,
        eventId: result.eventId,
        error: result.error,
      });
    }

    // Always return 200 to acknowledge receipt
    res.json({
      success: true,
      processed: result.processed,
      message: result.message || result.error,
    });
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return 400 for webhook errors to trigger retry
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    });
  }
});

/**
 * Get billing summary for user
 * GET /api/billing/summary
 */
router.get('/summary', authenticate, async (req, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get subscription details
    const subscriptionDetails = await SubscriptionService.getUserSubscription(userId);
    if (!subscriptionDetails) {
      res.json({
        success: true,
        data: {
          hasSubscription: false,
          subscription: null,
          upcomingInvoice: null,
          paymentMethods: [],
        },
      });
      return;
    }

    let upcomingInvoice = null;
    let paymentMethods: any[] = [];

    // Get upcoming invoice and payment methods if Stripe subscription exists
    if (subscriptionDetails.subscription.stripeSubscriptionId) {
      try {
        upcomingInvoice = await StripeService.getUpcomingInvoice(
          subscriptionDetails.subscription.stripeSubscriptionId
        );
      } catch (error) {
        logger.warn('Could not fetch upcoming invoice', {
          subscriptionId: subscriptionDetails.subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (subscriptionDetails.subscription.stripeCustomerId) {
      try {
        const stripePMs = await StripeService.getCustomerPaymentMethods(
          subscriptionDetails.subscription.stripeCustomerId
        );
        paymentMethods = stripePMs.map((pm) => ({
          id: pm.id,
          type: pm.type,
          card: pm.card
            ? {
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year,
              }
            : null,
          created: new Date(pm.created * 1000),
        }));
      } catch (error) {
        logger.warn('Could not fetch payment methods', {
          customerId: subscriptionDetails.subscription.stripeCustomerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      data: {
        hasSubscription: true,
        subscription: subscriptionDetails,
        upcomingInvoice,
        paymentMethods,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get billing history from local database
 * GET /api/billing/history
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    // Get billing history from our database
    const billingHistory = await BillingService.getUserBillingHistory(userId, limit);

    res.json({
      success: true,
      data: billingHistory,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get failed payments for retry
 * GET /api/billing/failed-payments
 */
router.get('/failed-payments', authenticate, async (req, res, next): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get user's subscription
    const subscription = await CustomerSubscription.findByUserId(userId);
    if (!subscription) {
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    // Get failed payments for this subscription
    const allFailedPayments = await BillingService.getFailedPayments();
    const userFailedPayments = allFailedPayments.filter(
      (payment) => payment.subscriptionId === subscription.id
    );

    res.json({
      success: true,
      data: userFailedPayments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get revenue statistics (admin only)
 * GET /api/billing/revenue-stats
 */
router.get('/revenue-stats', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const stats = await BillingService.getRevenueStats(startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get monthly revenue (admin only)
 * GET /api/billing/monthly-revenue
 */
router.get('/monthly-revenue', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const monthlyRevenue = await BillingService.getMonthlyRevenue(year);

    res.json({
      success: true,
      data: monthlyRevenue,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get billing dashboard summary (admin only)
 * GET /api/billing/dashboard
 */
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const summary = await BillingService.getBillingSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get pending payments (admin only)
 * GET /api/billing/pending-payments
 */
router.get('/pending-payments', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const pendingPayments = await BillingService.getPendingPayments();

    res.json({
      success: true,
      data: pendingPayments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Manually sync billing record from Stripe invoice (admin only)
 * POST /api/billing/sync-invoice
 */
router.post('/sync-invoice', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { invoiceId } = req.body;
    if (!invoiceId) {
      throw new AppError('Invoice ID is required', 400);
    }

    // Get invoice from Stripe
    const stripeInvoice = await stripe.invoices.retrieve(invoiceId);

    // Create or update billing record
    const billingRecord = await BillingService.updateBillingRecordFromStripeInvoice(stripeInvoice);

    res.json({
      success: true,
      data: billingRecord,
      message: 'Invoice synced successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Run billing scheduled jobs (admin only)
 * POST /api/billing/run-jobs
 */
router.post('/run-jobs', authenticate, async (req, res, next) => {
  try {
    const user = req.user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { jobType } = req.body;

    let result: any;
    switch (jobType) {
      case 'failed-payments':
        result = await BillingScheduledJobs.processFailedPayments();
        break;
      case 'sync-records':
        result = await BillingScheduledJobs.syncBillingRecordsFromStripe();
        break;
      case 'cleanup':
        result = await BillingScheduledJobs.cleanupOldBillingRecords();
        break;
      case 'monthly-report':
        const { year, month } = req.body;
        result = await BillingScheduledJobs.generateMonthlyBillingReport(year, month);
        break;
      case 'all':
        result = await BillingScheduledJobs.runAllJobs();
        break;
      default:
        throw new AppError('Invalid job type', 400);
    }

    res.json({
      success: true,
      data: result,
      message: `${jobType} job completed successfully`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
