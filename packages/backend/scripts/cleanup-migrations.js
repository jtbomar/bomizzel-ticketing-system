#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function cleanupMigrations() {
  console.log('🧹 Cleaning up old migration records...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DB_CONNECTION_STRING,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const result = await client.query(`
      DELETE FROM knex_migrations 
      WHERE name IN (
        '20251122100000_add_org_id_to_tables.js',
        '20251122110000_backfill_org_id_data.js',
        '20251122120000_enhance_user_company_associations.js'
      )
      RETURNING name
    `);

    console.log(`✅ Deleted ${result.rowCount} old migration records`);
    
    if (result.rows.length > 0) {
      console.log('Deleted migrations:');
      result.rows.forEach(row => console.log(`  - ${row.name}`));
    }

    await client.end();
    console.log('✅ Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

cleanupMigrations();
