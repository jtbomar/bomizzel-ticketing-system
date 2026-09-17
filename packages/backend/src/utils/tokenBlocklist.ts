import { createHash } from 'crypto';
import { redisClient, isRedisAvailable } from '@/config/redis';
import { JWTUtils } from '@/utils/jwt';
import { logger } from '@/utils/logger';

/**
 * JWTs are stateless: once signed, they stay valid until they expire. Logout
 * was therefore purely cosmetic - it logged a line and told the client to throw
 * the token away, but a copied token kept working for the rest of its lifetime.
 *
 * This is the server-side half: revoked tokens are recorded until the moment
 * they would have expired anyway, and `authenticate` rejects anything listed.
 * Entries are keyed by a hash of the token, so the store never holds a usable
 * credential, and each one carries a TTL equal to the token's own remaining
 * life - the blocklist can never grow without bound.
 *
 * Redis is the store when it is reachable (it is shared across instances). When
 * it is not, an in-process map takes over: correct for a single instance and for
 * tests, best-effort across a cluster. Degrading is better than a logout that
 * silently does nothing, which is what we had.
 */

const KEY_PREFIX = 'revoked_token:';

// Ceiling for a token that carries no `exp`, so an entry can never outlive the
// longest token we issue.
const FALLBACK_TTL_SECONDS = 7 * 24 * 60 * 60;

// hash -> epoch ms at which the entry may be dropped
const memoryBlocklist = new Map<string, number>();

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const remainingLifetimeSeconds = (token: string): number => {
  const expiresAt = JWTUtils.getTokenExpiration(token);
  if (!expiresAt) {
    return FALLBACK_TTL_SECONDS;
  }
  const seconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
  return Math.min(Math.max(seconds, 0), FALLBACK_TTL_SECONDS);
};

const pruneMemoryBlocklist = (): void => {
  const now = Date.now();
  for (const [hash, expiresAtMs] of memoryBlocklist) {
    if (expiresAtMs <= now) {
      memoryBlocklist.delete(hash);
    }
  }
};

/**
 * Revoke a token for whatever remains of its lifetime. Tokens that have already
 * expired are ignored - they are rejected by signature verification anyway.
 */
export const revokeToken = async (token: string): Promise<void> => {
  const ttlSeconds = remainingLifetimeSeconds(token);
  if (ttlSeconds <= 0) {
    return;
  }

  const hash = hashToken(token);

  if (isRedisAvailable()) {
    try {
      await redisClient.setEx(`${KEY_PREFIX}${hash}`, ttlSeconds, '1');
      return;
    } catch (error) {
      logger.error('Failed to record revoked token in Redis, falling back to memory:', error);
    }
  }

  pruneMemoryBlocklist();
  memoryBlocklist.set(hash, Date.now() + ttlSeconds * 1000);
};

export const isTokenRevoked = async (token: string): Promise<boolean> => {
  const hash = hashToken(token);

  if (isRedisAvailable()) {
    try {
      const exists = await redisClient.exists(`${KEY_PREFIX}${hash}`);
      if (exists) {
        return true;
      }
    } catch (error) {
      // Fail closed on the Redis answer alone would lock everyone out of the
      // API whenever Redis blips, so fall through to the in-process view.
      logger.error('Failed to check revoked token in Redis, falling back to memory:', error);
    }
  }

  const expiresAtMs = memoryBlocklist.get(hash);
  if (expiresAtMs === undefined) {
    return false;
  }
  if (expiresAtMs <= Date.now()) {
    memoryBlocklist.delete(hash);
    return false;
  }
  return true;
};

/** Test seam: drops the in-process entries. Never touches Redis. */
export const clearMemoryBlocklist = (): void => {
  memoryBlocklist.clear();
};
