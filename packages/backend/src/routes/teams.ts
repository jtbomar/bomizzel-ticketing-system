import { Router, Request, Response } from 'express';
import { TeamService } from '@/services/TeamService';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';
import { requireRole } from '@/middleware/requireRole';

const router = Router();

/**
 * GET /teams
 * Get all teams with pagination and filtering
 */
router.get(
  '/',
  authenticate,
  validateRequest({
    query: {
      page: { type: 'number', required: false, min: 1 },
      limit: { type: 'number', required: false, min: 1, max: 100 },
      search: { type: 'string', required: false },
      isActive: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, search, isActive } = req.query;

      const teams = await TeamService.getTeams({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
      });

      res.json(teams);
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_TEAMS_FAILED',
          message: 'Failed to retrieve teams',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * GET /teams/:teamId
 * Get a specific team by ID
 */
router.get(
  '/:teamId',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;

      const team = await TeamService.getTeamById(teamId);

      if (!team) {
        res.status(404).json({
          error: {
            code: 'TEAM_NOT_FOUND',
            message: 'Team not found',
          },
        });
        return;
      }

      res.json({ team });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_TEAM_FAILED',
          message: 'Failed to retrieve team',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * POST /teams
 * Create a new team (admin only)
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  validateRequest({
    body: {
      name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
      description: { type: 'string', required: false, maxLength: 500 },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      const team = await TeamService.createTeam({ name, description }, userId);

      res.status(201).json({ team });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'CREATE_TEAM_FAILED',
          message: 'Failed to create team',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /teams/:teamId
 * Update team information (admin or team lead only)
 */
router.put(
  '/:teamId',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      name: { type: 'string', required: false, minLength: 1, maxLength: 100 },
      description: { type: 'string', required: false, maxLength: 500 },
      isActive: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const { name, description, isActive } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      const team = await TeamService.updateTeam(teamId, { name, description, isActive }, userId);

      res.json({ team });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'UPDATE_TEAM_FAILED',
          message: 'Failed to update team',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * GET /teams/:teamId/members
 * Get team members
 */
router.get(
  '/:teamId/members',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;

      const members = await TeamService.getTeamMembers(teamId);

      res.json({ members });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_TEAM_MEMBERS_FAILED',
          message: 'Failed to retrieve team members',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * POST /teams/:teamId/members
 * Add user to team (admin or team lead only)
 */
router.post(
  '/:teamId/members',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      userId: { type: 'string', required: true, format: 'uuid' },
      role: { type: 'string', required: false, enum: ['member', 'lead', 'admin'] },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const { userId, role = 'member' } = req.body;
      const addedById = req.user?.id;

      if (!addedById) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      await TeamService.addUserToTeam(teamId, userId, role, addedById);

      res.status(201).json({ message: 'User added to team successfully' });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'ADD_USER_TO_TEAM_FAILED',
          message: 'Failed to add user to team',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * DELETE /teams/:teamId/members/:userId
 * Remove user from team (admin or team lead only)
 */
router.delete(
  '/:teamId/members/:userId',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
      userId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId, userId } = req.params;
      const removedById = req.user?.id;

      if (!removedById) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      await TeamService.removeUserFromTeam(teamId, userId, removedById);

      res.json({ message: 'User removed from team successfully' });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'REMOVE_USER_FROM_TEAM_FAILED',
          message: 'Failed to remove user from team',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /teams/:teamId/members/:userId/role
 * Update user's role in team (admin or team lead only)
 */
router.put(
  '/:teamId/members/:userId/role',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
      userId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      role: { type: 'string', required: true, enum: ['member', 'lead', 'admin'] },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId, userId } = req.params;
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

      await TeamService.updateUserTeamRole(teamId, userId, role, updatedById);

      res.json({ message: 'User role updated successfully' });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'UPDATE_USER_TEAM_ROLE_FAILED',
          message: 'Failed to update user team role',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

export default router;
