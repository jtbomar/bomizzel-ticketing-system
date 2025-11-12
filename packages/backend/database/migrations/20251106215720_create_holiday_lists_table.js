/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('holiday_lists', function(table) {
    table.increments('id').primary();
    table.uuid('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').nullable();
    table.string('region').nullable(); // e.g., 'US', 'UK', 'Canada'
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_default').defaultTo(false);
    table.timestamps(true, true);
  }).then(() => {
    return knex.schema.createTable('holidays', function(table) {
      table.increments('id').primary();
      table.integer('holiday_list_id').unsigned().references('id').inTable('holiday_lists').onDelete('CASCADE');
      table.string('name').notNullable(); // e.g., 'Christmas Day', 'New Year'
      table.date('date').notNullable(); // The actual holiday date
      table.boolean('is_recurring').defaultTo(false); // If it repeats yearly
      table.string('recurrence_pattern').nullable(); // e.g., 'yearly', 'monthly'
      table.text('description').nullable();
      table.timestamps(true, true);
      
      table.index(['holiday_list_id', 'date']);
    });
  }).then(() => {
    return knex.schema.createTable('business_hours_holiday_lists', function(table) {
      table.increments('id').primary();
      table.integer('business_hours_id').unsigned().references('id').inTable('business_hours').onDelete('CASCADE');
      table.integer('holiday_list_id').unsigned().references('id').inTable('holiday_lists').onDelete('CASCADE');
      table.timestamps(true, true);
      
      table.unique(['business_hours_id', 'holiday_list_id']);
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('business_hours_holiday_lists')
    .then(() => knex.schema.dropTableIfExists('holidays'))
    .then(() => knex.schema.dropTableIfExists('holiday_lists'));
};