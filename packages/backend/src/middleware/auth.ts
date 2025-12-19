import { Request, Response, NextFunction } from 'express';
import { JWTUtils, JWTPayload } from '@/utils/jwt';
import { User } from '@/models/User';
import { AppError } from './errorHandler';
import { logger } from '@/utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        isActive: boolean;
        organizationId?: string;
        companyId?: string;
        companies?: string[];
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JWTUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new AppError('Authentication token required', 401, 'MISSING_TOKEN');
    }

    const payload = JWTUtils.verifyAccessToken(token);

    if (!payload) {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }

    // Verify user still exists and is active
    const user = await User.findById(payload.userId);

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.is_active) {
      throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }

    // Get user's organization for tenant isolation
    const organizationId = user.organization_id;
    const userCompanies = await User.getUserCompanies(user.id);
    const companyIds = userCompanies.map(uc => uc.companyId);

    // Attach user info to request with organization and company context
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      organizationId: organizationId, // Organization for service provider employees
      companyId: companyIds[0], // Primary company for customers
      companies: companyIds, // All associated companies for customers
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Authentication error:', error);
      next(new AppError('Authentication failed', 401, 'AUTH_FAILED'));
    }
  }
};

/**
 * Middleware to authorize requests based on user roles
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS', {
          requiredRoles: allowedRoles,
          userRole: req.user.role,
        })
      );
      return;
    }

    next();
  };
};

/**
 * Middleware for optional authentication (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JWTUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    const payload = JWTUtils.verifyAccessToken(token);

    if (payload) {
      const user = await User.findById(payload.userId);

      if (user && user.is_active) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on errors, just continue without user
    logger.debug('Optional auth error (continuing without user):', error);
    next();
  }
};

/**
 * Middleware to check if user owns a resource or has admin privileges
 */
export const authorizeOwnerOrAdmin = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      return;
    }

    const resourceUserId = req.params[userIdParam];

    // Allow if user is admin or owns the resource
    if (req.user.role === 'admin' || req.user.id === resourceUserId) {
      next();
      return;
    }

    next(new AppError('Access denied', 403, 'ACCESS_DENIED'));
  };
};

/**
 * Middleware to check if user belongs to a company
 */
export const authorizeCompanyMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const companyId = req.params.companyId || req.body.companyId;

    if (!companyId) {
      throw new AppError('Company ID required', 400, 'COMPANY_ID_REQUIRED');
    }

    // Admin users can access any company
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if user is associated with the company
    const { Company } = await import('@/models/Company');
    const isCompanyMember = await Company.isUserInCompany(req.user.id, companyId);

    if (!isCompanyMember) {
      throw new AppError('Access denied to company resources', 403, 'COMPANY_ACCESS_DENIED');
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Company authorization error:', error);
      next(new AppError('Authorization failed', 500, 'AUTHORIZATION_FAILED'));
    }
  }
};

/**
 * Middleware to check if user belongs to a team
 */
export const authorizeTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const teamId = req.params.teamId || req.body.teamId;

    if (!teamId) {
      throw new AppError('Team ID required', 400, 'TEAM_ID_REQUIRED');
    }

    // Admin users can access any team
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if user is a member of the team
    const { Team } = await import('@/models/Team');
    const isTeamMember = await Team.isUserInTeam(req.user.id, teamId);

    if (!isTeamMember) {
      throw new AppError('Access denied to team resources', 403, 'TEAM_ACCESS_DENIED');
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Team authorization error:', error);
      next(new AppError('Authorization failed', 500, 'AUTHORIZATION_FAILED'));
    }
  }
};

/**
 * Middleware to check if user is a team lead or admin
 */
export const authorizeTeamLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const teamId = req.params.teamId || req.body.teamId;

    if (!teamId) {
      throw new AppError('Team ID required', 400, 'TEAM_ID_REQUIRED');
    }

    // Admin users can access any team
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if user is a team lead
    const { Team } = await import('@/models/Team');
    const isTeamLead = await Team.isTeamLead(req.user.id, teamId);

    if (!isTeamLead) {
      throw new AppError('Team lead privileges required', 403, 'TEAM_LEAD_REQUIRED');
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Team lead authorization error:', error);
      next(new AppError('Authorization failed', 500, 'AUTHORIZATION_FAILED'));
    }
  }
};
