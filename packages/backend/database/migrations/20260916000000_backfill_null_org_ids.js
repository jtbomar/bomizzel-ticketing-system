/**
 * Backfill org_id rows left NULL after 20251123000000_consolidated_multi_tenancy_setup.
 *
 * That migration added org_id and backfilled it from company_id, but the insert
 * paths in application code were never updated to set org_id, so every row
 * created afterwards has org_id = NULL. This re-runs the same backfill and is
 * safe to apply repeatedly.
 */
exports.up = async function (knex) {
  // table -> column to copy org_id from
  const fromCompanyId = ['tickets', 'queues', 'teams', 'custom_fields', 'departments'];

  for (const table of fromCompanyId) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;

    const hasOrgId = await knex.schema.hasColumn(table, 'org_id');
    const hasCompanyId = await knex.schema.hasColumn(table, 'company_id');
    if (!hasOrgId || !hasCompanyId) continue;

    const result = await knex(table)
      .whereNull('org_id')
      .whereNotNull('company_id')
      .update({ org_id: knex.ref('company_id') });

    console.log(`✅ ${table}: backfilled ${result} org_id value(s) from company_id`);
  }

  // ticket_notes has no company_id of its own; derive it from the parent ticket.
  if (await knex.schema.hasTable('ticket_notes')) {
    if (await knex.schema.hasColumn('ticket_notes', 'org_id')) {
      await knex.raw(`
        UPDATE ticket_notes
        SET org_id = tickets.org_id
        FROM tickets
        WHERE ticket_notes.ticket_id = tickets.id
          AND ticket_notes.org_id IS NULL
          AND tickets.org_id IS NOT NULL
      `);
      console.log('✅ ticket_notes: backfilled org_id from parent ticket');
    }
  }

  // Users who still have no current_org_id get their first company association.
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
  console.log('✅ users: backfilled current_org_id');
};

exports.down = async function () {
  // Data backfill only - nothing to undo. Reverting would mean re-introducing
  // NULLs, which is never what a rollback wants here.
};
