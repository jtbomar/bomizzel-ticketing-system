import { Router, Request, Response } from 'express';
import { EnhancedRegistrationService, EnhancedRegistrationData } from '../services/EnhancedRegistrationService';
import { validate } from '../utils/validation';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const enhancedRegistrationSchema = Joi.object({
  // Personal Information
  firstName: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'First name is required',
    'string.min': 'First name must be at least 1 character',
    'string.max': 'First name must be less than 50 characters'
  }),
  lastName: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'Last name is required',
    'string.min': 'Last name must be at least 1 character',
    'string.max': 'Last name must be less than 50 characters'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'string.empty': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.empty': 'Password is required'
  }),
  phone: Joi.string().optional().allow('').pattern(/^[\+]?[1-9][\d\s\-\(\)]{0,15}$/).messages({
    'string.pattern.base': 'Please enter a valid phone number'
  }),
  
  // Company Information
  companyAction: Joi.string().valid('create', 'join').required().messages({
    'any.only': 'Company action must be either "create" or "join"',
    'string.empty': 'Please specify whether to create or join a company'
  }),
  companyName: Joi.when('companyAction', {
    is: 'create',
    then: Joi.string().trim().min(1).max(100).required().messages({
      'string.empty': 'Company name is required when creating a new company',
      'string.max': 'Company name must be less than 100 characters'
    }),
    otherwise: Joi.string().optional().allow('')
  }),
  companyId: Joi.when('companyAction', {
    is: 'join',
    then: Joi.string().uuid().optional(),
    otherwise: Joi.string().optional().allow('')
  }),
  companyInviteCode: Joi.when('companyAction', {
    is: 'join',
    then: Joi.string().optional().allow(''),
    otherwise: Joi.string().optional().allow('')
  }),
  
  // Role and Preferences
  role: Joi.string().valid('customer', 'employee').default('customer'),
  department: Joi.string().max(50).optional().allow(''),
  jobTitle: Joi.string().max(50).optional().allow(''),
  
  // Marketing and Communication
  marketingOptIn: Joi.boolean().default(false),
  communicationPreferences: Joi.object({
    email: Joi.boolean().default(true),
    sms: Joi.boolean().default(false),
    push: Joi.boolean().default(true)
  }).optional()
}).custom((value, helpers) => {
  // Custom validation: if joining company, need either companyId or inviteCode
  if (value.companyAction === 'join' && !value.companyId && !value.companyInviteCode) {
    return helpers.error('custom.joinCompanyRequired');
  }
  return value;
}).messages({
  'custom.joinCompanyRequired': 'Please provide a company ID or invite code to join a company'
});

const companySearchSchema = Joi.object({
  query: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Search query must be at least 2 characters',
    'string.max': 'Search query must be less than 50 characters',
    'string.empty': 'Search query is required'
  }),
  limit: Joi.number().integer().min(1).max(20).default(10)
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().uuid().required().messages({
    'string.empty': 'Verification token is required',
    'string.uuid': 'Invalid verification token format'
  })
});

/**
 * POST /api/auth/register-enhanced
 * Enhanced registration with company association
 */
router.post(
  '/register-enhanced',
  validate(enhancedRegistrationSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const registrationData: EnhancedRegistrationData = req.body;
      
      logger.info('Enhanced registration attempt', {
        email: registrationData.email,
        companyAction: registrationData.companyAction,
        role: registrationData.role
      });

      const result = await EnhancedRegistrationService.registerWithCompany(registrationData);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
          data: {
            user: result.user,
            company: result.company,
            verificationRequired: result.verificationRequired
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          errors: result.errors
        });
      }

    } catch (error) {
      logger.error('Enhanced registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed due to server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * GET /api/auth/search-companies
 * Search for companies to join
 */
router.get(
  '/search-companies',
  validate(companySearchSchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, limit } = req.query as { query: string; limit?: number };
      
      const companies = await EnhancedRegistrationService.searchCompanies(query, limit);
      
      res.json({
        success: true,
        data: companies,
        message: `Found ${companies.length} companies matching "${query}"`
      });

    } catch (error) {
      logger.error('Company search error:', error);
      res.status(500).json({
        success: false,
        message: 'Company search failed',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * POST /api/auth/verify-email
 * Verify email address with token
 */
router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body;
      
      logger.info('Email verification attempt', { token });

      const result = await EnhancedRegistrationService.verifyEmail(token);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          data: result.user
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Email verification failed due to server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post(
  '/resend-verification',
  validate(Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required'
    })
  })),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      
      // Find user by email
      const User = require('../models/User').User;
      const user = await User.findByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists or not for security
        res.json({
          success: true,
          message: 'If an account with this email exists and is unverified, a verification email has been sent.'
        });
        return;
      }
      
      if (user.emailVerified) {
        res.status(400).json({
          success: false,
          message: 'This email address is already verified.'
        });
        return;
      }
      
      // Resend verification email
      const EmailService = require('../services/EmailService').EmailService;
      const { v4: uuidv4 } = require('uuid');
      
      const verificationToken = uuidv4();
      await User.update(user.id, {
        verificationToken,
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
      
      await EmailService.sendVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
      });
      
      res.json({
        success: true,
        message: 'Verification email sent successfully.'
      });

    } catch (error) {
      logger.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend verification email',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

export default router;