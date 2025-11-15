import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import companyRoutes from './companies';
import teamRoutes from './teams';
import customFieldRoutes from './customFields';
import ticketRoutes from './tickets';
import ticketNoteRoutes from './ticketNotes';
import queueRoutes from './queues';
import fileRoutes from './files';
import emailRoutes from './email';
import bulkOperationsRoutes from './bulkOperations';
import searchRoutes from './search';
import adminRoutes from './admin';
import systemConfigRoutes from './systemConfig';
import reportsRoutes from './reports';
import ticketStatusRoutes from './ticketStatuses';
import monitoringRoutes from './monitoring';
// Temporarily disabled - Stripe not configured
// import subscriptionRoutes from './subscriptions';
// import usageAlertRoutes from './usageAlerts';
// import billingRoutes from './billing';
// import subscriptionAnalyticsRoutes from './subscriptionAnalytics';
import ticketArchivalRoutes from './ticketArchival';
import companyRegistrationRoutes from './companyRegistration';
import enhancedRegistrationRoutes from './enhancedRegistration';
import adminProvisioningRoutes from './adminProvisioning';
import dataExportRoutes from './dataExport';
import queryBuilderRoutes from './queryBuilder';
import customerQueryBuilderRoutes from './customerQueryBuilder';
import businessHoursRoutes from './businessHours';
import organizationalRolesRoutes from './organizationalRoles';
import userProfilesRoutes from './userProfiles';
import agentsRoutes from './agents';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/auth', enhancedRegistrationRoutes); // Enhanced registration endpoints
router.use('/company-registration', companyRegistrationRoutes);
router.use('/admin/provisioning', adminProvisioningRoutes); // Admin provisioning endpoints
router.use('/users', userRoutes);
router.use('/agents', agentsRoutes); // Agent management endpoints
router.use('/companies', companyRoutes);
router.use('/teams', teamRoutes);
router.use('/teams', ticketStatusRoutes);
router.use('/custom-fields', customFieldRoutes);
router.use('/tickets', ticketRoutes);
router.use('/tickets', ticketNoteRoutes);
router.use('/tickets', ticketArchivalRoutes);
router.use('/queues', queueRoutes);
router.use('/files', fileRoutes);
router.use('/bulk', bulkOperationsRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);
router.use('/system', systemConfigRoutes);
router.use('/reports', reportsRoutes);
router.use('/monitoring', monitoringRoutes);
// Temporarily disabled - Stripe not configured
// router.use('/subscriptions', subscriptionRoutes);
// router.use('/subscription-analytics', subscriptionAnalyticsRoutes);
// router.use('/usage-alerts', usageAlertRoutes);
// router.use('/billing', billingRoutes);
router.use('/data-export', dataExportRoutes);
router.use('/query-builder', queryBuilderRoutes);
router.use('/customer-query-builder', customerQueryBuilderRoutes);
router.use('/business-hours', businessHoursRoutes);
router.use('/organizational-roles', organizationalRolesRoutes);
router.use('/user-profiles', userProfilesRoutes);
router.use('/', emailRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Bomizzel Ticketing System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      enhancedRegistration: '/api/auth/register-enhanced',
      adminProvisioning: '/api/admin/provisioning',
      users: '/api/users',
      agents: '/api/agents',
      companies: '/api/companies',
      teams: '/api/teams',
      teamStatuses: '/api/teams/:teamId/statuses',
      customFields: '/api/custom-fields',
      tickets: '/api/tickets',
      ticketNotes: '/api/tickets/:ticketId/notes',
      ticketArchival: '/api/tickets/:ticketId/archive',
      queues: '/api/queues',
      files: '/api/files',
      bulk: '/api/bulk',
      search: '/api/search',
      admin: '/api/admin',
      systemConfig: '/api/system',
      reports: '/api/reports',
      monitoring: '/api/monitoring',
      subscriptions: '/api/subscriptions',
      subscriptionAnalytics: '/api/subscription-analytics',
      usageAlerts: '/api/usage-alerts',
      billing: '/api/billing',
      dataExport: '/api/data-export',
      dataImport: '/api/data-export/import',
      businessHours: '/api/business-hours',
      email: '/api/email',
      emailTemplates: '/api/email/templates',
      health: '/health',
    },
  });
});

export default router;
