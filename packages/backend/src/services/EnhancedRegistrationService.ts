import { User } from '../models/User';
import { Company } from '../models/Company';
import { CompanyUser } from '../models/CompanyUser';
import { EmailService } from './EmailService';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export interface EnhancedRegistrationData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  
  // Company Information
  companyAction: 'create' | 'join';
  companyName?: string; // For creating new company
  companyId?: string;   // For joining existing company
  companyInviteCode?: string; // For joining with invite
  
  // Role and Preferences
  role?: 'customer' | 'employee';
  department?: string;
  jobTitle?: string;
  
  // Marketing and Communication
  marketingOptIn?: boolean;
  communicationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export interface RegistrationResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  company?: {
    id: string;
    name: string;
    role: string;
  };
  verificationRequired: boolean;
  message: string;
  errors?: Record<string, string>;
}

export class EnhancedRegistrationService {
  /**
   * Enhanced registration with company association
   */
  static async registerWithCompany(data: EnhancedRegistrationData): Promise<RegistrationResult> {
    try {
      // Validate input data
      const validation = await this.validateRegistrationData(data);
      if (!validation.isValid) {
        return {
          success: false,
          verificationRequired: false,
          message: 'Validation failed',
          errors: validation.errors
        };
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(data.email);
      if (existingUser) {
        return {
          success: false,
          verificationRequired: false,
          message: 'An account with this email already exists',
          errors: { email: 'Email already registered' }
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Create user
      const userId = uuidv4();
      const user = await User.create({
        id: userId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        role: data.role || 'customer',
        isActive: false, // Require email verification
        emailVerified: false,
        department: data.department,
        jobTitle: data.jobTitle,
        marketingOptIn: data.marketingOptIn || false,
        communicationPreferences: JSON.stringify(data.communicationPreferences || {
          email: true,
          sms: false,
          push: true
        })
      });

      // Handle company association
      let company;
      let companyRole = 'member';

      if (data.companyAction === 'create' && data.companyName) {
        // Create new company
        company = await this.createCompanyForUser(data.companyName, userId);
        companyRole = 'admin'; // User becomes admin of their own company
      } else if (data.companyAction === 'join' && (data.companyId || data.companyInviteCode)) {
        // Join existing company
        company = await this.joinExistingCompany(userId, data.companyId, data.companyInviteCode);
        companyRole = 'member';
      }

      // Send verification email
      await this.sendVerificationEmail(user);

      // Log registration
      logger.info('Enhanced registration completed', {
        userId: user.id,
        email: user.email,
        companyId: company?.id,
        companyAction: data.companyAction
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        company: company ? {
          id: company.id,
          name: company.name,
          role: companyRole
        } : undefined,
        verificationRequired: true,
        message: 'Registration successful! Please check your email to verify your account.'
      };

    } catch (error) {
      logger.error('Enhanced registration failed:', error);
      return {
        success: false,
        verificationRequired: false,
        message: 'Registration failed. Please try again.',
        errors: { general: 'An unexpected error occurred' }
      };
    }
  }

  /**
   * Create a new company for the user
   */
  private static async createCompanyForUser(companyName: string, userId: string) {
    const companyId = uuidv4();
    
    const company = await Company.create({
      id: companyId,
      name: companyName,
      isActive: true,
      createdBy: userId,
      settings: JSON.stringify({
        allowSelfRegistration: true,
        requireApproval: false,
        defaultRole: 'member'
      })
    });

    // Associate user with company as admin
    await CompanyUser.create({
      id: uuidv4(),
      companyId: company.id,
      userId: userId,
      role: 'admin',
      isActive: true,
      addedBy: userId
    });

    return company;
  }

  /**
   * Join an existing company
   */
  private static async joinExistingCompany(userId: string, companyId?: string, inviteCode?: string) {
    let company;

    if (companyId) {
      company = await Company.findById(companyId);
    } else if (inviteCode) {
      // Find company by invite code (you might want to implement invite codes)
      company = await Company.findByInviteCode(inviteCode);
    }

    if (!company) {
      throw new Error('Company not found');
    }

    // Check if company allows self-registration
    const settings = company.settings ? JSON.parse(company.settings) : {};
    if (!settings.allowSelfRegistration) {
      throw new Error('This company requires an invitation to join');
    }

    // Associate user with company
    await CompanyUser.create({
      id: uuidv4(),
      companyId: company.id,
      userId: userId,
      role: settings.defaultRole || 'member',
      isActive: !settings.requireApproval, // If approval required, start inactive
      addedBy: userId
    });

    return company;
  }

  /**
   * Validate registration data
   */
  private static async validateRegistrationData(data: EnhancedRegistrationData) {
    const errors: Record<string, string> = {};

    // Personal information validation
    if (!data.firstName?.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!data.lastName?.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!data.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!data.password) {
      errors.password = 'Password is required';
    } else if (data.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }

    // Company information validation
    if (!data.companyAction) {
      errors.companyAction = 'Please specify whether to create or join a company';
    } else if (data.companyAction === 'create' && !data.companyName?.trim()) {
      errors.companyName = 'Company name is required when creating a new company';
    } else if (data.companyAction === 'join' && !data.companyId && !data.companyInviteCode) {
      errors.company = 'Please provide a company ID or invite code to join';
    }

    // Phone validation (optional)
    if (data.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(data.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.phone = 'Please enter a valid phone number';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Send verification email
   */
  private static async sendVerificationEmail(user: any) {
    try {
      const verificationToken = uuidv4();
      
      // Store verification token (you might want to add this to user model)
      await User.update(user.id, {
        verificationToken,
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Send email
      await EmailService.sendVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
      });

    } catch (error) {
      logger.error('Failed to send verification email:', error);
      // Don't throw error - registration should still succeed
    }
  }

  /**
   * Search for companies (for join flow)
   */
  static async searchCompanies(query: string, limit: number = 10) {
    try {
      const companies = await Company.search(query, limit);
      return companies.map(company => ({
        id: company.id,
        name: company.name,
        description: company.description,
        allowsSelfRegistration: company.settings ? 
          JSON.parse(company.settings).allowSelfRegistration : false
      }));
    } catch (error) {
      logger.error('Company search failed:', error);
      return [];
    }
  }

  /**
   * Verify email address
   */
  static async verifyEmail(token: string) {
    try {
      const user = await User.findByVerificationToken(token);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }

      // Check if token is expired
      if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
        return {
          success: false,
          message: 'Verification token has expired. Please request a new one.'
        };
      }

      // Activate user
      await User.update(user.id, {
        isActive: true,
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null
      });

      logger.info('Email verified successfully', { userId: user.id, email: user.email });

      return {
        success: true,
        message: 'Email verified successfully! You can now log in.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      };

    } catch (error) {
      logger.error('Email verification failed:', error);
      return {
        success: false,
        message: 'Email verification failed. Please try again.'
      };
    }
  }
}