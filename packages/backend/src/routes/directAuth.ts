import { Router } from 'express';
import { validate } from '@/utils/validation';
import { loginSchema } from '@/utils/validation';
import { authRateLimiter } from '@/middleware/rateLimiter';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * POST /direct-auth/login
 * Direct login that bypasses User model issues
 */
router.post('/login', authRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 DIRECT AUTH LOGIN ATTEMPT:', email);
    
    // Use direct database connection (same as working emergency endpoint)
    const { db } = require('../config/database');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    
    // Find user directly from database
    const user = await db('users').where('email', email.toLowerCase()).first();
    
    if (!user) {
      logger.warn(`Login attempt with non-existent email: ${email}`);
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      logger.warn(`Login attempt with deactivated account: ${email}`);
      return res.status(401).json({
        error: 'Account is deactivated'
      });
    }

    // Verify password directly with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      logger.warn(`Login attempt with invalid password: ${email}`);
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Generate JWT tokens (same as AuthService)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-refresh-secret',
      { expiresIn: '7d' }
    );

    // Convert to API model format (same as AuthService)
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

    logger.info(`Direct auth login successful: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: userModel,
      token: accessToken,
      refreshToken: refreshToken,
    });
    return;

  } catch (error) {
    logger.error('Direct auth login error:', error);
    next(error);
    return;
  }
});

export default router;