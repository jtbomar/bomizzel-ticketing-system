/**
 * Saved views of the ticket board and list (the sidebar's Views).
 *
 * owner_id null = shared with the subscriber's whole team (admins make
 * these); otherwise a personal view only its owner sees - like macros.
 * conditions: [{ field, values }], all of which a ticket must match:
 * status, priority, assignee (me / unassigned / user ids), department,
 * account, channel, product, created (today / 7d / 30d), keywords, or a
 * custom field ("cf:<key>").
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('ticket_views')) return;
  await knex.schema.createTable('ticket_views', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.uuid('owner_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 80).notNullable();
    table.jsonb('conditions').notNullable().defaultTo('[]');
    table.integer('position').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.index(['org_id', 'owner_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ticket_views');
};
