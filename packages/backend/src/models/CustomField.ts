import { BaseModel } from './BaseModel';
import { CustomFieldTable } from '@/types/database';
import { CustomField as CustomFieldModel } from '@/types/models';

export class CustomField extends BaseModel {
  protected static tableName = 'custom_fields';

  static async createCustomField(fieldData: {
    teamId: string;
    name: string;
    label: string;
    type: 'string' | 'number' | 'decimal' | 'integer' | 'picklist';
    isRequired?: boolean;
    options?: string[];
    validation?: Record<string, any>;
    order?: number;
  }): Promise<CustomFieldTable> {
    return this.create({
      team_id: fieldData.teamId,
      name: fieldData.name,
      label: fieldData.label,
      type: fieldData.type,
      is_required: fieldData.isRequired || false,
      options: fieldData.options,
      validation: fieldData.validation,
      order: fieldData.order || 0,
    });
  }

  static async findByTeam(teamId: string): Promise<CustomFieldTable[]> {
    return this.query
      .where('team_id', teamId)
      .where('is_active', true)
      .orderBy('order', 'asc')
      .orderBy('created_at', 'asc');
  }

  static async findByTeamAndName(teamId: string, name: string): Promise<CustomFieldTable | null> {
    const result = await this.query.where('team_id', teamId).where('name', name).first();
    return result || null;
  }

  static async updateOrder(fieldId: string, order: number): Promise<CustomFieldTable | null> {
    return this.update(fieldId, { order });
  }

  static async validateFieldValue(
    field: CustomFieldTable,
    value: any
  ): Promise<{ isValid: boolean; error?: string }> {
    // Required field validation
    if (field.is_required && (value === null || value === undefined || value === '')) {
      return { isValid: false, error: `${field.label} is required` };
    }

    // Skip validation if value is empty and field is not required
    if (!field.is_required && (value === null || value === undefined || value === '')) {
      return { isValid: true };
    }

    // Type-specific validation
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { isValid: false, error: `${field.label} must be a string` };
        }
        break;

      case 'number':
      case 'decimal':
        if (typeof value !== 'number' || isNaN(value)) {
          return { isValid: false, error: `${field.label} must be a valid number` };
        }
        break;

      case 'integer':
        if (!Number.isInteger(value)) {
          return { isValid: false, error: `${field.label} must be an integer` };
        }
        break;

      case 'picklist':
        if (!field.options || !Array.isArray(field.options)) {
          return { isValid: false, error: `${field.label} has no valid options configured` };
        }
        if (!field.options.includes(value)) {
          return {
            isValid: false,
            error: `${field.label} must be one of: ${field.options.join(', ')}`,
          };
        }
        break;
    }

    // Custom validation rules
    if (field.validation) {
      const validation = field.validation;

      // Min/Max validation for numbers
      if (
        (field.type === 'number' || field.type === 'decimal' || field.type === 'integer') &&
        typeof value === 'number'
      ) {
        if (validation.min !== undefined && value < validation.min) {
          return { isValid: false, error: `${field.label} must be at least ${validation.min}` };
        }
        if (validation.max !== undefined && value > validation.max) {
          return { isValid: false, error: `${field.label} must be at most ${validation.max}` };
        }
      }

      // Length validation for strings
      if (field.type === 'string' && typeof value === 'string') {
        if (validation.min !== undefined && value.length < validation.min) {
          return {
            isValid: false,
            error: `${field.label} must be at least ${validation.min} characters`,
          };
        }
        if (validation.max !== undefined && value.length > validation.max) {
          return {
            isValid: false,
            error: `${field.label} must be at most ${validation.max} characters`,
          };
        }
      }

      // Pattern validation for strings
      if (field.type === 'string' && validation.pattern && typeof value === 'string') {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return {
            isValid: false,
            error: validation.message || `${field.label} format is invalid`,
          };
        }
      }
    }

    return { isValid: true };
  }

  static async validateCustomFieldValues(
    teamId: string,
    values: Record<string, any>
  ): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    const fields = await this.findByTeam(teamId);
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const value = values[field.name];
      const validation = await this.validateFieldValue(field, value);

      if (!validation.isValid && validation.error) {
        errors[field.name] = validation.error;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  static async reorderFields(
    teamId: string,
    fieldOrders: { fieldId: string; order: number }[]
  ): Promise<void> {
    await this.transaction(async (trx) => {
      for (const { fieldId, order } of fieldOrders) {
        await trx('custom_fields')
          .where('id', fieldId)
          .where('team_id', teamId)
          .update({ order, updated_at: new Date() });
      }
    });
  }

  // Convert database record to API model
  static toModel(field: CustomFieldTable): CustomFieldModel {
    return {
      id: field.id,
      teamId: field.team_id,
      name: field.name,
      label: field.label,
      type: field.type,
      isRequired: field.is_required,
      options: field.options,
      validation: field.validation,
      order: field.order,
      isActive: field.is_active,
      createdAt: field.created_at,
      updatedAt: field.updated_at,
    };
  }
}
