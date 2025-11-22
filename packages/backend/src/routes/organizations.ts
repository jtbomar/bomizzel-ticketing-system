import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { OrganizationService } from '../services/OrganizationService';

const router = Router();

/**
 * GET /api/orgs
 * Get all organizations the user has access to
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const organizations = await OrganizationService.getUserOrganizations(req.user!.id);

    res.json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orgs/default
 * Get user's default organization
 */
router.get('/default', authenticate, async (req, res, next) => {
  try {
    const defaultOrg = await OrganizationService.getDefaultOrganization(req.user!.id);

    if (!defaultOrg) {
      return res.status(404).json({
        success: false,
        message: 'No organizations found for user',
      });
    }

    res.json({
      success: true,
      data: defaultOrg,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orgs/:orgId/set-default
 * Set user's default organization
 */
router.post('/:orgId/set-default', authenticate, async (req, res, next) => {
  try {
    await OrganizationService.setDefaultOrganization(req.user!.id, req.params.orgId);

    res.json({
      success: true,
      message: 'Default organization updated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orgs/:orgId
 * Get organization details
 */
router.get('/:orgId', authenticate, async (req, res, next) => {
  try {
    // Verify user has access
    const hasAccess = await OrganizationService.hasAccess(req.user!.id, req.params.orgId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this organization',
      });
    }

    const org = await OrganizationService.getOrganization(req.params.orgId);

    res.json({
      success: true,
      data: org,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
