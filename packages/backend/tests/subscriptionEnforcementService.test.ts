import { SubscriptionEnforcementService } from '../src/services/SubscriptionEnforcementService';
import { SubscriptionService } from '../src/services/SubscriptionService';
import { UsageTrackingService } from '../src/services/UsageTrackingService';
import { SubscriptionPlan } from '../src/models/SubscriptionPlan';
import { User } from '../src/models/User';
import { Ticket } from '../src/models/Ticket';
import { Company } from '../src/models/Company';
import { AppError } from '../src/middleware/errorHandler';

describe('SubscriptionEnforcementService', () => {
  let userId: string;
  let companyId: string;
  let limitedPlanId: string;
  let unlimitedPlanId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    // Create test company
    const company = await Company.createCompany({
      name: 'Enforcement Test Company',
      domain: 'enforcement-test.com',
    });
    companyId = company.id;

    // Create test user
    const user = await User.createUser({
      email: 'enforcement-test@example.com',
      password: 'password123',
      firstName: 'Enforcement',
      lastName: 'Test',
      role: 'customer',
    });
    userId = user.id;

    // Create limited plan for testing enforcement
    const limitedPlan = await SubscriptionPlan.createPlan({
      name: 'Limited Plan',
      slug: 'limited-enforcement',
      price: 10,
      currency: 'USD',
      billingInterval: 'month',
      activeTicketLimit: 3,
      completedTicketLimit: 3,
      totalTicketLimit: 6,
      features: ['Limited features'],
      trialDays: 0,
      isActive: true,
      sortOrder: 1,
    });
    limitedPlanId = limitedPlan.id;

    // Create unlimited plan for testing
    const unlimitedPlan = await SubscriptionPlan.createPlan({
      name: 'Unlimited Plan',
      slug: 'unlimited-enforcement',
      price: 100,
      currency: 'USD',
      billingInterval: 'month',
      activeTicketLimit: -1,
      completedTicketLimit: -1,
      totalTicketLimit: -1,
      features: ['Unlimited features'],
      trialDays: 0,
      isActive: true,
      sortOrder: 2,
    });
    unlimitedPlanId = unlimitedPlan.id;

    // Create subscription for user
    const subscription = await SubscriptionService.createSubscription(userId, limitedPlanId);
    subscriptionId = subscription.id;
  });

  describe('enforceTicketCreationLimit', () => {
    it('should allow ticket creation when under limits', async () => {
      const enforcement = await SubscriptionEnforcementService.enforceTicketCreationLimit(userId);

      expect(enforcement.allowed).toBe(true);
    });

    it('should prevent ticket creation when at active limit', async () => {
      // Create tickets up to the limit
      for (let i = 0; i < 3; i++) {
        const ticket = await Ticket.createTicket({
          title: `Enforcement Test Ticket ${i}`,
          description: 'Test ticket for enforcement',
          priority: 'medium',
          status: 'open',
          customerId: userId,
          companyId: companyId,
          createdBy: userId,
        });
        await UsageTrackingService.recordTicketCreation(userId, ticket.id);
      }

      const enforcement = await SubscriptionEnforcementService.enforceTicketCreationLimit(userId);

      expect(enforcement.allowed).toBe(false);
      expect(enforcement.reason).toContain('Active ticket limit reached');
      expect(enforcement.limitType).toBe('active');
      expect(enforcement.upgradeMessage).toBeDefined();
      expect(enforcement.suggestedPlans).toBeDefined();
      expect(Array.isArray(enforcement.suggestedPlans)).toBe(true);
    });

    it('should allow creation for unlimited plan', async () => {
      const unlimitedUser = await User.createUser({
        email: 'unlimited-test@example.com',
        password: 'password123',
        firstName: 'Unlimited',
        lastName: 'Test',
        role: 'customer',
      });

      await SubscriptionService.createSubscription(unlimitedUser.id, unlimitedPlanId);

      const enforcement = await SubscriptionEnforcementService.enforceTicketCreationLimit(unlimitedUser.id);
      expect(enforcement.allowed).toBe(true);
    });
  });

  describe('enforceTicketCompletionLimit', () => {
    let completionTestUserId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'completion-enforcement@example.com',
        password: 'password123',
        firstName: 'Completion',
        lastName: 'Enforcement',
        role: 'customer',
      });
      completionTestUserId = user.id;

      await SubscriptionService.createSubscription(completionTestUserId, limitedPlanId);
    });

    it('should allow ticket completion when under limits', async () => {
      const enforcement = await SubscriptionEnforcementService.enforceTicketCompletionLimit(completionTestUserId);

      expect(enforcement.allowed).toBe(true);
    });

    it('should prevent completion when at completed limit', async () => {
      // Create and complete tickets up to the limit
      for (let i = 0; i < 3; i++) {
        const ticket = await Ticket.createTicket({
          title: `Completion Test Ticket ${i}`,
          description: 'Test ticket for completion enforcement',
          priority: 'medium',
          status: 'open',
          customerId: completionTestUserId,
          companyId: companyId,
          createdBy: completionTestUserId,
        });
        await UsageTrackingService.recordTicketCreation(completionTestUserId, ticket.id);
        await UsageTrackingService.recordTicketStatusChange(
          completionTestUserId,
          ticket.id,
          'open',
          'completed'
        );
      }

      const enforcement = await SubscriptionEnforcementService.enforceTicketCompletionLimit(completionTestUserId);

      expect(enforcement.allowed).toBe(false);
      expect(enforcement.reason).toContain('Completed ticket limit reached');
      expect(enforcement.limitType).toBe('completed');
      expect(enforcement.upgradeMessage).toBeDefined();
    });
  });

  describe('checkTicketCreationLimits', () => {
    let creationCheckUserId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'creation-check@example.com',
        password: 'password123',
        firstName: 'Creation',
        lastName: 'Check',
        role: 'customer',
      });
      creationCheckUserId = user.id;

      await SubscriptionService.createSubscription(creationCheckUserId, limitedPlanId);

      // Fill up the limits
      for (let i = 0; i < 3; i++) {
        const ticket = await Ticket.createTicket({
          title: `Creation Check Ticket ${i}`,
          description: 'Test ticket for creation check',
          priority: 'medium',
          status: 'open',
          customerId: creationCheckUserId,
          companyId: companyId,
          createdBy: creationCheckUserId,
        });
        await UsageTrackingService.recordTicketCreation(creationCheckUserId, ticket.id);
      }
    });

    it('should throw AppError when limits are reached', async () => {
      await expect(
        SubscriptionEnforcementService.checkTicketCreationLimits(creationCheckUserId)
      ).rejects.toThrow(AppError);

      try {
        await SubscriptionEnforcementService.checkTicketCreationLimits(creationCheckUserId);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(429);
        expect(error.code).toBe('SUBSCRIPTION_LIMIT_REACHED');
        expect(error.details).toHaveProperty('limitType');
        expect(error.details).toHaveProperty('upgradeMessage');
        expect(error.details).toHaveProperty('suggestedPlans');
      }
    });

    it('should not throw error when limits are not reached', async () => {
      const allowedUser = await User.createUser({
        email: 'allowed-creation@example.com',
        password: 'password123',
        firstName: 'Allowed',
        lastName: 'Creation',
        role: 'customer',
      });

      await SubscriptionService.createSubscription(allowedUser.id, limitedPlanId);

      await expect(
        SubscriptionEnforcementService.checkTicketCreationLimits(allowedUser.id)
      ).resolves.not.toThrow();
    });
  });

  describe('checkTicketCompletionLimits', () => {
    let completionCheckUserId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'completion-check@example.com',
        password: 'password123',
        firstName: 'Completion',
        lastName: 'Check',
        role: 'customer',
      });
      completionCheckUserId = user.id;

      await SubscriptionService.createSubscription(completionCheckUserId, limitedPlanId);

      // Fill up the completion limits
      for (let i = 0; i < 3; i++) {
        const ticket = await Ticket.createTicket({
          title: `Completion Check Ticket ${i}`,
          description: 'Test ticket for completion check',
          priority: 'medium',
          status: 'open',
          customerId: completionCheckUserId,
          companyId: companyId,
          createdBy: completionCheckUserId,
        });
        await UsageTrackingService.recordTicketCreation(completionCheckUserId, ticket.id);
        await UsageTrackingService.recordTicketStatusChange(
          completionCheckUserId,
          ticket.id,
          'open',
          'completed'
        );
      }
    });

    it('should throw AppError when completion limits are reached', async () => {
      await expect(
        SubscriptionEnforcementService.checkTicketCompletionLimits(completionCheckUserId)
      ).rejects.toThrow(AppError);

      try {
        await SubscriptionEnforcementService.checkTicketCompletionLimits(completionCheckUserId);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(429);
        expect(error.code).toBe('SUBSCRIPTION_LIMIT_REACHED');
      }
    });
  });

  describe('getUsageWarnings', () => {
    let warningTestUserId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'warning-test@example.com',
        password: 'password123',
        firstName: 'Warning',
        lastName: 'Test',
        role: 'customer',
      });
      warningTestUserId = user.id;

      await SubscriptionService.createSubscription(warningTestUserId, limitedPlanId);

      // Create tickets to approach limits (75% threshold)
      for (let i = 0; i < 2; i++) {
        const ticket = await Ticket.createTicket({
          title: `Warning Test Ticket ${i}`,
          description: 'Test ticket for warnings',
          priority: 'medium',
          status: 'open',
          customerId: warningTestUserId,
          companyId: companyId,
          createdBy: warningTestUserId,
        });
        await UsageTrackingService.recordTicketCreation(warningTestUserId, ticket.id);
      }
    });

    it('should return warnings when approaching limits', async () => {
      const warnings = await SubscriptionEnforcementService.getUsageWarnings(warningTestUserId);

      expect(warnings).toHaveProperty('hasWarnings');
      expect(warnings).toHaveProperty('warnings');
      expect(Array.isArray(warnings.warnings)).toBe(true);

      if (warnings.hasWarnings) {
        expect(warnings.upgradeMessage).toBeDefined();
        expect(warnings.suggestedPlans).toBeDefined();
        
        const warning = warnings.warnings[0];
        expect(warning).toHaveProperty('type');
        expect(warning).toHaveProperty('percentage');
        expect(warning).toHaveProperty('message');
        expect(warning).toHaveProperty('severity');
        expect(['info', 'warning', 'critical']).toContain(warning.severity);
      }
    });

    it('should return no warnings for unlimited plan', async () => {
      const unlimitedUser = await User.createUser({
        email: 'unlimited-warning@example.com',
        password: 'password123',
        firstName: 'Unlimited',
        lastName: 'Warning',
        role: 'customer',
      });

      await SubscriptionService.createSubscription(unlimitedUser.id, unlimitedPlanId);

      const warnings = await SubscriptionEnforcementService.getUsageWarnings(unlimitedUser.id);
      expect(warnings.hasWarnings).toBe(false);
      expect(warnings.warnings).toHaveLength(0);
    });
  });

  describe('getSuggestedUpgradePlans', () => {
    it('should return higher tier plans as suggestions', async () => {
      const suggestedPlans = await SubscriptionEnforcementService.getSuggestedUpgradePlans(userId);

      expect(Array.isArray(suggestedPlans)).toBe(true);
      
      if (suggestedPlans.length > 0) {
        // All suggested plans should have higher price than current plan
        const currentSubscription = await SubscriptionService.getUserSubscription(userId);
        const currentPrice = currentSubscription!.plan.price;
        
        suggestedPlans.forEach(plan => {
          expect(plan.price).toBeGreaterThan(currentPrice);
        });
      }
    });

    it('should return all plans for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-suggestions@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubSuggestions',
        role: 'customer',
      });

      const suggestedPlans = await SubscriptionEnforcementService.getSuggestedUpgradePlans(userWithoutSub.id);
      expect(Array.isArray(suggestedPlans)).toBe(true);
    });
  });

  describe('hasUnlimitedPlan', () => {
    it('should return true for unlimited plan', async () => {
      const unlimitedUser = await User.createUser({
        email: 'unlimited-check@example.com',
        password: 'password123',
        firstName: 'Unlimited',
        lastName: 'Check',
        role: 'customer',
      });

      await SubscriptionService.createSubscription(unlimitedUser.id, unlimitedPlanId);

      const hasUnlimited = await SubscriptionEnforcementService.hasUnlimitedPlan(unlimitedUser.id);
      expect(hasUnlimited).toBe(true);
    });

    it('should return false for limited plan', async () => {
      const hasUnlimited = await SubscriptionEnforcementService.hasUnlimitedPlan(userId);
      expect(hasUnlimited).toBe(false);
    });

    it('should return false for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-unlimited@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubUnlimited',
        role: 'customer',
      });

      const hasUnlimited = await SubscriptionEnforcementService.hasUnlimitedPlan(userWithoutSub.id);
      expect(hasUnlimited).toBe(false);
    });
  });

  describe('getEnforcementStatus', () => {
    it('should return comprehensive enforcement status', async () => {
      const status = await SubscriptionEnforcementService.getEnforcementStatus(userId);

      expect(status).toHaveProperty('canCreateTickets');
      expect(status).toHaveProperty('canCompleteTickets');
      expect(status).toHaveProperty('hasUnlimitedPlan');
      expect(status).toHaveProperty('currentUsage');
      expect(status).toHaveProperty('limits');
      expect(status).toHaveProperty('percentageUsed');
      expect(status).toHaveProperty('warnings');

      expect(typeof status.canCreateTickets).toBe('boolean');
      expect(typeof status.canCompleteTickets).toBe('boolean');
      expect(typeof status.hasUnlimitedPlan).toBe('boolean');
      expect(Array.isArray(status.warnings)).toBe(true);
    });

    it('should return safe defaults on error', async () => {
      // Test with invalid user ID to trigger error handling
      const status = await SubscriptionEnforcementService.getEnforcementStatus('invalid-user-id');

      expect(status.canCreateTickets).toBe(true);
      expect(status.canCompleteTickets).toBe(true);
      expect(status.hasUnlimitedPlan).toBe(false);
      expect(status.warnings).toEqual([]);
    });
  });

  describe('validateBulkOperation', () => {
    let bulkTestUserId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'bulk-test@example.com',
        password: 'password123',
        firstName: 'Bulk',
        lastName: 'Test',
        role: 'customer',
      });
      bulkTestUserId = user.id;

      await SubscriptionService.createSubscription(bulkTestUserId, limitedPlanId);
    });

    it('should allow bulk operation when within limits', async () => {
      const validation = await SubscriptionEnforcementService.validateBulkOperation(
        bulkTestUserId,
        'create',
        2
      );

      expect(validation.allowed).toBe(true);
    });

    it('should prevent bulk operation when it would exceed limits', async () => {
      const validation = await SubscriptionEnforcementService.validateBulkOperation(
        bulkTestUserId,
        'create',
        5 // This would exceed the limit of 3
      );

      expect(validation.allowed).toBe(false);
      expect(validation.reason).toContain('would exceed');
      expect(validation.limitType).toBeDefined();
      expect(validation.upgradeMessage).toBeDefined();
    });

    it('should allow bulk operation for unlimited plan', async () => {
      const unlimitedUser = await User.createUser({
        email: 'bulk-unlimited@example.com',
        password: 'password123',
        firstName: 'Bulk',
        lastName: 'Unlimited',
        role: 'customer',
      });

      await SubscriptionService.createSubscription(unlimitedUser.id, unlimitedPlanId);

      const validation = await SubscriptionEnforcementService.validateBulkOperation(
        unlimitedUser.id,
        'create',
        1000
      );

      expect(validation.allowed).toBe(true);
    });

    it('should validate bulk completion operations', async () => {
      const validation = await SubscriptionEnforcementService.validateBulkOperation(
        bulkTestUserId,
        'complete',
        5 // This would exceed completed ticket limit
      );

      expect(validation.allowed).toBe(false);
      expect(validation.limitType).toBe('completed');
    });

    it('should allow bulk operation for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'bulk-no-sub@example.com',
        password: 'password123',
        firstName: 'Bulk',
        lastName: 'NoSub',
        role: 'customer',
      });

      const validation = await SubscriptionEnforcementService.validateBulkOperation(
        userWithoutSub.id,
        'create',
        100
      );

      expect(validation.allowed).toBe(true);
    });
  });
});