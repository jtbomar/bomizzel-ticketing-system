/**
 * How a subscriber's customer portal looks, set on the Rebranding page:
 * a background picture (data: URI, served publicly at
 * /api/public/portal-background/:companyId) and a welcome title and message
 * on the sign-in page.
 */
const COLUMNS = [
  ['portal_background', (t, n) => t.text(n).nullable()],
  ['portal_welcome_title', (t, n) => t.string(n, 120).nullable()],
  ['portal_welcome_text', (t, n) => t.string(n, 500).nullable()],
];

exports.up = async function (knex) {
  for (const [name, add] of COLUMNS) {
    if (!(await knex.schema.hasColumn('company_profiles', name))) {
      await knex.schema.alterTable('company_profiles', (t) => add(t, name));
    }
  }
};

exports.down = async function (knex) {
  for (const [name] of COLUMNS) {
    if (await knex.schema.hasColumn('company_profiles', name)) {
      await knex.schema.alterTable('company_profiles', (t) => t.dropColumn(name));
    }
  }
};
