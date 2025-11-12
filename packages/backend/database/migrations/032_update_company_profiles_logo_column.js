/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('company_profiles', (table) => {
    table.text('logo').alter(); // Change from varchar(255) to text
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('company_profiles', (table) => {
    table.string('logo').alter(); // Change back to varchar(255)
  });
};