/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('usage_summaries', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('subscription_id')
      .notNullable()
      .references('id')
      .inTable('customer_subscriptions')
      .onDelete('CASCADE');
    table.string('period').notNullable(); // YYYY-MM format for monthly tracking
    table.integer('active_tickets_count').defaultTo(0);
    table.integer('completed_tickets_count').defaultTo(0);
    table.integer('total_tickets_count').defaultTo(0);
    table.integer('archived_tickets_count').defaultTo(0);
    table.timestamp('last_updated').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    // Indexes
    table.index('subscription_id');
    table.index('period');
    table.index(['subscription_id', 'period']);
    table.index('last_updated');

    // Ensure one summary per subscription per period
    table.unique(['subscription_id', 'period']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('usage_summaries');
};
