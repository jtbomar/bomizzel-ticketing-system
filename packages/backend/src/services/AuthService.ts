import { User } from '@/models/User';
import { Company } from '@/models/Company';
import { SubscriptionPlan } from '@/models/SubscriptionPlan';
import { JWTUtils, TokenPair } from '@/utils/jwt';
import { CryptoUtils } from '@/utils/crypto';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { CreateUserRequest, LoginRequest, LoginResponse, User as UserModel } from '@/types/models';
import { SubscriptionService } from './SubscriptionService';
import { EmailService } from './EmailService';

export class AuthService {
  /**
   * Register a new user
   */
  static async register(
    userData: CreateUserRequest
  ): Promise<{ user: UserModel; tokens: TokenPair }> {
    try {
      // Check if user already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
      }

      // Create the user
      const user = await User.createUser({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'customer',
      });

      // Generate email verification token
      const { token: verificationToken, expiresAt } = CryptoUtils.generateEmailVerificationToken();
      await User.setEmailVerificationToken(user.id, verificationToken, expiresAt);

      // Create subscription for customer users
      if (user.role === 'customer') {
        try {
          let planId = userData.selectedPlanId;

          // If no plan selected, default to Free Tier
          if (!planId) {
            const freeTierPlan = await SubscriptionPlan.getFreeTier();
            if (freeTierPlan) {
              planId = freeTierPlan.id;
            }
          }

          if (planId) {
            // Create subscription with trial if requested
            const subscription = await SubscriptionService.createSubscription(user.id, planId, {
              startTrial: userData.startTrial || false,
              metadata: {
                registrationSource: 'direct_signup',
                userAgent: 'web',
              },
            });

            // Get plan details for welcome email
            const plan = await SubscriptionPlan.findById(planId);
            if (plan) {
              try {
                // Send welcome email based on subscription plan
                const planFeatures =
                  typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;

                await EmailService.sendWelcomeEmail(
                  user.email,
                  `${user.first_name} ${user.last_name}`.trim(),
                  plan.name,
                  planFeatures || [],
                  userData.startTrial && plan.trial_days > 0,
                  plan.trial_days
                );

                logger.info(`Welcome email sent during registration`, {
                  userId: user.id,
                  planId,
                  planName: plan.name,
                  isTrialPlan: userData.startTrial && plan.trial_days > 0,
                });
              } catch (emailError) {
                // Log email error but don't fail registration
                logger.error('Failed to send welcome email during registration', {
                  userId: user.id,
                  planId,
                  error: emailError,
                });
              }
            }

            logger.info(`Subscription created during registration`, {
              userId: user.id,
              planId,
              startTrial: userData.startTrial,
            });
          }
        } catch (subscriptionError) {
          // Log the error but don't fail registration
          logger.error('Failed to create subscription during registration', {
            userId: user.id,
            selectedPlanId: userData.selectedPlanId,
            error: subscriptionError,
          });

          // We could optionally create a default free subscription here
          // or handle this in a background job
        }
      }

      // Generate JWT tokens
      const tokens = JWTUtils.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Convert to API model
      const userModel = User.toModel(user);

      logger.info(`User registered successfully: ${user.email}`);

      return { user: userModel, tokens };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Registration error:', error);
      throw new AppError('Registration failed', 500, 'REGISTRATION_FAILED');
    }
  }

  /**
   * Login user
   */
  static async login(loginData: LoginRequest): Promise<LoginResponse> {
    try {
      // PERMANENT FIX: Use direct database access instead of User model
      // This bypasses the broken User.findByEmail and User.verifyPassword methods
      
      const { db } = require('@/config/database');
      const bcrypt = require('bcryptjs');
      
      // Find user directly from database
      const user = await db('users').where('email', loginData.email.toLowerCase()).first();
      
      if (!user) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
      }

      // Verify password directly with bcrypt
      const isPasswordValid = await bcrypt.compare(loginData.password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Generate JWT tokens
      const tokens = JWTUtils.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Convert to API model format manually (bypassing User.toModel)
      const userModel = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        emailVerified: user.email_verified,
        preferences: user.preferences || {},
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };

      logger.info(`User logged in successfully: ${user.email}`);

      return {
        user: userModel,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Login error:', error);
      throw new AppError('Login failed', 500, 'LOGIN_FAILED');
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const payload = JWTUtils.verifyRefreshToken(refreshToken);
      if (!payload) {
        throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Verify user still exists and is active
      const user = await User.findById(payload.userId);
      if (!user || !user.is_active) {
        throw new AppError('User not found or deactivated', 401, 'USER_NOT_FOUND');
      }

      // Generate new token pair
      const tokens = JWTUtils.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      logger.debug(`Tokens refreshed for user: ${user.email}`);

      return tokens;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Token refresh error:', error);
      throw new AppError('Token refresh failed', 500, 'TOKEN_REFRESH_FAILED');
    }
  }

  /**
   * Verify email address
   */
  static async verifyEmail(token: string): Promise<void> {
    try {
      const user = await User.findByEmailVerificationToken(token);
      if (!user) {
        throw new AppError(
          'Invalid or expired verification token',
          400,
          'INVALID_VERIFICATION_TOKEN'
        );
      }

      await User.verifyEmail(user.id);

      logger.info(`Email verified for user: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Email verification error:', error);
      throw new AppError('Email verification failed', 500, 'EMAIL_VERIFICATION_FAILED');
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        logger.info(`Password reset requested for non-existent email: ${email}`);
        return;
      }

      if (!user.is_active) {
        throw new AppError('Account is deactivated', 400, 'ACCOUNT_DEACTIVATED');
      }

      // Generate password reset token
      const { token, expiresAt } = CryptoUtils.generatePasswordResetToken();
      await User.setPasswordResetToken(user.id, token, expiresAt);

      // TODO: Send password reset email
      logger.info(`Password reset token generated for user: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Password reset request error:', error);
      throw new AppError('Password reset request failed', 500, 'PASSWORD_RESET_REQUEST_FAILED');
    }
  }

  /**
   * Reset password using token
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const user = await User.findByPasswordResetToken(token);
      if (!user) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
      }

      await User.updatePassword(user.id, newPassword);

      logger.info(`Password reset successfully for user: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Password reset error:', error);
      throw new AppError('Password reset failed', 500, 'PASSWORD_RESET_FAILED');
    }
  }

  /**
   * Change password for authenticated user
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify current password
      const isCurrentPasswordValid = await User.verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }

      await User.updatePassword(user.id, newPassword);

      logger.info(`Password changed successfully for user: ${user.email}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Password change error:', error);
      throw new AppError('Password change failed', 500, 'PASSWORD_CHANGE_FAILED');
    }
  }

  /**
   * Get user profile with company associations
   */
  static async getUserProfile(userId: string): Promise<UserModel & { companies?: any[] }> {
    try {
      const userWithCompanies = await User.findWithCompanies(userId);
      if (!userWithCompanies) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const userModel = User.toModel(userWithCompanies);

      return {
        ...userModel,
        companies: userWithCompanies.companies,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Get user profile error:', error);
      throw new AppError('Failed to get user profile', 500, 'GET_PROFILE_FAILED');
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      preferences?: any;
    }
  ): Promise<UserModel> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const updatedUser = await User.update(userId, {
        first_name: updateData.firstName,
        last_name: updateData.lastName,
        preferences: updateData.preferences
          ? { ...user.preferences, ...updateData.preferences }
          : user.preferences,
      });

      if (!updatedUser) {
        throw new AppError('Failed to update profile', 500, 'UPDATE_FAILED');
      }

      logger.info(`Profile updated for user: ${user.email}`);

      return User.toModel(updatedUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update profile error:', error);
      throw new AppError('Profile update failed', 500, 'PROFILE_UPDATE_FAILED');
    }
  }

  /**
   * Ensure user has a subscription (create Free Tier if none exists)
   */
  static async ensureUserSubscription(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user || user.role !== 'customer') {
        return; // Only customer users need subscriptions
      }

      // Check if user already has a subscription
      const existingSubscription = await SubscriptionService.getUserSubscription(userId);
      if (existingSubscription) {
        return; // User already has a subscription
      }

      // Get Free Tier plan
      const freeTierPlan = await SubscriptionPlan.getFreeTier();
      if (!freeTierPlan) {
        logger.error('Free Tier plan not found when ensuring user subscription', { userId });
        return;
      }

      // Create Free Tier subscription
      await SubscriptionService.createSubscription(userId, freeTierPlan.id, {
        startTrial: false,
        metadata: {
          source: 'auto_assignment',
          reason: 'ensure_subscription',
        },
      });

      logger.info('Free Tier subscription auto-created for user', {
        userId,
        planId: freeTierPlan.id,
      });
    } catch (error) {
      logger.error('Error ensuring user subscription', { userId, error });
      // Don't throw error to avoid breaking other operations
    }
  }

  /**
   * Associate user with company
   */
  static async associateWithCompany(
    userId: string,
    companyId: string,
    role: string = 'member'
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const company = await Company.findById(companyId);
      if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
      }

      // Check if association already exists
      const isAlreadyAssociated = await Company.isUserInCompany(userId, companyId);
      if (isAlreadyAssociated) {
        throw new AppError(
          'User is already associated with this company',
          409,
          'ALREADY_ASSOCIATED'
        );
      }

      await Company.addUserToCompany(userId, companyId, role);

      logger.info(`User ${user.email} associated with company ${company.name}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Company association error:', error);
      throw new AppError('Company association failed', 500, 'COMPANY_ASSOCIATION_FAILED');
    }
  }
}
