/**
 * Billing per company (Settings > Billing): Free, Standard and Professional,
 * charged per agent through Stripe.
 *
 * companies:
 * - plan: the paid plan Stripe says it has ('free' when none).
 * - comped_plan: a plan given free of charge (by the platform owner) - it
 *   wins over everything else. Every company here before billing existed
 *   gets Professional this way, so nothing they set up gets locked.
 * - billing_interval, stripe_customer_id, stripe_subscription_id,
 *   subscription_status, seats, current_period_end: Stripe's view, kept in
 *   step by its webhook.
 * - past_due_since: when a payment first failed, for the grace period.
 * trial_ends_at / is_trial were already there; a trial is Professional.
 */
const COLUMNS = [
  ['plan', (t, n) => t.string(n, 32).notNullable().defaultTo('free')],
  ['comped_plan', (t, n) => t.string(n, 32).nullable()],
  ['billing_interval', (t, n) => t.string(n, 8).nullable()],
  ['stripe_customer_id', (t, n) => t.string(n, 64).nullable()],
  ['stripe_subscription_id', (t, n) => t.string(n, 64).nullable()],
  ['subscription_status', (t, n) => t.string(n, 32).nullable()],
  ['seats', (t, n) => t.integer(n).nullable()],
  ['current_period_end', (t, n) => t.timestamp(n, { useTz: true }).nullable()],
  ['past_due_since', (t, n) => t.timestamp(n, { useTz: true }).nullable()],
];

exports.up = async function (knex) {
  for (const [name, add] of COLUMNS) {
    if (!(await knex.schema.hasColumn('companies', name))) {
      await knex.schema.alterTable('companies', (t) => add(t, name));
    }
  }
  // Subscribers already here keep everything, free of charge
  const comped = await knex('companies')
    .whereNull('subscriber_id')
    .whereNull('comped_plan')
    .update({ comped_plan: 'professional' });
  console.log(`✅ ${comped} existing compan${comped === 1 ? 'y' : 'ies'} on Professional, free`);
};

exports.down = async function (knex) {
  for (const [name] of COLUMNS) {
    if (await knex.schema.hasColumn('companies', name)) {
      await knex.schema.alterTable('companies', (t) => t.dropColumn(name));
    }
  }
};
