/**
 * Macros: saved replies and ticket changes an agent applies in one click.
 *
 * owner_id null = shared with the subscriber's whole team (admins make
 * these); otherwise a personal macro only its owner sees.
 * actions: { status, resolution, priority, assignTo ('me' | 'unassigned' |
 * user id), departmentId } - only the ones set are changed.
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('macros')) return;
  await knex.schema.createTable('macros', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.uuid('owner_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 120).notNullable();
    table.text('reply_html').nullable();
    table.boolean('reply_internal').notNullable().defaultTo(false);
    table.jsonb('actions').notNullable().defaultTo('{}');
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.index(['org_id', 'owner_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('macros');
};
