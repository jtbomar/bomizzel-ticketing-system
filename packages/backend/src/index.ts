import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

// Load environment variables first
dotenv.config();

// Migrations are handled by Dockerfile startup script
// Skip running them again in the application code
console.log('🚀 Starting Bomizzel backend...');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
console.log('🔧 Environment PORT:', process.env.PORT);
console.log('🔧 Using PORT:', PORT);

// Basic middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
  'http://192.168.0.133:3000',
  'http://192.168.0.117:3000',
  /^http:\/\/192\.168\.0\.\d+:3000$/,
  /^http:\/\/192\.168\.0\.\d+:3002$/,
  'https://www.bomizzel.com',
  'https://bomizzel.com',
  'https://bomizzel-ticketing-system-frontend.vercel.app',
  /^https:\/\/bomizzel-ticketing-system-.*\.vercel\.app$/,
];

console.log('🔒 CORS allowed origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      console.log('🌐 CORS request from origin:', origin);

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is allowed
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        }
        return allowed.test(origin);
      });

      if (isAllowed) {
        console.log('✅ CORS: Origin allowed:', origin);
        callback(null, true);
      } else {
        console.log('❌ CORS: Origin blocked:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400, // 24 hours
  })
);

// CORS is already configured above

// Increase payload limit for image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Import and mount API routes
try {
  const routes = require('./routes').default;
  app.use('/api', routes);
  console.log('✅ API routes registered successfully');
} catch (error) {
  console.warn('⚠️ Could not register API routes:', error);

  // Try to register critical routes individually
  try {
    const authRoutes = require('./routes/auth').default;
    const adminRoutes = require('./routes/admin').default;
    const adminProvisioningRoutes = require('./routes/adminProvisioning').default;
    const enhancedRegistrationRoutes = require('./routes/enhancedRegistration').default;
    const businessHoursRoutes = require('./routes/businessHours').default;
    const holidayListRoutes = require('./routes/holidayLists').default;
    const departmentRoutes = require('./routes/departments').default;
    const customerHappinessRoutes = require('./routes/customerHappiness').default;
    const companyRoutes = require('./routes/companies').default;
    const organizationalRolesRoutes = require('./routes/organizationalRoles').default;
    const userProfilesRoutes = require('./routes/userProfiles').default;
    const agentsRoutes = require('./routes/agents').default;
    const usersRoutes = require('./routes/users').default;

    // Try to load tickets, custom fields, teams, and files routes
    let ticketsRoutes, customFieldsRoutes, teamsRoutes, filesRoutes;
    try {
      ticketsRoutes = require('./routes/tickets').default;
      customFieldsRoutes = require('./routes/customFields').default;
      teamsRoutes = require('./routes/teams').default;
      filesRoutes = require('./routes/files').default;
    } catch (err) {
      console.warn('⚠️ Could not load tickets/custom-fields/teams/files routes:', err);
    }

    app.use('/api/auth', authRoutes);
    app.use('/api/auth', enhancedRegistrationRoutes);

    // Direct auth routes (bypass User model issues)
    try {
      const directAuthRoutes = require('./routes/directAuth').default;
      app.use('/api/direct-auth', directAuthRoutes);
      console.log('🔐 Direct auth routes registered');
    } catch (error) {
      console.warn('⚠️ Could not load direct auth routes:', error);
    }
    app.use('/api/admin', adminRoutes);
    app.use('/api/admin/provisioning', adminProvisioningRoutes);

    // Emergency admin routes for database issues
    try {
      const emergencyAdminRoutes = require('./routes/admin').default;
      app.use('/api/emergency', emergencyAdminRoutes);
      console.log('🚨 Emergency admin routes registered');
    } catch (error) {
      console.warn('⚠️ Could not load emergency admin routes:', error);
    }
    app.use('/api/business-hours', businessHoursRoutes);
    app.use('/api/holiday-lists', holidayListRoutes);
    app.use('/api/departments', departmentRoutes);
    app.use('/api/customer-happiness', customerHappinessRoutes);
    app.use('/api/companies', companyRoutes);
    app.use('/api/organizational-roles', organizationalRolesRoutes);
    app.use('/api/user-profiles', userProfilesRoutes);
    app.use('/api/agents', agentsRoutes);
    app.use('/api/users', usersRoutes);

    if (ticketsRoutes) {
      app.use('/api/tickets', ticketsRoutes);
      console.log('✅ Tickets routes registered');
    }
    if (customFieldsRoutes) {
      app.use('/api/custom-fields', customFieldsRoutes);
      console.log('✅ Custom fields routes registered');
    }
    if (teamsRoutes) {
      app.use('/api/teams', teamsRoutes);
      console.log('✅ Teams routes registered');
    }
    if (filesRoutes) {
      app.use('/api/files', filesRoutes);
      console.log('✅ Files routes registered');
    }

    console.log(
      '✅ Auth, admin, companies, agents, users, admin provisioning, enhanced registration, business hours, holiday lists, departments, customer happiness, organizational roles, and user profiles routes registered'
    );
  } catch (err) {
    console.error('❌ Failed to register provisioning routes:', err);
  }

  // Manually register auth verify endpoint as fallback
  app.get('/api/auth/verify', async (req: Request, res: Response): Promise<void> => {
    try {
      const { authenticate } = await import('./middleware/auth');
      const { User } = await import('./models/User');

      // Extract token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);
      const { JWTUtils } = await import('./utils/jwt');
      const payload = JWTUtils.verifyAccessToken(token);

      if (!payload) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      const user = await User.findById(payload.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Auth verify error:', error);
      res.status(401).json({ error: 'Authentication failed' });
    }
  });
  console.log('✅ Manual auth verify endpoint registered');
}

// Company profile endpoints with database persistence
app.get('/api/company-registration/profile', async (req: Request, res: Response) => {
  try {
    const { db } = await import('./config/database');

    // Get the first company profile (for now, we'll use a single profile)
    const profile = await db('company_profiles').first();

    if (profile) {
      res.json({
        success: true,
        data: {
          id: profile.id,
          name: profile.company_id, // We'll use company name from companies table later
          logo: profile.logo,
          website: profile.website,
          primaryContact: profile.primary_contact,
          primaryEmail: profile.primary_email,
          primaryPhone: profile.primary_phone,
          address: profile.address,
          phoneNumbers: profile.phone_numbers,
        },
      });
    } else {
      // Return default data if no profile exists
      res.json({
        success: true,
        data: {
          id: null,
          name: 'Bomizzel Services Inc.',
          logo: '',
          website: 'https://bomizzel.com',
          primaryContact: 'Jeff Bomar',
          primaryEmail: 'jeffrey.t.bomar@gmail.com',
          primaryPhone: '(555) 123-4567',
          address: {
            street: '123 Business Street',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94102',
            country: 'United States',
          },
          phoneNumbers: {
            main: '(555) 123-4567',
            fax: '(555) 123-4568',
            support: '(555) 123-4569',
          },
        },
      });
    }
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company profile',
    });
  }
});

