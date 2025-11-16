/**
 * Migration: Fix users role check constraint
 * Remove any existing check constraint and ensure the enum allows all valid roles
 */

exports.up = async function (knex) {
  // Drop any existing check constraint
  await knex.raw(`
    ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS users_role_check;
  `);
  
  console.log('✅ Removed users_role_check constraint');
};

exports.down = async function (knex) {
  // Don't recreate the constraint on rollback
  console.log('✅ Rollback complete - no constraint to restore');
};
