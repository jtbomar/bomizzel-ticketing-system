import { SystemSetting } from '@/models/SystemSetting';
import { User } from '@/models/User';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { SystemSetting as SystemSettingModel } from '@/types/models';

export class SystemConfigService {
  /**
   * Get all system settings grouped by category
   */
  static async getAllSettings(): Promise<{ [category: string]: SystemSettingModel[] }> {
    try {
      const settings = await SystemSetting.getAllSettings();
      const grouped: { [category: string]: SystemSettingModel[] } = {};

      settings.forEach((setting) => {
        const model = SystemSetting.toModel(setting);
        if (!grouped[model.category]) {
          grouped[model.category] = [];
        }
        grouped[model.category].push(model);
      });

      return grouped;
    } catch (error) {
      logger.error('Get all settings error:', error);
      throw new AppError('Failed to get system settings', 500, 'GET_SETTINGS_FAILED');
    }
  }

  /**
   * Get settings by category
   */
  static async getSettingsByCategory(category: string): Promise<SystemSettingModel[]> {
    try {
      const settings = await SystemSetting.getSettingsByCategory(category);
      return settings.map((setting) => SystemSetting.toModel(setting));
    } catch (error) {
      logger.error('Get settings by category error:', error);
      throw new AppError('Failed to get settings by category', 500, 'GET_CATEGORY_SETTINGS_FAILED');
    }
  }

  /**
   * Get a specific setting value
   */
  static async getSetting(key: string): Promise<any> {
    try {
      const setting = await SystemSetting.getSetting(key);
      if (!setting) {
        return null;
      }

      return SystemSetting.toModel(setting).value;
    } catch (error) {
      logger.error('Get setting error:', error);
      throw new AppError('Failed to get setting', 500, 'GET_SETTING_FAILED');
    }
  }

  /**
   * Update system settings (admin only)
   */
  static async updateSettings(
    settings: { key: string; value: any; category?: string }[],
    updatedById: string
  ): Promise<SystemSettingModel[]> {
    try {
      // Check if user is admin
      const user = await User.findById(updatedById);
      if (!user || user.role !== 'admin') {
        throw new AppError('Only administrators can update system settings', 403, 'ADMIN_REQUIRED');
      }

      const updatedSettings: SystemSettingModel[] = [];

      for (const { key, value, category = 'general' } of settings) {
        const setting = await SystemSetting.setSetting(key, value, category);
        updatedSettings.push(SystemSetting.toModel(setting));
      }

      logger.info(`System settings updated by ${updatedById}`, {
        settingKeys: settings.map((s) => s.key),
      });

      return updatedSettings;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Update settings error:', error);
      throw new AppError('Failed to update system settings', 500, 'UPDATE_SETTINGS_FAILED');
    }
  }

  /**
   * Delete a system setting (admin only)
   */
  static async deleteSetting(key: string, deletedById: string): Promise<void> {
    try {
      // Check if user is admin
      const user = await User.findById(deletedById);
      if (!user || user.role !== 'admin') {
        throw new AppError('Only administrators can delete system settings', 403, 'ADMIN_REQUIRED');
      }

      const setting = await SystemSetting.getSetting(key);
      if (!setting) {
        throw new AppError('Setting not found', 404, 'SETTING_NOT_FOUND');
      }

      await SystemSetting.deleteSetting(key);

      logger.info(`System setting ${key} deleted by ${deletedById}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Delete setting error:', error);
      throw new AppError('Failed to delete system setting', 500, 'DELETE_SETTING_FAILED');
    }
  }

  /**
   * Get default system configuration
   */
  static getDefaultConfig(): { [key: string]: any } {
    return {
      // Email settings
      'email.smtp.host': '',
      'email.smtp.port': 587,
      'email.smtp.secure': false,
      'email.smtp.user': '',
      'email.smtp.password': '',
      'email.from.name': 'Bomizzel Support',
      'email.from.address': 'support@bomizzel.com',

      // File upload settings
      'files.maxSize': 10485760, // 10MB
      'files.allowedTypes': [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'text/plain',
      ],
      'files.storage.type': 'local',
      'files.storage.path': './uploads',

      // Security settings
      'security.jwt.expiresIn': '1h',
      'security.jwt.refreshExpiresIn': '7d',
      'security.passwordMinLength': 8,
      'security.maxLoginAttempts': 5,
      'security.lockoutDuration': 900, // 15 minutes

      // Ticket settings
      'tickets.defaultStatus': 'open',
      'tickets.autoAssignment': false,
      'tickets.priorityLevels': ['low', 'medium', 'high', 'urgent'],

      // Dashboard settings
      'dashboard.refreshInterval': 30000, // 30 seconds
      'dashboard.metricsRetention': 90, // days

      // Notification settings
      'notifications.email.enabled': true,
      'notifications.browser.enabled': true,
      'notifications.realtime.enabled': true,

      // System settings
      'system.maintenanceMode': false,
      'system.registrationEnabled': true,
      'system.companyName': 'Bomizzel',
      'system.supportEmail': 'support@bomizzel.com',
      'system.timezone': 'UTC',
    };
  }

  /**
   * Initialize default settings if they don't exist
   */
  static async initializeDefaultSettings(): Promise<void> {
    try {
      const defaultConfig = this.getDefaultConfig();

      for (const [key, value] of Object.entries(defaultConfig)) {
        const existing = await SystemSetting.getSetting(key);
        if (!existing) {
          const category = key.split('.')[0];
          await SystemSetting.setSetting(key, value, category);
        }
      }

      logger.info('Default system settings initialized');
    } catch (error) {
      logger.error('Initialize default settings error:', error);
      throw new AppError('Failed to initialize default settings', 500, 'INIT_SETTINGS_FAILED');
    }
  }

  /**
   * Export system configuration
   */
  static async exportConfig(): Promise<{ [key: string]: any }> {
    try {
      const settings = await SystemSetting.getAllSettings();
      const config: { [key: string]: any } = {};

      settings.forEach((setting) => {
        const model = SystemSetting.toModel(setting);
        config[model.key] = model.value;
      });

      return config;
    } catch (error) {
      logger.error('Export config error:', error);
      throw new AppError('Failed to export configuration', 500, 'EXPORT_CONFIG_FAILED');
    }
  }

  /**
   * Import system configuration (admin only)
   */
  static async importConfig(config: { [key: string]: any }, importedById: string): Promise<void> {
    try {
      // Check if user is admin
      const user = await User.findById(importedById);
      if (!user || user.role !== 'admin') {
        throw new AppError(
          'Only administrators can import system configuration',
          403,
          'ADMIN_REQUIRED'
        );
      }

      for (const [key, value] of Object.entries(config)) {
        const category = key.split('.')[0];
        await SystemSetting.setSetting(key, value, category);
      }

      logger.info(`System configuration imported by ${importedById}`, {
        settingCount: Object.keys(config).length,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Import config error:', error);
      throw new AppError('Failed to import configuration', 500, 'IMPORT_CONFIG_FAILED');
    }
  }
}
