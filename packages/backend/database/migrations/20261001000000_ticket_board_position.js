/**
 * tickets.board_position: where a ticket sits in its lane on the board, so
 * dragging one above another sticks for everyone at the subscriber. Lower is
 * worked first; tickets nobody has placed (null) come after, oldest first.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('tickets', 'board_position'))) {
    await knex.schema.alterTable('tickets', (table) => {
      table.integer('board_position').nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('tickets', 'board_position')) {
    await knex.schema.alterTable('tickets', (table) => table.dropColumn('board_position'));
  }
};
