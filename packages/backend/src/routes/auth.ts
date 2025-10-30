import { Router } from 'express';
import { AuthService } from '@/services/AuthService';
import { authenticate, optionalAuth } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import { authRateLimiter, strictRateLimiter } from '@/middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '@/utils/validation';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', authRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { user, tokens } = await AuthService.register(req.body);
    
    res.status(201).json({
      message: 'User registered successfully',
      user,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Login user
 */
router.post('/login', authRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const loginResponse = await AuthService.login(req.body);
    
    res.json({
      message: 'Login successful',
      ...loginResponse,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', validate(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await AuthService.refreshToken(refreshToken);
    
    res.json({
      message: 'Token refreshed successfully',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', optionalAuth, async (req, res, next) => {
  try {
    // In a JWT-based system, logout is primarily handled client-side
    // by removing the tokens. We could implement token blacklisting here
    // if needed for additional security.
    
    if (req.user) {
      logger.info(`User logged out: ${req.user.email}`);
    }
    
    res.json({
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/profile
 * Get current user profile
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const profile = await AuthService.getUserProfile(req.user!.id);
    
    res.json({
      user: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const updatedUser = await AuthService.updateProfile(req.user!.id, req.body);
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/verify-email
 * Verify email address
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw new AppError('Verification token is required', 400, 'TOKEN_REQUIRED');
    }
    
    await AuthService.verifyEmail(token);
    
    res.json({
      message: 'Email verified successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', strictRateLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    await AuthService.requestPasswordReset(email);
    
    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    await AuthService.resetPassword(token, password);
    
    res.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
    
    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/associate-company
 * Associate user with a company
 */
router.post('/associate-company', authenticate, async (req, res, next) => {
  try {
    const { companyId, role = 'member' } = req.body;
    
    if (!companyId) {
      throw new AppError('Company ID is required', 400, 'COMPANY_ID_REQUIRED');
    }
    
    await AuthService.associateWithCompany(req.user!.id, companyId, role);
    
    res.json({
      message: 'Successfully associated with company',
    });
  } catch (error) {
    next(error);
  }
});

export default router;