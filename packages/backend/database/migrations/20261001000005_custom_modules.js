/**
 * Custom modules (Settings > Modules): a subscriber's own record types -
 * Assets, Contracts, Locations - each with a layout like accounts and
 * contacts, and lookup fields that link records across modules.
 *
 * - custom_modules: the module. key is how fields and layouts refer to it
 *   ("cm_assets"), name / singular are what people see.
 * - custom_records: its records. name is the standard field; everything
 *   else is a custom field, in values.
 * - module_fields.lookup_module: for a lookup field, the module it links to
 *   (accounts, contacts or a custom module's key). Its value is the linked
 *   record's id.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('custom_modules'))) {
    await knex.schema.createTable('custom_modules', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('key', 64).notNullable();
      table.string('name', 80).notNullable();
      table.string('singular', 80).notNullable();
      table.timestamps(true, true);
      table.unique(['org_id', 'key']);
    });
  }
  if (!(await knex.schema.hasTable('custom_records'))) {
    await knex.schema.createTable('custom_records', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table
        .uuid('module_id')
        .notNullable()
        .references('id')
        .inTable('custom_modules')
        .onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.jsonb('values').notNullable().defaultTo('{}');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.index(['org_id', 'module_id', 'name']);
    });
    await knex.raw('CREATE INDEX custom_records_values_gin ON custom_records USING gin ("values")');
  }
  if (!(await knex.schema.hasColumn('module_fields', 'lookup_module'))) {
    await knex.schema.alterTable('module_fields', (table) => {
      table.string('lookup_module', 64).nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('module_fields', 'lookup_module')) {
    await knex.schema.alterTable('module_fields', (t) => t.dropColumn('lookup_module'));
  }
  await knex.schema.dropTableIfExists('custom_records');
  await knex.schema.dropTableIfExists('custom_modules');
};
