import { Router, Request, Response } from 'express';
import { QueryBuilderService } from '../services/QueryBuilderService';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

/**
 * POST /api/query-builder/execute
 * Execute a SQL query
 */
router.post('/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.body;
    const userId = req.user!.id;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query is required'
      });
      return;
    }

    const result = await QueryBuilderService.executeQuery(query, userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Query execution failed', { error });
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Query execution failed'
    });
  }
});

/**
 * POST /api/query-builder/build
 * Build a query from visual builder parameters
 */
router.post('/build', async (req: Request, res: Response): Promise<void> => {
  try {
    const params = req.body;
    const query = QueryBuilderService.buildQuery(params);

    res.json({
      success: true,
      data: { query }
    });

  } catch (error) {
    logger.error('Query building failed', { error });
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Query building failed'
    });
  }
});

/**
 * GET /api/query-builder/schema
 * Get database schema (tables and columns)
 */
router.get('/schema', async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = await QueryBuilderService.getTableSchema();

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
 * GET /api/query-builder/templates
 * Get common query templates
 */
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = QueryBuilderService.getQueryTemplates();

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
 * GET /api/query-builder/history
 * Get query execution history
 */
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const history = await QueryBuilderService.getQueryHistory(userId, limit);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    logger.error('Failed to get history', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve query history'
    });
  }
});

/**
 * POST /api/query-builder/export
 * Execute query and export results as CSV
 */
router.post('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.body;
    const userId = req.user!.id;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Query is required'
      });
      return;
    }

    const result = await QueryBuilderService.executeQuery(query, userId);
    const csv = QueryBuilderService.exportToCSV(result);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="query_results_${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    logger.error('Query export failed', { error });
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Query export failed'
    });
  }
});

export default router;
