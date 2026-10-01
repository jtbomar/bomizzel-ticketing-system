/**
 * Fields and layouts, one system for every module (tickets first; accounts,
 * contacts and custom modules later).
 *
 * - module_fields: a subscriber's custom fields for a module. The standard
 *   fields (subject, account, contact, product, phone, ...) are defined in
 *   code and can't be removed; only these can.
 * - module_layouts: the order of fields, in sections, for a module.
 * - tickets.product_id / tickets.phone: two standard ticket fields that had
 *   nowhere to live. Phone is filled from the contact unless given.
 *
 * Custom field values stay in tickets.custom_field_values, keyed by the
 * field's key (cf_...). The older half-built field tables (custom_fields,
 * ticket_layouts, layout_fields, department_ticket_templates) are empty and
 * no longer used.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('module_fields'))) {
    await knex.schema.createTable('module_fields', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('module', 32).notNullable();
      table.string('key', 64).notNullable();
      table.string('label', 120).notNullable();
      // text | textarea | number | decimal | date | checkbox | email | phone |
      // url | picklist | multiselect
      table.string('type', 24).notNullable();
      table.jsonb('options').notNullable().defaultTo('[]');
      table.boolean('is_required').notNullable().defaultTo(false);
      table.string('help_text', 255).nullable();
      table.timestamps(true, true);
      table.unique(['org_id', 'module', 'key']);
    });
  }
  if (!(await knex.schema.hasTable('module_layouts'))) {
    await knex.schema.createTable('module_layouts', (table) => {
      table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('module', 32).notNullable();
      // [{ id, title, fields: [key, ...] }]
      table.jsonb('sections').notNullable();
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.primary(['org_id', 'module']);
    });
  }
  if (!(await knex.schema.hasColumn('tickets', 'product_id'))) {
    await knex.schema.alterTable('tickets', (table) => {
      table
        .integer('product_id')
        .nullable()
        .references('id')
        .inTable('products')
        .onDelete('SET NULL');
      table.string('phone', 40).nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('tickets', 'product_id')) {
    await knex.schema.alterTable('tickets', (table) => {
      table.dropColumn('product_id');
      table.dropColumn('phone');
    });
  }
  await knex.schema.dropTableIfExists('module_layouts');
  await knex.schema.dropTableIfExists('module_fields');
};
