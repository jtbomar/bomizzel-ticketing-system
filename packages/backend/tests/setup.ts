import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// NOTE: the database is deliberately NOT mocked.
//
// This file used to replace src/config/database with { db: mockDb }, where
// mockDb was a plain object exposing only migrate/destroy/truncate. Nearly
// every suite here is an integration test that calls real models
// (User.createUser, db('tickets')...), so `db` had to be callable - it was not,
// and `db('users')` threw "db is not a function". That is why the only suites
// that ever passed were the three that touch no database at all.
//
// CI provisions Postgres and runs migrations before the test steps, so the
// suites now talk to the real test database configured in .env.test. Running
// them locally requires a Postgres reachable at DB_HOST/DB_PORT.
//
// Redis, email and file IO stay mocked: they are external side effects that
// tests should not depend on.

// Mirror every export of src/config/redis. isRedisAvailable was missing, so
// rateLimiter threw "isRedisAvailable is not a function" on every request it
// guarded - it swallowed the error, but it flooded the logs and meant rate
// limiting was never actually exercised.
jest.mock('../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  closeRedisConnection: jest.fn().mockResolvedValue(undefined),
  isRedisAvailable: jest.fn().mockReturnValue(false),
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  },
}));

jest.mock('../src/config/email', () => ({
  initializeEmailService: jest.fn().mockResolvedValue(undefined),
  emailTransporter: {
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  },
}));

afterAll(async () => {
  // Release the pg pool so Jest can exit cleanly.
  const { db } = require('../src/config/database');
  if (db && typeof db.destroy === 'function') {
    await db.destroy();
  }
});

afterEach(() => {
  jest.clearAllMocks();
});
