import { Router } from 'express';
import { CompanyRegistrationService } from '@/services/CompanyRegistrationService';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import Joi from 'joi';

const router = Router();

// Company registration schema
const companyRegistrationSchema = Joi.object({
  // Company info
  companyName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Company name must be at least 2 characters',
    'string.max': 'Company name cannot exceed 100 characters',
    'any.required': 'Company name is required',
  }),
  domain: Joi.string().domain().optional().messages({
    'string.domain': 'Please provide a valid domain',
  }),
  description: Joi.string().max(500).optional(),
  
  // Admin user info
  adminFirstName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'First name is required',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'Admin first name is required',
  }),
  adminLastName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Last name is required',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Admin last name is required',
  }),
  adminEmail: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Admin email is required',
  }),
  adminPassword: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Admin password is required',
  }),
  
  // Organization profile (optional)
  timezone: Joi.string().optional(),
  primaryContactName: Joi.string().max(100).optional(),
  primaryContactEmail: Joi.string().email().optional(),
  primaryContactPhone: Joi.string().max(20).optional(),
  mobilePhone: Joi.string().max(20).optional(),
  websiteUrl: Joi.string().uri().optional(),
  
  // Address (optional)
  addressLine1: Joi.string().max(100).optional(),
  addressLine2: Joi.string().max(100).optional(),
  city: Joi.string().max(50).optional(),
  stateProvince: Joi.string().max(50).optional(),
  postalCode: Joi.string().max(20).optional(),
  country: Joi.string().max(50).optional(),
  
  // Subscription
  subscriptionPlanId: Joi.string().uuid().optional(),
  startTrial: Joi.boolean().optional().default(true),
});

// Company profile update schema
const companyProfileUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  domain: Joi.string().domain().optional(),
  description: Joi.string().max(500).optional(),
  logoUrl: Joi.string().uri().optional(),
  primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  
  // Contact info
  primaryContactName: Joi.string().max(100).optional(),
  primaryContactEmail: Joi.string().email().optional(),
  primaryContactPhone: Joi.string().max(20).optional(),
  mobilePhone: Joi.string().max(20).optional(),
  websiteUrl: Joi.string().uri().optional(),
  
  // Address
  addressLine1: Joi.string().max(100).optional(),
  addressLine2: Joi.string().max(100).optional(),
  city: Joi.string().max(50).optional(),
  stateProvince: Joi.string().max(50).optional(),
  postalCode: Joi.string().max(20).optional(),
  country: Joi.string().max(50).optional(),
  
  // Settings
  timezone: Joi.string().optional(),
  dateFormat: Joi.string().valid('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD').optional(),
  timeFormat: Joi.string().valid('12', '24').optional(),
  currency: Joi.string().length(3).optional(),
  language: Joi.string().length(2).optional(),
  
  // Company settings
  allowPublicRegistration: Joi.boolean().optional(),
  requireEmailVerification: Joi.boolean().optional(),
  welcomeMessage: Joi.string().max(1000).optional(),
});

/**
 * POST /api/company-registration/register
 * Register a new company with admin user
 */
router.post('/register', validate(companyRegistrationSchema), async (req, res, next) => {
  try {
    const result = await CompanyRegistrationService.registerCompany(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Company registered successfully',
      data: {
        company: result.company,
        adminUser: {
          id: result.adminUser.id,
          email: result.adminUser.email,
          firstName: result.adminUser.firstName,
          lastName: result.adminUser.lastName,
          role: result.adminUser.role,
        },
        tokens: result.tokens,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/company-registration/profile
 * Get current user's company profile
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    // Get user's primary company (first one they're associated with)
    const userCompanies = await CompanyRegistrationService.getUserCompanies(req.user!.id);
    
    if (userCompanies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No company found for user',
      });
    }
    
    const companyProfile = await CompanyRegistrationService.getCompanyProfile(userCompanies[0].id);
    
    res.json({
      success: true,
      data: companyProfile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/company-registration/profile
 * Update company profile
 */
router.put('/profile', authenticate, validate(companyProfileUpdateSchema), async (req, res, next) => {
  try {
    // Get user's primary company
    const userCompanies = await CompanyRegistrationService.getUserCompanies(req.user!.id);
    
    if (userCompanies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No company found for user',
      });
    }
    
    const updatedProfile = await CompanyRegistrationService.updateCompanyProfile(
      userCompanies[0].id,
      req.body,
      req.user!.id
    );
    
    res.json({
      success: true,
      message: 'Company profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/company-registration/timezones
 * Get list of available timezones
 */
router.get('/timezones', (req, res) => {
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Vancouver',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney',
    'Australia/Melbourne',
    // Add more as needed
  ];
  
  res.json({
    success: true,
    data: timezones,
  });
});

/**
 * GET /api/company-registration/countries
 * Get list of countries
 */
router.get('/countries', (req, res) => {
  const countries = [
    'United States',
    'Canada',
    'United Kingdom',
    'Germany',
    'France',
    'Australia',
    'Japan',
    'India',
    'Brazil',
    'Mexico',
    // Add more as needed
  ];
  
  res.json({
    success: true,
    data: countries,
  });
});

export default router;