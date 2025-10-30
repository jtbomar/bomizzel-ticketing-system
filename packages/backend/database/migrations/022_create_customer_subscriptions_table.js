/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('customer_subscriptions', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('plan_id').notNullable().references('id').inTable('subscription_plans').onDelete('RESTRICT');
    table.enum('status', ['active', 'trial', 'cancelled', 'past_due', 'suspended']).notNullable().defaultTo('active');
    table.timestamp('current_period_start').notNullable();
    table.timestamp('current_period_end').notNullable();
    table.timestamp('trial_start');
    table.timestamp('trial_end');
    table.timestamp('cancelled_at');
    table.boolean('cancel_at_period_end').defaultTo(false);
    table.string('payment_method_id');
    table.string('stripe_subscription_id').unique();
    table.string('stripe_customer_id');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    // Indexes
    table.index('user_id');
    table.index('plan_id');
    table.index('status');
    table.index('current_period_end');
    table.index('trial_end');
    table.index('stripe_subscription_id');
    table.index('stripe_customer_id');
    
    // Ensure one active subscription per user
    table.unique(['user_id'], { predicate: knex.whereRaw("status IN ('active', 'trial')") });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('customer_subscriptions');
};