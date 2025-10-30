import { Router } from 'express';
import { UserService } from '@/services/UserService';
import { authenticate, authorize, authorizeOwnerOrAdmin } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import {
  updateUserSchema,
  paginationSchema,
  uuidSchema,
} from '@/utils/validation';
import { AppError } from '@/middleware/errorHandler';

const router = Router();

/**
 * GET /users
 * Get all users with pagination and filtering (Admin only)
 */
router.get('/', 
  authenticate, 
  authorize('admin'), 
  validate(paginationSchema, 'query'), 
  async (req, res, next) => {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query as any;
      const { role, isActive } = req.query as any;

      const users = await UserService.getUsers({
        page,
        limit,
        search,
        role,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      });

      res.json(users);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/stats
 * Get user statistics (Admin only)
 */
router.get('/stats', 
  authenticate, 
  authorize('admin'), 
  async (req, res, next) => {
    try {
      const stats = await UserService.getUserStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/search
 * Search users by name or email
 */
router.get('/search', 
  authenticate, 
  async (req, res, next) => {
    try {
      const { q: query, limit, role } = req.query as any;

      if (!query || query.length < 2) {
        throw new AppError('Search query must be at least 2 characters', 400, 'INVALID_SEARCH_QUERY');
      }

      const users = await UserService.searchUsers(query, {
        limit: limit ? parseInt(limit, 10) : 10,
        role,
      });

      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
);/**

 * GET /users/:userId
 * Get user by ID (Admin or own profile)
 */
router.get('/:userId', 
  authenticate, 
  validate(uuidSchema, 'params'), 
  authorizeOwnerOrAdmin('userId'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await UserService.getUserById(userId);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /users/:userId
 * Update user information (Admin or own profile)
 */
router.put('/:userId', 
  authenticate, 
  validate(uuidSchema, 'params'),
  validate(updateUserSchema),
  authorizeOwnerOrAdmin('userId'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      // Only admins can change role and isActive status
      if ((req.body.role || req.body.isActive !== undefined) && req.user!.role !== 'admin') {
        throw new AppError('Only administrators can change user role or status', 403, 'ADMIN_REQUIRED');
      }

      const updatedUser = await UserService.updateUser(userId, req.body, req.user!.id);
      
      res.json({
        message: 'User updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /users/:userId/deactivate
 * Deactivate user account (Admin only)
 */
router.post('/:userId/deactivate', 
  authenticate, 
  authorize('admin'),
  validate(uuidSchema, 'params'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      if (userId === req.user!.id) {
        throw new AppError('Cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
      }

      await UserService.deactivateUser(userId, req.user!.id);
      
      res.json({
        message: 'User deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /users/:userId/reactivate
 * Reactivate user account (Admin only)
 */
router.post('/:userId/reactivate', 
  authenticate, 
  authorize('admin'),
  validate(uuidSchema, 'params'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      await UserService.reactivateUser(userId, req.user!.id);
      
      res.json({
        message: 'User reactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:userId/companies
 * Get user's company associations
 */
router.get('/:userId/companies', 
  authenticate, 
  validate(uuidSchema, 'params'),
  authorizeOwnerOrAdmin('userId'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const companies = await UserService.getUserCompanies(userId);
      res.json({ companies });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /users/:userId/teams
 * Get user's team memberships
 */
router.get('/:userId/teams', 
  authenticate, 
  validate(uuidSchema, 'params'),
  authorizeOwnerOrAdmin('userId'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const teams = await UserService.getUserTeams(userId);
      res.json({ teams });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /users/:userId/preferences
 * Update user preferences
 */
router.put('/:userId/preferences', 
  authenticate, 
  validate(uuidSchema, 'params'),
  authorizeOwnerOrAdmin('userId'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const updatedUser = await UserService.updateUserPreferences(userId, req.body);
      
      res.json({
        message: 'Preferences updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;