require('dotenv').config();

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'bomizzel_db',
      user: process.env.DB_USER || 'bomizzel_user',
      password: process.env.DB_PASSWORD || 'bomizzel_password',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './database/seeds',
    },
  },

  test: {
    client: 'postgresql',
    // DATABASE_URL wins when it is set. Only production honoured it before, so a
    // job that supplied nothing but a connection URL - the performance job does
    // exactly that - silently fell through to the test_user defaults and died on
    // "password authentication failed for user test_user".
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'bomizzel_test',
      user: process.env.DB_USER || 'test_user',
      password: process.env.DB_PASSWORD || 'test_password',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './database/seeds',
    },
  },

  production: {
    client: 'postgresql',
    connection: (() => {
      const url = process.env.DATABASE_URL;
      if (!url) {
        return {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
        };
      }
      // Use public URL if available, otherwise internal
      const publicUrl = process.env.DATABASE_PUBLIC_URL;
      return {
        connectionString: publicUrl || url,
        ssl: publicUrl ? { rejectUnauthorized: false } : false,
      };
    })(),
    pool: {
      min: 0,
      max: 20,
    },
    acquireConnectionTimeout: 30000,
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './database/seeds',
    },
  },
};
