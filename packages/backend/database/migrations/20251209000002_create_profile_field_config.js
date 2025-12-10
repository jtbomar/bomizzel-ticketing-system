/**
 * Create profile field configuration table
 */
exports.up = function(knex) {
  return knex.schema.createTable('profile_field_config', function(table) {
    table.increments('id').primary();
    table.uuid('org_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.string('field_name').notNullable();
    table.string('field_type').notNullable(); // text, email, tel, select, file, textarea
    table.boolean('is_required').defaultTo(false);
    table.boolean('is_enabled').defaultTo(true);
    table.integer('display_order').defaultTo(0);
    table.jsonb('options'); // For select fields
    table.timestamps(true, true);

    // Unique constraint: one config per field per org
    table.unique(['org_id', 'field_name']);
    table.index('org_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('profile_field_config');
};
