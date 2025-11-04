import { Router, Request, Response } from 'express';
import { UserRoleService } from '@/services/UserRoleService';
import { authenticate } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/requireRole';
import { validateRequest } from '@/utils/validation';

const router = Router();

/**
 * GET /admin/users
 * Get all users with pagination and filtering (admin only)
 */
router.get(
  '/users',
  authenticate,
  requireAdmin,
  validateRequest({
    query: {
      page: { type: 'number', required: false, min: 1 },
      limit: { type: 'number', required: false, min: 1, max: 100 },
      role: {
        type: 'string',
        required: false,
        enum: ['customer', 'employee', 'team_lead', 'admin'],
      },
      search: { type: 'string', required: false },
      isActive: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { page, limit, role, search, isActive } = req.query;

      const users = await UserRoleService.getUsers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        role: role as string,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
      });

      res.json(users);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_USERS_FAILED',
          message: 'Failed to retrieve users',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * GET /admin/users/:userId
 * Get user details with teams and permissions (admin only)
 */
router.get(
  '/users/:userId',
  authenticate,
  requireAdmin,
  validateRequest({
    params: {
      userId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const user = await UserRoleService.getUserDetails(userId);

      res.json({ user });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_USER_DETAILS_FAILED',
          message: 'Failed to retrieve user details',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /admin/users/:userId/role
 * Update user role (admin only)
 */
router.put(
  '/users/:userId/role',
  authenticate,
  requireAdmin,
  validateRequest({
    params: {
      userId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      role: {
        type: 'string',
        required: true,
        enum: ['customer', 'employee', 'team_lead', 'admin'],
      },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const updatedById = req.user?.id;

      if (!updatedById) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const user = await UserRoleService.updateUserRole(userId, role, updatedById);

      res.json({ user });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'UPDATE_USER_ROLE_FAILED',
          message: 'Failed to update user role',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /admin/users/:userId/status
 * Update user active status (admin only)
 */
router.put(
  '/users/:userId/status',
  authenticate,
  requireAdmin,
  validateRequest({
    params: {
      userId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      isActive: { type: 'boolean', required: true },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      const updatedById = req.user?.id;

      if (!updatedById) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const user = await UserRoleService.updateUserStatus(userId, isActive, updatedById);

      res.json({ user });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'UPDATE_USER_STATUS_FAILED',
          message: 'Failed to update user status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * POST /admin/users
 * Create a new user (admin only)
 */
router.post(
  '/users',
  authenticate,
  requireAdmin,
  validateRequest({
    body: {
      firstName: { type: 'string', required: true, minLength: 1 },
      lastName: { type: 'string', required: true, minLength: 1 },
      email: { type: 'string', required: true, format: 'email' },
      password: { type: 'string', required: true, minLength: 6 },
      role: {
        type: 'string',
        required: true,
        enum: ['customer', 'employee', 'team_lead', 'admin'],
      },
      teamId: { type: 'string', required: false, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, email, password, role, teamId } = req.body;
      const createdById = req.user?.id;

      if (!createdById) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const user = await UserRoleService.createUser({
        firstName,
        lastName,
        email,
        password,
        role,
        teamId,
        createdById,
      });

      res.status(201).json({ user });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'CREATE_USER_FAILED',
          message: 'Failed to create user',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /admin/users/:userId
 * Update user details (admin only)
 */
router.put(
  '/users/:userId',
  authenticate,
  requireAdmin,
  validateRequest({
    params: {
      userId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      firstName: { type: 'string', required: false, minLength: 1 },
      lastName: { type: 'string', required: false, minLength: 1 },
      email: { type: 'string', required: false, format: 'email' },
      role: {
        type: 'string',
        required: false,
        enum: ['customer', 'employee', 'team_lead', 'admin'],
      },
      isActive: { type: 'boolean', required: false },
      teamId: { type: 'string', required: false, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const updateData = req.body;
      const updatedById = req.user?.id;

      if (!updatedById) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const user = await UserRoleService.updateUser(userId, updateData, updatedById);

      res.json({ user });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'UPDATE_USER_FAILED',
          message: 'Failed to update user',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * GET /admin/stats/roles
 * Get role statistics (admin only)
 */
router.get('/stats/roles', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await UserRoleService.getRoleStats();

    res.json({ stats });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'GET_ROLE_STATS_FAILED',
        message: 'Failed to retrieve role statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default router;
