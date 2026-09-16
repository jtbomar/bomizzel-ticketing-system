#!/usr/bin/env node

/**
 * Force reseed the database - Emergency fix for login issues
 * This script will clear and reseed the database with fresh data
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚨 EMERGENCY DATABASE RESEED STARTING...');

try {
  // Change to backend directory
  process.chdir(path.join(__dirname, '..'));

  console.log('📍 Current directory:', process.cwd());

  // Run migrations first
  console.log('🔄 Running migrations...');
  execSync('npx knex migrate:latest', { stdio: 'inherit' });

  // Force run seeds
  console.log('🌱 Force running seeds...');
  execSync('npx knex seed:run', { stdio: 'inherit' });

  console.log('✅ Database reseed completed successfully!');
  console.log('🔐 Login credentials should now work:');
  console.log('   - jeff@bomar.com / password123');
  console.log('   - elena@bomar.com / password123');
  console.log('   - Any customer: [firstname].[lastname]@[company].com / password123');
} catch (error) {
  console.error('❌ Database reseed failed:', error.message);
  process.exit(1);
}
