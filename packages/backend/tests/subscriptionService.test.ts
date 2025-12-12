import { SubscriptionService } from '../src/services/SubscriptionService';
import { SubscriptionPlan } from '../src/models/SubscriptionPlan';
import { CustomerSubscription } from '../src/models/CustomerSubscription';
import { User } from '../src/models/User';
import { AppError } from '../src/middleware/errorHandler';

describe('SubscriptionService', () => {
  let userId: string;
  let freePlanId: string;
  let starterPlanId: string;
  let professionalPlanId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    // Create test user
    const user = await User.createUser({
      email: 'subscription-test@example.com',
      password: 'password123',
      firstName: 'Subscription',
      lastName: 'Test',
      role: 'customer',
    });
    userId = user.id;

    // Create test subscription plans
    const freePlan = await SubscriptionPlan.createPlan({
      name: 'Free Tier',
      slug: 'free-tier',
      price: 0,
      currency: 'USD',
      billingInterval: 'month',
      activeTicketLimit: 100,
      completedTicketLimit: 100,
      totalTicketLimit: 200,
      features: ['Basic ticketing', 'Email support'],
      trialDays: 0,
      sortOrder: 1,
    });
    freePlanId = freePlan.id;

    const starterPlan = await SubscriptionPlan.createPlan({
      name: 'Starter',
      slug: 'starter',
      price: 10,
      currency: 'USD',
      billingInterval: 'month',
      activeTicketLimit: 500,
      completedTicketLimit: 500,
      totalTicketLimit: 1000,
      features: ['Advanced ticketing', 'Priority support', 'Custom fields'],
      trialDays: 14,
      sortOrder: 2,
    });
    starterPlanId = starterPlan.id;

    const professionalPlan = await SubscriptionPlan.createPlan({
      name: 'Professional',
      slug: 'professional',
      price: 50,
      currency: 'USD',
      billingInterval: 'month',
      activeTicketLimit: 5000,
      completedTicketLimit: 5000,
      totalTicketLimit: 10000,
      features: ['All features', 'API access', 'Advanced analytics'],
      trialDays: 14,
      sortOrder: 3,
    });
    professionalPlanId = professionalPlan.id;
  });

  describe('createSubscription', () => {
    it('should create a new subscription for a user', async () => {
      const subscription = await SubscriptionService.createSubscription(userId, freePlanId);

      expect(subscription.userId).toBe(userId);
      expect(subscription.planId).toBe(freePlanId);
      expect(subscription.status).toBe('active');
      expect(subscription.currentPeriodStart).toBeInstanceOf(Date);
      expect(subscription.currentPeriodEnd).toBeInstanceOf(Date);

      subscriptionId = subscription.id;
    });

    it('should create subscription with trial when specified', async () => {
      const testUser = await User.createUser({
        email: 'trial-test@example.com',
        password: 'password123',
        firstName: 'Trial',
        lastName: 'Test',
        role: 'customer',
      });

      const subscription = await SubscriptionService.createSubscription(
        testUser.id,
        starterPlanId,
        { startTrial: true }
      );

      expect(subscription.status).toBe('trial');
      expect(subscription.trialStart).toBeInstanceOf(Date);
      expect(subscription.trialEnd).toBeInstanceOf(Date);
    });

    it('should throw error if plan does not exist', async () => {
      await expect(
        SubscriptionService.createSubscription(userId, 'non-existent-plan')
      ).rejects.toThrow('Invalid or inactive subscription plan');
    });

    it('should throw error if user already has subscription', async () => {
      await expect(SubscriptionService.createSubscription(userId, starterPlanId)).rejects.toThrow(
        'User already has an active subscription'
      );
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription to higher tier', async () => {
      const upgradedSubscription = await SubscriptionService.upgradeSubscription(
        subscriptionId,
        starterPlanId
      );

      expect(upgradedSubscription.planId).toBe(starterPlanId);
      expect(upgradedSubscription.status).toBe('active');
    });

    it('should throw error when downgrading', async () => {
      await expect(
        SubscriptionService.upgradeSubscription(subscriptionId, freePlanId)
      ).rejects.toThrow('Cannot downgrade to a lower or same tier plan');
    });

    it('should throw error for non-existent subscription', async () => {
      await expect(
        SubscriptionService.upgradeSubscription('non-existent', professionalPlanId)
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const cancelledSubscription = await SubscriptionService.cancelSubscription(
        subscriptionId,
        true
      );

      expect(cancelledSubscription.cancelAtPeriodEnd).toBe(true);
    });

    it('should cancel subscription immediately', async () => {
      // Create another subscription for immediate cancellation test
      const testUser = await User.createUser({
        email: 'cancel-test@example.com',
        password: 'password123',
        firstName: 'Cancel',
        lastName: 'Test',
        role: 'customer',
      });

      const subscription = await SubscriptionService.createSubscription(testUser.id, starterPlanId);

      const cancelledSubscription = await SubscriptionService.cancelSubscription(
        subscription.id,
        false
      );

      expect(cancelledSubscription.status).toBe('cancelled');
    });

    it('should throw error for already cancelled subscription', async () => {
      await expect(SubscriptionService.cancelSubscription(subscriptionId, false)).rejects.toThrow(
        'Subscription is already cancelled'
      );
    });
  });

  describe('getUserSubscription', () => {
    let activeUserId: string;
    let activeSubscriptionId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'active-subscription@example.com',
        password: 'password123',
        firstName: 'Active',
        lastName: 'User',
        role: 'customer',
      });
      activeUserId = user.id;

      const subscription = await SubscriptionService.createSubscription(
        activeUserId,
        professionalPlanId
      );
      activeSubscriptionId = subscription.id;
    });

    it('should return subscription details with plan and usage', async () => {
      const subscriptionDetails = await SubscriptionService.getUserSubscription(activeUserId);

      expect(subscriptionDetails).toBeDefined();
      expect(subscriptionDetails!.subscription.userId).toBe(activeUserId);
      expect(subscriptionDetails!.plan.id).toBe(professionalPlanId);
      expect(subscriptionDetails!.usage).toBeDefined();
      expect(subscriptionDetails!.limitStatus).toBeDefined();
    });

    it('should return null for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-subscription@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'Subscription',
        role: 'customer',
      });

      const subscriptionDetails = await SubscriptionService.getUserSubscription(userWithoutSub.id);
      expect(subscriptionDetails).toBeNull();
    });
  });

  describe('getAvailablePlans', () => {
    it('should return all active subscription plans', async () => {
      const plans = await SubscriptionService.getAvailablePlans();

      expect(plans.length).toBeGreaterThanOrEqual(3);
      expect(plans.every((plan) => plan.isActive)).toBe(true);

      const planSlugs = plans.map((p) => p.slug);
      expect(planSlugs).toContain('free-tier');
      expect(planSlugs).toContain('starter');
      expect(planSlugs).toContain('professional');
    });
  });

  describe('getPlanById', () => {
    it('should return plan by ID', async () => {
      const plan = await SubscriptionService.getPlanById(starterPlanId);

      expect(plan).toBeDefined();
      expect(plan!.id).toBe(starterPlanId);
      expect(plan!.name).toBe('Starter');
      expect(plan!.price).toBe(10);
    });

    it('should return null for non-existent plan', async () => {
      const plan = await SubscriptionService.getPlanById('non-existent');
      expect(plan).toBeNull();
    });
  });

  describe('getPlanBySlug', () => {
    it('should return plan by slug', async () => {
      const plan = await SubscriptionService.getPlanBySlug('professional');

      expect(plan).toBeDefined();
      expect(plan!.slug).toBe('professional');
      expect(plan!.name).toBe('Professional');
      expect(plan!.price).toBe(50);
    });

    it('should return null for non-existent slug', async () => {
      const plan = await SubscriptionService.getPlanBySlug('non-existent');
      expect(plan).toBeNull();
    });
  });

  describe('trial management', () => {
    let trialUserId: string;
    let trialSubscriptionId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'trial-management@example.com',
        password: 'password123',
        firstName: 'Trial',
        lastName: 'Management',
        role: 'customer',
      });
      trialUserId = user.id;
    });

    it('should start a trial subscription', async () => {
      const trialSubscription = await SubscriptionService.startTrial(
        trialUserId,
        professionalPlanId,
        { trialDays: 14 }
      );

      expect(trialSubscription.status).toBe('trial');
      expect(trialSubscription.trialStart).toBeInstanceOf(Date);
      expect(trialSubscription.trialEnd).toBeInstanceOf(Date);

      trialSubscriptionId = trialSubscription.id;
    });

    it('should get trial status', async () => {
      const trialStatus = await SubscriptionService.getTrialStatus(trialSubscriptionId);

      expect(trialStatus.isInTrial).toBe(true);
      expect(trialStatus.daysRemaining).toBeGreaterThan(0);
      expect(trialStatus.hasExpired).toBe(false);
    });

    it('should extend trial period', async () => {
      const extendedSubscription = await SubscriptionService.extendTrial(trialSubscriptionId, 7);

      const trialStatus = await SubscriptionService.getTrialStatus(trialSubscriptionId);
      expect(trialStatus.daysRemaining).toBeGreaterThan(14);
    });

    it('should convert trial to paid subscription', async () => {
      const convertedSubscription = await SubscriptionService.convertTrialToPaid(
        trialSubscriptionId,
        { paymentMethodId: 'test-payment-method' }
      );

      expect(convertedSubscription.status).toBe('active');
      expect(convertedSubscription.paymentMethodId).toBe('test-payment-method');
    });

    it('should cancel trial subscription', async () => {
      // Create another trial for cancellation test
      const testUser = await User.createUser({
        email: 'trial-cancel@example.com',
        password: 'password123',
        firstName: 'Trial',
        lastName: 'Cancel',
        role: 'customer',
      });

      const trialSub = await SubscriptionService.startTrial(testUser.id, starterPlanId);
      const cancelledTrial = await SubscriptionService.cancelTrial(trialSub.id);

      expect(cancelledTrial.status).toBe('cancelled');
    });
  });

  describe('updateSubscriptionStatus', () => {
    let statusTestUserId: string;
    let statusTestSubscriptionId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'status-test@example.com',
        password: 'password123',
        firstName: 'Status',
        lastName: 'Test',
        role: 'customer',
      });
      statusTestUserId = user.id;

      const subscription = await SubscriptionService.createSubscription(
        statusTestUserId,
        starterPlanId
      );
      statusTestSubscriptionId = subscription.id;
    });

    it('should update subscription status', async () => {
      const updatedSubscription = await SubscriptionService.updateSubscriptionStatus(
        statusTestSubscriptionId,
        'past_due'
      );

      expect(updatedSubscription.status).toBe('past_due');
    });

    it('should throw error for non-existent subscription', async () => {
      await expect(
        SubscriptionService.updateSubscriptionStatus('non-existent', 'active')
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('updatePaymentMethod', () => {
    let paymentTestUserId: string;
    let paymentTestSubscriptionId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'payment-test@example.com',
        password: 'password123',
        firstName: 'Payment',
        lastName: 'Test',
        role: 'customer',
      });
      paymentTestUserId = user.id;

      const subscription = await SubscriptionService.createSubscription(
        paymentTestUserId,
        starterPlanId
      );
      paymentTestSubscriptionId = subscription.id;
    });

    it('should update payment method', async () => {
      const updatedSubscription = await SubscriptionService.updatePaymentMethod(
        paymentTestSubscriptionId,
        'new-payment-method-id'
      );

      expect(updatedSubscription.paymentMethodId).toBe('new-payment-method-id');
    });

    it('should throw error for non-existent subscription', async () => {
      await expect(
        SubscriptionService.updatePaymentMethod('non-existent', 'payment-method')
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('processExpiredTrials', () => {
    it('should process expired trials', async () => {
      // This test would require manipulating dates or using time mocking
      // For now, we'll test the method exists and returns expected structure
      const result = await SubscriptionService.processExpiredTrials();

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('cancelled');
      expect(result).toHaveProperty('convertedToFree');
      expect(typeof result.processed).toBe('number');
      expect(typeof result.cancelled).toBe('number');
      expect(typeof result.convertedToFree).toBe('number');
    });
  });

  describe('isPlanUnlimited', () => {
    let unlimitedPlanId: string;

    beforeAll(async () => {
      const unlimitedPlan = await SubscriptionPlan.createPlan({
        name: 'Enterprise',
        slug: 'enterprise',
        price: 200,
        currency: 'USD',
        billingInterval: 'month',
        activeTicketLimit: -1,
        completedTicketLimit: -1,
        totalTicketLimit: -1,
        features: ['Unlimited everything'],
        trialDays: 14,
        sortOrder: 5,
      });
      unlimitedPlanId = unlimitedPlan.id;
    });

    it('should return true for unlimited plan', async () => {
      const isUnlimited = await SubscriptionService.isPlanUnlimited(unlimitedPlanId);
      expect(isUnlimited).toBe(true);
    });

    it('should return false for limited plan', async () => {
      const isUnlimited = await SubscriptionService.isPlanUnlimited(starterPlanId);
      expect(isUnlimited).toBe(false);
    });
  });
});
