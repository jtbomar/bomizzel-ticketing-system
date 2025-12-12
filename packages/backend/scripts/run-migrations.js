#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Starting migration process...');
console.log('📍 Current directory:', process.cwd());
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('🗄️  DATABASE_URL exists:', !!process.env.DATABASE_URL);

try {
  // Determine environment
  const env = process.env.NODE_ENV || (process.env.DATABASE_URL ? 'production' : 'development');
  console.log(`🎯 Using environment: ${env}`);

  // Get the backend directory (where knexfile.js is)
  const backendDir = __dirname.includes('packages/backend')
    ? path.resolve(__dirname, '..')
    : process.cwd();

  console.log(`📂 Backend directory: ${backendDir}`);

  // Run migrations from the backend directory
  const command = `cd ${backendDir} && npx knex migrate:latest --knexfile knexfile.js --env ${env}`;
  console.log(`⚙️  Running: ${command}`);

  const output = execSync(command, {
    encoding: 'utf-8',
    stdio: 'inherit',
    shell: '/bin/bash',
  });

  console.log('✅ Migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
