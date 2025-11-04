import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

/**
 * Enhanced security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' ws: wss:; " +
      "frame-ancestors 'none';"
  );

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Request origin validation middleware
 */
export const validateOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const allowedOrigins = [
    process.env['FRONTEND_URL'] || 'http://localhost:3000',
    'http://localhost:3000',
    'https://localhost:3000',
  ];

  // Skip validation for same-origin requests and health checks
  if (!origin && !referer) {
    return next();
  }

  if (req.path === '/health') {
    return next();
  }

  // Check if origin is allowed
  if (origin && !allowedOrigins.includes(origin)) {
    logger.warn('Blocked request from unauthorized origin', {
      origin,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });

    return res.status(403).json({
      error: {
        code: 'FORBIDDEN_ORIGIN',
        message: 'Request from unauthorized origin',
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }

  next();
};

/**
 * Request method validation middleware
 */
export const validateMethod = (req: Request, res: Response, next: NextFunction): void => {
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `Method ${req.method} not allowed`,
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }

  next();
};

/**
 * User agent validation middleware
 */
export const validateUserAgent = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent');

  // Block requests without user agent (potential bots)
  if (!userAgent) {
    logger.warn('Blocked request without User-Agent', {
      ip: req.ip,
      path: req.path,
    });

    return res.status(400).json({
      error: {
        code: 'MISSING_USER_AGENT',
        message: 'User-Agent header is required',
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }

  // Block known malicious user agents
  const blockedPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /masscan/i,
    /nmap/i,
    /python-requests/i,
    /curl/i,
    /wget/i,
  ];

  const isBlocked = blockedPatterns.some((pattern) => pattern.test(userAgent));

  if (isBlocked) {
    logger.warn('Blocked request from suspicious User-Agent', {
      userAgent,
      ip: req.ip,
      path: req.path,
    });

    return res.status(403).json({
      error: {
        code: 'BLOCKED_USER_AGENT',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }

  next();
};

/**
 * IP whitelist/blacklist middleware
 */
export const ipFilter = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = req.ip;

  // Get IP blacklist from environment or use default
  const blacklistedIPs = (process.env['IP_BLACKLIST'] || '').split(',').filter(Boolean);

  if (blacklistedIPs.includes(clientIP)) {
    logger.warn('Blocked request from blacklisted IP', {
      ip: clientIP,
      path: req.path,
    });

    return res.status(403).json({
      error: {
        code: 'IP_BLOCKED',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
        requestId: req.id || 'unknown',
      },
    });
  }

  next();
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          timeout: timeoutMs,
        });

        res.status(408).json({
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout',
            timestamp: new Date().toISOString(),
            requestId: req.id || 'unknown',
          },
        });
      }
    }, timeoutMs);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};
