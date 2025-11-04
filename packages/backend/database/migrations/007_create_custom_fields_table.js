/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('custom_fields', function (table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('team_id').notNullable();
    table.string('name').notNullable();
    table.string('label').notNullable();
    table.enum('type', ['string', 'number', 'decimal', 'integer', 'picklist']).notNullable();
    table.boolean('is_required').defaultTo(false);
    table.jsonb('options').nullable(); // For picklist type
    table.jsonb('validation').nullable(); // Validation rules
    table.integer('order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('team_id').references('id').inTable('teams').onDelete('CASCADE');

    // Indexes
    table.index('team_id');
    table.index('name');
    table.index('type');
    table.index('order');
    table.index('is_active');

    // Unique constraint for name within team
    table.unique(['team_id', 'name']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('custom_fields');
};
