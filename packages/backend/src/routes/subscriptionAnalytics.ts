import express from 'express';
import { SubscriptionAnalyticsService } from '@/services/SubscriptionAnalyticsService';
import { authenticate } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * GET /api/subscription-analytics/mrr
 * Get Monthly Recurring Revenue for a specific month or current month
 */
router.get('/mrr', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { year, month } = req.query;
    const now = new Date();
    const targetYear = year ? parseInt(year as string) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;

    if (targetMonth < 1 || targetMonth > 12) {
      throw new AppError('Invalid month. Must be between 1 and 12.', 400);
    }

    const mrr = await SubscriptionAnalyticsService.calculateMRR(targetYear, targetMonth);

    res.json({
      success: true,
      data: mrr,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/mrr/historical
 * Get historical MRR data for charting
 */
router.get('/mrr/historical', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { months } = req.query;
    const monthsCount = months ? parseInt(months as string) : 12;

    if (monthsCount < 1 || monthsCount > 24) {
      throw new AppError('Invalid months parameter. Must be between 1 and 24.', 400);
    }

    const historicalMrr = await SubscriptionAnalyticsService.getHistoricalMRR(monthsCount);

    res.json({
      success: true,
      data: historicalMrr,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/clv
 * Get Customer Lifetime Value data
 */
router.get('/clv', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { limit, offset } = req.query;
    const limitCount = limit ? parseInt(limit as string) : 100;
    const offsetCount = offset ? parseInt(offset as string) : 0;

    if (limitCount < 1 || limitCount > 500) {
      throw new AppError('Invalid limit parameter. Must be between 1 and 500.', 400);
    }

    const clvData = await SubscriptionAnalyticsService.calculateCustomerLifetimeValue(
      limitCount,
      offsetCount
    );

    res.json({
      success: true,
      data: clvData,
      pagination: {
        limit: limitCount,
        offset: offsetCount,
        total: clvData.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/conversion-rates
 * Get conversion rates from free to paid plans
 */
router.get('/conversion-rates', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { year, month } = req.query;
    const now = new Date();
    const targetYear = year ? parseInt(year as string) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;

    if (targetMonth < 1 || targetMonth > 12) {
      throw new AppError('Invalid month. Must be between 1 and 12.', 400);
    }

    const conversionRates = await SubscriptionAnalyticsService.calculateConversionRates(
      targetYear,
      targetMonth
    );

    res.json({
      success: true,
      data: conversionRates,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/conversion-rates/historical
 * Get historical conversion rates for trending
 */
router.get('/conversion-rates/historical', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { months } = req.query;
    const monthsCount = months ? parseInt(months as string) : 12;

    if (monthsCount < 1 || monthsCount > 24) {
      throw new AppError('Invalid months parameter. Must be between 1 and 24.', 400);
    }

    const historicalConversion =
      await SubscriptionAnalyticsService.getHistoricalConversionRates(monthsCount);

    res.json({
      success: true,
      data: historicalConversion,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/plan-distribution
 * Get subscription plan distribution and revenue breakdown
 */
router.get('/plan-distribution', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const planDistribution = await SubscriptionAnalyticsService.getPlanDistribution();

    res.json({
      success: true,
      data: planDistribution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/churn
 * Get churn analysis for a specific month
 */
router.get('/churn', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { year, month } = req.query;
    const now = new Date();
    const targetYear = year ? parseInt(year as string) : now.getFullYear();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;

    if (targetMonth < 1 || targetMonth > 12) {
      throw new AppError('Invalid month. Must be between 1 and 12.', 400);
    }

    const churnAnalysis = await SubscriptionAnalyticsService.analyzeChurn(targetYear, targetMonth);

    res.json({
      success: true,
      data: churnAnalysis,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/usage
 * Get usage analytics showing customers approaching limits
 */
router.get('/usage', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const usageAnalytics = await SubscriptionAnalyticsService.getUsageAnalytics();

    res.json({
      success: true,
      data: usageAnalytics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/revenue-metrics
 * Get comprehensive revenue metrics for a date range
 */
router.get('/revenue-metrics', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const { startDate, endDate } = req.query;

    // Default to current month if no dates provided
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const start = startDate ? new Date(startDate as string) : defaultStartDate;
    const end = endDate ? new Date(endDate as string) : defaultEndDate;

    if (start > end) {
      throw new AppError('Start date must be before end date.', 400);
    }

    const revenueMetrics = await SubscriptionAnalyticsService.getRevenueMetrics(start, end);

    res.json({
      success: true,
      data: revenueMetrics,
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscription-analytics/dashboard
 * Get comprehensive dashboard data combining multiple metrics
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new AppError('Access denied. Admin role required.', 403);
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get current month data
    const [
      currentMrr,
      conversionRates,
      planDistribution,
      churnAnalysis,
      usageAnalytics,
      revenueMetrics,
      historicalMrr,
    ] = await Promise.all([
      SubscriptionAnalyticsService.calculateMRR(currentYear, currentMonth),
      SubscriptionAnalyticsService.calculateConversionRates(currentYear, currentMonth),
      SubscriptionAnalyticsService.getPlanDistribution(),
      SubscriptionAnalyticsService.analyzeChurn(currentYear, currentMonth),
      SubscriptionAnalyticsService.getUsageAnalytics(),
      SubscriptionAnalyticsService.getRevenueMetrics(
        new Date(currentYear, currentMonth - 1, 1),
        new Date(currentYear, currentMonth, 0, 23, 59, 59, 999)
      ),
      SubscriptionAnalyticsService.getHistoricalMRR(6), // Last 6 months
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          mrr: currentMrr,
          revenueMetrics,
          conversionRates,
          churnAnalysis,
        },
        charts: {
          historicalMrr,
          planDistribution,
        },
        insights: {
          usageAnalytics,
          topCustomers: [], // Would be populated from CLV data
          growthTrends: {
            mrrGrowth: currentMrr.netMrrGrowth,
            customerGrowth: currentMrr.newSubscriptions - currentMrr.churnedSubscriptions,
            conversionTrend: conversionRates.overallConversionRate,
          },
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
