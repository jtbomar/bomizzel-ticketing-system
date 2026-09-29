/**
 * organizational_roles and user_profiles are now per subscriber (company_id =
 * the subscriber's id). Rows were created with company_id 'bomizzel-internal'
 * (or none) by default. While there is exactly one subscriber they are its;
 * with more than one there is no safe guess, so they are left and reported.
 */

const SUBSCRIBERS = `
  SELECT c.id FROM companies c
   WHERE c.subscriber_id IS NULL
     AND EXISTS (
           SELECT 1 FROM user_company_associations a
             JOIN users u ON u.id = a.user_id
            WHERE a.company_id = c.id
              AND a.role IN ('owner', 'admin')
              AND u.role IN ('admin', 'employee', 'team_lead'))
`;

exports.up = async function (knex) {
  const subscribers = (await knex.raw(SUBSCRIBERS)).rows;

  for (const table of ['organizational_roles', 'user_profiles']) {
    if (!(await knex.schema.hasTable(table))) continue;

    const unowned = () =>
      knex(table).where((q) =>
        q.whereNull('company_id').orWhere('company_id', 'bomizzel-internal')
      );

    if (subscribers.length === 1) {
      const moved = await unowned().update({ company_id: subscribers[0].id });
      console.log(`✅ ${table}: gave ${moved} unowned row(s) to the only subscriber`);
    } else {
      const [{ count }] = await unowned().count('* as count');
      if (Number(count) > 0) {
        console.warn(`⚠️  ${table}: ${count} row(s) have no subscriber - set company_id by hand`);
      }
    }
  }
};

exports.down = async function () {
  // Nothing to undo: the old 'bomizzel-internal' value meant "no owner".
};
