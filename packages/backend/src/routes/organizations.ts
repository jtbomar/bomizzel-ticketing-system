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
router.get('/default', authenticate, async (req, res, next): Promise<void> => {
  try {
    const defaultOrg = await OrganizationService.getDefaultOrganization(req.user!.id);

    if (!defaultOrg) {
      res.status(404).json({
        success: false,
        message: 'No organizations found for user',
      });
      return;
    }

    res.json({
      success: true,
      data: defaultOrg,
    });
    return;
  } catch (error) {
    next(error);
    return;
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
 * GET /api/orgs/profile
 * Get current user's organization profile (for company profile page)
 */
router.get('/profile', authenticate, async (req, res, next): Promise<void> => {
  try {
    if (!req.user?.organizationId) {
      res.status(404).json({
        success: false,
        message: 'No organization found for user',
      });
      return;
    }

    const org = await OrganizationService.getOrganization(req.user.organizationId);

    res.json({
      success: true,
      data: org,
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * PUT /api/orgs/profile
 * Update current user's organization profile
 */
router.put('/profile', authenticate, async (req, res, next): Promise<void> => {
  try {
    if (!req.user?.organizationId) {
      res.status(404).json({
        success: false,
        message: 'No organization found for user',
      });
      return;
    }

    const updatedOrg = await OrganizationService.updateOrganization(req.user.organizationId, req.body);

    res.json({
      success: true,
      data: updatedOrg,
      message: 'Organization profile updated successfully',
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * GET /api/orgs/:orgId
 * Get organization details
 */
router.get('/:orgId', authenticate, async (req, res, next): Promise<void> => {
  try {
    // Verify user has access
    const hasAccess = await OrganizationService.hasAccess(req.user!.id, req.params.orgId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this organization',
      });
      return;
    }

    const org = await OrganizationService.getOrganization(req.params.orgId);

    res.json({
      success: true,
      data: org,
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
