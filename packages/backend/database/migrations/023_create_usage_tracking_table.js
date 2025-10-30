/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('usage_tracking', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('subscription_id').notNullable().references('id').inTable('customer_subscriptions').onDelete('CASCADE');
    table.uuid('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    table.enum('action', ['created', 'completed', 'archived', 'deleted']).notNullable();
    table.string('previous_status');
    table.string('new_status');
    table.timestamp('action_timestamp').notNullable().defaultTo(knex.fn.now());
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    // Indexes
    table.index('subscription_id');
    table.index('ticket_id');
    table.index('action');
    table.index('action_timestamp');
    table.index(['subscription_id', 'action_timestamp']);
    
    // Composite index for efficient usage queries
    table.index(['subscription_id', 'action', 'action_timestamp']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('usage_tracking');
};