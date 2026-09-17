import { JWTUtils } from '@/utils/jwt';
import { User } from '@/models/User';
import { Company } from '@/models/Company';
import { Team } from '@/models/Team';
import { Queue } from '@/models/Queue';
import { Ticket } from '@/models/Ticket';

export const createTestToken = (userId: string, email?: string, role?: string): string => {
  return JWTUtils.generateAccessToken({
    userId,
    email: email || `test-${userId}@example.com`,
    role: role || 'employee',
  });
};

export const createTestTokenPair = (userId: string, email?: string, role?: string) => {
  return JWTUtils.generateTokenPair({
    userId,
    email: email || `test-${userId}@example.com`,
    role: role || 'employee',
  });
};

export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'employee' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockAdmin = {
  id: 'test-admin-id',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockCustomer = {
  id: 'test-customer-id',
  email: 'customer@example.com',
  firstName: 'Customer',
  lastName: 'User',
  role: 'customer' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockCompany = {
  id: 'test-company-id',
  name: 'Test Company',
  domain: 'testcompany.com',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockTeam = {
  id: 'test-team-id',
  name: 'Test Team',
  companyId: 'test-company-id',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockQueue = {
  id: 'test-queue-id',
  name: 'Test Queue',
  teamId: 'test-team-id',
  type: 'employee' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const createMockTicketData = (overrides: any = {}) => ({
  title: 'Test Ticket',
  description: 'Test Description',
  companyId: mockCompany.id,
  teamId: mockTeam.id,
  customFieldValues: {},
  ...overrides,
});

// ---------------------------------------------------------------------------
// Database fixtures
//
// Ticket.createTicket requires submitterId, companyId, queueId and teamId - all
// NOT NULL columns with foreign keys. Several suites were calling it with an
// invented shape ({ priority: 'medium', customerId, createdBy }) and no queue or
// team, which could never have worked. This builds a consistent, valid context.
// ---------------------------------------------------------------------------

export interface TicketContext {
  userId: string;
  companyId: string;
  teamId: string;
  queueId: string;
}

/**
 * Create a company, team, queue and customer wired together correctly.
 * `prefix` keeps names and emails unique across suites sharing a database.
 */
export const createTicketContext = async (prefix: string): Promise<TicketContext> => {
  const company = await Company.createCompany({
    name: `${prefix} Company`,
    domain: `${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.test`,
  });

  const team = await Team.createTeam({
    name: `${prefix} Team`,
    description: `${prefix} test team`,
  });

  const queue = await Queue.createQueue({
    name: `${prefix} Queue`,
    description: `${prefix} test queue`,
    type: 'unassigned',
    teamId: team.id,
  });

  const user = await User.createUser({
    email: `${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.com`,
    password: 'password123',
    firstName: prefix,
    lastName: 'Tester',
    role: 'customer',
  });

  return { userId: user.id, companyId: company.id, teamId: team.id, queueId: queue.id };
};

/** Create a ticket in the given context, with only the fields the model accepts. */
export const createContextTicket = async (
  ctx: TicketContext,
  overrides: { title?: string; description?: string; customFieldValues?: Record<string, any> } = {}
) =>
  Ticket.createTicket({
    title: overrides.title ?? 'Test Ticket',
    description: overrides.description ?? 'Test ticket description',
    submitterId: ctx.userId,
    companyId: ctx.companyId,
    queueId: ctx.queueId,
    teamId: ctx.teamId,
    customFieldValues: overrides.customFieldValues ?? {},
  });