app.put('/api/company-registration/profile', async (req: Request, res: Response) => {
  try {
    const { db } = await import('./config/database');
    const {
      name,
      logo,
      website,
      primaryContact,
      primaryEmail,
      primaryPhone,
      address,
      phoneNumbers,
    } = req.body;

    // Check if profile exists
    const existingProfile = await db('company_profiles').first();

    if (existingProfile) {
      // Update existing profile
      await db('company_profiles')
        .where({ id: existingProfile.id })
        .update({
          logo,
          website,
          primary_contact: primaryContact,
          primary_email: primaryEmail,
          primary_phone: primaryPhone,
          address: JSON.stringify(address),
          phone_numbers: JSON.stringify(phoneNumbers),
          updated_at: db.fn.now(),
        });
    } else {
      // Create new profile
      await db('company_profiles').insert({
        logo,
        website,
        primary_contact: primaryContact,
        primary_email: primaryEmail,
        primary_phone: primaryPhone,
        address: JSON.stringify(address),
        phone_numbers: JSON.stringify(phoneNumbers),
      });
    }

    res.json({
      success: true,
      message: 'Company profile updated successfully',
      data: req.body,
    });
  } catch (error) {
    console.error('Error updating company profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company profile',
    });
  }
});

// Branding endpoints
app.get('/api/company-registration/branding', async (req: Request, res: Response) => {
  try {
    const { db } = await import('./config/database');

    // Get the first branding profile
    const branding = await db('company_profiles').first();

    if (branding) {
      res.json({
        success: true,
        data: {
          logo: branding.logo,
          favicon: branding.favicon,
          linkbackUrl: branding.linkback_url,
          companyName: branding.company_name,
          tagline: branding.tagline,
          primaryColor: branding.primary_color,
          secondaryColor: branding.secondary_color,
          accentColor: branding.accent_color,
        },
      });
    } else {
      // Return default branding data
      res.json({
        success: true,
        data: {
          logo: '',
          favicon: '',
          linkbackUrl: 'https://bomizzel.com',
          companyName: 'Bomizzel Services Inc.',
          tagline: 'Professional Ticketing Solutions',
          primaryColor: '#3B82F6',
          secondaryColor: '#1E40AF',
          accentColor: '#10B981',
        },
      });
    }
  } catch (error) {
    console.error('Error fetching branding data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branding data',
    });
  }
});

