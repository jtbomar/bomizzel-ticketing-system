/**
 * Branded email to a subscriber's customers.
 *
 * - users.email_signature_html: an agent's own signature, on the emails they
 *   send (cleaned to formatting only, like notes).
 * - company_profiles.email_signature_html: the subscriber's signature, on its
 *   automatic emails and for agents with none of their own.
 * - company_profiles.auto_invite_contacts: a contact staff add gets the
 *   welcome email (set your password) without anyone ticking the box.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('users', 'email_signature_html'))) {
    await knex.schema.alterTable('users', (t) => t.text('email_signature_html').nullable());
  }
  if (!(await knex.schema.hasColumn('company_profiles', 'email_signature_html'))) {
    await knex.schema.alterTable('company_profiles', (t) =>
      t.text('email_signature_html').nullable()
    );
  }
  if (!(await knex.schema.hasColumn('company_profiles', 'auto_invite_contacts'))) {
    await knex.schema.alterTable('company_profiles', (t) =>
      t.boolean('auto_invite_contacts').notNullable().defaultTo(false)
    );
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('users', 'email_signature_html')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('email_signature_html'));
  }
  for (const column of ['email_signature_html', 'auto_invite_contacts']) {
    if (await knex.schema.hasColumn('company_profiles', column)) {
      await knex.schema.alterTable('company_profiles', (t) => t.dropColumn(column));
    }
  }
};
