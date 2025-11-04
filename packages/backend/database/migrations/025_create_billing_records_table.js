/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('billing_records', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('subscription_id')
      .notNullable()
      .references('id')
      .inTable('customer_subscriptions')
      .onDelete('CASCADE');
    table.string('stripe_invoice_id').unique();
    table.string('stripe_payment_intent_id');
    table.string('invoice_number');
    table
      .enum('status', ['draft', 'open', 'paid', 'void', 'uncollectible'])
      .notNullable()
      .defaultTo('draft');
    table.integer('amount_due').notNullable(); // Amount in cents
    table.integer('amount_paid').defaultTo(0); // Amount in cents
    table.integer('amount_remaining').defaultTo(0); // Amount in cents
    table.string('currency', 3).notNullable().defaultTo('usd');
    table.timestamp('billing_date').notNullable();
    table.timestamp('due_date');
    table.timestamp('paid_at');
    table.timestamp('voided_at');
    table.string('hosted_invoice_url');
    table.string('invoice_pdf_url');
    table.string('payment_method_id');
    table.integer('attempt_count').defaultTo(0);
    table.text('failure_reason');
    table.jsonb('line_items').defaultTo('[]'); // Store invoice line items
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);

    // Indexes
    table.index('subscription_id');
    table.index('stripe_invoice_id');
    table.index('status');
    table.index('billing_date');
    table.index('due_date');
    table.index('paid_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('billing_records');
};
