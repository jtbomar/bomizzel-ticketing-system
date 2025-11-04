/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('ticket_notes', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('ticket_id').notNullable();
    table.uuid('author_id').notNullable();
    table.text('content').notNullable();
    table.boolean('is_internal').defaultTo(false);
    table.boolean('is_email_generated').defaultTo(false);
    table.jsonb('email_metadata').nullable();
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
    table.foreign('author_id').references('id').inTable('users').onDelete('RESTRICT');

    // Indexes
    table.index('ticket_id');
    table.index('author_id');
    table.index('is_internal');
    table.index('is_email_generated');
    table.index('created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('ticket_notes');
};
