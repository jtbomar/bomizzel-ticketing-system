/**
 * Formatted notes. ticket_notes.content stays the plain-text version (search,
 * plain-text email, older clients); content_html holds the sanitised HTML the
 * editor produced (bold, colours, highlight, lists, links).
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('ticket_notes', 'content_html'))) {
    await knex.schema.alterTable('ticket_notes', (table) => {
      table.text('content_html').nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('ticket_notes', 'content_html')) {
    await knex.schema.alterTable('ticket_notes', (table) => table.dropColumn('content_html'));
  }
};
