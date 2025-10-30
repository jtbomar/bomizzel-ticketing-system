import { Router, Request, Response } from 'express';
import { ReportingService } from '@/services/ReportingService';
import { authenticate } from '@/middleware/auth';
import { requireEmployee } from '@/middleware/requireRole';
import { validateRequest } from '@/utils/validation';

const router = Router();

/**
 * GET /reports/tickets
 * Generate ticket analytics report
 */
router.get('/tickets', authenticate, requireEmployee, validateRequest({
  query: {
    startDate: { type: 'string', required: false, format: 'date' },
    endDate: { type: 'string', required: false, format: 'date' },
    teamId: { type: 'string', required: false, format: 'uuid' },
    status: { type: 'string', required: false },
    assignedToId: { type: 'string', required: false, format: 'uuid' },
  },
}), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, teamId, status, assignedToId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const filters: any = {};
    
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }
    
    if (teamId) {
      filters.teamId = teamId as string;
    }
    
    if (status) {
      filters.status = status as string;
    }
    
    if (assignedToId) {
      filters.assignedToId = assignedToId as string;
    }

    const report = await ReportingService.generateTicketReport(filters, userId);

    res.json({ report });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'GENERATE_TICKET_REPORT_FAILED',
        message: 'Failed to generate ticket report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /reports/users
 * Generate user analytics report (admin only)
 */
router.get('/users', authenticate, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const report = await ReportingService.generateUserReport(userId);

    res.json({ report });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'GENERATE_USER_REPORT_FAILED',
        message: 'Failed to generate user report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /reports/teams
 * Generate team analytics report
 */
router.get('/teams', authenticate, requireEmployee, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const report = await ReportingService.generateTeamReport(userId);

    res.json({ report });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'GENERATE_TEAM_REPORT_FAILED',
        message: 'Failed to generate team report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /reports/export/:dataType
 * Export data to CSV format (admin only)
 */
router.get('/export/:dataType', authenticate, validateRequest({
  params: {
    dataType: { type: 'string', required: true, enum: ['tickets', 'users', 'teams'] },
  },
  query: {
    startDate: { type: 'string', required: false, format: 'date' },
    endDate: { type: 'string', required: false, format: 'date' },
    teamId: { type: 'string', required: false, format: 'uuid' },
    status: { type: 'string', required: false },
  },
}), async (req: Request, res: Response) => {
  try {
    const { dataType } = req.params;
    const { startDate, endDate, teamId, status } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const filters: any = {};
    
    if (startDate) {
      filters.startDate = new Date(startDate as string);
    }
    
    if (endDate) {
      filters.endDate = new Date(endDate as string);
    }
    
    if (teamId) {
      filters.teamId = teamId as string;
    }
    
    if (status) {
      filters.status = status as string;
    }

    const csvData = await ReportingService.exportToCSV(
      dataType as 'tickets' | 'users' | 'teams',
      filters,
      userId
    );

    const filename = `${dataType}-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'EXPORT_DATA_FAILED',
        message: 'Failed to export data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default router;