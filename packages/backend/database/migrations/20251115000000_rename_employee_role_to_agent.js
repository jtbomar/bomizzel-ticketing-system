/**
 * Migration: Rename 'employee' role to 'agent'
 * This updates the role enum and all existing employee records
 */

exports.up = async function (knex) {
  // Step 1: Add 'agent' to the enum
  await knex.raw(`
    ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS users_role_check;
  `);
  
  await knex.raw(`
    ALTER TABLE users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('customer', 'employee', 'agent', 'team_lead', 'admin'));
  `);

  // Step 2: Update all existing 'employee' role users to 'agent'
  await knex('users')
    .where('role', 'employee')
    .update({ role: 'agent' });

  // Step 3: Remove 'employee' from the enum
  await knex.raw(`
    ALTER TABLE users 
    DROP CONSTRAINT users_role_check;
  `);
  
  await knex.raw(`
    ALTER TABLE users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('customer', 'agent', 'team_lead', 'admin'));
  `);

  console.log('✅ Renamed employee role to agent');
};

exports.down = async function (knex) {
  // Step 1: Add 'employee' back to the enum
  await knex.raw(`
    ALTER TABLE users 
    DROP CONSTRAINT users_role_check;
  `);
  
  await knex.raw(`
    ALTER TABLE users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('customer', 'employee', 'agent', 'team_lead', 'admin'));
  `);

  // Step 2: Revert agent back to employee
  await knex('users')
    .where('role', 'agent')
    .update({ role: 'employee' });

  // Step 3: Remove 'agent' from the enum
  await knex.raw(`
    ALTER TABLE users 
    DROP CONSTRAINT users_role_check;
  `);
  
  await knex.raw(`
    ALTER TABLE users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('customer', 'employee', 'team_lead', 'admin'));
  `);

  console.log('✅ Reverted agent role back to employee');
};
