/**
 * Why a ticket was finished: fixed, wont_do, duplicate or no_response. Set
 * when it's resolved (or closed); kept when it auto-closes after 7 days; cleared
 * if it's reopened.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('tickets', 'resolution'))) {
    await knex.schema.alterTable('tickets', (table) => {
      table.string('resolution', 32).nullable();
    });
  }
  // Tickets already resolved or closed were, as far as anyone recorded, fixed.
  await knex('tickets')
    .whereIn('status', ['resolved', 'closed'])
    .whereNull('resolution')
    .update({ resolution: 'fixed' });
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('tickets', 'resolution')) {
    await knex.schema.alterTable('tickets', (table) => table.dropColumn('resolution'));
  }
};
