import { Router } from 'express';
import { CompanyService } from '@/services/CompanyService';
import { authenticate, authorize, authorizeCompanyMember } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import {
  createCompanySchema,
  updateCompanySchema,
  addUserToCompanySchema,
  updateUserCompanyRoleSchema,
  paginationSchema,
  uuidSchema,
} from '@/utils/validation';
import { AppError } from '@/middleware/errorHandler';

const router = Router();

/**
 * POST /companies
 * Create a new company (Admin only)
 */
router.post('/', 
  authenticate, 
  authorize('admin'), 
  validate(createCompanySchema), 
  async (req, res, next) => {
    try {
      const company = await CompanyService.createCompany(req.body, req.user!.id);
      
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
router.get('/', 
  authenticate, 
  validate(paginationSchema, 'query'), 
  async (req, res, next) => {
    try {
      const { page, limit, search } = req.query as any;
      const { isActive } = req.query as any;

      const companies = await CompanyService.getCompanies({
        page,
        limit,
        search,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      });

      res.json(companies);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /companies/stats
 * Get company statistics (Admin only)
 */
router.get('/stats', 
  authenticate, 
  authorize('admin'), 
  async (req, res, next) => {
    try {
      const stats = await CompanyService.getCompanyStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /companies/search
 * Search companies by name or domain
 */
router.get('/search', 
  authenticate, 
  async (req, res, next) => {
    try {
      const { q: query, limit } = req.query as any;

      if (!query || query.length < 2) {
        throw new AppError('Search query must be at least 2 characters', 400, 'INVALID_SEARCH_QUERY');
      }

      const companies = await CompanyService.searchCompanies(query, {
        limit: limit ? parseInt(limit, 10) : 10,
      });

      res.json({ companies });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /companies/:companyId
 * Get company by ID
 */
router.get('/:companyId', 
  authenticate, 
  validate(uuidSchema, 'params'),
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
router.put('/:companyId', 
  authenticate, 
  authorize('admin'),
  validate(uuidSchema, 'params'),
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
router.delete('/:companyId', 
  authenticate, 
  authorize('admin'),
  validate(uuidSchema, 'params'),
  async (req, res, next) => {
    try {
      const { companyId } = req.params;
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
router.get('/:companyId/users', 
  authenticate, 
  validate(uuidSchema, 'params'),
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
router.post('/:companyId/users', 
  authenticate, 
  authorize('admin'),
  validate(uuidSchema, 'params'),
  validate(addUserToCompanySchema),
  async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const { userId, role } = req.body;
      
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
router.delete('/:companyId/users/:userId', 
  authenticate, 
  authorize('admin'),
  validate(uuidSchema, 'params'),
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
router.put('/:companyId/users/:userId/role', 
  authenticate, 
  authorize('admin'),
  validate(uuidSchema, 'params'),
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