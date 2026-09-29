import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { logger } from '@/utils/logger';

/**
 * Platform admin = the people who run Bomizzel itself, not a customer's admin.
 *
 * Every company that signs up gets a user with role 'admin', so role alone
 * can't tell a customer's admin apart from us. A platform admin must have role
 * 'admin' AND an email on the PLATFORM_ADMIN_EMAILS list (comma separated).
 * The email is the one loaded from the database by `authenticate`, not the
 * token, and the match is exact - no "contains bomizzel" style checks.
 */
const DEFAULT_PLATFORM_ADMIN_EMAILS = 'jeffrey.t.bomar@gmail.com,jeff@bomizzel.com';

export const getPlatformAdminEmails = (): string[] =>
  (process.env.PLATFORM_ADMIN_EMAILS || DEFAULT_PLATFORM_ADMIN_EMAILS)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isPlatformAdmin = (user?: { email?: string; role?: string }): boolean =>
  !!user &&
  user.role === 'admin' &&
  !!user.email &&
  getPlatformAdminEmails().includes(user.email.trim().toLowerCase());

/**
 * Use after `authenticate`.
 */
export const requirePlatformAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    return;
  }

  if (!isPlatformAdmin(req.user)) {
    logger.warn('Platform admin route denied', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      path: req.originalUrl,
    });
    next(new AppError('Insufficient permissions', 403, 'PLATFORM_ADMIN_REQUIRED'));
    return;
  }

  next();
};

/**
 * Routes that wipe, reseed or rewrite the database are switched off in
 * production unless ALLOW_DANGEROUS_DB_ROUTES=true is set. Turn it on in
 * Railway only for as long as you need it, then turn it back off.
 * Responds 404 so the routes don't advertise themselves while disabled.
 */
export const requireDangerousRoutesEnabled = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const isProduction = (process.env.NODE_ENV || 'production') === 'production';

  if (isProduction && process.env.ALLOW_DANGEROUS_DB_ROUTES !== 'true') {
    logger.warn('Dangerous database route called while disabled', {
      userId: req.user?.id,
      email: req.user?.email,
      path: req.originalUrl,
    });
    next(new AppError('Not found', 404, 'NOT_FOUND'));
    return;
  }

  next();
};

/**
 * The full guard for reset / reseed / cleanup routes, in order:
 * signed in -> platform admin -> switched on.
 */
export const dangerousDatabaseRoute = [requirePlatformAdmin, requireDangerousRoutesEnabled];
