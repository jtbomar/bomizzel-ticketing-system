import { Router, Request, Response } from 'express';
import { CustomFieldService } from '@/services/CustomFieldService';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import { logger } from '@/utils/logger';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createCustomFieldSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .required()
    .messages({
      'string.min': 'Field name is required',
      'string.pattern.base':
        'Field name must start with a letter and contain only letters, numbers, and underscores',
      'any.required': 'Field name is required',
    }),
  label: Joi.string().min(1).required().messages({
    'string.min': 'Field label is required',
    'any.required': 'Field label is required',
  }),
  type: Joi.string()
    .valid('string', 'number', 'decimal', 'integer', 'picklist')
    .required()
    .messages({
      'any.only': 'Type must be one of: string, number, decimal, integer, picklist',
      'any.required': 'Field type is required',
    }),
  isRequired: Joi.boolean().optional().default(false),
  options: Joi.array().items(Joi.string()).optional(),
  validation: Joi.object({
    min: Joi.number().optional(),
    max: Joi.number().optional(),
    pattern: Joi.string().optional(),
    message: Joi.string().optional(),
  }).optional(),
});

const updateCustomFieldSchema = Joi.object({
  label: Joi.string().min(1).optional().messages({
    'string.min': 'Field label cannot be empty',
  }),
  isRequired: Joi.boolean().optional(),
  options: Joi.array().items(Joi.string()).optional(),
  validation: Joi.object({
    min: Joi.number().optional(),
    max: Joi.number().optional(),
    pattern: Joi.string().optional(),
    message: Joi.string().optional(),
  }).optional(),
});

const reorderFieldsSchema = Joi.object({
  fieldOrders: Joi.array()
    .items(
      Joi.object({
        fieldId: Joi.string().uuid().required(),
        order: Joi.number().integer().min(0).required(),
      })
    )
    .required(),
});

const validateValuesSchema = Joi.object({
  values: Joi.object().pattern(Joi.string(), Joi.any()).required(),
});

// Middleware to check team access
const checkTeamAccess = async (req: Request, res: Response, next: Function): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only employees, team leads, and admins can access team custom fields
    if (!['employee', 'team_lead', 'admin'].includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    // TODO: Add team membership validation when TeamService is available
    // For now, allow all employees to access any team's custom fields

    next();
  } catch (error) {
    logger.error('Team access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /custom-fields/teams/:teamId
 * Get all custom fields for a team
 */
router.get('/teams/:teamId', authenticate, checkTeamAccess, async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;

    const fields = await CustomFieldService.getTeamCustomFields(teamId);

    res.json({
      success: true,
      data: fields,
    });
  } catch (error) {
    logger.error('Get team custom fields error:', error);
    res.status(500).json({
      error: 'Failed to retrieve custom fields',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /custom-fields/teams/:teamId
 * Create a new custom field for a team
 */
router.post(
  '/teams/:teamId',
  authenticate,
  checkTeamAccess,
  validate(createCustomFieldSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const fieldData = req.body;

      // Only team leads and admins can create custom fields
      if (!['team_lead', 'admin'].includes(req.user!.role)) {
        res
          .status(403)
          .json({ error: 'Only team leads and admins can create custom fields' });
        return;
      }

      const field = await CustomFieldService.createCustomField(teamId, fieldData);

      res.status(201).json({
        success: true,
        data: field,
      });
    } catch (error) {
      logger.error('Create custom field error:', error);

      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }

      res.status(400).json({
        error: 'Failed to create custom field',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /custom-fields/:fieldId/teams/:teamId
 * Get a specific custom field
 */
router.get(
  '/:fieldId/teams/:teamId',
  authenticate,
  checkTeamAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { fieldId, teamId } = req.params;

      const field = await CustomFieldService.getCustomField(fieldId, teamId);

      res.json({
        success: true,
        data: field,
      });
    } catch (error) {
      logger.error('Get custom field error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Failed to retrieve custom field',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * PUT /custom-fields/:fieldId/teams/:teamId
 * Update a custom field
 */
router.put(
  '/:fieldId/teams/:teamId',
  authenticate,
  checkTeamAccess,
  validate(updateCustomFieldSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { fieldId, teamId } = req.params;
      const updates = req.body;

      // Only team leads and admins can update custom fields
      if (!['team_lead', 'admin'].includes(req.user!.role)) {
        res
          .status(403)
          .json({ error: 'Only team leads and admins can update custom fields' });
        return;
      }

      const field = await CustomFieldService.updateCustomField(fieldId, teamId, updates);

      res.json({
        success: true,
        data: field,
      });
    } catch (error) {
      logger.error('Update custom field error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(400).json({
        error: 'Failed to update custom field',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /custom-fields/:fieldId/teams/:teamId
 * Delete (deactivate) a custom field
 */
router.delete(
  '/:fieldId/teams/:teamId',
  authenticate,
  checkTeamAccess,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { fieldId, teamId } = req.params;

      // Only team leads and admins can delete custom fields
      if (!['team_lead', 'admin'].includes(req.user!.role)) {
        res
          .status(403)
          .json({ error: 'Only team leads and admins can delete custom fields' });
        return;
      }

      await CustomFieldService.deleteCustomField(fieldId, teamId);

      res.json({
        success: true,
        message: 'Custom field deleted successfully',
      });
    } catch (error) {
      logger.error('Delete custom field error:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Failed to delete custom field',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * PUT /custom-fields/teams/:teamId/reorder
 * Reorder custom fields for a team
 */
router.put(
  '/teams/:teamId/reorder',
  authenticate,
  checkTeamAccess,
  validate(reorderFieldsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const { fieldOrders } = req.body;

      // Only team leads and admins can reorder custom fields
      if (!['team_lead', 'admin'].includes(req.user!.role)) {
        res
          .status(403)
          .json({ error: 'Only team leads and admins can reorder custom fields' });
        return;
      }

      await CustomFieldService.reorderCustomFields(teamId, fieldOrders);

      res.json({
        success: true,
        message: 'Custom fields reordered successfully',
      });
    } catch (error) {
      logger.error('Reorder custom fields error:', error);

      res.status(400).json({
        error: 'Failed to reorder custom fields',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /custom-fields/teams/:teamId/validate
 * Validate custom field values against team's field definitions
 */
router.post(
  '/teams/:teamId/validate',
  authenticate,
  validate(validateValuesSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId } = req.params;
      const { values } = req.body;

      const validation = await CustomFieldService.validateCustomFieldValues(teamId, values);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('Validate custom field values error:', error);

      res.status(500).json({
        error: 'Failed to validate custom field values',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
