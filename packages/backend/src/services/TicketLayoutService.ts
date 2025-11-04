import { db as knex } from '../config/database';
import { 
  TicketLayout, 
  LayoutField, 
  CreateLayoutRequest, 
  TicketLayoutResponse 
} from '../models/TicketLayout';

export class TicketLayoutService {
  
  async getLayoutsByTeam(teamId: string): Promise<TicketLayout[]> {
    const layouts = await knex('ticket_layouts')
      .where({ team_id: teamId, is_active: true })
      .orderBy('sort_order', 'asc')
      .select('*');
    
    return layouts.map(this.mapLayoutFromDb);
  }

  async getLayoutById(layoutId: string, includeFields = true): Promise<TicketLayoutResponse | null> {
    const layout = await knex('ticket_layouts')
      .where({ id: layoutId })
      .first();
    
    if (!layout) return null;

    const fields = includeFields 
      ? await knex('layout_fields')
          .where({ layout_id: layoutId })
          .orderBy('sort_order', 'asc')
          .select('*')
      : [];

    return {
      layout: this.mapLayoutFromDb(layout),
      fields: fields.map(this.mapFieldFromDb)
    };
  }

  async getDefaultLayout(teamId: string): Promise<TicketLayoutResponse | null> {
    const layout = await knex('ticket_layouts')
      .where({ team_id: teamId, is_default: true, is_active: true })
      .first();
    
    if (!layout) return null;

    const fields = await knex('layout_fields')
      .where({ layout_id: layout.id })
      .orderBy('sort_order', 'asc')
      .select('*');

    return {
      layout: this.mapLayoutFromDb(layout),
      fields: fields.map(this.mapFieldFromDb)
    };
  }

  async createLayout(teamId: string, request: CreateLayoutRequest): Promise<TicketLayoutResponse> {
    return await knex.transaction(async (trx) => {
      // If this is set as default, unset other defaults
      if (request.isDefault) {
        await trx('ticket_layouts')
          .where({ team_id: teamId })
          .update({ is_default: false });
      }

      // Create the layout
      const [layoutId] = await trx('ticket_layouts')
        .insert({
          team_id: teamId,
          name: request.name,
          description: request.description,
          layout_config: JSON.stringify(request.layoutConfig),
          is_default: request.isDefault || false,
          is_active: true,
          sort_order: await this.getNextSortOrder(trx, teamId)
        })
        .returning('id');

      // Create the fields
      const fieldsToInsert = request.fields.map(field => ({
        layout_id: layoutId.id,
        field_name: field.fieldName,
        field_label: field.fieldLabel,
        field_type: field.fieldType,
        field_config: JSON.stringify(field.fieldConfig),
        validation_rules: field.validationRules ? JSON.stringify(field.validationRules) : null,
        is_required: field.isRequired || false,
        sort_order: field.sortOrder,
        grid_position_x: field.gridPositionX,
        grid_position_y: field.gridPositionY,
        grid_width: field.gridWidth,
        grid_height: field.gridHeight
      }));

      if (fieldsToInsert.length > 0) {
        await trx('layout_fields').insert(fieldsToInsert);
      }

      // Return the created layout with fields
      const result = await this.getLayoutById(layoutId.id);
      return result!;
    });
  }

  async updateLayout(layoutId: string, request: Partial<CreateLayoutRequest>): Promise<TicketLayoutResponse | null> {
    return await knex.transaction(async (trx) => {
      const layout = await trx('ticket_layouts').where({ id: layoutId }).first();
      if (!layout) return null;

      // If this is set as default, unset other defaults
      if (request.isDefault) {
        await trx('ticket_layouts')
          .where({ team_id: layout.team_id })
          .whereNot({ id: layoutId })
          .update({ is_default: false });
      }

      // Update the layout
      const updateData: any = {};
      if (request.name) updateData.name = request.name;
      if (request.description !== undefined) updateData.description = request.description;
      if (request.layoutConfig) updateData.layout_config = JSON.stringify(request.layoutConfig);
      if (request.isDefault !== undefined) updateData.is_default = request.isDefault;

      if (Object.keys(updateData).length > 0) {
        await trx('ticket_layouts').where({ id: layoutId }).update(updateData);
      }

      // Update fields if provided
      if (request.fields) {
        // Delete existing fields
        await trx('layout_fields').where({ layout_id: layoutId }).del();

        // Insert new fields
        const fieldsToInsert = request.fields.map(field => ({
          layout_id: layoutId,
          field_name: field.fieldName,
          field_label: field.fieldLabel,
          field_type: field.fieldType,
          field_config: JSON.stringify(field.fieldConfig),
          validation_rules: field.validationRules ? JSON.stringify(field.validationRules) : null,
          is_required: field.isRequired || false,
          sort_order: field.sortOrder,
          grid_position_x: field.gridPositionX,
          grid_position_y: field.gridPositionY,
          grid_width: field.gridWidth,
          grid_height: field.gridHeight
        }));

        if (fieldsToInsert.length > 0) {
          await trx('layout_fields').insert(fieldsToInsert);
        }
      }

      // Return the updated layout with fields
      const result = await this.getLayoutById(layoutId);
      return result!;
    });
  }

  async deleteLayout(layoutId: string): Promise<boolean> {
    const result = await knex('ticket_layouts')
      .where({ id: layoutId })
      .update({ is_active: false });
    
    return result > 0;
  }

  async duplicateLayout(layoutId: string, newName: string): Promise<TicketLayoutResponse | null> {
    const original = await this.getLayoutById(layoutId);
    if (!original) return null;

    const request: CreateLayoutRequest = {
      name: newName,
      description: original.layout.description,
      layoutConfig: original.layout.layoutConfig,
      isDefault: false,
      fields: original.fields.map(field => ({
        fieldName: field.fieldName,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        fieldConfig: field.fieldConfig,
        validationRules: field.validationRules,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
        gridPositionX: field.gridPositionX,
        gridPositionY: field.gridPositionY,
        gridWidth: field.gridWidth,
        gridHeight: field.gridHeight
      }))
    };

    return await this.createLayout(original.layout.teamId, request);
  }

  private async getNextSortOrder(trx: any, teamId: string): Promise<number> {
    const result = await trx('ticket_layouts')
      .where({ team_id: teamId })
      .max('sort_order as max_order')
      .first();
    
    return (result?.max_order || 0) + 1;
  }

  private mapLayoutFromDb(row: any): TicketLayout {
    return {
      id: row.id,
      teamId: row.team_id,
      name: row.name,
      description: row.description,
      layoutConfig: typeof row.layout_config === 'string' 
        ? JSON.parse(row.layout_config) 
        : row.layout_config,
      isDefault: row.is_default,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapFieldFromDb(row: any): LayoutField {
    return {
      id: row.id,
      layoutId: row.layout_id,
      fieldName: row.field_name,
      fieldLabel: row.field_label,
      fieldType: row.field_type,
      fieldConfig: typeof row.field_config === 'string' 
        ? JSON.parse(row.field_config) 
        : row.field_config,
      validationRules: row.validation_rules 
        ? (typeof row.validation_rules === 'string' 
            ? JSON.parse(row.validation_rules) 
            : row.validation_rules)
        : undefined,
      isRequired: row.is_required,
      sortOrder: row.sort_order,
      gridPositionX: row.grid_position_x,
      gridPositionY: row.grid_position_y,
      gridWidth: row.grid_width,
      gridHeight: row.grid_height,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const ticketLayoutService = new TicketLayoutService();