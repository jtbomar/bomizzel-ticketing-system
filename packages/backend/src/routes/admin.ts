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
  async (req: Request, res: Response): Promise<void> => {
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const updatedById = req.user?.id;

      if (!updatedById) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      const updatedById = req.user?.id;

      if (!updatedById) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
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
      phone: { type: 'string', required: false },
      mobilePhone: { type: 'string', required: false },
      extension: { type: 'string', required: false },
      about: { type: 'string', required: false },
      organizationalRoleId: { type: 'number', required: false },
      userProfileId: { type: 'number', required: false },
      departmentIds: { type: 'array', required: false },
      mustChangePassword: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        firstName, lastName, email, password, role, teamId,
        phone, mobilePhone, extension, about,
        organizationalRoleId, userProfileId, departmentIds, mustChangePassword
      } = req.body;
      const createdById = req.user?.id;

      if (!createdById) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      const user = await UserRoleService.createUser({
        firstName,
        lastName,
        email,
        password,
        role,
        teamId,
        createdById,
        phone,
        mobilePhone,
        extension,
        about,
        organizationalRoleId,
        userProfileId,
        departmentIds,
        mustChangePassword,
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const updateData = req.body;
      const updatedById = req.user?.id;

      if (!updatedById) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
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
router.get('/stats/roles', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
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

/**
 * GET /admin/users/:userId/assigned-tickets
 * Check how many tickets are assigned to a user (admin only)
 */
router.get('/users/:userId/assigned-tickets', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { db } = require('@/config/database');
    
    // Count tickets assigned to this user
    const result = await db('tickets')
      .where('assigned_to', userId)
      .count('* as count')
      .first();
    
    const count = parseInt(result?.count || '0');
    
    res.json({ 
      userId,
      ticketCount: count,
      hasTickets: count > 0
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'CHECK_TICKETS_FAILED',
        message: 'Failed to check assigned tickets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * DELETE /admin/users/:userId/permanent
 * Permanently delete a user (admin only)
 */
router.delete('/users/:userId/permanent', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { db } = require('@/config/database');
    
    // Check if user exists and is inactive
    const user = await db('users').where('id', userId).first();
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }
    
    if (user.is_active) {
      res.status(400).json({
        error: {
          code: 'USER_STILL_ACTIVE',
          message: 'User must be deactivated before permanent deletion',
        },
      });
      return;
    }
    
    // Check for assigned tickets
    const ticketCount = await db('tickets')
      .where('assigned_to', userId)
      .count('* as count')
      .first();
    
    if (parseInt(ticketCount?.count || '0') > 0) {
      res.status(400).json({
        error: {
          code: 'HAS_ASSIGNED_TICKETS',
          message: 'Cannot delete user with assigned tickets. Please reassign tickets first.',
        },
      });
      return;
    }
    
    // Permanently delete the user
    await db('users').where('id', userId).del();
    
    res.json({ 
      message: 'User permanently deleted',
      userId 
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'DELETE_USER_FAILED',
        message: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /admin/seed-statuses
 * One-time endpoint to seed default ticket statuses for all teams
 */
router.post('/seed-statuses', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { db } = require('@/config/database');
    const { v4: uuidv4 } = require('uuid');
    
    console.log('🌱 Seeding default ticket statuses...');

    const teams = await db('teams').select('id', 'name');

    if (teams.length === 0) {
      res.json({ success: true, message: 'No teams found', teamsProcessed: 0 });
      return;
    }

    const defaultStatuses = [
      { name: 'open', label: 'Open', color: '#EF4444', order: 1, is_default: true, is_closed: false },
      { name: 'in_progress', label: 'In Progress', color: '#F59E0B', order: 2, is_default: false, is_closed: false },
      { name: 'waiting', label: 'Waiting', color: '#3B82F6', order: 3, is_default: false, is_closed: false },
      { name: 'resolved', label: 'Resolved', color: '#10B981', order: 4, is_default: false, is_closed: true },
    ];

    let teamsProcessed = 0;
    let statusesCreated = 0;

    for (const team of teams) {
      const existingStatuses = await db('ticket_statuses')
        .where('team_id', team.id)
        .count('* as count')
        .first();

      const count = parseInt(existingStatuses?.count as string || '0');

      if (count > 0) {
        console.log(`Team ${team.name} already has ${count} statuses, skipping`);
        continue;
      }

      for (const status of defaultStatuses) {
        await db('ticket_statuses').insert({
          id: uuidv4(),
          team_id: team.id,
          name: status.name,
          label: status.label,
          color: status.color,
          order: status.order,
          is_default: status.is_default,
          is_closed: status.is_closed,
          is_active: true,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
        statusesCreated++;
      }

      teamsProcessed++;
      console.log(`✅ Created default statuses for team ${team.name}`);
    }

    console.log(`✅ Seeded ${statusesCreated} statuses for ${teamsProcessed} teams`);

    res.json({
      success: true,
      message: 'Default ticket statuses seeded successfully',
      teamsProcessed,
      statusesCreated,
      teams: teams.map((t: any) => t.name),
    });
  } catch (error) {
    console.error('Failed to seed statuses:', error);
    res.status(500).json({
      error: {
        code: 'SEED_STATUSES_FAILED',
        message: 'Failed to seed statuses',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default router;
