/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('team_memberships', function (table) {
    table.uuid('user_id').notNullable();
    table.uuid('team_id').notNullable();
    table.enum('role', ['member', 'lead', 'admin']).defaultTo('member');
    table.timestamps(true, true);

    // Primary key
    table.primary(['user_id', 'team_id']);

    // Foreign keys
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('team_id').references('id').inTable('teams').onDelete('CASCADE');

    // Indexes
    table.index('user_id');
    table.index('team_id');
    table.index('role');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('team_memberships');
};
