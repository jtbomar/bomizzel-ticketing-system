import { BaseModel } from './BaseModel';
import { SystemSettingTable } from '@/types/database';
import { SystemSetting as SystemSettingModel } from '@/types/models';

export class SystemSetting extends BaseModel {
  protected static tableName = 'system_settings';

  static async getSetting(key: string): Promise<SystemSettingTable | null> {
    const result = await this.query.where('key', key).first();
    return result || null;
  }

  static async setSetting(key: string, value: any, category: string = 'general'): Promise<SystemSettingTable> {
    const existing = await this.getSetting(key);
    
    if (existing) {
      return this.update(existing.id, {
        value: JSON.stringify(value),
        category,
      });
    } else {
      return this.create({
        key,
        value: JSON.stringify(value),
        category,
      });
    }
  }

  static async getSettingsByCategory(category: string): Promise<SystemSettingTable[]> {
    return this.query.where('category', category).orderBy('key', 'asc');
  }

  static async getAllSettings(): Promise<SystemSettingTable[]> {
    return this.query.orderBy('category', 'asc').orderBy('key', 'asc');
  }

  static async deleteSetting(key: string): Promise<void> {
    await this.query.where('key', key).del();
  }

  // Convert database record to API model
  static toModel(setting: SystemSettingTable): SystemSettingModel {
    let parsedValue;
    try {
      parsedValue = JSON.parse(setting.value);
    } catch {
      parsedValue = setting.value;
    }

    return {
      id: setting.id,
      key: setting.key,
      value: parsedValue,
      category: setting.category,
      createdAt: setting.created_at,
      updatedAt: setting.updated_at,
    };
  }
}