import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { BulkOperationsService } from '../services/BulkOperationsService';
import { validateRequest } from '../utils/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const bulkAssignSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  assignedToId: Joi.string().uuid().required(),
});

const bulkStatusUpdateSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  status: Joi.string().min(1).max(50).required(),
});

const bulkPriorityUpdateSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  priority: Joi.number().integer().min(0).max(100).required(),
});

const bulkDeleteSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
});

const bulkMoveSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  queueId: Joi.string().uuid().required(),
});

/**
 * POST /api/bulk/assign
 * Bulk assign tickets to an employee
 */
router.post('/assign', authenticate, validateRequest(bulkAssignSchema), async (req, res, next) => {
  try {
    const { ticketIds, assignedToId } = req.body;
    const performedById = req.user!.id;
    const userRole = req.user!.role;

    const result = await BulkOperationsService.bulkAssignTickets(
      { ticketIds, assignedToId, performedById },
      userRole
    );

    res.json({
      success: true,
      data: result,
      message: `Bulk assignment completed: ${result.summary.successful}/${result.summary.total} tickets assigned`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bulk/status
 * Bulk update ticket status
 */
router.post('/status', authenticate, validateRequest(bulkStatusUpdateSchema), async (req, res, next) => {
  try {
    const { ticketIds, status } = req.body;
    const performedById = req.user!.id;
    const userRole = req.user!.role;

    const result = await BulkOperationsService.bulkUpdateStatus(
      { ticketIds, status, performedById },
      userRole
    );

    res.json({
      success: true,
      data: result,
      message: `Bulk status update completed: ${result.summary.successful}/${result.summary.total} tickets updated`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bulk/priority
 * Bulk update ticket priority
 */
router.post(
  '/priority',
  auth,
  validateRequest(bulkPriorityUpdateSchema),
  async (req, res, next) => {
    try {
      const { ticketIds, priority } = req.body;
      const performedById = req.user!.id;
      const userRole = req.user!.role;

      const result = await BulkOperationsService.bulkUpdatePriority(
        { ticketIds, priority, performedById },
        userRole
      );

      res.json({
        success: true,
        data: result,
        message: `Bulk priority update completed: ${result.summary.successful}/${result.summary.total} tickets updated`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/bulk/move
 * Bulk move tickets to a different queue
 */
router.post('/move', authenticate, validateRequest(bulkMoveSchema), async (req, res, next) => {
  try {
    const { ticketIds, queueId } = req.body;
    const performedById = req.user!.id;
    const userRole = req.user!.role;

    const result = await BulkOperationsService.bulkMoveToQueue(
      ticketIds,
      queueId,
      performedById,
      userRole
    );

    res.json({
      success: true,
      data: result,
      message: `Bulk move completed: ${result.summary.successful}/${result.summary.total} tickets moved`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/bulk/delete
 * Bulk delete tickets (soft delete)
 */
router.delete('/delete', authenticate, validateRequest(bulkDeleteSchema), async (req, res, next) => {
  try {
    const { ticketIds } = req.body;
    const performedById = req.user!.id;
    const userRole = req.user!.role;

    const result = await BulkOperationsService.bulkDeleteTickets(
      { ticketIds, performedById },
      userRole
    );

    res.json({
      success: true,
      data: result,
      message: `Bulk delete completed: ${result.summary.successful}/${result.summary.total} tickets deleted`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bulk/history
 * Get bulk operation history for current user
 */
router.get('/history', auth, async (req, res, next) => {
  try {
    const performedById = req.user!.id;
    const { limit, offset, action } = req.query;

    const history = await BulkOperationsService.getBulkOperationHistory(performedById, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      action: action as string,
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bulk/validate-access
 * Validate ticket access for bulk operations
 */
router.post('/validate-access', authenticate, async (req, res, next) => {
  try {
    const { ticketIds } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ticketIds must be a non-empty array',
      });
    }

    const result = await BulkOperationsService.validateTicketAccess(ticketIds, userId, userRole);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
