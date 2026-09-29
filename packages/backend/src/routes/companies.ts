import { Router } from 'express';
import { CompanyService } from '@/services/CompanyService';
import { authenticate, authorize, authorizeCompanyMember } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import Joi from 'joi';
import {
  createCompanySchema,
  updateCompanySchema,
  addUserToCompanySchema,
  updateUserCompanyRoleSchema,
  paginationSchema,
  uuidSchema,
} from '@/utils/validation';
import { AppError } from '@/middleware/errorHandler';
import { db } from '@/config/database';
import { isCompanyInTenant, isStaff, isUserInTenant, requireTenantId } from '@/utils/tenant';

const router = Router();

// Router-level so it runs before the router.param checks below.
router.use(authenticate);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every /:companyId route: staff may reach their own subscriber and its
// accounts; contacts only the account(s) they belong to. Anything else is a
// 404. Admins could read, edit, delete and join any company on the platform.
router.param('companyId', async (req, _res, next, companyId) => {
  try {
    if (!UUID.test(companyId)) throw new AppError('Invalid company ID', 400, 'VALIDATION_ERROR');
    const user = req.user!;
    const allowed = isStaff(user)
      ? await isCompanyInTenant(companyId, user.tenantId as string)
      : (user.companies || []).includes(companyId);
    if (!allowed) throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    next();
  } catch (error) {
    next(error);
  }
});

router.param('userId', async (req, _res, next, userId) => {
  try {
    if (!UUID.test(userId)) throw new AppError('Invalid user ID', 400, 'VALIDATION_ERROR');
    if (!(await isUserInTenant(userId, req.user?.tenantId as string))) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /companies
 * Create a new company (Admin only)
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(createCompanySchema),
  async (req, res, next) => {
    try {
      // A new account belongs to the creating admin's subscriber.
      const company = await CompanyService.createCompany(
        req.body,
        req.user!.id,
        requireTenantId(req.user)
      );

      res.status(201).json({
        message: 'Company created successfully',
        company,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /companies
 * Get all companies with pagination and filtering
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page, limit, search } = req.query as any;
    const { isActive } = req.query as any;

    const companies = await CompanyService.getCompanies({
      page,
      limit,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      requestingUser: {
        id: req.user!.id,
        role: req.user!.role,
        tenantId: req.user!.tenantId,
        companies: req.user!.companies,
      },
    });

    res.json(companies);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /companies/stats
 * Get company statistics (Admin only)
 */
router.get('/stats', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const stats = await CompanyService.getCompanyStats(requireTenantId(req.user));
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /companies/search
 * Search companies by name or domain
 */
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q: query, limit } = req.query as any;

    if (!query || query.length < 2) {
      throw new AppError('Search query must be at least 2 characters', 400, 'INVALID_SEARCH_QUERY');
    }

    const tenantId = requireTenantId(req.user);
    const companies = await CompanyService.searchCompanies(query, {
      limit: limit ? parseInt(limit, 10) : 10,
      ...(isStaff(req.user) ? { subscriberId: tenantId } : { ids: req.user!.companies || [] }),
    });

    res.json({ companies });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /companies/:companyId
 * Get company by ID
 */
router.get(
  '/:companyId',
  authenticate,
  validate(Joi.object({ companyId: uuidSchema }), 'params'),
  authorizeCompanyMember,
  async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const company = await CompanyService.getCompanyById(companyId);
      res.json({ company });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /companies/:companyId
 * Update company information (Admin only)
 */
router.put(
  '/:companyId',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ companyId: uuidSchema }), 'params'),
  validate(updateCompanySchema),
  async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const updatedCompany = await CompanyService.updateCompany(companyId, req.body, req.user!.id);

      res.json({
        message: 'Company updated successfully',
        company: updatedCompany,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /companies/:companyId
 * Delete company (soft delete - Admin only)
 */
router.delete(
  '/:companyId',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ companyId: uuidSchema }), 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.params;
      if (companyId === req.user!.tenantId) {
        throw new AppError(
          'A subscriber cannot delete its own company here',
          400,
          'CANNOT_DELETE_SUBSCRIBER'
        );
      }
      await CompanyService.deleteCompany(companyId, req.user!.id);

      res.json({
        message: 'Company deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /companies/:companyId/users
 * Get company users
 */
router.get(
  '/:companyId/users',
  authenticate,
  validate(Joi.object({ companyId: uuidSchema }), 'params'),
  authorizeCompanyMember,
  async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const users = await CompanyService.getCompanyUsers(companyId);
      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /companies/:companyId/users
 * Add user to company (Admin only)
 */
router.post(
  '/:companyId/users',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ companyId: uuidSchema }), 'params'),
  validate(addUserToCompanySchema),
  async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const { userId, role } = req.body;

      // Only a user already in this subscriber, or a brand-new user who
      // belongs to no company yet (a contact just registered for an account).
      // Pulling in another subscriber's user would hand them this subscriber.
      const inTenant = await isUserInTenant(userId, req.user!.tenantId as string);
      const hasAnyCompany = await db('user_company_associations')
        .where('user_id', userId)
        .first('user_id');
      if (!inTenant && hasAnyCompany) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      await CompanyService.addUserToCompany(companyId, userId, role, req.user!.id);

      res.status(201).json({
        message: 'User added to company successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /companies/:companyId/users/:userId
 * Remove user from company (Admin only)
 */
router.delete(
  '/:companyId/users/:userId',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ companyId: uuidSchema, userId: uuidSchema }), 'params'),
  async (req, res, next) => {
    try {
      const { companyId, userId } = req.params;
      await CompanyService.removeUserFromCompany(companyId, userId, req.user!.id);

      res.json({
        message: 'User removed from company successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /companies/:companyId/users/:userId/role
 * Update user's role in company (Admin only)
 */
router.put(
  '/:companyId/users/:userId/role',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ companyId: uuidSchema, userId: uuidSchema }), 'params'),
  validate(updateUserCompanyRoleSchema),
  async (req, res, next) => {
    try {
      const { companyId, userId } = req.params;
      const { role } = req.body;

      await CompanyService.updateUserCompanyRole(companyId, userId, role, req.user!.id);

      res.json({
        message: 'User role updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
