/**
 * Cleanup script to remove old migration records
 * Run this manually: node scripts/cleanup-migrations.js
 */
const knex = require('knex');
const knexConfig = require('../knexfile');

async function cleanup() {
  const db = knex(knexConfig.production);
  
  try {
    console.log('🧹 Cleaning up old migration records...');
    
    const deleted = await db('knex_migrations')
      .whereIn('name', [
        '20251122100000_add_org_id_to_tables.js',
        '20251122110000_backfill_org_id_data.js',
        '20251122120000_enhance_user_company_associations.js'
      ])
      .del();
    
    console.log(`✅ Removed ${deleted} old migration records`);
    console.log('✅ Database is clean. You can now run migrations.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.destroy();
  }
}

cleanup();
