import knex from 'knex';

const knexConfig = require('../../knexfile.js');
// NODE_ENV=test always wins. Otherwise use the production config when
// DATABASE_URL is set (Railway), falling back to NODE_ENV.
//
// Previously DATABASE_URL took precedence unconditionally, so a test run with
// DATABASE_URL exported - which .env.test itself sets - resolved to the
// production connection.
const environment =
  process.env['NODE_ENV'] === 'test'
    ? 'test'
    : process.env.DATABASE_URL
      ? 'production'
      : process.env['NODE_ENV'] || 'development';
const config = knexConfig[environment];

console.log(`📦 Database environment: ${environment}`);

export const db = knex(config);

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    await db.raw('SELECT 1');
    console.log('✅ Database connection established successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeConnection = async (): Promise<void> => {
  try {
    await db.destroy();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};
