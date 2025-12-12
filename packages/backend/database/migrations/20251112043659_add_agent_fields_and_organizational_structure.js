/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Create organizational_roles table (company hierarchy like President, Director, etc.)
  await knex.schema.createTable('organizational_roles', function (table) {
    table.increments('id').primary();
    table.string('company_id').notNullable();
    table.string('name').notNullable(); // e.g., "President", "Director of Support"
    table.text('description');
    table.integer('hierarchy_level').defaultTo(0); // Lower number = higher in hierarchy
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.index(['company_id', 'is_active']);
    table.unique(['company_id', 'name']);
  });

  // Create user_profiles table (like Support Administrator, Technical Lead, etc.)
  await knex.schema.createTable('user_profiles', function (table) {
    table.increments('id').primary();
    table.string('company_id').notNullable();
    table.string('name').notNullable(); // e.g., "Support Administrator", "Technical Lead"
    table.text('description');
    table.jsonb('permissions').defaultTo('{}'); // Store specific permissions
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.index(['company_id', 'is_active']);
    table.unique(['company_id', 'name']);
  });

  // Add new fields to users table
  await knex.schema.table('users', function (table) {
    table.string('phone');
    table.string('mobile_phone');
    table.string('extension');
    table.text('about');
    table.integer('organizational_role_id').unsigned();
    table.integer('user_profile_id').unsigned();
    table.boolean('must_change_password').defaultTo(false);
    table.string('default_password'); // Temporary storage for initial password

    table
      .foreign('organizational_role_id')
      .references('organizational_roles.id')
      .onDelete('SET NULL');
    table.foreign('user_profile_id').references('user_profiles.id').onDelete('SET NULL');
  });

  // Create user_departments junction table (many-to-many)
  await knex.schema.createTable('user_departments', function (table) {
    table.increments('id').primary();
    table.uuid('user_id').notNullable();
    table.integer('department_id').unsigned().notNullable();
    table.boolean('is_primary').defaultTo(false); // One department can be primary
    table.timestamps(true, true);

    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('department_id').references('departments.id').onDelete('CASCADE');
    table.unique(['user_id', 'department_id']);
    table.index('user_id');
    table.index('department_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_departments');

  await knex.schema.table('users', function (table) {
    table.dropForeign('organizational_role_id');
    table.dropForeign('user_profile_id');
    table.dropColumn('phone');
    table.dropColumn('mobile_phone');
    table.dropColumn('extension');
    table.dropColumn('about');
    table.dropColumn('organizational_role_id');
    table.dropColumn('user_profile_id');
    table.dropColumn('must_change_password');
    table.dropColumn('default_password');
  });

  await knex.schema.dropTableIfExists('user_profiles');
  await knex.schema.dropTableIfExists('organizational_roles');
};
