/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('subscription_plans', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique();
    table.string('slug').notNullable().unique();
    table.decimal('price', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('USD');
    table.enum('billing_interval', ['month', 'year']).defaultTo('month');
    table.integer('active_ticket_limit').notNullable(); // -1 for unlimited
    table.integer('completed_ticket_limit').notNullable(); // -1 for unlimited
    table.integer('total_ticket_limit').notNullable(); // -1 for unlimited
    table.jsonb('features').defaultTo('[]');
    table.integer('trial_days').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.integer('sort_order').defaultTo(0);
    table.text('description');
    table.timestamps(true, true);
    
    // Indexes
    table.index('slug');
    table.index('is_active');
    table.index('sort_order');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('subscription_plans');
};