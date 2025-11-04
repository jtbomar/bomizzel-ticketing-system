/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('queues', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description');
    table.enum('type', ['unassigned', 'employee']).notNullable();
    table.uuid('assigned_to_id').nullable();
    table.uuid('team_id').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('assigned_to_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('team_id').references('id').inTable('teams').onDelete('CASCADE');

    // Indexes
    table.index('name');
    table.index('type');
    table.index('assigned_to_id');
    table.index('team_id');
    table.index('is_active');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('queues');
};
