import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Mock database and external services for unit tests
const mockDb = {
  migrate: {
    latest: jest.fn().mockResolvedValue(undefined),
  },
  destroy: jest.fn().mockResolvedValue(undefined),
  truncate: jest.fn().mockResolvedValue(undefined),
};

// Mock the database module
jest.mock('../src/config/database', () => ({
  db: mockDb,
}));

// Mock Redis
jest.mock('../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  closeRedisConnection: jest.fn().mockResolvedValue(undefined),
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  },
}));

// Mock email service
jest.mock('../src/config/email', () => ({
  initializeEmailService: jest.fn().mockResolvedValue(undefined),
  emailTransporter: {
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 1024 }),
  },
}));

// Setup test environment
beforeAll(async () => {
  // Test environment is ready
  console.log('Test environment initialized');
});

afterAll(async () => {
  // Clean up test environment
  console.log('Test environment cleaned up');
});

// Clean up between tests
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
});
