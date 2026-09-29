/**
 * Several older suites build a single company, some staff and some teams
 * without saying who owns what - from before subscribers existed. Now that
 * everything is scoped to a subscriber, those fixtures would see nothing.
 *
 * This makes that one company the subscriber for the whole fixture:
 * - teams, queues and custom fields with no owner become its;
 * - staff with no company become its staff;
 * - tickets (and their notes) get it as their subscriber;
 * - every user's current_org_id points at it.
 *
 * Call it at the end of a suite's setup, and again after creating more teams
 * with the Team model directly. New code and new tests should build a proper
 * subscriber -> account -> contact fixture instead (see tenantIsolation.test.ts).
 */
export const adoptSingleTenant = async (companyId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { db } = require('../../src/config/database');

  await db('teams').whereNull('org_id').update({ org_id: companyId });
  await db('queues').whereNull('org_id').update({ org_id: companyId });
  if (await db.schema.hasColumn('custom_fields', 'org_id')) {
    await db('custom_fields').whereNull('org_id').update({ org_id: companyId });
  }

  const staffWithoutCompany = await db('users')
    .whereIn('role', ['admin', 'employee', 'team_lead'])
    .whereNotIn('id', db('user_company_associations').select('user_id'))
    .select('id');
  if (staffWithoutCompany.length > 0) {
    await db('user_company_associations').insert(
      staffWithoutCompany.map((u: { id: string }) => ({
        user_id: u.id,
        company_id: companyId,
        role: 'admin',
      }))
    );
  }

  // Other companies in the fixture are this subscriber's accounts.
  await db('companies')
    .whereNot('id', companyId)
    .whereNull('subscriber_id')
    .update({ subscriber_id: companyId });

  await db.raw(
    `UPDATE tickets t SET org_id = coalesce(c.subscriber_id, c.id)
       FROM companies c WHERE c.id = t.company_id`
  );
  await db.raw(
    `UPDATE ticket_notes n SET org_id = t.org_id FROM tickets t WHERE t.id = n.ticket_id`
  );
  await db('users').update({ current_org_id: companyId });
};
