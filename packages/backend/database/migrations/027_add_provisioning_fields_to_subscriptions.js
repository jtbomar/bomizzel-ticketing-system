/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('customer_subscriptions', function (table) {
    // Add company association
    table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');

    // Add custom limits and pricing
    table.jsonb('limits').defaultTo('{}');
    table.jsonb('custom_pricing');

    // Add billing and provisioning fields
    table.enum('billing_cycle', ['monthly', 'annual']).defaultTo('monthly');
    table.boolean('is_custom').defaultTo(false);
    table.uuid('provisioned_by').references('id').inTable('users');
    table.text('notes');

    // Add indexes
    table.index('company_id');
    table.index('is_custom');
    table.index('provisioned_by');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('customer_subscriptions', function (table) {
    table.dropColumn('company_id');
    table.dropColumn('limits');
    table.dropColumn('custom_pricing');
    table.dropColumn('billing_cycle');
    table.dropColumn('is_custom');
    table.dropColumn('provisioned_by');
    table.dropColumn('notes');
  });
};
