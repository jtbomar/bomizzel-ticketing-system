/**
 * Clean up old migration records that no longer have files
 */
exports.up = async function(knex) {
  console.log('🧹 Cleaning up old migration records...');
  
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
  // No rollback needed
};
