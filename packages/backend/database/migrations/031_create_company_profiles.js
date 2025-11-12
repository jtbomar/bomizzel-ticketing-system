/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('company_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.string('logo').nullable();
    table.string('website').nullable();
    table.string('primary_contact').nullable();
    table.string('primary_email').nullable();
    table.string('primary_phone').nullable();
    table.jsonb('address').nullable();
    table.jsonb('phone_numbers').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('company_profiles');
};
