import { Router, Request, Response } from 'express';
import { CustomerQueryBuilderService } from '../services/CustomerQueryBuilderService';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication (any authenticated user can access)
router.use(authenticate);

/**
 * POST /api/customer-query-builder/execute
 * Execute a SQL query scoped to user's company
 */
router.post('/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, companyId } = req.body;
    const userId = req.user!.id;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query is required'
      });
      return;
    }

    if (!companyId) {
      res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
      return;
    }

    const result = await CustomerQueryBuilderService.executeQuery(query, userId, companyId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Customer query execution failed', { error });
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Query execution failed'
    });
  }
});

/**
 * GET /api/customer-query-builder/schema
 * Get database schema (customer-accessible tables only)
 */
router.get('/schema', async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = await CustomerQueryBuilderService.getTableSchema();

    res.json({
      success: true,
      data: schema
    });

  } catch (error) {
    logger.error('Failed to get schema', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve database schema'
    });
  }
});

/**
 * GET /api/customer-query-builder/templates
 * Get customer query templates
 */
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = CustomerQueryBuilderService.getQueryTemplates();

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    logger.error('Failed to get templates', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve query templates'
    });
  }
});

/**
 * POST /api/customer-query-builder/export
 * Execute query and export results as CSV
 */
router.post('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, companyId } = req.body;
    const userId = req.user!.id;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query is required'
      });
      return;
    }

    if (!companyId) {
      res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
      return;
    }

    const result = await CustomerQueryBuilderService.executeQuery(query, userId, companyId);
    const csv = CustomerQueryBuilderService.exportToCSV(result);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report_${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    logger.error('Customer query export failed', { error });
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Query export failed'
    });
  }
});

export default router;
