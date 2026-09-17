import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

/**
 * Middleware to sanitize input data to prevent XSS and injection attacks
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters.
    //
    // Express 5 exposes req.query through a getter-only accessor, so plain
    // assignment threw on every request. The catch below swallowed it, which
    // meant query strings were never sanitized - and because the throw happened
    // here, req.params was never sanitized either. Redefine the property, the
    // same way utils/validation.ts does.
    if (req.query && typeof req.query === 'object') {
      Object.defineProperty(req, 'query', {
        value: sanitizeObject(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    next();
  }
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key
      const cleanKey = sanitizeString(key);
      // Recursively sanitize the value
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

/**
 * Strip characters that are dangerous to store, not to display.
 *
 * This used to HTML-escape every incoming string: < became &lt;, "javascript:"
 * was cut out of the middle of words, anything matching on\w+= was deleted, and
 * every value was trimmed. That is output encoding applied to input, and it was
 * wrong in both directions.
 *
 * It did not prevent XSS. Escaping has to happen where a value is rendered,
 * because only there do you know whether it is landing in HTML, an attribute, a
 * URL or JSON. The frontend is React, which escapes on render, and nothing in it
 * uses dangerouslySetInnerHTML - so input escaping was guarding a door that was
 * already shut. Where HTML really is assembled from user values, in the email
 * templates, it is now escaped at that point.
 *
 * Meanwhile it corrupted data at rest. An email's htmlBody arrived as
 * &lt;p&gt;, a ticket describing "5 < 10" was stored mangled, a bug report
 * mentioning javascript: lost the word, and passwords were silently trimmed, so
 * one with a trailing space could never be typed. Stored escaped text also
 * double-escapes the moment anything renders it correctly.
 *
 * Null bytes are a genuine storage problem - Postgres rejects them in text
 * columns - so those still go.
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  return str.replace(/\0/g, '');
}

/**
 * Middleware to validate content type for POST/PUT requests
 */
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  const method = req.method.toLowerCase();

  if (['post', 'put', 'patch'].includes(method)) {
    const contentType = req.get('Content-Type');

    // A bodyless POST has no content to describe, so demanding a Content-Type
    // for it just rejects valid requests - /auth/logout being the obvious one.
    const hasBody =
      req.get('Transfer-Encoding') !== undefined ||
      parseInt(req.get('Content-Length') || '0', 10) > 0;

    if (!hasBody) {
      next();
      return;
    }

    if (!contentType) {
      res.status(400).json({
        error: {
          code: 'MISSING_CONTENT_TYPE',
          message: 'Content-Type header is required',
          timestamp: new Date().toISOString(),
          requestId: req.id || 'unknown',
        },
      });
      return;
    }

    // Allow JSON and multipart form data
    const allowedTypes = [
      'application/json',
      'multipart/form-data',
      'application/x-www-form-urlencoded',
    ];

    const isValidType = allowedTypes.some((type) => contentType.toLowerCase().startsWith(type));

    if (!isValidType) {
      res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Unsupported Content-Type',
          timestamp: new Date().toISOString(),
          requestId: req.id || 'unknown',
        },
      });
      return;
    }
  }

  next();
};

/**
 * Middleware to limit request body size
 */
export const limitRequestSize = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');

    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body too large. Maximum size is ${maxSize} bytes`,
          timestamp: new Date().toISOString(),
          requestId: req.id || 'unknown',
        },
      });
      return;
    }

    next();
  };
};
