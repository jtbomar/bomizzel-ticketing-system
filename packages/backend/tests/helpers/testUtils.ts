import { JWTUtils } from '@/utils/jwt';

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
