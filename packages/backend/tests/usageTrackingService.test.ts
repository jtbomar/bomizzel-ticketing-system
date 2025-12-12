import { UsageTrackingService } from '../src/services/UsageTrackingService';
import { SubscriptionService } from '../src/services/SubscriptionService';
import { SubscriptionPlan } from '../src/models/SubscriptionPlan';
import { User } from '../src/models/User';
import { Ticket } from '../src/models/Ticket';
import { Company } from '../src/models/Company';

describe('UsageTrackingService', () => {
  let userId: string;
  let companyId: string;
  let freePlanId: string;
  let starterPlanId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    // Create test company
    const company = await Company.createCompany({
      name: 'Usage Test Company',
      domain: 'usage-test.com',
    });
    companyId = company.id;

    // Create test user
    const user = await User.createUser({
      email: 'usage-test@example.com',
      password: 'password123',
      firstName: 'Usage',
      lastName: 'Test',
      role: 'customer',
    });
    userId = user.id;

    // Create test subscription plans
    const freePlan = await SubscriptionPlan.createPlan({
      name: 'Free Tier',
      slug: 'free-tier-usage',
      price: 0,
      currency: 'USD',
      billingInterval: 'month',
      activeTicketLimit: 5,
      completedTicketLimit: 5,
      totalTicketLimit: 10,
      features: ['Basic ticketing'],
      trialDays: 0,
      sortOrder: 1,
    });
    freePlanId = freePlan.id;

    const starterPlan = await SubscriptionPlan.createPlan({
      name: 'Starter Usage',
      slug: 'starter-usage',
      price: 10,
      currency: 'USD',
      billingInterval: 'month',
      activeTicketLimit: 20,
      completedTicketLimit: 20,
      totalTicketLimit: 40,
      features: ['Advanced ticketing'],
      trialDays: 14,
      sortOrder: 2,
    });
    starterPlanId = starterPlan.id;

    // Create subscription for user
    const subscription = await SubscriptionService.createSubscription(userId, freePlanId);
    subscriptionId = subscription.id;
  });

  describe('recordTicketCreation', () => {
    it('should record ticket creation', async () => {
      const ticket = await Ticket.createTicket({
        title: 'Test Ticket for Usage',
        description: 'Test ticket description',
        priority: 'medium',
        status: 'open',
        customerId: userId,
        companyId: companyId,
        createdBy: userId,
      });

      await expect(
        UsageTrackingService.recordTicketCreation(userId, ticket.id)
      ).resolves.not.toThrow();

      // Verify usage was recorded
      const usage = await UsageTrackingService.getCurrentUsage(userId);
      expect(usage.activeTickets).toBeGreaterThan(0);
      expect(usage.totalTickets).toBeGreaterThan(0);
    });

    it('should handle recording for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-usage@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'Sub',
        role: 'customer',
      });

      await expect(
        UsageTrackingService.recordTicketCreation(userWithoutSub.id, 'test-ticket-id')
      ).resolves.not.toThrow();
    });
  });

  describe('recordTicketStatusChange', () => {
    let testTicketId: string;

    beforeAll(async () => {
      const ticket = await Ticket.createTicket({
        title: 'Status Change Test Ticket',
        description: 'Test ticket for status changes',
        priority: 'medium',
        status: 'open',
        customerId: userId,
        companyId: companyId,
        createdBy: userId,
      });
      testTicketId = ticket.id;

      // Record initial creation
      await UsageTrackingService.recordTicketCreation(userId, testTicketId);
    });

    it('should record ticket completion', async () => {
      await UsageTrackingService.recordTicketStatusChange(
        userId,
        testTicketId,
        'open',
        'completed'
      );

      const usage = await UsageTrackingService.getCurrentUsage(userId);
      expect(usage.completedTickets).toBeGreaterThan(0);
    });

    it('should record ticket archival', async () => {
      await UsageTrackingService.recordTicketStatusChange(
        userId,
        testTicketId,
        'completed',
        'archived'
      );

      const usage = await UsageTrackingService.getCurrentUsage(userId);
      expect(usage.archivedTickets).toBeGreaterThan(0);
    });

    it('should handle status change for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-status@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubStatus',
        role: 'customer',
      });

      await expect(
        UsageTrackingService.recordTicketStatusChange(
          userWithoutSub.id,
          'test-ticket-id',
          'open',
          'completed'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('getCurrentUsage', () => {
    it('should return current usage statistics', async () => {
      const usage = await UsageTrackingService.getCurrentUsage(userId);

      expect(usage).toHaveProperty('activeTickets');
      expect(usage).toHaveProperty('completedTickets');
      expect(usage).toHaveProperty('totalTickets');
      expect(usage).toHaveProperty('archivedTickets');
      expect(typeof usage.activeTickets).toBe('number');
      expect(typeof usage.completedTickets).toBe('number');
      expect(typeof usage.totalTickets).toBe('number');
      expect(typeof usage.archivedTickets).toBe('number');
    });

    it('should return zero usage for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-current@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubCurrent',
        role: 'customer',
      });

      const usage = await UsageTrackingService.getCurrentUsage(userWithoutSub.id);

      expect(usage.activeTickets).toBe(0);
      expect(usage.completedTickets).toBe(0);
      expect(usage.totalTickets).toBe(0);
      expect(usage.archivedTickets).toBe(0);
    });
  });

  describe('checkLimitStatus', () => {
    it('should return limit status with percentages', async () => {
      const limitStatus = await UsageTrackingService.checkLimitStatus(userId);

      expect(limitStatus).toHaveProperty('isAtLimit');
      expect(limitStatus).toHaveProperty('isNearLimit');
      expect(limitStatus).toHaveProperty('percentageUsed');
      expect(limitStatus).toHaveProperty('limits');
      expect(limitStatus).toHaveProperty('current');

      expect(typeof limitStatus.isAtLimit).toBe('boolean');
      expect(typeof limitStatus.isNearLimit).toBe('boolean');
      expect(limitStatus.percentageUsed).toHaveProperty('active');
      expect(limitStatus.percentageUsed).toHaveProperty('completed');
      expect(limitStatus.percentageUsed).toHaveProperty('total');
    });

    it('should throw error for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-limit@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubLimit',
        role: 'customer',
      });

      await expect(UsageTrackingService.checkLimitStatus(userWithoutSub.id)).rejects.toThrow(
        'No active subscription found'
      );
    });
  });

  describe('canCreateTicket', () => {
    let limitTestUserId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'limit-test@example.com',
        password: 'password123',
        firstName: 'Limit',
        lastName: 'Test',
        role: 'customer',
      });
      limitTestUserId = user.id;

      // Create subscription with very low limits for testing
      await SubscriptionService.createSubscription(limitTestUserId, freePlanId);
    });

    it('should allow ticket creation when under limits', async () => {
      const canCreate = await UsageTrackingService.canCreateTicket(limitTestUserId);

      expect(canCreate.canCreate).toBe(true);
      expect(canCreate.usage).toBeDefined();
      expect(canCreate.limits).toBeDefined();
    });

    it('should prevent ticket creation when at active limit', async () => {
      // Create tickets up to the limit
      for (let i = 0; i < 5; i++) {
        const ticket = await Ticket.createTicket({
          title: `Limit Test Ticket ${i}`,
          description: 'Test ticket for limits',
          priority: 'medium',
          status: 'open',
          customerId: limitTestUserId,
          companyId: companyId,
          createdBy: limitTestUserId,
        });
        await UsageTrackingService.recordTicketCreation(limitTestUserId, ticket.id);
      }

      const canCreate = await UsageTrackingService.canCreateTicket(limitTestUserId);

      expect(canCreate.canCreate).toBe(false);
      expect(canCreate.reason).toContain('Active ticket limit reached');
      expect(canCreate.limitType).toBe('active');
    });

    it('should allow creation for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-create@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubCreate',
        role: 'customer',
      });

      const canCreate = await UsageTrackingService.canCreateTicket(userWithoutSub.id);
      expect(canCreate.canCreate).toBe(true);
    });
  });

  describe('canCompleteTicket', () => {
    let completeTestUserId: string;

    beforeAll(async () => {
      const user = await User.createUser({
        email: 'complete-test@example.com',
        password: 'password123',
        firstName: 'Complete',
        lastName: 'Test',
        role: 'customer',
      });
      completeTestUserId = user.id;

      await SubscriptionService.createSubscription(completeTestUserId, freePlanId);
    });

    it('should allow ticket completion when under limits', async () => {
      const canComplete = await UsageTrackingService.canCompleteTicket(completeTestUserId);

      expect(canComplete.canComplete).toBe(true);
      expect(canComplete.usage).toBeDefined();
      expect(canComplete.limits).toBeDefined();
    });

    it('should prevent completion when at completed limit', async () => {
      // Create and complete tickets up to the limit
      for (let i = 0; i < 5; i++) {
        const ticket = await Ticket.createTicket({
          title: `Complete Test Ticket ${i}`,
          description: 'Test ticket for completion limits',
          priority: 'medium',
          status: 'open',
          customerId: completeTestUserId,
          companyId: companyId,
          createdBy: completeTestUserId,
        });
        await UsageTrackingService.recordTicketCreation(completeTestUserId, ticket.id);
        await UsageTrackingService.recordTicketStatusChange(
          completeTestUserId,
          ticket.id,
          'open',
          'completed'
        );
      }

      const canComplete = await UsageTrackingService.canCompleteTicket(completeTestUserId);

      expect(canComplete.canComplete).toBe(false);
      expect(canComplete.reason).toContain('Completed ticket limit reached');
    });
  });

  describe('getUsagePercentages', () => {
    it('should return usage percentages', async () => {
      const percentages = await UsageTrackingService.getUsagePercentages(userId);

      expect(percentages).toHaveProperty('active');
      expect(percentages).toHaveProperty('completed');
      expect(percentages).toHaveProperty('total');
      expect(typeof percentages.active).toBe('number');
      expect(typeof percentages.completed).toBe('number');
      expect(typeof percentages.total).toBe('number');
    });
  });

  describe('getUsersApproachingLimits', () => {
    it('should return users approaching limits', async () => {
      const usersApproaching = await UsageTrackingService.getUsersApproachingLimits(50);

      expect(Array.isArray(usersApproaching)).toBe(true);

      if (usersApproaching.length > 0) {
        const user = usersApproaching[0];
        expect(user).toHaveProperty('userId');
        expect(user).toHaveProperty('subscriptionId');
        expect(user).toHaveProperty('usage');
        expect(user).toHaveProperty('limits');
        expect(user).toHaveProperty('percentageUsed');
      }
    });
  });

  describe('getTicketHistory', () => {
    let historyTicketId: string;

    beforeAll(async () => {
      const ticket = await Ticket.createTicket({
        title: 'History Test Ticket',
        description: 'Test ticket for history',
        priority: 'medium',
        status: 'open',
        customerId: userId,
        companyId: companyId,
        createdBy: userId,
      });
      historyTicketId = ticket.id;

      // Create some history
      await UsageTrackingService.recordTicketCreation(userId, historyTicketId);
      await UsageTrackingService.recordTicketStatusChange(
        userId,
        historyTicketId,
        'open',
        'in_progress'
      );
      await UsageTrackingService.recordTicketStatusChange(
        userId,
        historyTicketId,
        'in_progress',
        'completed'
      );
    });

    it('should return ticket history', async () => {
      const history = await UsageTrackingService.getTicketHistory(historyTicketId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      if (history.length > 0) {
        const record = history[0];
        expect(record).toHaveProperty('ticketId');
        expect(record).toHaveProperty('action');
        expect(record).toHaveProperty('timestamp');
        expect(record.ticketId).toBe(historyTicketId);
      }
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity for user', async () => {
      const activity = await UsageTrackingService.getRecentActivity(userId, 10);

      expect(Array.isArray(activity)).toBe(true);

      if (activity.length > 0) {
        const record = activity[0];
        expect(record).toHaveProperty('ticketId');
        expect(record).toHaveProperty('action');
        expect(record).toHaveProperty('timestamp');
      }
    });

    it('should return empty array for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-activity@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubActivity',
        role: 'customer',
      });

      const activity = await UsageTrackingService.getRecentActivity(userWithoutSub.id);
      expect(activity).toEqual([]);
    });
  });

  describe('recordTicketArchival', () => {
    it('should record ticket archival', async () => {
      const ticket = await Ticket.createTicket({
        title: 'Archival Test Ticket',
        description: 'Test ticket for archival',
        priority: 'medium',
        status: 'completed',
        customerId: userId,
        companyId: companyId,
        createdBy: userId,
      });

      await expect(
        UsageTrackingService.recordTicketArchival(userId, ticket.id)
      ).resolves.not.toThrow();
    });
  });

  describe('recordTicketRestoration', () => {
    it('should record ticket restoration', async () => {
      const ticket = await Ticket.createTicket({
        title: 'Restoration Test Ticket',
        description: 'Test ticket for restoration',
        priority: 'medium',
        status: 'archived',
        customerId: userId,
        companyId: companyId,
        createdBy: userId,
      });

      await expect(
        UsageTrackingService.recordTicketRestoration(userId, ticket.id)
      ).resolves.not.toThrow();
    });
  });

  describe('updateUsageSummary', () => {
    it('should update usage summary', async () => {
      await expect(UsageTrackingService.updateUsageSummary(subscriptionId)).resolves.not.toThrow();
    });
  });

  describe('getUsageForPeriod', () => {
    it('should return usage for specific period', async () => {
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usage = await UsageTrackingService.getUsageForPeriod(userId, currentPeriod);

      expect(usage).toHaveProperty('activeTickets');
      expect(usage).toHaveProperty('completedTickets');
      expect(usage).toHaveProperty('totalTickets');
      expect(usage).toHaveProperty('archivedTickets');
    });

    it('should return zero usage for user without subscription', async () => {
      const userWithoutSub = await User.createUser({
        email: 'no-sub-period@example.com',
        password: 'password123',
        firstName: 'No',
        lastName: 'SubPeriod',
        role: 'customer',
      });

      const currentPeriod = new Date().toISOString().slice(0, 7);
      const usage = await UsageTrackingService.getUsageForPeriod(userWithoutSub.id, currentPeriod);

      expect(usage.activeTickets).toBe(0);
      expect(usage.completedTickets).toBe(0);
      expect(usage.totalTickets).toBe(0);
      expect(usage.archivedTickets).toBe(0);
    });
  });
});
