import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
let isRedisConnected = false;

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
  isRedisConnected = false;
});

redisClient.on('connect', () => {
  logger.info('✅ Redis connection established successfully');
  isRedisConnected = true;
});

redisClient.on('disconnect', () => {
  logger.info('Redis connection disconnected');
  isRedisConnected = false;
});

export const connectRedis = async (): Promise<void> => {
  try {
    // Only connect if REDIS_URL is provided
    if (!process.env['REDIS_URL']) {
      logger.warn('⚠️ REDIS_URL not configured - Redis features disabled');
      return;
    }

    await redisClient.connect();
    isRedisConnected = true;
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    logger.warn('⚠️ Continuing without Redis - caching and rate limiting will be disabled');
    isRedisConnected = false;
    // Don't throw - allow app to continue without Redis
  }
};

export const closeRedisConnection = async (): Promise<void> => {
  try {
    if (isRedisConnected) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
};

export const isRedisAvailable = (): boolean => {
  return isRedisConnected;
};
