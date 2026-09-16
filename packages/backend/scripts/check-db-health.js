#!/usr/bin/env node

/**
 * Check database health and user accounts
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Checking database health...');

try {
  // Change to backend directory
  process.chdir(path.join(__dirname, '..'));

  const env = process.env.NODE_ENV || (process.env.DATABASE_URL ? 'production' : 'development');
  console.log(`🎯 Environment: ${env}`);

  // Check if users table exists and has data
  console.log('👥 Checking users...');
  try {
    const usersResult = execSync(
      `npx knex --knexfile knexfile.js --env ${env} raw "SELECT email, role FROM users LIMIT 10"`,
      { encoding: 'utf-8' }
    );
    console.log('Users found:', usersResult);
  } catch (e) {
    console.log('Users check failed:', e.message);
  }

  // Check if companies exist
  console.log('🏢 Checking companies...');
  try {
    const companiesResult = execSync(
      `npx knex --knexfile knexfile.js --env ${env} raw "SELECT name FROM companies LIMIT 5"`,
      { encoding: 'utf-8' }
    );
    console.log('Companies found:', companiesResult);
  } catch (e) {
    console.log('Companies check failed:', e.message);
  }

  console.log('✅ Database health check completed');
} catch (error) {
  console.error('❌ Database health check failed:', error.message);
  process.exit(1);
}
