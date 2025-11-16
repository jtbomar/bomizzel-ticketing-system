/**
 * Migration: Clean up orphaned migration records
 * Remove records for migrations that no longer exist
 */

exports.up = async function (knex) {
  // Delete the orphaned migration records
  await knex('knex_migrations')
    .whereIn('name', [
      '20251115000000_rename_employee_role_to_agent.js',
      '20251115000001_rename_employee_queue_type_to_agent.js'
    ])
    .del();
  
  console.log('✅ Cleaned up orphaned migration records');
};

exports.down = async function (knex) {
  // Can't restore deleted records
  console.log('✅ Rollback complete');
};
