import { CustomField } from '@/models/CustomField';
import { Team } from '@/models/Team';
import { CustomField as CustomFieldModel, FieldValidation } from '@/types/models';

export class CustomFieldService {
  /**
   * Create a new custom field for a team
   */
  static async createCustomField(
    teamId: string,
    fieldData: {
      name: string;
      label: string;
      type: 'string' | 'number' | 'decimal' | 'integer' | 'picklist';
      isRequired?: boolean;
      options?: string[];
      validation?: FieldValidation;
    }
  ): Promise<CustomFieldModel> {
    // Validate team exists
    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if field name already exists for this team
    const existingField = await CustomField.findByTeamAndName(teamId, fieldData.name);
    if (existingField) {
      throw new Error(`Custom field with name '${fieldData.name}' already exists for this team`);
    }

    // Validate field configuration
    this.validateFieldConfiguration(fieldData);

    // Get next order number
    const existingFields = await CustomField.findByTeam(teamId);
    const nextOrder =
      existingFields.length > 0 ? Math.max(...existingFields.map((f) => f.order)) + 1 : 0;

    // Create the field
    const field = await CustomField.createCustomField({
      teamId,
      name: fieldData.name,
      label: fieldData.label,
      type: fieldData.type,
      isRequired: fieldData.isRequired || false,
      ...(fieldData.options && { options: fieldData.options }),
      ...(fieldData.validation && { validation: fieldData.validation }),
      order: nextOrder,
    });

    return CustomField.toModel(field);
  }

  /**
   * Get all custom fields for a team
   */
  static async getTeamCustomFields(teamId: string): Promise<CustomFieldModel[]> {
    const fields = await CustomField.findByTeam(teamId);
    return fields.map((field) => CustomField.toModel(field));
  }

  /**
   * Update a custom field
   */
  static async updateCustomField(
    fieldId: string,
    teamId: string,
    updates: {
      label?: string;
      isRequired?: boolean;
      options?: string[];
      validation?: FieldValidation;
    }
  ): Promise<CustomFieldModel> {
    const field = await CustomField.findById(fieldId);
    if (!field) {
      throw new Error('Custom field not found');
    }

    if (field.team_id !== teamId) {
      throw new Error('Custom field does not belong to this team');
    }

    // Validate updates
    if (updates.options !== undefined && field.type === 'picklist') {
      if (!Array.isArray(updates.options) || updates.options.length === 0) {
        throw new Error('Picklist fields must have at least one option');
      }
    }

    if (updates.validation !== undefined) {
      this.validateFieldValidation(field.type, updates.validation);
    }

    const updatedField = await CustomField.update(fieldId, {
      label: updates.label,
      is_required: updates.isRequired,
      options: updates.options,
      validation: updates.validation,
    });

    if (!updatedField) {
      throw new Error('Failed to update custom field');
    }

    return CustomField.toModel(updatedField);
  }

  /**
   * Delete a custom field
   */
  static async deleteCustomField(fieldId: string, teamId: string): Promise<void> {
    const field = await CustomField.findById(fieldId);
    if (!field) {
      throw new Error('Custom field not found');
    }

    if (field.team_id !== teamId) {
      throw new Error('Custom field does not belong to this team');
    }

    await CustomField.update(fieldId, { is_active: false });
  }

  /**
   * Reorder custom fields for a team
   */
  static async reorderCustomFields(
    teamId: string,
    fieldOrders: { fieldId: string; order: number }[]
  ): Promise<void> {
    // Validate all fields belong to the team
    const teamFields = await CustomField.findByTeam(teamId);
    const teamFieldIds = new Set(teamFields.map((f) => f.id));

    for (const { fieldId } of fieldOrders) {
      if (!teamFieldIds.has(fieldId)) {
        throw new Error(`Field ${fieldId} does not belong to team ${teamId}`);
      }
    }

    await CustomField.reorderFields(teamId, fieldOrders);
  }

  /**
   * Validate custom field values against team's field definitions
   */
  static async validateCustomFieldValues(
    teamId: string,
    values: Record<string, any>
  ): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    return CustomField.validateCustomFieldValues(teamId, values);
  }

  /**
   * Get custom field by ID with team validation
   */
  static async getCustomField(fieldId: string, teamId: string): Promise<CustomFieldModel> {
    const field = await CustomField.findById(fieldId);
    if (!field) {
      throw new Error('Custom field not found');
    }

    if (field.team_id !== teamId) {
      throw new Error('Custom field does not belong to this team');
    }

    return CustomField.toModel(field);
  }

  /**
   * Validate field configuration
   */
  private static validateFieldConfiguration(fieldData: {
    name: string;
    label: string;
    type: 'string' | 'number' | 'decimal' | 'integer' | 'picklist';
    isRequired?: boolean;
    options?: string[];
    validation?: FieldValidation;
  }): void {
    // Validate field name (must be alphanumeric with underscores)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldData.name)) {
      throw new Error(
        'Field name must start with a letter and contain only letters, numbers, and underscores'
      );
    }

    // Validate label
    if (!fieldData.label || fieldData.label.trim().length === 0) {
      throw new Error('Field label is required');
    }

    // Validate picklist options
    if (fieldData.type === 'picklist') {
      if (
        !fieldData.options ||
        !Array.isArray(fieldData.options) ||
        fieldData.options.length === 0
      ) {
        throw new Error('Picklist fields must have at least one option');
      }

      // Check for duplicate options
      const uniqueOptions = new Set(fieldData.options);
      if (uniqueOptions.size !== fieldData.options.length) {
        throw new Error('Picklist options must be unique');
      }
    }

    // Validate validation rules
    if (fieldData.validation) {
      this.validateFieldValidation(fieldData.type, fieldData.validation);
    }
  }

  /**
   * Validate field validation rules
   */
  private static validateFieldValidation(
    fieldType: 'string' | 'number' | 'decimal' | 'integer' | 'picklist',
    validation: FieldValidation
  ): void {
    // Min/Max validation for numeric fields
    if (['number', 'decimal', 'integer'].includes(fieldType)) {
      if (validation.min !== undefined && validation.max !== undefined) {
        if (validation.min > validation.max) {
          throw new Error('Minimum value cannot be greater than maximum value');
        }
      }

      if (fieldType === 'integer') {
        if (validation.min !== undefined && !Number.isInteger(validation.min)) {
          throw new Error('Minimum value for integer field must be an integer');
        }
        if (validation.max !== undefined && !Number.isInteger(validation.max)) {
          throw new Error('Maximum value for integer field must be an integer');
        }
      }
    }

    // Length validation for string fields
    if (fieldType === 'string') {
      if (validation.min !== undefined && validation.max !== undefined) {
        if (validation.min > validation.max) {
          throw new Error('Minimum length cannot be greater than maximum length');
        }
      }

      if (validation.min !== undefined && validation.min < 0) {
        throw new Error('Minimum length cannot be negative');
      }

      if (validation.max !== undefined && validation.max < 1) {
        throw new Error('Maximum length must be at least 1');
      }

      // Validate regex pattern
      if (validation.pattern) {
        try {
          new RegExp(validation.pattern);
        } catch (error) {
          throw new Error('Invalid regex pattern in validation');
        }
      }
    }

    // Picklist fields don't support min/max/pattern validation
    if (fieldType === 'picklist') {
      if (validation.min !== undefined || validation.max !== undefined || validation.pattern) {
        throw new Error('Picklist fields do not support min/max/pattern validation');
      }
    }
  }
}
