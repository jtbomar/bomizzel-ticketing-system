/**
 * Phase 1: Add org_id to all tenant-scoped tables
 * This migration adds organization context to all tables that need tenant isolation
 */
exports.up = async function(knex) {
  console.log('🚀 Starting multi-tenancy migration - Phase 1: Adding org_id columns');

  // Add org_id to tickets table
  const hasTicketsOrgId = await knex.schema.hasColumn('tickets', 'org_id');
  if (!hasTicketsOrgId) {
    await knex.schema.alterTable('tickets', (table) => {
      table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
      table.index('org_id');
    });
    console.log('✅ Added org_id to tickets table');
  }

  // Add org_id to queues table
  const hasQueuesOrgId = await knex.schema.hasColumn('queues', 'org_id');
  if (!hasQueuesOrgId) {
    await knex.schema.alterTable('queues', (table) => {
      table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
      table.index('org_id');
    });
    console.log('✅ Added org_id to queues table');
  }

  // Add org_id to teams table
  const hasTeamsOrgId = await knex.schema.hasColumn('teams', 'org_id');
  if (!hasTeamsOrgId) {
    await knex.schema.alterTable('teams', (table) => {
      table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
      table.index('org_id');
    });
    console.log('✅ Added org_id to teams table');
  }

  // Add org_id to custom_fields table
  const hasCustomFieldsOrgId = await knex.schema.hasColumn('custom_fields', 'org_id');
  if (!hasCustomFieldsOrgId) {
    await knex.schema.alterTable('custom_fields', (table) => {
      table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
      table.index('org_id');
    });
    console.log('✅ Added org_id to custom_fields table');
  }

  // Add org_id to ticket_notes table
  const hasTicketNotesOrgId = await knex.schema.hasColumn('ticket_notes', 'org_id');
  if (!hasTicketNotesOrgId) {
    await knex.schema.alterTable('ticket_notes', (table) => {
      table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
      table.index('org_id');
    });
    console.log('✅ Added org_id to ticket_notes table');
  }

  // Add org_id to files table (if table exists)
  const hasFilesTable = await knex.schema.hasTable('files');
  if (hasFilesTable) {
    const hasFilesOrgId = await knex.schema.hasColumn('files', 'org_id');
    if (!hasFilesOrgId) {
      await knex.schema.alterTable('files', (table) => {
        table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
        table.index('org_id');
      });
      console.log('✅ Added org_id to files table');
    }
  } else {
    console.log('⚠️  Skipping files table - does not exist');
  }

  // Add org_id to departments table
  const hasDepartmentsOrgId = await knex.schema.hasColumn('departments', 'org_id');
  if (!hasDepartmentsOrgId) {
    await knex.schema.alterTable('departments', (table) => {
      table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
      table.index('org_id');
    });
    console.log('✅ Added org_id to departments table');
  }

  // Add current_org_id to users table (for tracking user's current org context)
  const hasUsersCurrentOrgId = await knex.schema.hasColumn('users', 'current_org_id');
  if (!hasUsersCurrentOrgId) {
    await knex.schema.alterTable('users', (table) => {
      table.uuid('current_org_id').references('id').inTable('companies').onDelete('SET NULL');
      table.index('current_org_id');
    });
    console.log('✅ Added current_org_id to users table');
  }

  console.log('✅ Phase 1 migration completed - org_id columns added');
};

exports.down = async function(knex) {
  console.log('⚠️  Rolling back multi-tenancy migration - Phase 1');

  // Remove org_id columns (in reverse order)
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('current_org_id');
  });

  await knex.schema.alterTable('departments', (table) => {
    table.dropColumn('org_id');
  });

  await knex.schema.alterTable('files', (table) => {
    table.dropColumn('org_id');
  });

  await knex.schema.alterTable('ticket_notes', (table) => {
    table.dropColumn('org_id');
  });

  await knex.schema.alterTable('custom_fields', (table) => {
    table.dropColumn('org_id');
  });

  await knex.schema.alterTable('teams', (table) => {
    table.dropColumn('org_id');
  });

  await knex.schema.alterTable('queues', (table) => {
    table.dropColumn('org_id');
  });

  await knex.schema.alterTable('tickets', (table) => {
    table.dropColumn('org_id');
  });

  console.log('✅ Rollback completed');
};
