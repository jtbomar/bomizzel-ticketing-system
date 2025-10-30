import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

export class CacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly DEFAULT_PREFIX = 'bomizzel';

  /**
   * Get a value from cache
   */
  static async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const { prefix = this.DEFAULT_PREFIX } = options;
      const fullKey = `${prefix}:${key}`;
      
      const value = await redisClient.get(fullKey);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  static async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const { ttl = this.DEFAULT_TTL, prefix = this.DEFAULT_PREFIX } = options;
      const fullKey = `${prefix}:${key}`;
      
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await redisClient.setEx(fullKey, ttl, serializedValue);
      } else {
        await redisClient.set(fullKey, serializedValue);
      }
      
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  static async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const { prefix = this.DEFAULT_PREFIX } = options;
      const fullKey = `${prefix}:${key}`;
      
      await redisClient.del(fullKey);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  static async delPattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    try {
      const { prefix = this.DEFAULT_PREFIX } = options;
      const fullPattern = `${prefix}:${pattern}`;
      
      const keys = await redisClient.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await redisClient.del(keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   */
  static async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const { prefix = this.DEFAULT_PREFIX } = options;
      const fullKey = `${prefix}:${key}`;
      
      const exists = await redisClient.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  /**
   * Get or set a value (cache-aside pattern)
   */
  static async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key, options);
      
      if (cached !== null) {
        return cached;
      }

      // If not in cache, fetch the data
      const data = await fetchFunction();
      
      if (data !== null && data !== undefined) {
        // Store in cache for next time
        await this.set(key, data, options);
      }

      return data;
    } catch (error) {
      logger.error('Cache getOrSet error:', { key, error });
      // If cache fails, still try to fetch the data
      try {
        return await fetchFunction();
      } catch (fetchError) {
        logger.error('Fetch function error:', { key, error: fetchError });
        return null;
      }
    }
  }

  /**
   * Increment a counter in cache
   */
  static async incr(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const { ttl = this.DEFAULT_TTL, prefix = this.DEFAULT_PREFIX } = options;
      const fullKey = `${prefix}:${key}`;
      
      const value = await redisClient.incr(fullKey);
      
      // Set TTL if this is the first increment
      if (value === 1 && ttl > 0) {
        await redisClient.expire(fullKey, ttl);
      }
      
      return value;
    } catch (error) {
      logger.error('Cache increment error:', { key, error });
      return 0;
    }
  }

  /**
   * Cache middleware for Express routes
   */
  static middleware(keyGenerator: (req: any) => string, options: CacheOptions = {}) {
    return async (req: any, res: any, next: any) => {
      try {
        const cacheKey = keyGenerator(req);
        const cached = await this.get(cacheKey, options);
        
        if (cached !== null) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(cached);
        }

        // Store original json method
        const originalJson = res.json;
        
        // Override json method to cache the response
        res.json = function(data: any) {
          res.setHeader('X-Cache', 'MISS');
          
          // Cache the response data
          CacheService.set(cacheKey, data, options).catch(error => {
            logger.error('Failed to cache response:', { cacheKey, error });
          });
          
          // Call original json method
          return originalJson.call(this, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }
}

// Predefined cache configurations
export const CacheConfigs = {
  // Short-term cache for frequently accessed data
  SHORT: { ttl: 60, prefix: 'bomizzel:short' }, // 1 minute
  
  // Medium-term cache for moderately changing data
  MEDIUM: { ttl: 300, prefix: 'bomizzel:medium' }, // 5 minutes
  
  // Long-term cache for rarely changing data
  LONG: { ttl: 3600, prefix: 'bomizzel:long' }, // 1 hour
  
  // User-specific cache
  USER: { ttl: 900, prefix: 'bomizzel:user' }, // 15 minutes
  
  // Metrics cache
  METRICS: { ttl: 60, prefix: 'bomizzel:metrics' }, // 1 minute
  
  // Search results cache
  SEARCH: { ttl: 300, prefix: 'bomizzel:search' }, // 5 minutes
};

// Cache key generators
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userCompanies: (userId: string) => `user:${userId}:companies`,
  userTeams: (userId: string) => `user:${userId}:teams`,
  ticket: (ticketId: string) => `ticket:${ticketId}`,
  ticketNotes: (ticketId: string) => `ticket:${ticketId}:notes`,
  ticketAttachments: (ticketId: string) => `ticket:${ticketId}:attachments`,
  queueTickets: (queueId: string, page: number, limit: number) => 
    `queue:${queueId}:tickets:${page}:${limit}`,
  teamCustomFields: (teamId: string) => `team:${teamId}:custom-fields`,
  teamStatuses: (teamId: string) => `team:${teamId}:statuses`,
  dashboardMetrics: (userId: string) => `dashboard:${userId}:metrics`,
  searchResults: (query: string, filters: string) => 
    `search:${Buffer.from(query + filters).toString('base64')}`,
};