import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = uuidv4();

  // Log the error
  logger.error('Request error', {
    requestId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle different error types
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: Record<string, any> | undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    // src/utils/errors.ts declares a SEPARATE AppError hierarchy
    // (ValidationError, NotFoundError, ForbiddenError, UnauthorizedError,
    // ConflictError). Those are not instances of the AppError above, and the
    // subclasses never set `name`, so all 101 throw sites across 8 route and
    // service files fell through to a generic 500 - a missing ticket answered
    // 500 instead of 404, a bad upload 500 instead of 400.
    //
    // Match on the carried status code instead of the class identity, and
    // derive the error code from the constructor name
    // (ValidationError -> VALIDATION_ERROR).
    statusCode = (error as unknown as { statusCode: number }).statusCode;
    message = error.message;
    const ctorName = error.constructor?.name;
    code = ctorName ? ctorName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase() : 'ERROR';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  }

  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  res.status(statusCode).json(errorResponse);
};
