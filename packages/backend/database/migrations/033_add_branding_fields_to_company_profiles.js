/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('company_profiles', (table) => {
    table.text('favicon').nullable();
    table.string('linkback_url').nullable();
    table.string('company_name').nullable();
    table.string('tagline').nullable();
    table.string('primary_color').nullable();
    table.string('secondary_color').nullable();
    table.string('accent_color').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('company_profiles', (table) => {
    table.dropColumn('favicon');
    table.dropColumn('linkback_url');
    table.dropColumn('company_name');
    table.dropColumn('tagline');
    table.dropColumn('primary_color');
    table.dropColumn('secondary_color');
    table.dropColumn('accent_color');
  });
};
