import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { PlanService, TRIAL_DAYS } from '@/services/PlanService';
import { OrgBillingService, billingEnabled } from '@/services/OrgBillingService';
import { logger } from '@/utils/logger';

/**
 * Billing for a subscriber (Settings > Billing):
 *   GET  /api/org-billing           its plan, trial, usage, and the plans
 *   POST /api/org-billing/checkout  { plan, interval } -> Stripe Checkout url
 *   POST /api/org-billing/portal    -> Stripe's billing page url
 *   POST /api/org-billing/webhook   Stripe's events (signed)
 * and the public price list: GET /api/plans (mounted separately).
 */
const router = Router();

// Stripe calls this; no login, the signature is the proof
router.post('/webhook', async (req, res) => {
  let event;
  try {
    event = OrgBillingService.verifyEvent((req as any).rawBody, req.header('stripe-signature'));
  } catch (error) {
    logger.warn('Stripe webhook refused', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(400).json({ error: 'invalid signature' });
    return;
  }
  try {
    await OrgBillingService.handleEvent(event);
    res.json({ received: true });
  } catch (error) {
    // 500 so Stripe retries; syncing is safe to repeat
    logger.error('Stripe webhook failed', {
      type: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'processing failed' });
  }
});

router.use(authenticate, requireStaff);

router.get('/', async (req, res, next) => {
  try {
    res.json({
      ...(await PlanService.summary(requireTenantId(req.user))),
      plans: OrgBillingService.plansForDisplay(),
      trialDays: TRIAL_DAYS,
      billingEnabled: billingEnabled(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/checkout', authorize('admin'), async (req, res, next) => {
  try {
    res.json(
      await OrgBillingService.checkout(
        requireTenantId(req.user),
        req.user!,
        String(req.body?.plan || ''),
        String(req.body?.interval || 'month')
      )
    );
  } catch (error) {
    next(error);
  }
});

// What adding (change=1) or removing (change=-1) an agent would cost
router.get('/seat-preview', authorize('admin'), async (req, res, next) => {
  try {
    const change = Number(req.query['change']) === -1 ? -1 : 1;
    res.json(await OrgBillingService.seatPreview(requireTenantId(req.user), change));
  } catch (error) {
    next(error);
  }
});

router.post('/portal', authorize('admin'), async (req, res, next) => {
  try {
    res.json(await OrgBillingService.portal(requireTenantId(req.user)));
  } catch (error) {
    next(error);
  }
});

export default router;

/** GET /api/plans - the price list, for the pricing and sign-up pages. */
export const plansRouter = Router().get('/', (_req, res) => {
  res.json({ plans: OrgBillingService.plansForDisplay(), trialDays: TRIAL_DAYS });
});
