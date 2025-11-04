import express from 'express';
import { TicketArchivalService } from '@/services/TicketArchivalService';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Simple auth middleware for mock server
const auth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    req.user = { id: decoded.userId, email: decoded.email, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Archive a single ticket
 * POST /api/tickets/:ticketId/archive
 */
router.post('/:ticketId/archive', auth, async (req: any, res: any) => {
  try {
    const { ticketId } = req.params;
    const { id: userId, role } = req.user;

    // Mock implementation for demo
    console.log('Archiving ticket:', ticketId, 'by user:', userId, 'with role:', role);

    res.json({
      success: true,
      message: 'Ticket archived successfully',
    });
  } catch (error) {
    console.error('Error archiving ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Restore an archived ticket
 * POST /api/tickets/:ticketId/restore
 */
router.post('/:ticketId/restore', auth, async (req: any, res: any) => {
  try {
    const { ticketId } = req.params;
    const { id: userId, role } = req.user;

    // Mock implementation for demo
    console.log('Restoring ticket:', ticketId, 'by user:', userId, 'with role:', role);

    res.json({
      success: true,
      message: 'Ticket restored successfully',
    });
  } catch (error) {
    console.error('Error restoring ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Bulk archive multiple tickets
 * POST /api/tickets/archive/bulk
 */
router.post('/archive/bulk', auth, async (req: any, res: any) => {
  try {
    const { ticketIds } = req.body;
    const { id: userId, role } = req.user;

    // Mock implementation
    console.log('Bulk archiving tickets:', ticketIds, 'by user:', userId, 'with role:', role);

    res.json({
      success: true,
      message: `Archived ${ticketIds.length} tickets`,
      data: {
        successful: ticketIds,
        failed: [],
        totalProcessed: ticketIds.length,
        archivedCount: ticketIds.length,
      },
    });
  } catch (error) {
    console.error('Error bulk archiving tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get archival suggestions for the current user
 * GET /api/tickets/archive/suggestions
 */
router.get('/archive/suggestions', auth, async (req: any, res: any) => {
  try {
    // Mock suggestions data
    const suggestions = [
      {
        ticketId: 'bb0e8400-e29b-41d4-a716-446655440001',
        title: 'Old resolved ticket',
        status: 'resolved',
        completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        daysSinceCompletion: 45,
        canArchive: true,
        reason: 'Completed over 30 days ago',
      },
    ];

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Error getting archival suggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get archivable tickets for the current user
 * GET /api/tickets/archivable
 */
router.get('/archivable', auth, async (req: any, res: any) => {
  try {
    // Mock archivable tickets
    const tickets = [
      {
        id: 'bb0e8400-e29b-41d4-a716-446655440001',
        title: 'Old resolved ticket',
        status: 'resolved',
        resolvedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        closedAt: null,
        updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        canArchive: true,
      },
    ];

    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    console.error('Error getting archivable tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Search archived tickets
 * GET /api/tickets/archived
 */
router.get('/archived', auth, async (req: any, res: any) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Mock archived tickets
    const tickets = [
      {
        id: 'bb0e8400-e29b-41d4-a716-446655440003',
        title: 'Archived ticket example',
        status: 'resolved',
        archived_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        submitter_id: 'user1',
        company_id: 'company1',
      },
    ];

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: tickets.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error('Error searching archived tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get archival statistics for the current user
 * GET /api/tickets/archive/stats
 */
router.get('/archive/stats', auth, async (req: any, res: any) => {
  try {
    // Mock stats
    const stats = {
      totalArchived: 15,
      archivedThisMonth: 3,
      archivedThisYear: 12,
      oldestArchived: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      newestArchived: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting archival stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get automated archival suggestions for the current user
 * GET /api/tickets/archive/auto-suggestions
 */
router.get('/archive/auto-suggestions', auth, async (req: any, res: any) => {
  try {
    const { id: userId, role } = req.user;

    // Mock enhanced automated suggestions with Enterprise features
    const suggestions = {
      shouldSuggestArchival: true,
      reason: 'Warning: Approaching completed ticket limit',
      suggestions: [
        {
          ticketId: 'bb0e8400-e29b-41d4-a716-446655440001',
          title: 'Old resolved ticket from 45 days ago',
          status: 'resolved',
          completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          daysSinceCompletion: 45,
          priority: 'high' as const,
        },
        {
          ticketId: 'bb0e8400-e29b-41d4-a716-446655440002',
          title: 'Completed support request',
          status: 'completed',
          completedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          daysSinceCompletion: 35,
          priority: 'medium' as const,
        },
        {
          ticketId: 'bb0e8400-e29b-41d4-a716-446655440003',
          title: 'Closed bug report',
          status: 'closed',
          completedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          daysSinceCompletion: 25,
          priority: 'low' as const,
        },
      ],
      usageInfo: {
        current: 85,
        limit: 100,
        percentage: 85,
      },
      automationAvailable: role === 'admin' || role === 'enterprise_user', // Mock Enterprise check
      automationConfig: {
        enabled: true,
        daysAfterCompletion: 30,
        nextRunDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    };

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Error getting auto suggestions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Run automated archival for Enterprise users (admin only)
 * POST /api/tickets/archive/run-automation
 */
router.post('/archive/run-automation', auth, async (req: any, res: any) => {
  try {
    const { role } = req.user;

    // Only admins can trigger automated archival
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can run automated archival',
      });
    }

    // Mock automation result
    const result = {
      processedSubscriptions: 5,
      totalTicketsArchived: 23,
      subscriptionResults: [],
    };

    res.json({
      success: true,
      message: `Automated archival completed. Processed ${result.processedSubscriptions} subscriptions and archived ${result.totalTicketsArchived} tickets.`,
      data: result,
    });
  } catch (error) {
    console.error('Error running automation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get automatic archival configuration for current user
 * GET /api/tickets/archive/auto-config
 */
router.get('/archive/auto-config', auth, async (req: any, res: any) => {
  try {
    const { id: userId, role } = req.user;

    // Mock Enterprise configuration
    const config = {
      available: role === 'admin' || role === 'enterprise_user',
      enabled: true,
      config: {
        enabled: true,
        daysAfterCompletion: 30,
        maxTicketsPerRun: 50,
        onlyWhenApproachingLimits: false,
        limitThreshold: 0,
      },
      planName: role === 'admin' || role === 'enterprise_user' ? 'Enterprise' : 'Professional',
    };

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error getting auto-archival config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Configure automatic archival for Enterprise users
 * POST /api/tickets/archive/auto-config
 */
router.post('/archive/auto-config', auth, async (req: any, res: any) => {
  try {
    const { id: userId, role } = req.user;
    const { enabled, daysAfterCompletion, maxTicketsPerRun } = req.body;

    // Check if user has Enterprise plan
    if (role !== 'admin' && role !== 'enterprise_user') {
      return res.status(403).json({
        success: false,
        message: 'Automatic archival configuration is only available for Enterprise plans',
      });
    }

    // Mock configuration update
    const config = {
      enabled: enabled !== undefined ? enabled : true,
      daysAfterCompletion: daysAfterCompletion || 30,
      maxTicketsPerRun: maxTicketsPerRun || 50,
      onlyWhenApproachingLimits: false,
      limitThreshold: 0,
    };

    res.json({
      success: true,
      message: 'Automatic archival configuration updated successfully',
      data: { config },
    });
  } catch (error) {
    console.error('Error configuring auto-archival:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Trigger immediate archival for Enterprise users
 * POST /api/tickets/archive/trigger-immediate
 */
router.post('/archive/trigger-immediate', auth, async (req: any, res: any) => {
  try {
    const { id: userId, role } = req.user;
    const { daysAfterCompletion, maxTickets } = req.body;

    // Check if user has Enterprise plan
    if (role !== 'admin' && role !== 'enterprise_user') {
      return res.status(403).json({
        success: false,
        message: 'Immediate archival is only available for Enterprise plans',
      });
    }

    // Mock immediate archival
    const archivedCount = Math.floor(Math.random() * 20) + 5; // Random 5-25 tickets

    res.json({
      success: true,
      message: `Archived ${archivedCount} tickets successfully`,
      data: {
        archivedCount,
        errors: [],
      },
    });
  } catch (error) {
    console.error('Error triggering immediate archival:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get archival automation status and next run time
 * GET /api/tickets/archive/automation-status
 */
router.get('/archive/automation-status', auth, async (req: any, res: any) => {
  try {
    const { role } = req.user;

    // Mock automation status
    const status = {
      isRunning: true,
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      lastRunResults: {
        processedSubscriptions: 3,
        totalTicketsArchived: 15,
        errors: 0,
      },
      available: role === 'admin' || role === 'enterprise_user',
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting automation status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
