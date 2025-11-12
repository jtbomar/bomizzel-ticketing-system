/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return Promise.all([
    // Data export logs table
    knex.schema.createTable('data_export_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('export_id').notNullable().unique();
      table.jsonb('exported_data'); // Summary of what was exported
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index('company_id');
      table.index('user_id');
      table.index('created_at');
    }),

    // Data import logs table
    knex.schema.createTable('data_import_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('import_id').notNullable().unique();
      table.jsonb('imported_data'); // Summary of what was imported
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      table.index('company_id');
      table.index('user_id');
      table.index('created_at');
    })
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('data_import_logs'),
    knex.schema.dropTableIfExists('data_export_logs')
  ]);
};
