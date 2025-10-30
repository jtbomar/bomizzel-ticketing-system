/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('subscription_plans', function(table) {
    table.string('stripe_price_id').unique();
    table.string('stripe_product_id');
    table.index('stripe_price_id');
    table.index('stripe_product_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('subscription_plans', function(table) {
    table.dropIndex('stripe_price_id');
    table.dropIndex('stripe_product_id');
    table.dropColumn('stripe_price_id');
    table.dropColumn('stripe_product_id');
  });
};