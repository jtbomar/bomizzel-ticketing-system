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

  // Seeds are test data (including logins with a password that's in this repo),
  // so they never run in production unless ALLOW_PRODUCTION_SEED=true is set on
  // purpose. Elsewhere they run only when the users table is empty.
  if (env === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    console.log('⏭️  Production: skipping seeds (set ALLOW_PRODUCTION_SEED=true to run them)');
  } else {
    console.log('🔍 Checking if database needs seeding...');

    try {
      // Count users with knex itself (the knex CLI has no "raw" command)
      const countScript =
        "const k=require('knex')(require('./knexfile.js')[process.argv[1]]);" +
        "k('users').count({c:'*'}).first().then(r=>{console.log(Number(r.c));return k.destroy()})" +
        ".catch(e=>{console.error(e.message);process.exit(1)})";
      const userCount = Number(
        execSync(`node -e "${countScript}" ${env}`, { cwd: backendDir, encoding: 'utf-8' }).trim()
      );

      if (userCount === 0) {
        console.log('🌱 No users found, running seeds...');
        const seedCommand = `cd ${backendDir} && npx knex seed:run --knexfile knexfile.js --env ${env}`;
        console.log(`⚙️  Running: ${seedCommand}`);
        execSync(seedCommand, { encoding: 'utf-8', stdio: 'inherit', shell: '/bin/bash' });
        console.log('✅ Seeds completed successfully');
      } else {
        console.log(`⏭️  ${userCount} users exist, skipping seeds`);
      }
    } catch (seedError) {
      console.warn('⚠️  Could not check for users, skipping seeds:', seedError.message);
    }
  }
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
