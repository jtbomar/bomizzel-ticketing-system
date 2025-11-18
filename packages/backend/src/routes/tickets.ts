import { Router, Request, Response, NextFunction } from 'express';
import { TicketService } from '@/services/TicketService';
import { FileService } from '@/services/FileService';
import { Ticket } from '@/models/Ticket';
import { authenticate } from '@/middleware/auth';
import { uploadSingle, handleMulterError } from '@/middleware/fileUpload';
import { validateRequest } from '@/utils/validation';
import { CreateTicketRequest, UpdateTicketRequest } from '@/types/models';
import {
  enforceAndTrackTicketCreation,
  enforceAndTrackTicketStatusChange,
  enforceAndTrackTicketCompletion,
  addUsageWarnings,
} from '@/middleware/subscriptionEnforcement';

const router = Router();

// All ticket routes require authentication
router.use(authenticate);

/**
 * Create a new ticket
 * POST /tickets
 */
router.post(
  '/',
  validateRequest({
    body: {
      title: { type: 'string', required: true, minLength: 1, maxLength: 255 },
      description: { type: 'string', required: true, minLength: 1 },
      companyId: { type: 'string', required: true, format: 'uuid' },
      teamId: { type: 'string', required: true, format: 'uuid' },
      customFieldValues: { type: 'object', required: false },
      submitterId: { type: 'string', required: false, format: 'uuid' },
    },
  }),
  ...enforceAndTrackTicketCreation,
  async (req, res, next) => {
    try {
      const ticketData: CreateTicketRequest = req.body;
      const currentUserId = req.user!.id;
      const currentUserRole = req.user!.role;
      
      // Allow agents to create tickets on behalf of customers
      let submitterId = currentUserId;
      if (req.body.submitterId && ['admin', 'team_lead', 'employee'].includes(currentUserRole)) {
        submitterId = req.body.submitterId;
      }

      const ticket = await TicketService.createTicket(ticketData, submitterId);

      res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get tickets with filtering and pagination
 * GET /tickets
 */
router.get(
  '/',
  validateRequest({
    query: {
      companyId: { type: 'string', required: false, format: 'uuid' },
      queueId: { type: 'string', required: false, format: 'uuid' },
      assignedToId: { type: 'string', required: false, format: 'uuid' },
      status: { type: 'string', required: false },
      search: { type: 'string', required: false },
      page: { type: 'number', required: false, min: 1 },
      limit: { type: 'number', required: false, min: 1, max: 100 },
    },
  }),
  addUsageWarnings,
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const options: any = {};

      if (req.query.companyId) options.companyId = req.query.companyId as string;
      if (req.query.queueId) options.queueId = req.query.queueId as string;
      if (req.query.assignedToId) options.assignedToId = req.query.assignedToId as string;
      if (req.query.status) options.status = req.query.status as string;
      if (req.query.search) options.search = req.query.search as string;
      if (req.query.page) options.page = parseInt(req.query.page as string);
      if (req.query.limit) options.limit = parseInt(req.query.limit as string);

      const result = await TicketService.getTickets(userId, userRole, options);

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
 * Get a specific ticket
 * GET /tickets/:id
 */
router.get(
  '/:id',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  addUsageWarnings,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const ticket = await TicketService.getTicket(ticketId, userId, userRole);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a ticket
 * PUT /tickets/:id
 */
router.put(
  '/:id',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      title: { type: 'string', required: false, minLength: 1, maxLength: 255 },
      description: { type: 'string', required: false, minLength: 1 },
      status: { type: 'string', required: false },
      priority: { type: 'number', required: false, min: 0, max: 100 },
      assignedToId: { type: 'string', required: false, format: 'uuid', nullable: true },
      customFieldValues: { type: 'object', required: false },
    },
  }),
  ...enforceAndTrackTicketStatusChange,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const updateData: UpdateTicketRequest = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const ticket = await TicketService.updateTicket(ticketId, updateData, userId, userRole);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Assign ticket to an employee
 * POST /tickets/:id/assign
 */
router.post(
  '/:id/assign',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      assignedToId: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  addUsageWarnings,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const { assignedToId } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const ticket = await TicketService.assignTicket(ticketId, assignedToId, userId, userRole);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Unassign ticket
 * POST /tickets/:id/unassign
 */
router.post(
  '/:id/unassign',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  addUsageWarnings,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const ticket = await TicketService.unassignTicket(ticketId, userId, userRole);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update ticket status
 * PUT /tickets/:id/status
 */
router.put(
  '/:id/status',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      status: { type: 'string', required: true },
    },
  }),
  async (req, res, next) => {
    try {
      // Determine if this is a completion status
      const completionStatuses = ['completed', 'resolved', 'closed'];
      const isCompletion = completionStatuses.includes(req.body.status.toLowerCase());

      // Apply appropriate middleware based on status change
      const middleware = isCompletion
        ? enforceAndTrackTicketCompletion
        : enforceAndTrackTicketStatusChange;

      // Execute middleware chain
      let middlewareIndex = 0;
      const executeMiddleware = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (middlewareIndex < middleware.length) {
            const currentMiddleware = middleware[middlewareIndex++];
            currentMiddleware(req, res, (error?: any) => {
              if (error) {
                reject(error);
              } else {
                executeMiddleware().then(resolve).catch(reject);
              }
            });
          } else {
            resolve();
          }
        });
      };

      // Execute all middleware
      await executeMiddleware();

      // Proceed with route handler
      const ticketId = req.params.id;
      const { status } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const ticket = await TicketService.updateTicketStatus(ticketId, status, userId, userRole);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update ticket priority
 * PUT /tickets/:id/priority
 */
router.put(
  '/:id/priority',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
    body: {
      priority: { type: 'number', required: true, min: 0, max: 100 },
    },
  }),
  addUsageWarnings,
  async (req, res, next) => {
    try {
      const ticketId = req.params.id;
      const { priority } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const ticket = await TicketService.updateTicketPriority(ticketId, priority, userId, userRole);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload file attachment to a ticket
 * POST /tickets/:id/attachments
 */
router.post(
  '/:id/attachments',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  uploadSingle,
  handleMulterError,
  addUsageWarnings,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ticketId = req.params.id;
      const userId = req.user!.id;
      const { noteId } = req.body;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file provided',
          },
        });
        return;
      }

      const attachment = await FileService.uploadFile(req.file, ticketId, userId, noteId);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: attachment,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get attachments for a ticket
 * GET /tickets/:id/attachments
 */
router.get(
  '/:id/attachments',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  addUsageWarnings,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticketId = req.params.id;
      const userId = req.user!.id;

      const attachments = await FileService.getTicketAttachments(ticketId, userId);

      res.json({
        success: true,
        data: attachments,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get ticket history
 * GET /tickets/:id/history
 */
router.get(
  '/:id/history',
  validateRequest({
    params: {
      id: { type: 'string', required: true, format: 'uuid' },
    },
  }),
  addUsageWarnings,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticketId = req.params.id;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Validate ticket access
      await TicketService.getTicket(ticketId, userId, userRole);

      // Get ticket history
      const history = await Ticket.getTicketHistory(ticketId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /tickets/delete-all
 * Delete all tickets (admin only, for cleanup)
 */
router.post('/delete-all', authenticate, async (req, res, next) => {
  try {
    // Only allow admin users
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete all tickets',
      });
    }

    const db = require('../config/database').default;
    const deleted = await db('tickets').del();

    return res.json({
      success: true,
      deleted,
      message: `Deleted ${deleted} tickets`,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
