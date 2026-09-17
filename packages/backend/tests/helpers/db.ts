/**
 * Test database reset.
 *
 * Suites share one database. Those that build fixtures in `beforeAll` get a
 * clean slate once per file (tests/setup.ts calls this). Those that rebuild
 * fixtures in `beforeEach` - with fixed identifiers like 'admin@bomizzel.com' -
 * need it before every test, or the second test collides on
 * users_email_unique; they call this themselves.
 */

/** Truncate every application table. Refuses to touch a non-test database. */
export const resetDatabase = async (): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { db } = require('../../src/config/database');

  const connection = db.client?.config?.connection ?? {};
  const target =
    typeof connection === 'string'
      ? connection
      : connection.database || connection.connectionString;

  if (process.env.NODE_ENV !== 'test' || !/test/i.test(String(target))) {
    throw new Error(
      `Refusing to truncate: expected NODE_ENV=test and a database name containing "test", ` +
        `got NODE_ENV=${process.env.NODE_ENV} target=${target}`
    );
  }

  const { rows } = await db.raw(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('knex_migrations', 'knex_migrations_lock')`
  );

  if (rows.length > 0) {
    const tables = rows.map((r: { tablename: string }) => `"${r.tablename}"`).join(', ');
    await db.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }
};
