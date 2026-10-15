/**
 * Portal names. companies.support_email_slug is a subscriber's one name: its
 * portal (portal.bomizzel.com/<name>) and its support email. When a
 * subscriber changes it, the old name goes here so its old address and portal
 * link keep working, and nobody else can take it.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('subscriber_slug_aliases'))) {
    await knex.schema.createTable('subscriber_slug_aliases', (t) => {
      t.string('slug', 64).primary();
      t.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['company_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('subscriber_slug_aliases');
};
