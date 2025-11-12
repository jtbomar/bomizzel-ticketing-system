import { Router, Request, Response } from 'express';
import { AdminProvisioningService, ProvisionCustomerRequest, CustomSubscriptionLimits } from '../services/AdminProvisioningService';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../utils/validation';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Validation schemas
const provisionCustomerSchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(100).required(),
  companyDomain: Joi.string().trim().max(100).optional().allow(''),
  companyDescription: Joi.string().trim().max(500).optional().allow(''),
  
  adminEmail: Joi.string().email().required(),
  adminFirstName: Joi.string().trim().min(1).max(50).required(),
  adminLastName: Joi.string().trim().min(1).max(50).required(),
  adminPhone: Joi.string().optional().allow(''),
  
  planId: Joi.string().uuid().optional().allow(null),
  customLimits: Joi.object({
    maxUsers: Joi.number().integer().min(1).optional(),
    maxActiveTickets: Joi.number().integer().min(1).optional(),
    maxCompletedTickets: Joi.number().integer().min(1).optional(),
    maxTotalTickets: Joi.number().integer().min(1).optional(),
    storageQuotaGB: Joi.number().min(1).optional(),
    maxAttachmentSizeMB: Joi.number().min(1).optional(),
    maxCustomFields: Joi.number().integer().min(1).optional(),
    maxQueues: Joi.number().integer().min(1).optional()
  }).optional(),
  
  customPricing: Joi.object({
    monthlyPrice: Joi.number().min(0).optional(),
    annualPrice: Joi.number().min(0).optional(),
    setupFee: Joi.number().min(0).optional()
  }).optional(),
  
  billingCycle: Joi.string().valid('monthly', 'annual').default('monthly'),
  trialDays: Joi.number().integer().min(0).max(90).optional(),
  startDate: Joi.date().optional(),
  
  notes: Joi.string().max(1000).optional().allow(''),
  metadata: Joi.object().optional()
});

const updateLimitsSchema = Joi.object({
  maxUsers: Joi.number().integer().min(1).optional(),
  maxActiveTickets: Joi.number().integer().min(1).optional(),
  maxCompletedTickets: Joi.number().integer().min(1).optional(),
  maxTotalTickets: Joi.number().integer().min(1).optional(),
  storageQuotaGB: Joi.number().min(1).optional(),
  maxAttachmentSizeMB: Joi.number().min(1).optional(),
  maxCustomFields: Joi.number().integer().min(1).optional(),
  maxQueues: Joi.number().integer().min(1).optional(),
  reason: Joi.string().max(500).optional().allow('')
});

/**
 * POST /api/admin/provisioning/customers
 * Provision a new customer with company, admin user, and subscription
 */
router.post(
  '/customers',
  validate(provisionCustomerSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const provisionedBy = req.user!.id;
      const request: ProvisionCustomerRequest = req.body;

      logger.info('Admin provisioning customer', {
        companyName: request.companyName,
        adminEmail: request.adminEmail,
        provisionedBy
      });

      const result = await AdminProvisioningService.provisionCustomer(request, provisionedBy);

      res.status(201).json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      logger.error('Customer provisioning failed', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Customer provisioning failed',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * GET /api/admin/provisioning/customers
 * Get all provisioned customers
 */
router.get(
  '/customers',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const status = req.query.status as string | undefined;

      const customers = await AdminProvisioningService.getProvisionedCustomers({
        limit,
        offset,
        status
      });

      res.json({
        success: true,
        data: {
          customers,
          pagination: {
            limit,
            offset,
            total: customers.length
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get provisioned customers', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve provisioned customers',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * PUT /api/admin/provisioning/subscriptions/:subscriptionId/limits
 * Update subscription limits for a customer
 */
router.put(
  '/subscriptions/:subscriptionId/limits',
  validate(updateLimitsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const updatedBy = req.user!.id;
      const { reason, ...newLimits } = req.body;

      logger.info('Admin updating subscription limits', {
        subscriptionId,
        newLimits,
        updatedBy,
        reason
      });

      const result = await AdminProvisioningService.updateSubscriptionLimits(
        subscriptionId,
        newLimits as CustomSubscriptionLimits,
        updatedBy,
        reason
      );

      res.json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      logger.error('Failed to update subscription limits', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update subscription limits',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * GET /api/admin/provisioning/subscriptions/:subscriptionId
 * Get detailed subscription information
 */
router.get(
  '/subscriptions/:subscriptionId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      
      const CustomerSubscription = require('../models/CustomerSubscription').CustomerSubscription;
      const subscription = await CustomerSubscription.findById(subscriptionId);
      
      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
        return;
      }

      // Get company and user details
      const Company = require('../models/Company').Company;
      const User = require('../models/User').User;
      
      const company = await Company.findById(subscription.company_id);
      const user = await User.findById(subscription.user_id);

      res.json({
        success: true,
        data: {
          subscription: {
            id: subscription.id,
            status: subscription.status,
            limits: subscription.limits ? JSON.parse(subscription.limits) : {},
            customPricing: subscription.custom_pricing ? JSON.parse(subscription.custom_pricing) : null,
            billingCycle: subscription.billing_cycle,
            currentPeriod: {
              start: subscription.current_period_start,
              end: subscription.current_period_end
            },
            trialEnd: subscription.trial_end,
            notes: subscription.notes,
            metadata: subscription.metadata ? JSON.parse(subscription.metadata) : {}
          },
          company: company ? {
            id: company.id,
            name: company.name,
            domain: company.domain,
            description: company.description
          } : null,
          admin: user ? {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone
          } : null
        }
      });

    } catch (error) {
      logger.error('Failed to get subscription details', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve subscription details',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

export default router;


/**
 * POST /api/admin/provisioning/subscriptions/:subscriptionId/disable
 * Disable a customer (blocks all users)
 */
router.post(
  '/subscriptions/:subscriptionId/disable',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const { reason } = req.body;
      const disabledBy = req.user!.id;

      logger.info('Admin disabling customer', { subscriptionId, disabledBy, reason });

      const result = await AdminProvisioningService.disableCustomer(
        subscriptionId,
        disabledBy,
        reason
      );

      res.json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      logger.error('Failed to disable customer', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disable customer',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * POST /api/admin/provisioning/subscriptions/:subscriptionId/enable
 * Enable a customer (allows users to access system)
 */
router.post(
  '/subscriptions/:subscriptionId/enable',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const { reason } = req.body;
      const enabledBy = req.user!.id;

      logger.info('Admin enabling customer', { subscriptionId, enabledBy, reason });

      const result = await AdminProvisioningService.enableCustomer(
        subscriptionId,
        enabledBy,
        reason
      );

      res.json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      logger.error('Failed to enable customer', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to enable customer',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * DELETE /api/admin/provisioning/subscriptions/:subscriptionId
 * Delete a customer (permanently removes all data)
 */
router.delete(
  '/subscriptions/:subscriptionId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { subscriptionId } = req.params;
      const { reason } = req.body;
      const deletedBy = req.user!.id;

      logger.info('Admin deleting customer', { subscriptionId, deletedBy, reason });

      const result = await AdminProvisioningService.deleteCustomer(
        subscriptionId,
        deletedBy,
        reason
      );

      res.json({
        success: true,
        message: result.message,
        data: result
      });

    } catch (error) {
      logger.error('Failed to delete customer', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete customer',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);
