/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('ticket_layouts', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('description');
      table.json('layout_config').notNullable(); // Stores field configuration and positioning
      table.boolean('is_default').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.integer('sort_order').defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['team_id', 'is_active']);
      table.index(['team_id', 'is_default']);
    })
    .createTable('layout_fields', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('layout_id').notNullable().references('id').inTable('ticket_layouts').onDelete('CASCADE');
      table.string('field_name').notNullable();
      table.string('field_label').notNullable();
      table.enum('field_type', [
        'text', 'textarea', 'rich_text', 'number', 'currency', 
        'date', 'datetime', 'picklist', 'multi_picklist', 
        'checkbox', 'radio', 'email', 'phone', 'url'
      ]).notNullable();
      table.json('field_config').notNullable(); // Field-specific configuration
      table.json('validation_rules'); // Validation configuration
      table.boolean('is_required').defaultTo(false);
      table.integer('sort_order').defaultTo(0);
      table.integer('grid_position_x').defaultTo(0);
      table.integer('grid_position_y').defaultTo(0);
      table.integer('grid_width').defaultTo(1);
      table.integer('grid_height').defaultTo(1);
      table.timestamps(true, true);
      
      table.index(['layout_id', 'sort_order']);
      table.unique(['layout_id', 'field_name']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('layout_fields')
    .dropTableIfExists('ticket_layouts');
};