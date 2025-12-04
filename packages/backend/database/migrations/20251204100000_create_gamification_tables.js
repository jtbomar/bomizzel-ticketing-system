/**
 * Create gamification tables for badges and trophies
 */
exports.up = async function(knex) {
  // Trophies/Achievements table
  await knex.schema.createTable('trophies', (table) => {
    table.increments('id').primary();
    table.uuid('company_id').notNullable();
    table.uuid('org_id');
    table.string('name', 255).notNullable();
    table.string('description', 500);
    table.string('icon', 100); // emoji or icon name
    table.enum('category', ['response', 'resolution', 'rating', 'volume', 'quality', 'speed']).notNullable();
    table.enum('criteria_type', ['tickets', 'time', 'rating', 'count']).notNullable();
    table.jsonb('criteria'); // { metric: 'first_response', operator: 'within', value: 20, unit: 'minutes' }
    table.integer('points').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.foreign('org_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.index(['company_id', 'is_active']);
  });

  // Badges table
  await knex.schema.createTable('badges', (table) => {
    table.increments('id').primary();
    table.uuid('company_id').notNullable();
    table.uuid('org_id');
    table.string('name', 255).notNullable();
    table.string('description', 500);
    table.string('icon', 100);
    table.enum('level', ['bronze', 'silver', 'gold', 'platinum']).notNullable();
    table.integer('required_points').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.foreign('org_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.index(['company_id', 'is_active']);
  });

  // User trophies (earned achievements)
  await knex.schema.createTable('user_trophies', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable();
    table.integer('trophy_id').unsigned().notNullable();
    table.timestamp('earned_at').defaultTo(knex.fn.now());
    table.integer('points_earned').defaultTo(0);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('trophy_id').references('id').inTable('trophies').onDelete('CASCADE');
    table.unique(['user_id', 'trophy_id']);
    table.index('user_id');
  });

  // User badges (earned badges)
  await knex.schema.createTable('user_badges', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable();
    table.integer('badge_id').unsigned().notNullable();
    table.timestamp('earned_at').defaultTo(knex.fn.now());

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('badge_id').references('id').inTable('badges').onDelete('CASCADE');
    table.unique(['user_id', 'badge_id']);
    table.index('user_id');
  });

  // User points/leaderboard
  await knex.schema.createTable('user_gamification_stats', (table) => {
    table.uuid('user_id').primary();
    table.uuid('company_id').notNullable();
    table.integer('total_points').defaultTo(0);
    table.integer('trophies_earned').defaultTo(0);
    table.integer('badges_earned').defaultTo(0);
    table.integer('current_streak').defaultTo(0);
    table.integer('longest_streak').defaultTo(0);
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.index(['company_id', 'total_points']);
  });

  console.log('✅ Created gamification tables');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_gamification_stats');
  await knex.schema.dropTableIfExists('user_badges');
  await knex.schema.dropTableIfExists('user_trophies');
  await knex.schema.dropTableIfExists('badges');
  await knex.schema.dropTableIfExists('trophies');
};
