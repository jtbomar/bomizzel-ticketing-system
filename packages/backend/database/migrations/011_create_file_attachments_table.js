/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('file_attachments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('ticket_id').notNullable();
    table.uuid('note_id').nullable(); // Optional association with a note
    table.string('file_name').notNullable();
    table.string('original_name').notNullable();
    table.integer('file_size').notNullable();
    table.string('mime_type').notNullable();
    table.uuid('uploaded_by_id').notNullable();
    table.string('storage_key').notNullable();
    table.string('storage_path').notNullable();
    table.boolean('is_image').defaultTo(false);
    table.string('thumbnail_path').nullable();
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
    table.foreign('note_id').references('id').inTable('ticket_notes').onDelete('SET NULL');
    table.foreign('uploaded_by_id').references('id').inTable('users').onDelete('RESTRICT');
    
    // Indexes
    table.index('ticket_id');
    table.index('note_id');
    table.index('uploaded_by_id');
    table.index('mime_type');
    table.index('is_image');
    table.index('created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('file_attachments');
};