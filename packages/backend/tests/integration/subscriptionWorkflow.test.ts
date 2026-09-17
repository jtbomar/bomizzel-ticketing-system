import { SubscriptionService } from '../../src/services/SubscriptionService';
import { SubscriptionEnforcementService } from '../../src/services/SubscriptionEnforcementService';
import { UsageTrackingService } from '../../src/services/UsageTrackingService';
import { SubscriptionPlan } from '../../src/models/SubscriptionPlan';
import { AppError } from '../../src/middleware/errorHandler';
import { createTicketContext, createContextTicket, TicketContext } from '../helpers/testUtils';

/**
 * Integration coverage for the subscription workflow (spec task 12.2):
 * signing up on a plan, tracking usage as tickets are created, blocking at the
 * plan limit, and having an upgrade lift that block.
 *
 * This file existed but was empty (0 bytes), which made Jest fail the whole
 * suite with "Your test suite must contain at least one test."
 *
 * These are real database tests - they need Postgres reachable via .env.test,
 * which CI provisions before running the integration step.
 */
describe('subscription workflow', () => {
  let ctx: TicketContext;
  let freePlanId: string;
  let starterPlanId: string;

  // Small plan limits keep the "hit the ceiling" test cheap.
  const FREE_ACTIVE_LIMIT = 2;

  beforeAll(async () => {
    ctx = await createTicketContext('SubWorkflow');

    const freePlan = await SubscriptionPlan.createPlan({
      name: 'Workflow Free',
      slug: 'workflow-free',
      price: 0,
      activeTicketLimit: FREE_ACTIVE_LIMIT,
      completedTicketLimit: 2,
      totalTicketLimit: 4,
      features: ['Basic ticketing'],
      trialDays: 0,
      sortOrder: 1,
    });
    freePlanId = freePlan.id;

    const starterPlan = await SubscriptionPlan.createPlan({
      name: 'Workflow Starter',
      slug: 'workflow-starter',
      price: 10,
      activeTicketLimit: 50,
      completedTicketLimit: 50,
      totalTicketLimit: 100,
      features: ['Advanced ticketing'],
      trialDays: 14,
      sortOrder: 2,
    });
    starterPlanId = starterPlan.id;
  });

  describe('signing up on a plan', () => {
    it('creates an active subscription for the chosen plan', async () => {
      const subscription = await SubscriptionService.createSubscription(ctx.userId, freePlanId);

      expect(subscription.planId).toBe(freePlanId);
      expect(['active', 'trial']).toContain(subscription.status);

      const current = await SubscriptionService.getUserSubscription(ctx.userId);
      expect(current).not.toBeNull();
      expect(current?.subscription.planId).toBe(freePlanId);
    });

    it('reports zero usage before any tickets exist', async () => {
      const usage = await UsageTrackingService.getCurrentUsage(ctx.userId);
      expect(usage.activeTickets).toBe(0);
    });
  });

  describe('usage tracking as tickets are created', () => {
    it('counts each created ticket against the active limit', async () => {
      const before = await UsageTrackingService.getCurrentUsage(ctx.userId);

      const ticket = await createContextTicket(ctx, { title: 'Workflow ticket 1' });
      await UsageTrackingService.recordTicketCreation(ctx.userId, ticket.id);

      const after = await UsageTrackingService.getCurrentUsage(ctx.userId);
      expect(after.activeTickets).toBe(before.activeTickets + 1);
    });

    it('still allows creation below the limit', async () => {
      const check = await UsageTrackingService.canCreateTicket(ctx.userId);
      expect(check.canCreate).toBe(true);
    });
  });

  describe('enforcement at the plan limit', () => {
    it('blocks ticket creation once the active limit is reached', async () => {
      // Fill the plan up to its active ceiling.
      const usage = await UsageTrackingService.getCurrentUsage(ctx.userId);
      for (let i = usage.activeTickets; i < FREE_ACTIVE_LIMIT; i++) {
        const ticket = await createContextTicket(ctx, { title: `Workflow fill ${i}` });
        await UsageTrackingService.recordTicketCreation(ctx.userId, ticket.id);
      }

      const check = await UsageTrackingService.canCreateTicket(ctx.userId);
      expect(check.canCreate).toBe(false);

      await expect(
        SubscriptionEnforcementService.checkTicketCreationLimits(ctx.userId)
      ).rejects.toThrow(AppError);
    });

    it('explains the limit and suggests an upgrade', async () => {
      try {
        await SubscriptionEnforcementService.checkTicketCreationLimits(ctx.userId);
        throw new Error('expected checkTicketCreationLimits to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.statusCode).toBe(429);
        expect(appError.details).toHaveProperty('upgradeMessage');
      }
    });
  });

  describe('upgrading lifts the block', () => {
    it('allows creation again on a larger plan', async () => {
      const current = await SubscriptionService.getUserSubscription(ctx.userId);
      expect(current).not.toBeNull();

      await SubscriptionService.upgradeSubscription(current!.subscription.id, starterPlanId);

      const upgraded = await SubscriptionService.getUserSubscription(ctx.userId);
      expect(upgraded?.subscription.planId).toBe(starterPlanId);

      const check = await UsageTrackingService.canCreateTicket(ctx.userId);
      expect(check.canCreate).toBe(true);

      await expect(
        SubscriptionEnforcementService.checkTicketCreationLimits(ctx.userId)
      ).resolves.toBeUndefined();
    });
  });
});
