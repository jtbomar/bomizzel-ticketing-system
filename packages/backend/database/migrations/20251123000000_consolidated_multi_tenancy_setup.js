/**
 * Consolidated Multi-Tenancy Setup
 * This migration safely adds org_id columns and backfills data
 * Can be run multiple times safely (idempotent)
 */
exports.up = async function (knex) {
  console.log('🚀 Starting consolidated multi-tenancy setup');

  // Helper function to safely add column
  async function addOrgIdColumn(tableName) {
    const tableExists = await knex.schema.hasTable(tableName);
    if (!tableExists) {
      console.log(`⚠️  Skipping ${tableName} - table does not exist`);
      return false;
    }

    const hasOrgId = await knex.schema.hasColumn(tableName, 'org_id');
    if (hasOrgId) {
      console.log(`⏭️  ${tableName}.org_id already exists`);
      return true;
    }

    await knex.schema.alterTable(tableName, (table) => {
      table.uuid('org_id').references('id').inTable('companies').onDelete('CASCADE');
      table.index('org_id');
    });
    console.log(`✅ Added org_id to ${tableName}`);
    return true;
  }

  // Helper function to safely backfill org_id from company_id
  async function backfillOrgId(tableName) {
    const tableExists = await knex.schema.hasTable(tableName);
    if (!tableExists) return;

    const hasCompanyId = await knex.schema.hasColumn(tableName, 'company_id');
    if (!hasCompanyId) {
      console.log(`⚠️  ${tableName} has no company_id column to backfill from`);
      return;
    }

    await knex.raw(`
      UPDATE ${tableName}
      SET org_id = company_id
      WHERE org_id IS NULL AND company_id IS NOT NULL
    `);
    console.log(`✅ Backfilled ${tableName}.org_id`);
  }

  // Add org_id columns to all tables
  await addOrgIdColumn('tickets');
  await addOrgIdColumn('queues');
  await addOrgIdColumn('teams');
  await addOrgIdColumn('custom_fields');
  await addOrgIdColumn('ticket_notes');
  await addOrgIdColumn('files');
  await addOrgIdColumn('departments');

  // Add current_org_id to users
  const hasCurrentOrgId = await knex.schema.hasColumn('users', 'current_org_id');
  if (!hasCurrentOrgId) {
    await knex.schema.alterTable('users', (table) => {
      table.uuid('current_org_id').references('id').inTable('companies').onDelete('SET NULL');
      table.index('current_org_id');
    });
    console.log('✅ Added current_org_id to users');
  }

  // Backfill org_id data
  await backfillOrgId('tickets');
  await backfillOrgId('queues');
  await backfillOrgId('teams');
  await backfillOrgId('custom_fields');
  await backfillOrgId('ticket_notes');
  await backfillOrgId('departments');

  // Backfill ticket_notes from tickets
  const hasTicketNotes = await knex.schema.hasTable('ticket_notes');
  if (hasTicketNotes) {
    await knex.raw(`
      UPDATE ticket_notes
      SET org_id = tickets.org_id
      FROM tickets
      WHERE ticket_notes.ticket_id = tickets.id
      AND ticket_notes.org_id IS NULL
      AND tickets.org_id IS NOT NULL
    `);
    console.log('✅ Backfilled ticket_notes.org_id from tickets');
  }

  // Set current_org_id for users
  await knex.raw(`
    UPDATE users
    SET current_org_id = (
      SELECT company_id
      FROM user_company_associations
      WHERE user_company_associations.user_id = users.id
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE current_org_id IS NULL
    AND EXISTS (
      SELECT 1 FROM user_company_associations
      WHERE user_company_associations.user_id = users.id
    )
  `);
  console.log('✅ Set current_org_id for users');

  // Enhance user_company_associations
  const hasLastAccessed = await knex.schema.hasColumn(
    'user_company_associations',
    'last_accessed_at'
  );
  if (!hasLastAccessed) {
    await knex.schema.alterTable('user_company_associations', (table) => {
      table.timestamp('last_accessed_at').defaultTo(knex.fn.now());
      table.index('last_accessed_at');
    });
    console.log('✅ Added last_accessed_at to user_company_associations');
  }

  const hasIsDefault = await knex.schema.hasColumn('user_company_associations', 'is_default');
  if (!hasIsDefault) {
    await knex.schema.alterTable('user_company_associations', (table) => {
      table.boolean('is_default').defaultTo(false);
      table.index('is_default');
    });
    console.log('✅ Added is_default to user_company_associations');

    // Set first association as default for each user
    const users = await knex('user_company_associations').select('user_id').groupBy('user_id');

    for (const user of users) {
      const firstAssociation = await knex('user_company_associations')
        .where('user_id', user.user_id)
        .orderBy('created_at', 'asc')
        .first();

      if (firstAssociation) {
        await knex('user_company_associations')
          .where('user_id', firstAssociation.user_id)
          .where('company_id', firstAssociation.company_id)
          .update({ is_default: true });
      }
    }
    console.log(`✅ Set default org for ${users.length} users`);
  }

  console.log('✅ Multi-tenancy setup completed successfully');
};

exports.down = async function (knex) {
  console.log('⚠️  Rolling back multi-tenancy setup');

  // Remove columns in reverse order
  const tables = [
    'tickets',
    'queues',
    'teams',
    'custom_fields',
    'ticket_notes',
    'files',
    'departments',
  ];

  for (const table of tables) {
    const exists = await knex.schema.hasTable(table);
    if (exists) {
      const hasOrgId = await knex.schema.hasColumn(table, 'org_id');
      if (hasOrgId) {
        await knex.schema.alterTable(table, (t) => t.dropColumn('org_id'));
      }
    }
  }

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('current_org_id');
  });

  await knex.schema.alterTable('user_company_associations', (table) => {
    table.dropColumn('is_default');
    table.dropColumn('last_accessed_at');
  });

  console.log('✅ Rollback completed');
};
