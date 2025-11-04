import { Request, Response, NextFunction } from 'express';
import { redisClient } from '@/config/redis';
import { AppError } from './errorHandler';
import { logger } from '@/utils/logger';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const window = Math.floor(Date.now() / windowMs);
      const redisKey = `${key}:${window}`;

      // Get current count
      const current = await redisClient.get(redisKey);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        throw new AppError(
          'Too many requests, please try again later',
          429,
          'RATE_LIMIT_EXCEEDED',
          {
            limit: maxRequests,
            windowMs,
            retryAfter: windowMs - (Date.now() % windowMs),
          }
        );
      }

      // Increment counter
      const pipeline = redisClient.multi();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
      await pipeline.exec();

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count - 1));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

      // Handle response to potentially skip counting
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send;
        res.send = function (body) {
          const statusCode = res.statusCode;
          const shouldSkip =
            (skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400);

          if (shouldSkip) {
            // Decrement the counter
            redisClient
              .decr(redisKey)
              .catch((err) => logger.error('Failed to decrement rate limit counter:', err));
          }

          return originalSend.call(this, body);
        };
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        logger.error('Rate limiter error:', error);
        // If Redis is down, allow the request to proceed
        next();
      }
    }
  };
};

// Predefined rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyGenerator: (req) => `auth:${req.ip}:${req.body.email || 'unknown'}`,
  skipSuccessfulRequests: true, // Only count failed attempts
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  keyGenerator: (req) => req.ip || 'unknown',
});

export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  keyGenerator: (req) => req.ip || 'unknown',
});

export const fileUploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 file uploads per minute
  keyGenerator: (req) => `upload:${req.ip}:${req.user?.id || 'anonymous'}`,
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute per user
  keyGenerator: (req) => `api:${req.user?.id || req.ip}`,
});

export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 search requests per minute
  keyGenerator: (req) => `search:${req.user?.id || req.ip}`,
});
