/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('ticket_history', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('ticket_id').notNullable();
    table.uuid('user_id').notNullable();
    table.string('action').notNullable(); // 'created', 'updated', 'assigned', 'status_changed', etc.
    table.string('field_name').nullable(); // Field that was changed
    table.text('old_value').nullable();
    table.text('new_value').nullable();
    table.jsonb('metadata').nullable(); // Additional context
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('RESTRICT');
    
    // Indexes
    table.index('ticket_id');
    table.index('user_id');
    table.index('action');
    table.index('field_name');
    table.index('created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('ticket_history');
};