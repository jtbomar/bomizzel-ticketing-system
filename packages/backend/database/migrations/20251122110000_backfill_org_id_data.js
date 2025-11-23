/**
 * Phase 1b: Backfill org_id for existing data
 * This migration populates org_id for all existing records
 */
exports.up = async function(knex) {
  console.log('🚀 Starting data backfill - Phase 1b: Populating org_id values');

  // Backfill tickets.org_id from company_id
  await knex.raw(`
    UPDATE tickets
    SET org_id = company_id
    WHERE org_id IS NULL AND company_id IS NOT NULL
  `);
  const ticketsCount = await knex('tickets').whereNotNull('org_id').count('* as count').first();
  console.log(`✅ Backfilled org_id for ${ticketsCount?.count || 0} tickets`);

  // Backfill queues.org_id from company_id
  await knex.raw(`
    UPDATE queues
    SET org_id = company_id
    WHERE org_id IS NULL AND company_id IS NOT NULL
  `);
  console.log(`✅ Backfilled org_id for queues`);

  // Backfill teams.org_id from company_id
  await knex.raw(`
    UPDATE teams
    SET org_id = company_id
    WHERE org_id IS NULL AND company_id IS NOT NULL
  `);
  console.log(`✅ Backfilled org_id for teams`);

  // Backfill custom_fields.org_id from company_id
  await knex.raw(`
    UPDATE custom_fields
    SET org_id = company_id
    WHERE org_id IS NULL AND company_id IS NOT NULL
  `);
  console.log(`✅ Backfilled org_id for custom_fields`);

  // Backfill departments.org_id from company_id
  await knex.raw(`
    UPDATE departments
    SET org_id = company_id
    WHERE org_id IS NULL AND company_id IS NOT NULL
  `);
  console.log(`✅ Backfilled org_id for departments`);

  // Backfill ticket_notes.org_id from tickets
  const ticketNotesUpdated = await knex.raw(`
    UPDATE ticket_notes
    SET org_id = tickets.org_id
    FROM tickets
    WHERE ticket_notes.ticket_id = tickets.id
    AND ticket_notes.org_id IS NULL
  `);
  console.log(`✅ Backfilled org_id for ticket_notes`);

  // Backfill files.org_id from tickets (if ticket_id exists)
  const filesUpdated = await knex.raw(`
    UPDATE files
    SET org_id = tickets.org_id
    FROM tickets
    WHERE files.ticket_id = tickets.id
    AND files.org_id IS NULL
  `);
  console.log(`✅ Backfilled org_id for files`);

  // Set current_org_id for users based on their default or most recent org
  const usersUpdated = await knex.raw(`
    UPDATE users
    SET current_org_id = (
      SELECT company_id
      FROM user_company_associations
      WHERE user_company_associations.user_id = users.id
      ORDER BY 
        CASE WHEN is_default = true THEN 0 ELSE 1 END,
        last_accessed_at DESC NULLS LAST,
        created_at DESC
      LIMIT 1
    )
    WHERE current_org_id IS NULL
    AND EXISTS (
      SELECT 1 FROM user_company_associations
      WHERE user_company_associations.user_id = users.id
    )
  `);
  console.log(`✅ Set current_org_id for users`);

  console.log('✅ Phase 1b data backfill completed');
};

exports.down = async function(knex) {
  console.log('⚠️  Rolling back data backfill - Phase 1b');
  
  // Clear org_id values
  await knex('tickets').update({ org_id: null });
  await knex('queues').update({ org_id: null });
  await knex('teams').update({ org_id: null });
  await knex('custom_fields').update({ org_id: null });
  await knex('departments').update({ org_id: null });
  await knex('ticket_notes').update({ org_id: null });
  await knex('files').update({ org_id: null });
  await knex('users').update({ current_org_id: null });

  console.log('✅ Rollback completed');
};
