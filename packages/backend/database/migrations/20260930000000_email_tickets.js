/**
 * Email for tickets.
 *
 * - companies.support_email_slug: each subscriber's support address is
 *   <slug>@<INBOUND_DOMAIN> (support.bomizzel.com). Only subscribers get one.
 * - tickets.source: 'web' or 'email'.
 * - ticket_email_messages: every email received for or sent from a ticket.
 *   provider_id (the email provider's id) is unique, so a webhook delivered
 *   twice can't create two tickets.
 */

const slugify = (name) =>
  (name || 'support')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'support';

exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('companies', 'support_email_slug'))) {
    await knex.schema.alterTable('companies', (table) => {
      table.string('support_email_slug', 64).nullable().unique();
    });
  }

  if (!(await knex.schema.hasColumn('tickets', 'source'))) {
    await knex.schema.alterTable('tickets', (table) => {
      table.string('source', 16).notNullable().defaultTo('web');
    });
  }

  if (!(await knex.schema.hasTable('ticket_email_messages'))) {
    await knex.schema.createTable('ticket_email_messages', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
      table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
      table.string('direction', 8).notNullable(); // inbound | outbound
      table.string('provider_id', 128).nullable().unique();
      table.text('message_id').nullable();
      table.string('from_address', 320).nullable();
      table.jsonb('to_addresses').nullable();
      table.text('subject').nullable();
      table
        .uuid('note_id')
        .nullable()
        .references('id')
        .inTable('ticket_notes')
        .onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.index(['ticket_id']);
      table.index(['org_id', 'direction', 'from_address', 'created_at']);
    });
  }

  // Give every subscriber an address. A subscriber is a company with no
  // subscriber_id that has a staff owner/admin.
  const subscribers = await knex('companies as c')
    .whereNull('c.subscriber_id')
    .whereNull('c.support_email_slug')
    .whereExists(function () {
      this.select(knex.raw('1'))
        .from('user_company_associations as a')
        .join('users as u', 'u.id', 'a.user_id')
        .whereRaw('a.company_id = c.id')
        .whereIn('a.role', ['owner', 'admin'])
        .whereIn('u.role', ['admin', 'employee', 'team_lead']);
    })
    .select('c.id', 'c.name', 'c.domain');

  for (const company of subscribers) {
    // Prefer the domain's first label (bomizzel.com -> bomizzel), then the name.
    const base = slugify((company.domain || '').split('.')[0] || company.name);
    let slug = base;
    for (let n = 2; await knex('companies').where('support_email_slug', slug).first('id'); n++) {
      slug = `${base}-${n}`;
    }
    await knex('companies').where('id', company.id).update({ support_email_slug: slug });
    console.log(`✅ ${company.name}: support address ${slug}@<inbound domain>`);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ticket_email_messages');
  if (await knex.schema.hasColumn('tickets', 'source')) {
    await knex.schema.alterTable('tickets', (table) => table.dropColumn('source'));
  }
  if (await knex.schema.hasColumn('companies', 'support_email_slug')) {
    await knex.schema.alterTable('companies', (table) => table.dropColumn('support_email_slug'));
  }
};
