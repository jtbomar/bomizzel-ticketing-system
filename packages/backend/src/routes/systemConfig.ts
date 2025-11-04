import { Router, Request, Response } from 'express';
import { SystemConfigService } from '@/services/SystemConfigService';
import { authenticate } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/requireRole';
import { validateRequest } from '@/utils/validation';

const router = Router();

/**
 * GET /system/settings
 * Get all system settings (admin only)
 */
router.get('/settings', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await SystemConfigService.getAllSettings();

    res.json({ settings });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'GET_SETTINGS_FAILED',
        message: 'Failed to retrieve system settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /system/settings/:category
 * Get settings by category (admin only)
 */
router.get(
  '/settings/:category',
  authenticate,
  requireAdmin,
  validateRequest({
    params: {
      category: { type: 'string', required: true },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.params;

      const settings = await SystemConfigService.getSettingsByCategory(category);

      res.json({ settings });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'GET_CATEGORY_SETTINGS_FAILED',
          message: 'Failed to retrieve settings by category',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * PUT /system/settings
 * Update system settings (admin only)
 */
router.put(
  '/settings',
  authenticate,
  requireAdmin,
  validateRequest({
    body: {
      settings: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', required: true },
            value: { required: true },
            category: { type: 'string', required: false },
          },
        },
      },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { settings } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      const updatedSettings = await SystemConfigService.updateSettings(settings, userId);

      res.json({ settings: updatedSettings });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'UPDATE_SETTINGS_FAILED',
          message: 'Failed to update system settings',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * DELETE /system/settings/:key
 * Delete a system setting (admin only)
 */
router.delete(
  '/settings/:key',
  authenticate,
  requireAdmin,
  validateRequest({
    params: {
      key: { type: 'string', required: true },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      await SystemConfigService.deleteSetting(key, userId);

      res.json({ message: 'Setting deleted successfully' });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'DELETE_SETTING_FAILED',
          message: 'Failed to delete system setting',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

/**
 * GET /system/config/export
 * Export system configuration (admin only)
 */
router.get('/config/export', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await SystemConfigService.exportConfig();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="system-config.json"');
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'EXPORT_CONFIG_FAILED',
        message: 'Failed to export system configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /system/config/import
 * Import system configuration (admin only)
 */
router.post(
  '/config/import',
  authenticate,
  requireAdmin,
  validateRequest({
    body: {
      config: { type: 'object', required: true },
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { config } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
      }

      await SystemConfigService.importConfig(config, userId);

      res.json({ message: 'Configuration imported successfully' });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'IMPORT_CONFIG_FAILED',
          message: 'Failed to import system configuration',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
);

export default router;
