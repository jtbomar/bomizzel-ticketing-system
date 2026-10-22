/**
 * When each user last signed in (password, social sign-in or a hand-off to
 * their company's address). Refreshing a session doesn't count.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('users', 'last_login_at'))) {
    await knex.schema.alterTable('users', (t) => t.timestamp('last_login_at').nullable());
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('users', 'last_login_at')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('last_login_at'));
  }
};
