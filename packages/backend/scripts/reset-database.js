/**
 * NUCLEAR OPTION: Drop and recreate entire database
 * This will delete EVERYTHING - all tables, data, migrations
 * Run with: node scripts/reset-database.js
 */
const knex = require('knex');
const knexConfig = require('../knexfile');

async function resetDatabase() {
  const db = knex(knexConfig.production);
  
  try {
    console.log('💣 NUCLEAR RESET: Dropping all tables...');
    
    // Drop all tables in the public schema
    await db.raw(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    console.log('✅ All tables dropped');
    console.log('🔄 Running migrations from scratch...');
    
    await db.destroy();
    
    // Recreate connection and run migrations
    const freshDb = knex(knexConfig.production);
    await freshDb.migrate.latest();
    
    console.log('✅ Database reset complete!');
    console.log('✅ All migrations run successfully');
    
    await freshDb.destroy();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await db.destroy();
    process.exit(1);
  }
}

resetDatabase();
