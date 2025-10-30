/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('tickets', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title').notNullable();
    table.text('description').notNullable();
    table.string('status').notNullable().defaultTo('open');
    table.integer('priority').defaultTo(0);
    table.uuid('submitter_id').notNullable();
    table.uuid('company_id').notNullable();
    table.uuid('assigned_to_id').nullable();
    table.uuid('queue_id').notNullable();
    table.uuid('team_id').notNullable();
    table.jsonb('custom_field_values').defaultTo('{}');
    table.timestamp('resolved_at').nullable();
    table.timestamp('closed_at').nullable();
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('submitter_id').references('id').inTable('users').onDelete('RESTRICT');
    table.foreign('company_id').references('id').inTable('companies').onDelete('RESTRICT');
    table.foreign('assigned_to_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('queue_id').references('id').inTable('queues').onDelete('RESTRICT');
    table.foreign('team_id').references('id').inTable('teams').onDelete('RESTRICT');
    
    // Indexes
    table.index('title');
    table.index('status');
    table.index('priority');
    table.index('submitter_id');
    table.index('company_id');
    table.index('assigned_to_id');
    table.index('queue_id');
    table.index('team_id');
    table.index('created_at');
    table.index('resolved_at');
    table.index('closed_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('tickets');
};