/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('business_hours', function(table) {
    table.increments('id').primary();
    table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.string('title').notNullable().defaultTo('Default Business Hours');
    table.text('description').nullable();
    table.string('timezone').notNullable().defaultTo('America/New_York');
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_default').defaultTo(false);
    table.timestamps(true, true);
  }).then(() => {
    return knex.schema.createTable('business_hours_schedule', function(table) {
      table.increments('id').primary();
      table.integer('business_hours_id').unsigned().references('id').inTable('business_hours').onDelete('CASCADE');
      table.integer('day_of_week').notNullable(); // 0 = Sunday, 1 = Monday, etc.
      table.boolean('is_working_day').defaultTo(true);
      table.time('start_time').nullable(); // e.g., '09:00:00'
      table.time('end_time').nullable(); // e.g., '17:00:00'
      table.time('break_start').nullable(); // Optional lunch break
      table.time('break_end').nullable();
      table.timestamps(true, true);
      
      table.unique(['business_hours_id', 'day_of_week']);
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('business_hours_schedule')
    .then(() => knex.schema.dropTableIfExists('business_hours'));
};
