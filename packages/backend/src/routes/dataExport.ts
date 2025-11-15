// @ts-nocheck
import { Router, Request, Response } from 'express';
import { DataExportService, ExportOptions } from '../services/DataExportService';
import { DataImportService, ImportOptions } from '../services/DataImportService';
import { authenticate } from '../middleware/auth';
import { validate } from '../utils/validation';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { uploadSingle } from '../middleware/fileUpload';
import path from 'path';
import fs from 'fs';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const exportSchema = Joi.object({
  companyId: Joi.string().uuid().required(),
  includeUsers: Joi.boolean().default(true),
  includeTickets: Joi.boolean().default(true),
  includeAttachments: Joi.boolean().default(true),
  includeCustomFields: Joi.boolean().default(true),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  format: Joi.string().valid('json', 'csv').default('json')
});

const importSchema = Joi.object({
  companyId: Joi.string().uuid().required(),
  overwriteExisting: Joi.boolean().default(false),
  skipDuplicates: Joi.boolean().default(true),
  validateOnly: Joi.boolean().default(false)
});

/**
 * POST /api/data-export/export
 * Export company data
 */
router.post(
  '/export',
  validate(exportSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { companyId, ...options } = req.body as ExportOptions & { companyId: string };

      logger.info('Export request received', { userId, companyId, options });

      const result = await DataExportService.exportCompanyData(
        companyId,
        userId,
        options
      );

      res.json({
        success: true,
        message: 'Data export completed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Export failed', { error });
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Export failed',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * GET /api/data-export/download/:exportId/:fileName
 * Download exported file
 */
router.get(
  '/download/:exportId/:fileName',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { exportId, fileName } = req.params;
      const filePath = path.join(process.cwd(), 'exports', exportId, fileName);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({
          success: false,
          message: 'Export file not found or has expired'
        });
        return;
      }

      res.download(filePath, fileName, (err) => {
        if (err) {
          logger.error('Download failed', { error: err, exportId, fileName });
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Download failed'
            });
          }
        }
      });

    } catch (error) {
      logger.error('Download failed', { error });
      res.status(500).json({
        success: false,
        message: 'Download failed'
      });
    }
  }
);

/**
 * POST /api/data-export/import
 * Import company data from file
 */
router.post(
  '/import',
  uploadSingle,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      // Parse options from request body
      const options: ImportOptions = {
        overwriteExisting: req.body.overwriteExisting === 'true',
        skipDuplicates: req.body.skipDuplicates !== 'false',
        validateOnly: req.body.validateOnly === 'true'
      };

      const companyId = req.body.companyId;

      if (!companyId) {
        res.status(400).json({
          success: false,
          message: 'Company ID is required'
        });
        return;
      }

      // Read and parse the uploaded file
      const fileContent = fs.readFileSync(file.path, 'utf-8');
      const importData = JSON.parse(fileContent);

      // Clean up uploaded file
      fs.unlinkSync(file.path);

      logger.info('Import request received', { userId, companyId, options });

      const result = await DataImportService.importCompanyData(
        companyId,
        userId,
        importData,
        options
      );

      res.json({
        success: result.success,
        message: result.success ? 'Data import completed successfully' : 'Data import validation failed',
        data: result
      });

    } catch (error) {
      logger.error('Import failed', { error });
      
      // Clean up file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
);

/**
 * GET /api/data-export/history/:companyId
 * Get export/import history for a company
 */
router.get(
  '/history/:companyId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const exportHistory = await DataExportService.getExportHistory(companyId, limit);
      const importHistory = await DataImportService.getImportHistory(companyId, limit);

      res.json({
        success: true,
        data: {
          exports: exportHistory,
          imports: importHistory
        }
      });

    } catch (error) {
      logger.error('Failed to get history', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve history'
      });
    }
  }
);

/**
 * POST /api/data-export/cleanup
 * Clean up old export files (admin only)
 */
router.post(
  '/cleanup',
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const olderThanHours = req.body.olderThanHours || 24;
      await DataExportService.cleanupOldExports(olderThanHours);

      res.json({
        success: true,
        message: 'Cleanup completed successfully'
      });

    } catch (error) {
      logger.error('Cleanup failed', { error });
      res.status(500).json({
        success: false,
        message: 'Cleanup failed'
      });
    }
  }
);

export default router;
