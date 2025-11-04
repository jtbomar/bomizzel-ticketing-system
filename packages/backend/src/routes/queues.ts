import { Router } from 'express';
import { TicketService } from '@/services/TicketService';
import { QueueService } from '@/services/QueueService';
import { Queue } from '@/models/Queue';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/utils/validation';

const router = Router();

// All queue routes require authentication
router.use(authenticate);

/**
 * Get tickets in a specific queue
 * GET /queues/:id/tickets
 */
router.get(
  '/:id/tickets',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
    query: {
      status: { type: 'string', required: false },
      page: { type: 'number', required: false, min: 1 },
      limit: { type: 'number', required: false, min: 1, max: 100 },
    },
  }),
  async (req, res, next) => {
    try {
      const queueId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const options: any = {};

      if (req.query.status) options.status = req.query.status as string;
      if (req.query.page) options.page = parseInt(req.query.page as string);
      if (req.query.limit) options.limit = parseInt(req.query.limit as string);

      const result = await TicketService.getQueueTickets(queueId, userId, userRole, options);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get queue details with metrics
 * GET /queues/:id
 */
router.get(
  '/:id',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next): Promise<void> => {
    try {
      const queueId = req.params.id;

      const queue = await Queue.getQueueWithTicketCount(queueId);
      if (!queue) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'QUEUE_NOT_FOUND',
            message: 'Queue not found',
          },
        });
      }

      res.json({
        success: true,
        data: Queue.toModel(queue),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get all queues for a team with metrics
 * GET /queues
 */
router.get(
  '/',
  validateRequest({
    query: {
      teamId: { type: 'string', required: false, format: 'uuid' },
      assignedToId: { type: 'string', required: false, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const { teamId, assignedToId } = req.query;
      let queues;

      if (teamId) {
        queues = await Queue.getTeamQueuesWithMetrics(teamId as string);
      } else if (assignedToId) {
        const assigneeQueues = await Queue.findByAssignee(assignedToId as string);
        queues = await Promise.all(
          assigneeQueues.map(async (queue) => {
            const queueWithCount = await Queue.getQueueWithTicketCount(queue.id);
            return queueWithCount;
          })
        );
      } else {
        // Return user's accessible queues based on role
        const userId = req.user!.id;
        const userRole = req.user!.role;

        if (userRole === 'employee') {
          // Get queues from user's teams and personal queues
          const { User } = await import('@/models/User');
          const userTeams = await User.getUserTeams(userId);
          const teamIds = userTeams.map((ut) => ut.teamId);

          const teamQueues = await Promise.all(
            teamIds.map((teamId) => Queue.getTeamQueuesWithMetrics(teamId))
          );

          const personalQueues = await Queue.findByAssignee(userId);
          const personalQueuesWithMetrics = await Promise.all(
            personalQueues.map((queue) => Queue.getQueueWithTicketCount(queue.id))
          );

          queues = [...teamQueues.flat(), ...personalQueuesWithMetrics];
        } else {
          // Admins and team leads can see all queues
          const allQueues = await Queue.query.where('is_active', true);
          queues = await Promise.all(
            allQueues.map((queue: any) => Queue.getQueueWithTicketCount(queue.id))
          );
        }
      }

      const queueModels = queues.map((queue) => Queue.toModel(queue));

      res.json({
        success: true,
        data: queueModels,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create a new queue
 * POST /queues
 */
router.post(
  '/',
  validateRequest({
    body: {
      name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
      description: { type: 'string', required: false },
      type: { type: 'string', required: true, enum: ['unassigned', 'employee'] },
      assignedToId: { type: 'string', required: false, format: 'uuid' },
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const queueData = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const queue = await QueueService.createQueue(queueData, userId, userRole);

      res.status(201).json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update queue details
 * PUT /queues/:id
 */
router.put(
  '/:id',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      name: { type: 'string', required: false, minLength: 1, maxLength: 255 },
      description: { type: 'string', required: false },
    },
  }),
  async (req, res, next) => {
    try {
      const queueId = req.params.id;
      const updateData = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const queue = await QueueService.updateQueue(queueId, updateData, userId, userRole);

      res.json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete queue
 * DELETE /queues/:id
 */
router.delete(
  '/:id',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const queueId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      await QueueService.deleteQueue(queueId, userId, userRole);

      res.json({
        success: true,
        message: 'Queue deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update queue assignment
 * PUT /queues/:id/assign
 */
router.put(
  '/:id/assign',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      assignedToId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const queueId = req.params.id;
      const { assignedToId } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const queue = await QueueService.assignQueue(queueId, assignedToId, userId, userRole);

      res.json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Unassign queue
 * PUT /queues/:id/unassign
 */
router.put(
  '/:id/unassign',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const queueId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const queue = await QueueService.unassignQueue(queueId, userId, userRole);

      res.json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get queue metrics
 * GET /queues/:id/metrics
 */
router.get(
  '/:id/metrics',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const queueId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const metrics = await QueueService.getQueueMetrics(queueId, userId, userRole);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get team queues with metrics
 * GET /queues/teams/:teamId/metrics
 */
router.get(
  '/teams/:teamId/metrics',
  validateRequest({
    params: {
      teamId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const metrics = await QueueService.getTeamQueuesWithMetrics(teamId, userId, userRole);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get user's dashboard metrics
 * GET /queues/dashboard/metrics
 */
router.get(
  '/dashboard/metrics',
  validateRequest({
    query: {
      includeTeamQueues: { type: 'boolean', required: false },
      includePersonalQueues: { type: 'boolean', required: false },
    },
  }),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const options = {
        includeTeamQueues: req.query.includeTeamQueues !== 'false',
        includePersonalQueues: req.query.includePersonalQueues !== 'false',
      };

      const metrics = await QueueService.getUserQueuesWithMetrics(userId, userRole, options);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get filtered queues with sorting
 * GET /queues/search
 */
router.get(
  '/search',
  validateRequest({
    query: {
      teamId: { type: 'string', required: false, format: 'uuid' },
      assignedToId: { type: 'string', required: false, format: 'uuid' },
      type: { type: 'string', required: false, enum: ['unassigned', 'employee'] },
      search: { type: 'string', required: false },
      sortBy: { type: 'string', required: false, enum: ['name', 'ticketCount', 'createdAt'] },
      sortOrder: { type: 'string', required: false, enum: ['asc', 'desc'] },
    },
  }),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const filters = {
        teamId: req.query.teamId as string,
        assignedToId: req.query.assignedToId as string,
        type: req.query.type as 'unassigned' | 'employee',
        search: req.query.search as string,
        sortBy: req.query.sortBy as 'name' | 'ticketCount' | 'createdAt',
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };

      const queues = await QueueService.getFilteredQueues(userId, userRole, filters);

      res.json({
        success: true,
        data: queues,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
