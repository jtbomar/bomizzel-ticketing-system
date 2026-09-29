/**
 * Tie every account to the subscriber that owns it.
 *
 * Subscribers (companies that sign up for Bomizzel) and accounts (a
 * subscriber's own customers) are both rows in `companies`, and nothing said
 * which subscriber an account belonged to - so every subscriber could see every
 * other subscriber's accounts, contacts and tickets.
 *
 * companies.subscriber_id is NULL for a subscriber and points at the owning
 * subscriber for an account. A company is a subscriber when it has an owner or
 * admin who is staff (not a customer contact), or a provisioned subscription.
 *
 * tickets.org_id held the account id; it now holds the subscriber id, the same
 * as teams, queues and departments. tickets.company_id is still the account.
 */

const STAFF_ROLES = `('admin', 'employee', 'team_lead')`;

const SUBSCRIBERS = `
  SELECT c.id FROM companies c
   WHERE EXISTS (
           SELECT 1 FROM user_company_associations a
             JOIN users u ON u.id = a.user_id
            WHERE a.company_id = c.id
              AND a.role IN ('owner', 'admin')
              AND u.role IN ${STAFF_ROLES})
      OR EXISTS (
           SELECT 1 FROM customer_subscriptions s
            WHERE s.company_id = c.id AND s.is_custom = true)
`;

exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('companies', 'subscriber_id'))) {
    await knex.schema.alterTable('companies', (table) => {
      // RESTRICT: removing a subscriber must deal with its accounts on purpose.
      table.uuid('subscriber_id').nullable().references('id').inTable('companies').onDelete('RESTRICT');
      table.index(['subscriber_id']);
    });
  }

  // Accounts: companies that are not subscribers. Give each the subscriber its
  // contacts were created under (users.current_org_id), when that is a subscriber.
  const byContacts = await knex.raw(`
    UPDATE companies acct
       SET subscriber_id = pick.subscriber_id
      FROM (
        SELECT DISTINCT ON (a.company_id) a.company_id, u.current_org_id AS subscriber_id
          FROM user_company_associations a
          JOIN users u ON u.id = a.user_id
         WHERE u.current_org_id IN (${SUBSCRIBERS})
         GROUP BY a.company_id, u.current_org_id
         ORDER BY a.company_id, count(*) DESC
      ) pick
     WHERE acct.id = pick.company_id
       AND acct.subscriber_id IS NULL
       AND acct.id NOT IN (${SUBSCRIBERS})
       AND pick.subscriber_id <> acct.id
  `);
  console.log(`✅ companies: linked ${byContacts.rowCount} account(s) to a subscriber via contacts`);

  // Any account still unlinked, while there is exactly one subscriber, belongs
  // to it. With more than one there is no safe guess, so leave it and say so.
  const subscribers = await knex.raw(SUBSCRIBERS);
  if (subscribers.rows.length === 1) {
    const only = subscribers.rows[0].id;
    const orphans = await knex('companies')
      .whereNull('subscriber_id')
      .whereNot('id', only)
      .update({ subscriber_id: only });
    console.log(`✅ companies: linked ${orphans} remaining account(s) to the only subscriber`);

    // Branding was one global row with no company; it's now per subscriber.
    if (await knex.schema.hasTable('company_profiles')) {
      const hasProfile = await knex('company_profiles').where('company_id', only).first('id');
      if (!hasProfile) {
        const moved = await knex('company_profiles')
          .whereNull('company_id')
          .orderBy('created_at')
          .limit(1)
          .update({ company_id: only });
        console.log(`✅ company_profiles: gave ${moved} unowned branding row to the only subscriber`);
      }
    }
  } else {
    const left = await knex.raw(
      `SELECT count(*)::int n FROM companies WHERE subscriber_id IS NULL AND id NOT IN (${SUBSCRIBERS})`
    );
    if (left.rows[0].n > 0) {
      console.warn(`⚠️  companies: ${left.rows[0].n} account(s) have no subscriber - set subscriber_id by hand`);
    }
  }

  // tickets.org_id -> the subscriber (account's subscriber, or the company itself
  // when a ticket was raised directly against a subscriber).
  const tickets = await knex.raw(`
    UPDATE tickets t
       SET org_id = coalesce(c.subscriber_id, c.id)
      FROM companies c
     WHERE c.id = t.company_id
       AND t.org_id IS DISTINCT FROM coalesce(c.subscriber_id, c.id)
  `);
  console.log(`✅ tickets: set org_id to the subscriber on ${tickets.rowCount} ticket(s)`);

  if (await knex.schema.hasColumn('ticket_notes', 'org_id')) {
    await knex.raw(`
      UPDATE ticket_notes n
         SET org_id = t.org_id
        FROM tickets t
       WHERE t.id = n.ticket_id
         AND n.org_id IS DISTINCT FROM t.org_id
    `);
  }
};

exports.down = async function (knex) {
  // Put tickets.org_id back to the account, as before.
  await knex.raw(`UPDATE tickets SET org_id = company_id WHERE company_id IS NOT NULL`);
  if (await knex.schema.hasColumn('companies', 'subscriber_id')) {
    await knex.schema.alterTable('companies', (table) => {
      table.dropColumn('subscriber_id');
    });
  }
};
