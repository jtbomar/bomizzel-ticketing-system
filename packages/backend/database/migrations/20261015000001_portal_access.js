/**
 * Customer portal access.
 *
 * users.portal_scope, for contacts: 'own' sees only the tickets they opened;
 * 'company' sees every ticket of their account(s). People who sign up on a
 * portal (or email in) start at 'own' until one of the subscriber's admins
 * approves them; contacts agents add are 'company'. Contacts already here
 * keep seeing what they saw (company).
 *
 * portal_access_requests: someone asking to see their company's tickets.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('users', 'portal_scope'))) {
    await knex.schema.alterTable('users', (t) =>
      t.string('portal_scope', 16).notNullable().defaultTo('own')
    );
    await knex('users').where('role', 'customer').update({ portal_scope: 'company' });
  }
  if (!(await knex.schema.hasTable('portal_access_requests'))) {
    await knex.schema.createTable('portal_access_requests', (t) => {
      t.uuid('id').primary();
      t.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      // The account they were placed in (by email domain, or made from the name they gave)
      t.uuid('company_id').nullable().references('id').inTable('companies').onDelete('SET NULL');
      t.string('company_name', 150).nullable();
      t.string('status', 16).notNullable().defaultTo('pending');
      t.timestamp('admins_notified_at', { useTz: true }).nullable();
      t.uuid('decided_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('decided_at', { useTz: true }).nullable();
      t.timestamps(true, true);
      t.index(['org_id', 'status']);
      t.index(['user_id']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('portal_access_requests');
  if (await knex.schema.hasColumn('users', 'portal_scope')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('portal_scope'));
  }
};
