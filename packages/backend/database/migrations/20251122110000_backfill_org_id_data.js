/**
 * Phase 1b: Backfill org_id for existing data
 * This migration populates org_id for all existing records
 */
exports.up = async function(knex) {
  console.log('🚀 Starting data backfill - Phase 1b: Populating org_id values');

  // Backfill tickets.org_id from company_id
  const ticketsUpdated = await knex('tickets')
    .whereNull('org_id')
    .whereNotNull('company_id')
    .update({ org_id: knex.raw('company_id') });
  console.log(`✅ Backfilled org_id for ${ticketsUpdated} tickets`);

  // Backfill queues.org_id from company_id
  const queuesUpdated = await knex('queues')
    .whereNull('org_id')
    .whereNotNull('company_id')
    .update({ org_id: knex.raw('company_id') });
  console.log(`✅ Backfilled org_id for ${queuesUpdated} queues`);

  // Backfill teams.org_id from company_id
  const teamsUpdated = await knex('teams')
    .whereNull('org_id')
    .whereNotNull('company_id')
    .update({ org_id: knex.raw('company_id') });
  console.log(`✅ Backfilled org_id for ${teamsUpdated} teams`);

  // Backfill custom_fields.org_id from company_id
  const customFieldsUpdated = await knex('custom_fields')
    .whereNull('org_id')
    .whereNotNull('company_id')
    .update({ org_id: knex.raw('company_id') });
  console.log(`✅ Backfilled org_id for ${customFieldsUpdated} custom_fields`);

  // Backfill departments.org_id from company_id
  const departmentsUpdated = await knex('departments')
    .whereNull('org_id')
    .whereNotNull('company_id')
    .update({ org_id: knex.raw('company_id') });
  console.log(`✅ Backfilled org_id for ${departmentsUpdated} departments`);

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
