/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tickets', function(table) {
    table.timestamp('archived_at').nullable();
    table.index('archived_at');
    
    // Add composite index for archival queries
    table.index(['status', 'archived_at'], 'idx_tickets_status_archived');
    table.index(['submitter_id', 'archived_at'], 'idx_tickets_submitter_archived');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tickets', function(table) {
    table.dropIndex([], 'idx_tickets_status_archived');
    table.dropIndex([], 'idx_tickets_submitter_archived');
    table.dropIndex([], 'archived_at');
    table.dropColumn('archived_at');
  });
};