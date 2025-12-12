import { User } from '../models/User';
import { Company } from '../models/Company';
import { EmailService } from './EmailService';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
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
  companyId?: string; // For joining existing company
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
          errors: validation.errors,
        };
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(data.email);
      if (existingUser) {
        return {
          success: false,
          verificationRequired: false,
          message: 'An account with this email already exists',
          errors: { email: 'Email already registered' },
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Create user
      const userId = uuidv4();
      const user = await User.create({
        id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email.toLowerCase(),
        password_hash: hashedPassword,
        phone: data.phone,
        role: data.role || 'customer',
        is_active: false, // Require email verification
        email_verified: false,
        department: data.department,
        job_title: data.jobTitle,
        marketing_opt_in: data.marketingOptIn || false,
        preferences: {
          theme: 'light',
          notifications: {
            email: data.communicationPreferences?.email ?? true,
            sms: data.communicationPreferences?.sms ?? false,
            push: data.communicationPreferences?.push ?? true,
          },
          dashboard: {
            defaultView: 'kanban',
            ticketsPerPage: 25,
          },
        },
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
        companyAction: data.companyAction,
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        company: company
          ? {
              id: company.id,
              name: company.name,
              role: companyRole,
            }
          : undefined,
        verificationRequired: true,
        message: 'Registration successful! Please check your email to verify your account.',
      };
    } catch (error) {
      logger.error('Enhanced registration failed:', error);
      return {
        success: false,
        verificationRequired: false,
        message: 'Registration failed. Please try again.',
        errors: { general: 'An unexpected error occurred' },
      };
    }
  }

  /**
   * Create a new company for the user
   */
  private static async createCompanyForUser(companyName: string, userId: string) {
    const company = await Company.create({
      name: companyName,
      is_active: true,
      created_by: userId,
      settings: JSON.stringify({
        allowSelfRegistration: true,
        requireApproval: false,
        defaultRole: 'member',
      }),
    });

    // Associate user with company as admin using the existing method
    await Company.addUserToCompany(userId, company.id, 'admin');

    return company;
  }

  /**
   * Join an existing company
   */
  private static async joinExistingCompany(
    userId: string,
    companyId?: string,
    inviteCode?: string
  ) {
    let company;

    if (companyId) {
      company = await Company.findById(companyId);
    } else if (inviteCode) {
      // For now, we'll implement a simple invite code system
      // You can enhance this later with a proper invite codes table
      company = await Company.findByName(inviteCode); // Temporary: use company name as invite code
    }

    if (!company) {
      throw new Error('Company not found');
    }

    // For now, assume all companies allow self-registration
    // You can add a settings field to the companies table later
    const settings = { allowSelfRegistration: true, defaultRole: 'member' };

    // Associate user with company using existing method
    await Company.addUserToCompany(userId, company.id, settings.defaultRole || 'member');

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
      errors,
    };
  }

  /**
   * Send verification email
   */
  private static async sendVerificationEmail(user: any) {
    try {
      const verificationToken = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification token using existing method
      await User.setEmailVerificationToken(user.id, verificationToken, expiresAt);

      // Send email (using notification email for now - you can create a specific verification email method)
      const htmlBody = `
        <h2>Welcome to Bomizzel!</h2>
        <p>Hi ${user.first_name},</p>
        <p>Thank you for registering! Please click the link below to verify your email address:</p>
        <p><a href="${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}">Verify Email Address</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `;
      const textBody = `
        Welcome to Bomizzel!
        Hi ${user.first_name},
        Thank you for registering! Please visit the following link to verify your email address:
        ${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}
        This link will expire in 24 hours.
        If you didn't create this account, please ignore this email.
      `;

      await EmailService.sendNotificationEmail(
        [user.email],
        'Verify Your Email Address - Bomizzel',
        htmlBody,
        textBody,
        { type: 'email_verification', userId: user.id }
      );
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
      const companies = await Company.findActiveCompanies({
        search: query,
        limit,
      });
      return companies.map((company) => ({
        id: company.id,
        name: company.name,
        description: company.description,
        allowsSelfRegistration: true, // For now, assume all companies allow self-registration
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
      const user = await User.findByEmailVerificationToken(token);

      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification token',
        };
      }

      // Activate user and verify email using existing method
      await User.verifyEmail(user.id);
      await User.update(user.id, {
        is_active: true,
      });

      logger.info('Email verified successfully', { userId: user.id, email: user.email });

      return {
        success: true,
        message: 'Email verified successfully! You can now log in.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      };
    } catch (error) {
      logger.error('Email verification failed:', error);
      return {
        success: false,
        message: 'Email verification failed. Please try again.',
      };
    }
  }
}
