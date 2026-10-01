/**
 * Account and contact layouts (Settings > Layouts).
 *
 * - companies: county for the address, a full billing address, and custom
 *   field values. (Street, city, state, ZIP and country were already there.)
 * - users (contacts): custom field values.
 */
const BILLING = [
  'billing_street',
  'billing_street2',
  'billing_city',
  'billing_state',
  'billing_county',
  'billing_postal_code',
  'billing_country',
];

exports.up = async function (knex) {
  const addMissing = async (table, columns) => {
    for (const [name, add] of columns) {
      if (!(await knex.schema.hasColumn(table, name))) {
        await knex.schema.alterTable(table, (t) => add(t, name));
      }
    }
  };
  await addMissing('companies', [
    ['county', (t, n) => t.string(n, 100).nullable()],
    ...BILLING.map((n) => [n, (t, name) => t.string(name, 255).nullable()]),
    ['custom_field_values', (t, n) => t.jsonb(n).notNullable().defaultTo('{}')],
  ]);
  await addMissing('users', [
    ['custom_field_values', (t, n) => t.jsonb(n).notNullable().defaultTo('{}')],
  ]);
};

exports.down = async function (knex) {
  for (const n of ['county', ...BILLING, 'custom_field_values']) {
    if (await knex.schema.hasColumn('companies', n)) {
      await knex.schema.alterTable('companies', (t) => t.dropColumn(n));
    }
  }
  if (await knex.schema.hasColumn('users', 'custom_field_values')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('custom_field_values'));
  }
};