app.put('/api/company-registration/branding', async (req: Request, res: Response) => {
  try {
    const { db } = await import('./config/database');
    const {
      logo,
      favicon,
      linkbackUrl,
      companyName,
      tagline,
      primaryColor,
      secondaryColor,
      accentColor,
    } = req.body;

    // Check if profile exists
    const existingProfile = await db('company_profiles').first();

    if (existingProfile) {
      // Update existing profile
      await db('company_profiles').where({ id: existingProfile.id }).update({
        logo,
        favicon,
        linkback_url: linkbackUrl,
        company_name: companyName,
        tagline,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        updated_at: db.fn.now(),
      });
    } else {
      // Create new profile
      await db('company_profiles').insert({
        logo,
        favicon,
        linkback_url: linkbackUrl,
        company_name: companyName,
        tagline,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
      });
    }

    res.json({
      success: true,
      message: 'Branding updated successfully',
      data: req.body,
    });
  } catch (error) {
    console.error('Error updating branding data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update branding data',
    });
  }
});

// Setup endpoint for running migrations
try {
  const setupRoutes = require('./routes/setup').default;
  app.use('/api/setup', setupRoutes);
  console.log('🔧 Setup routes registered');
} catch (error) {
  console.warn('⚠️ Could not register setup routes:', error);
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'bomizzel-backend',
  });
});

// API health check.
//
// Removed from this endpoint (all were unauthenticated and live in production):
//   - /db-test           leaked the database connection string
//   - /db-users          dumped every user's id/email/name/role and every company
//   - ?emergency_reseed=login           accepted credentials as URL query params
//                                       and returned a signed JWT
//   - ?emergency_reseed=create_shane    created an account
//   - ?emergency_reseed=fix_passwords   rewrote password hashes
//   - ?emergency_reseed=bomizzel_emergency_2024  reseeded the database
// Use the authenticated, admin-only routes under /api/database-reset and
// /api/seed for these operations instead.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Bomizzel API is running',
    timestamp: new Date().toISOString(),
  });
});

// NOTE: a large block of inline handlers used to live here, duplicating
// /api/auth/*, /api/tickets, /api/queues, /api/teams, /api/admin/users,
// /api/subscriptions/plans and /api/ticket-layouts. They were all shadowed by
// the real router mounted at '/api' above, so they never served a request, and
// most of them read from an in-memory `users` array that had been deleted -
// which is what produced the 39 TypeScript errors that broke `npm run build`.
//
// The endpoints the frontend actually needs are now served by the real routers:
//   /api/auth/me, /auth/preferences, /auth/profile-picture, PUT /auth/change-password
//     -> src/routes/auth.ts
//   /api/ticket-layouts  -> src/routes/ticketLayouts.ts (now mounted)
//   /api/subscriptions   -> src/routes/subscriptions.ts (now mounted)

// 404 + error handling. These must be registered after every route.
//
// Neither was mounted before, so Express fell back to its built-in error
// handler: every AppError came back as an HTML page ("<pre>Unauthorized</pre>")
// instead of JSON. The frontend reads error.response.data.error.message, so all
// API errors surfaced as undefined, and unmatched routes returned a bare 401
// rather than a 404.
app.use(notFoundHandler);
app.use(errorHandler);

// Start archival scheduler (only in production or when enabled)
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_ARCHIVAL_SCHEDULER === 'true') {
  try {
    const { ArchivalScheduledJobs } = require('./services/ArchivalScheduledJobs');
    ArchivalScheduledJobs.start();
    console.log('📦 Archival scheduler started');
  } catch (error) {
    console.warn('⚠️ Could not start archival scheduler:', error);
  }
}

// Initialize Redis connection (optional)
connectRedis().catch((err) => {
  console.warn('⚠️ Redis connection failed, continuing without caching:', err.message);
});

// Start server.
//
// Skipped under NODE_ENV=test: the test suites import { app } and drive it with
// supertest, and binding a real port on import left a TCPSERVERWRAP handle open
// that stopped Jest from exiting.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bomizzel backend server running on port ${PORT}`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
    console.log(`🔗 API health check at http://localhost:${PORT}/api/health`);
    console.log(`🌐 Network access available at http://0.0.0.0:${PORT}`);
  });
}

export { app };
// Trigger restart
