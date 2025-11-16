/**
 * Migration: Rename 'employee' queue type to 'agent'
 * This updates the queue type enum
 */

exports.up = async function (knex) {
  // Step 1: Add 'agent' to the enum
  await knex.raw(`
    ALTER TABLE queues 
    DROP CONSTRAINT IF EXISTS queues_type_check;
  `);
  
  await knex.raw(`
    ALTER TABLE queues 
    ADD CONSTRAINT queues_type_check 
    CHECK (type IN ('unassigned', 'employee', 'agent'));
  `);

  // Step 2: Update all existing 'employee' type queues to 'agent'
  await knex('queues')
    .where('type', 'employee')
    .update({ type: 'agent' });

  // Step 3: Remove 'employee' from the enum
  await knex.raw(`
    ALTER TABLE queues 
    DROP CONSTRAINT queues_type_check;
  `);
  
  await knex.raw(`
    ALTER TABLE queues 
    ADD CONSTRAINT queues_type_check 
    CHECK (type IN ('unassigned', 'agent'));
  `);

  console.log('✅ Renamed employee queue type to agent');
};

exports.down = async function (knex) {
  // Step 1: Add 'employee' back to the enum
  await knex.raw(`
    ALTER TABLE queues 
    DROP CONSTRAINT queues_type_check;
  `);
  
  await knex.raw(`
    ALTER TABLE queues 
    ADD CONSTRAINT queues_type_check 
    CHECK (type IN ('unassigned', 'employee', 'agent'));
  `);

  // Step 2: Revert agent back to employee
  await knex('queues')
    .where('type', 'agent')
    .update({ type: 'employee' });

  // Step 3: Remove 'agent' from the enum
  await knex.raw(`
    ALTER TABLE queues 
    DROP CONSTRAINT queues_type_check;
  `);
  
  await knex.raw(`
    ALTER TABLE queues 
    ADD CONSTRAINT queues_type_check 
    CHECK (type IN ('unassigned', 'employee'));
  `);

  console.log('✅ Reverted agent queue type back to employee');
};
