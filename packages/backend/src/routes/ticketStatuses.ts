// @ts-nocheck
import { Router, Request, Response } from 'express';
import { TicketStatusService } from '@/services/TicketStatusService';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';

const router = Router();

/**
 * GET /teams/:teamId/statuses
 * Get all statuses for a team
 */
router.get(
  '/:teamId/statuses',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { teamId } = req.params;

      const statuses = await TicketStatusService.getTeamStatuses(teamId);

      res.json({ statuses });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_TEAM_STATUSES_FAILED',
          message: 'Failed to retrieve team statuses',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * POST /teams/:teamId/statuses
 * Create a new status for a team
 */
router.post(
  '/:teamId/statuses',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      name: { type: 'string', required: true, minLength: 1, maxLength: 50 },
      label: { type: 'string', required: true, minLength: 1, maxLength: 100 },
      color: { type: 'string', required: false, pattern: '^#[0-9A-Fa-f]{6}$' },
      order: { type: 'number', required: false, min: 0 },
      isDefault: { type: 'boolean', required: false },
      isClosed: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { teamId } = req.params;
      const { name, label, color, order, isDefault, isClosed } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const status = await TicketStatusService.createStatus(
        teamId,
        { name, label, color, order, isDefault, isClosed },
        userId
      );

      res.status(201).json({ status });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'CREATE_STATUS_FAILED',
          message: 'Failed to create status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /teams/:teamId/statuses/:statusId
 * Update a ticket status
 */
router.put(
  '/:teamId/statuses/:statusId',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
      statusId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      name: { type: 'string', required: false, minLength: 1, maxLength: 50 },
      label: { type: 'string', required: false, minLength: 1, maxLength: 100 },
      color: { type: 'string', required: false, pattern: '^#[0-9A-Fa-f]{6}$' },
      order: { type: 'number', required: false, min: 0 },
      isDefault: { type: 'boolean', required: false },
      isClosed: { type: 'boolean', required: false },
      isActive: { type: 'boolean', required: false },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { statusId } = req.params;
      const { name, label, color, order, isDefault, isClosed, isActive } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const status = await TicketStatusService.updateStatus(
        statusId,
        { name, label, color, order, isDefault, isClosed, isActive },
        userId
      );

      res.json({ status });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'UPDATE_STATUS_FAILED',
          message: 'Failed to update status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * DELETE /teams/:teamId/statuses/:statusId
 * Delete a ticket status
 */
router.delete(
  '/:teamId/statuses/:statusId',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
      statusId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { statusId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      await TicketStatusService.deleteStatus(statusId, userId);

      res.json({ message: 'Status deleted successfully' });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'DELETE_STATUS_FAILED',
          message: 'Failed to delete status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /teams/:teamId/statuses/reorder
 * Reorder team statuses
 */
router.put(
  '/:teamId/statuses/reorder',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      statusOrders: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', required: true, format: 'uuid' },
            order: { type: 'number', required: true, min: 0 },
          },
        },
      },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { teamId } = req.params;
      const { statusOrders } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      await TicketStatusService.reorderStatuses(teamId, statusOrders, userId);

      res.json({ message: 'Statuses reordered successfully' });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'REORDER_STATUSES_FAILED',
          message: 'Failed to reorder statuses',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * GET /teams/:teamId/statuses/stats
 * Get status statistics for a team
 */
router.get(
  '/:teamId/statuses/stats',
  authenticate,
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { teamId } = req.params;

      const stats = await TicketStatusService.getStatusStats(teamId);

      res.json({ stats });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_STATUS_STATS_FAILED',
          message: 'Failed to retrieve status statistics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

export default router;
