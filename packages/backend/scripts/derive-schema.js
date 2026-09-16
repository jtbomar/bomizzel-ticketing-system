/* eslint-disable */
/**
 * Derives the effective database schema by running every migration's `up()`
 * against a stubbed Knex that records schema operations instead of executing
 * SQL. Read-only: touches no database. Used to verify that INSERTs in the
 * application code match the columns migrations actually create.
 *
 * Usage: node scripts/derive-schema.js [tableName ...]
 */
const fs = require('fs');
const path = require('path');

const MIGRATIONS = path.resolve(__dirname, '../database/migrations');

// tableName -> Map(column -> {type, notNullable, defaultTo, enumValues})
const schema = new Map();

function ensure(table) {
  if (!schema.has(table)) schema.set(table, new Map());
  return schema.get(table);
}

const COLUMN_TYPES = [
  'uuid',
  'string',
  'text',
  'integer',
  'bigInteger',
  'boolean',
  'json',
  'jsonb',
  'timestamp',
  'date',
  'time',
  'decimal',
  'float',
  'double',
  'binary',
  'enum',
  'enu',
  'increments',
  'bigIncrements',
  'specificType',
];

function makeTableBuilder(cols) {
  const chainable = (col) => {
    const api = {
      notNullable: () => {
        if (col) col.notNullable = true;
        return api;
      },
      nullable: () => {
        if (col) col.notNullable = false;
        return api;
      },
      defaultTo: (v) => {
        if (col) col.defaultTo = v;
        return api;
      },
      primary: () => api,
      unique: () => api,
      index: () => api,
      references: () => api,
      inTable: () => api,
      onDelete: () => api,
      onUpdate: () => api,
      alter: () => api,
      comment: () => api,
      unsigned: () => api,
      after: () => api,
    };
    return api;
  };

  const builder = {};
  for (const t of COLUMN_TYPES) {
    builder[t] = (name, arg) => {
      if (t === 'increments' || t === 'bigIncrements') {
        const col = { type: t, notNullable: true };
        cols.set(name || 'id', col);
        return chainable(col);
      }
      const col = { type: t };
      if ((t === 'enum' || t === 'enu') && Array.isArray(arg)) col.enumValues = arg;
      cols.set(name, col);
      return chainable(col);
    };
  }
  builder.timestamps = () => {
    cols.set('created_at', { type: 'timestamp' });
    cols.set('updated_at', { type: 'timestamp' });
    return chainable(null);
  };
  builder.dropColumn = (name) => {
    cols.delete(name);
    return chainable(null);
  };
  builder.dropColumns = (...names) => {
    names.flat().forEach((n) => cols.delete(n));
    return chainable(null);
  };
  builder.renameColumn = (from, to) => {
    if (cols.has(from)) {
      cols.set(to, cols.get(from));
      cols.delete(from);
    }
    return chainable(null);
  };
  builder.primary = () => chainable(null);
  builder.unique = () => chainable(null);
  builder.index = () => chainable(null);
  builder.foreign = () => chainable(null);
  builder.dropForeign = () => chainable(null);
  builder.dropUnique = () => chainable(null);
  builder.dropIndex = () => chainable(null);
  builder.dropPrimary = () => chainable(null);
  builder.setNullable = () => chainable(null);
  builder.dropNullable = () => chainable(null);
  return builder;
}

// A thenable no-op so `await knex.raw(...)`, query builders etc. resolve.
function noopQuery(result = []) {
  const handler = {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve) => resolve(result);
      }
      if (prop === 'catch' || prop === 'finally') {
        return () => proxy;
      }
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  };
  const proxy = new Proxy(function () {}, handler);
  return proxy;
}

function makeSchemaBuilder() {
  // Knex's real SchemaBuilder is both chainable and thenable. Do NOT give this
  // object a `then` that resolves to itself - the promise machinery unwraps
  // thenables recursively and spins forever. Chained forms like
  // `.createTable(a, ..).createTable(b, ..)` are instead reported as partially
  // applied in the summary at the end of a run.
  const api = {
    createTable: async (name, cb) => {
      cb(makeTableBuilder(ensure(name)));
      return api;
    },
    createTableIfNotExists: async (name, cb) => {
      cb(makeTableBuilder(ensure(name)));
      return api;
    },
    alterTable: async (name, cb) => {
      cb(makeTableBuilder(ensure(name)));
      return api;
    },
    table: async (name, cb) => {
      cb(makeTableBuilder(ensure(name)));
      return api;
    },
    dropTable: async (name) => {
      schema.delete(name);
      return api;
    },
    dropTableIfExists: async (name) => {
      schema.delete(name);
      return api;
    },
    renameTable: async (from, to) => {
      if (schema.has(from)) {
        schema.set(to, schema.get(from));
        schema.delete(from);
      }
      return api;
    },
    hasTable: async (name) => schema.has(name),
    hasColumn: async (t, c) => schema.has(t) && schema.get(t).has(c),
    raw: async () => ({ rows: [] }),
    withSchema: () => api,
  };
  return api;
}

function makeKnex() {
  const knex = function () {
    return noopQuery();
  };
  knex.schema = makeSchemaBuilder();
  knex.raw = () => noopQuery({ rows: [] });
  knex.whereRaw = () => noopQuery();
  knex.select = () => noopQuery();
  knex.fn = { now: () => 'now()', uuid: () => 'uuid()' };
  knex.transaction = async (cb) => (cb ? cb(knex) : knex);
  knex.client = { config: { client: 'postgresql' } };
  return knex;
}

async function main() {
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.js'))
    .sort();
  const knex = makeKnex();
  const failures = [];

  for (const f of files) {
    const mod = require(path.join(MIGRATIONS, f));
    if (typeof mod.up !== 'function') continue;
    try {
      await mod.up(knex);
    } catch (err) {
      failures.push(`${f}: ${err.message}`);
    }
  }

  const wanted = process.argv.slice(2);
  const tables = [...schema.keys()].sort();
  const show = wanted.length ? tables.filter((t) => wanted.includes(t)) : tables;

  for (const t of show) {
    const cols = schema.get(t);
    console.log(`\n${t} (${cols.size} columns)`);
    for (const [name, def] of cols) {
      const bits = [def.type];
      if (def.notNullable) bits.push('NOT NULL');
      if (def.defaultTo !== undefined) {
        let d;
        try {
          d = typeof def.defaultTo === 'object' ? '<raw>' : String(def.defaultTo);
        } catch (e) {
          d = '<raw>';
        }
        bits.push(`default=${d}`);
      }
      if (def.enumValues) bits.push(`enum(${def.enumValues.join('|')})`);
      console.log(`  ${name.padEnd(28)} ${bits.join(' ')}`);
    }
  }

  if (!wanted.length) {
    console.log(`\n--- ${tables.length} tables derived from ${files.length} migrations ---`);
  }
  if (failures.length) {
    console.log(`\n--- ${failures.length} migration(s) the simulator could not fully run ---`);
    failures.forEach((f) => console.log(`  ${f}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
