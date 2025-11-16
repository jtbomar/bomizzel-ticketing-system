import Joi from 'joi';

// User validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  firstName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'First name is required',
    'string.max': 'First name must be less than 50 characters',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Last name is required',
    'string.max': 'Last name must be less than 50 characters',
    'any.required': 'Last name is required',
  }),
  role: Joi.string().valid('customer', 'employee').optional().default('customer'),
  selectedPlanId: Joi.string().uuid().optional().messages({
    'string.guid': 'Selected plan ID must be a valid UUID',
  }),
  startTrial: Joi.boolean().optional().default(false),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'any.required': 'New password is required',
  }),
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must be less than 50 characters',
  }),
  lastName: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must be less than 50 characters',
  }),
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark').optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      browser: Joi.boolean().optional(),
      ticketAssigned: Joi.boolean().optional(),
      ticketUpdated: Joi.boolean().optional(),
      ticketResolved: Joi.boolean().optional(),
    }).optional(),
    dashboard: Joi.object({
      defaultView: Joi.string().valid('kanban', 'list').optional(),
      ticketsPerPage: Joi.number().integer().min(10).max(100).optional(),
    }).optional(),
  }).optional(),
});

// Company validation schemas
export const createCompanySchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Company name is required',
    'string.max': 'Company name must be less than 100 characters',
    'any.required': 'Company name is required',
  }),
  domain: Joi.string().domain().optional().messages({
    'string.domain': 'Please provide a valid domain',
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description must be less than 500 characters',
  }),
});

// Team validation schemas
export const createTeamSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Team name is required',
    'string.max': 'Team name must be less than 100 characters',
    'any.required': 'Team name is required',
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description must be less than 500 characters',
  }),
});

// Pagination validation
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(25),
  search: Joi.string().max(100).optional(),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
});

// User management validation schemas
export const updateUserSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name must be less than 50 characters',
  }),
  lastName: Joi.string().min(1).max(50).optional().messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name must be less than 50 characters',
  }),
  role: Joi.string().valid('customer', 'employee', 'team_lead', 'admin').optional(),
  isActive: Joi.boolean().optional(),
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark').optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      browser: Joi.boolean().optional(),
      ticketAssigned: Joi.boolean().optional(),
      ticketUpdated: Joi.boolean().optional(),
      ticketResolved: Joi.boolean().optional(),
    }).optional(),
    dashboard: Joi.object({
      defaultView: Joi.string().valid('kanban', 'list').optional(),
      ticketsPerPage: Joi.number().integer().min(10).max(100).optional(),
    }).optional(),
  }).optional(),
});

export const updateCompanySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional().messages({
    'string.min': 'Company name cannot be empty',
    'string.max': 'Company name must be less than 100 characters',
  }),
  domain: Joi.string().domain().optional().messages({
    'string.domain': 'Please provide a valid domain',
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'Description must be less than 500 characters',
  }),
  isActive: Joi.boolean().optional(),
});

export const addUserToCompanySchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'Invalid user ID format',
    'any.required': 'User ID is required',
  }),
  role: Joi.string().valid('admin', 'member', 'viewer').optional().default('member'),
});

export const updateUserCompanyRoleSchema = Joi.object({
  role: Joi.string().valid('admin', 'member', 'viewer').required().messages({
    'any.required': 'Role is required',
    'any.only': 'Role must be one of: admin, member, viewer',
  }),
});

// UUID validation
export const uuidSchema = Joi.string().uuid().required().messages({
  'string.uuid': 'Invalid ID format',
  'any.required': 'ID is required',
});

// Validation middleware factory
export const validate = (
  schema: Joi.ObjectSchema,
  property: 'body' | 'params' | 'query' = 'body'
) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.reduce((acc: any, detail: any) => {
        acc[detail.path.join('.')] = detail.message;
        return acc;
      }, {});

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
          requestId: req.id || 'unknown',
        },
      });
    }

    // Replace the original property with the validated and sanitized value
    req[property] = value;
    next();
  };
};

// Simple validation schema interface
interface ValidationField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  format?: 'uuid' | 'email' | 'url' | 'date';
  pattern?: string;
  enum?: string[];
  nullable?: boolean;
  items?: ValidationField;
}

interface ValidationSchema {
  body?: Record<string, ValidationField>;
  params?: Record<string, ValidationField>;
  query?: Record<string, ValidationField>;
}

// Simple validation middleware for route validation
export const validateRequest = (schema: ValidationSchema) => {
  return (req: any, res: any, next: any) => {
    const errors: Record<string, string> = {};

    // Validate each section
    ['body', 'params', 'query'].forEach((section) => {
      const sectionSchema = schema[section as keyof ValidationSchema];
      if (!sectionSchema) return;

      const data = req[section] || {};

      Object.entries(sectionSchema).forEach(([field, rules]) => {
        const value = data[field];
        const fieldPath = `${section}.${field}`;

        // Check required fields
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors[fieldPath] = `${field} is required`;
          return;
        }

        // Skip validation if field is not provided and not required
        if (value === undefined || value === null) {
          if (rules.nullable) return;
          if (!rules.required) return;
        }

        // Type validation
        switch (rules.type) {
          case 'string':
            if (typeof value !== 'string') {
              errors[fieldPath] = `${field} must be a string`;
              return;
            }
            if (rules.minLength && value.length < rules.minLength) {
              errors[fieldPath] = `${field} must be at least ${rules.minLength} characters`;
              return;
            }
            if (rules.maxLength && value.length > rules.maxLength) {
              errors[fieldPath] = `${field} must be at most ${rules.maxLength} characters`;
              return;
            }
            if (rules.enum && !rules.enum.includes(value)) {
              errors[fieldPath] = `${field} must be one of: ${rules.enum.join(', ')}`;
              return;
            }
            if (
              rules.format === 'uuid' &&
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                value
              )
            ) {
              errors[fieldPath] = `${field} must be a valid UUID`;
              return;
            }
            if (rules.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              errors[fieldPath] = `${field} must be a valid email`;
              return;
            }
            break;

          case 'number':
            const numValue = Number(value);
            if (isNaN(numValue)) {
              errors[fieldPath] = `${field} must be a number`;
              return;
            }
            if (rules.min !== undefined && numValue < rules.min) {
              errors[fieldPath] = `${field} must be at least ${rules.min}`;
              return;
            }
            if (rules.max !== undefined && numValue > rules.max) {
              errors[fieldPath] = `${field} must be at most ${rules.max}`;
              return;
            }
            // Convert string numbers to actual numbers
            data[field] = numValue;
            break;

          case 'boolean':
            if (typeof value !== 'boolean') {
              errors[fieldPath] = `${field} must be a boolean`;
              return;
            }
            break;

          case 'object':
            if (typeof value !== 'object' || Array.isArray(value)) {
              errors[fieldPath] = `${field} must be an object`;
              return;
            }
            break;

          case 'array':
            if (!Array.isArray(value)) {
              errors[fieldPath] = `${field} must be an array`;
              return;
            }
            break;
        }
      });
    });

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
          requestId: req.id || 'unknown',
        },
      });
    }

    next();
  };
};
