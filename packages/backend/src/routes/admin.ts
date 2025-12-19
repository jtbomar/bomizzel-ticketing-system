import { Router } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { UserService } from '@/services/UserService';
import { authenticate, authorize } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import Joi from 'joi';
import { updateUserSchema, paginationSchema, uuidSchema } from '@/utils/validation';
import { AppError } from '@/middleware/errorHandler';

const router = Router();

/**
 * EMERGENCY: Manual database reseed endpoint
 * This is a temporary endpoint to fix login issues
 */
router.post('/emergency-reseed', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY RESEED TRIGGERED');
    
    // Get the backend directory
    const backendDir = path.resolve(__dirname, '../..');
    const env = process.env.NODE_ENV || 'production';
    
    console.log('📂 Backend directory:', backendDir);
    console.log('🌍 Environment:', env);
    
    // Run migrations first
    console.log('🔄 Running migrations...');
    const migrateCommand = `cd ${backendDir} && npx knex migrate:latest --knexfile knexfile.js --env ${env}`;
    execSync(migrateCommand, { stdio: 'inherit' });
    
    // Run seeds
    console.log('🌱 Running seeds...');
    const seedCommand = `cd ${backendDir} && npx knex seed:run --knexfile knexfile.js --env ${env}`;
    execSync(seedCommand, { stdio: 'inherit' });
    
    console.log('✅ Emergency reseed completed');
    
    res.json({
      success: true,
      message: 'Database reseed completed successfully',
      credentials: {
        superAdmin: 'jeff@bomar.com / password123',
        admin: 'elena@bomar.com / password123',
        agent: 'jeremy@bomar.com / password123'
      }
    });
    
  } catch (error) {
    console.error('❌ Emergency reseed failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check database health
 */
router.get('/db-health', async (req, res) => {
  try {
    // This is a simple health check
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== ADMIN USER MANAGEMENT ROUTES =====

/**
 * GET /admin/users
 * Get all users with pagination and filtering (Admin only)
 */
router.get(
  '/users',
  authenticate,
  authorize('admin'),
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
        requestingUser: {
          id: req.user!.id,
          role: req.user!.role,
          organizationId: req.user!.organizationId,
          companyId: req.user!.companyId,
          companies: req.user!.companies,
        },
      });

      res.json(users);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/users/:userId
 * Get user by ID (Admin only)
 */
router.get(
  '/users/:userId',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await UserService.getUserById(userId, {
        id: req.user!.id,
        role: req.user!.role,
        organizationId: req.user!.organizationId,
        companyId: req.user!.companyId,
        companies: req.user!.companies,
      });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/users
 * Create new user (Admin only)
 */
router.post(
  '/users',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const userData = req.body;
      const newUser = await UserService.createUser(userData, req.user!.id);

      res.status(201).json({
        message: 'User created successfully',
        user: newUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /admin/users/:userId
 * Update user information (Admin only)
 */
router.put(
  '/users/:userId',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ userId: uuidSchema }), 'params'),
  validate(updateUserSchema),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
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
 * PUT /admin/users/:userId/role
 * Update user role (Admin only)
 */
router.put(
  '/users/:userId/role',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ userId: uuidSchema }), 'params'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      const updatedUser = await UserService.updateUser(userId, { role }, req.user!.id);

      res.json({
        message: 'User role updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /admin/users/:userId/status
 * Update user status (Admin only)
 */
router.put(
  '/users/:userId/status',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ userId: uuidSchema }), 'params'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      if (userId === req.user!.id && !isActive) {
        throw new AppError('Cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
      }

      const updatedUser = await UserService.updateUser(userId, { isActive }, req.user!.id);

      res.json({
        message: 'User status updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/users/:userId/assigned-tickets
 * Get tickets assigned to user (Admin only)
 */
router.get(
  '/users/:userId/assigned-tickets',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ userId: uuidSchema }), 'params'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      // This would need to be implemented in UserService or TicketService
      // For now, return empty array
      res.json({ tickets: [] });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /admin/users/:userId/permanent
 * Permanently delete user (Admin only)
 */
router.delete(
  '/users/:userId/permanent',
  authenticate,
  authorize('admin'),
  validate(Joi.object({ userId: uuidSchema }), 'params'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      if (userId === req.user!.id) {
        throw new AppError('Cannot delete your own account', 400, 'CANNOT_DELETE_SELF');
      }

      await UserService.deleteUser(userId, req.user!.id);

      res.json({
        message: 'User permanently deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;