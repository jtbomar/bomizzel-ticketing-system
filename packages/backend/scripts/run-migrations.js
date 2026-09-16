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

  // Check if we need to run seeds (if no users exist)
  console.log('🔍 Checking if database needs seeding...');

  try {
    const checkUsersCommand = `cd ${backendDir} && npx knex raw "SELECT COUNT(*) as count FROM users" --knexfile knexfile.js --env ${env}`;
    const userCountResult = execSync(checkUsersCommand, { encoding: 'utf-8' });

    // Parse the result to check user count
    const hasUsers =
      userCountResult.includes('"count":"0"') === false &&
      userCountResult.includes('count: 0') === false;

    if (!hasUsers) {
      console.log('🌱 No users found, running seeds...');
      const seedCommand = `cd ${backendDir} && npx knex seed:run --knexfile knexfile.js --env ${env}`;
      console.log(`⚙️  Running: ${seedCommand}`);

      execSync(seedCommand, {
        encoding: 'utf-8',
        stdio: 'inherit',
        shell: '/bin/bash',
      });

      console.log('✅ Seeds completed successfully');
      console.log('🔐 Default login credentials:');
      console.log('   - jeff@bomar.com / password123 (Super Admin)');
      console.log('   - elena@bomar.com / password123 (Admin)');
      console.log('   - jeremy@bomar.com / password123 (Agent)');
    } else {
      console.log('⏭️  Users already exist, skipping seeds');
    }
  } catch (seedError) {
    console.warn('⚠️  Could not check/run seeds:', seedError.message);
    console.log('🌱 Attempting to run seeds anyway...');

    try {
      const seedCommand = `cd ${backendDir} && npx knex seed:run --knexfile knexfile.js --env ${env}`;
      execSync(seedCommand, { encoding: 'utf-8', stdio: 'inherit', shell: '/bin/bash' });
      console.log('✅ Seeds completed successfully');
    } catch (finalSeedError) {
      console.warn('⚠️  Seeds failed, but continuing startup:', finalSeedError.message);
    }
  }
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
