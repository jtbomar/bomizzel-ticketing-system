/**
 * Migration: Fix queues type check constraint
 * Remove any existing check constraint
 */

exports.up = async function (knex) {
  // Drop any existing check constraint
  await knex.raw(`
    ALTER TABLE queues 
    DROP CONSTRAINT IF EXISTS queues_type_check;
  `);

  console.log('✅ Removed queues_type_check constraint');
};

exports.down = async function (knex) {
  // Don't recreate the constraint on rollback
  console.log('✅ Rollback complete - no constraint to restore');
};
