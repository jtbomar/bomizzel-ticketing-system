/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('user_company_associations', function (table) {
    table.uuid('user_id').notNullable();
    table.uuid('company_id').notNullable();
    table.string('role').defaultTo('member');
    table.timestamps(true, true);

    // Primary key
    table.primary(['user_id', 'company_id']);

    // Foreign keys
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');

    // Indexes
    table.index('user_id');
    table.index('company_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('user_company_associations');
};
