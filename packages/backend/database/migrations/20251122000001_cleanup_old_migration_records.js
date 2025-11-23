/**
 * Cleanup old migration records
 * This removes the records of deleted migrations from knex_migrations table
 */
exports.up = async function(knex) {
  console.log('🧹 Cleaning up old migration records');
  
  // Delete records of the old migrations we removed
  const deleted = await knex('knex_migrations')
    .whereIn('name', [
      '20251122100000_add_org_id_to_tables.js',
      '20251122110000_backfill_org_id_data.js',
      '20251122120000_enhance_user_company_associations.js'
    ])
    .del();
  
  console.log(`✅ Removed ${deleted} old migration records`);
};

exports.down = async function(knex) {
  // Can't really rollback this
  console.log('⚠️  Cannot rollback migration cleanup');
};
