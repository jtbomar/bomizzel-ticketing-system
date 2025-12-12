import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { db } from '../config/database';

// Extend Express Request to include org context
declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      orgRole?: string;
      orgName?: string;
    }
  }
}

/**
 * Extract and validate organization ID from URL
 * Ensures user has access to the organization
 *
 * Usage: router.use('/org/:orgId/tickets', authenticate, orgContext, ticketRoutes);
 */
export const orgContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract org ID from URL params
    const orgId = req.params.orgId;

    if (!orgId) {
      throw new AppError('Organization ID is required', 400, 'ORG_ID_REQUIRED');
    }

    // Verify user is authenticated
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    console.log(`🔍 Org Context - User: ${req.user.email}, Org: ${orgId}`);

    // Check if user has access to this organization
    const association = await db('user_company_associations')
      .where('user_id', req.user.id)
      .where('company_id', orgId)
      .first();

    if (!association) {
      console.log(`❌ Access denied - User ${req.user.email} not associated with org ${orgId}`);
      throw new AppError('Access denied to this organization', 403, 'ORG_ACCESS_DENIED');
    }

    // Verify organization exists and is active
    const org = await db('companies').where('id', orgId).where('is_active', true).first();

    if (!org) {
      throw new AppError('Organization not found or inactive', 404, 'ORG_NOT_FOUND');
    }

    // Add org context to request
    req.orgId = orgId;
    req.orgRole = association.role;
    req.orgName = org.name;

    console.log(`✅ Org Context - Access granted: ${org.name} (${association.role})`);

    // Update last accessed timestamp (async, don't wait)
    db('user_company_associations')
      .where('user_id', req.user.id)
      .where('company_id', orgId)
      .update({ last_accessed_at: db.fn.now() })
      .catch((err) => console.error('Failed to update last_accessed_at:', err));

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require specific org role(s)
 * Must be used after orgContext middleware
 *
 * Usage: router.delete('/ticket/:id', authenticate, orgContext, requireOrgRole(['admin', 'owner']), deleteTicket);
 */
export const requireOrgRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.orgRole) {
      throw new AppError('Organization context required', 500, 'ORG_CONTEXT_MISSING');
    }

    if (!allowedRoles.includes(req.orgRole)) {
      throw new AppError(
        `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`,
        403,
        'INSUFFICIENT_ORG_PERMISSIONS'
      );
    }

    next();
  };
};
