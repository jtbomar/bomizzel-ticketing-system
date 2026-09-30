/**
 * Permanent ticket numbers: #1001, #1002, ... per subscriber.
 *
 * - companies.next_ticket_number: the subscriber's counter (starts at 1001).
 * - tickets.ticket_number: assigned by a BEFORE INSERT trigger from the
 *   ticket's subscriber (org_id), so every way a ticket is created - web,
 *   email, import - gets one, and the row lock on the counter means two
 *   tickets created at once can't get the same number.
 * - Existing tickets are numbered per subscriber in order of creation.
 *
 * The dashboard used to show a ticket's position in the list plus 1000,
 * which changed as tickets came and went.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('companies', 'next_ticket_number'))) {
    await knex.schema.alterTable('companies', (table) => {
      table.integer('next_ticket_number').notNullable().defaultTo(1001);
    });
  }
  if (!(await knex.schema.hasColumn('tickets', 'ticket_number'))) {
    await knex.schema.alterTable('tickets', (table) => {
      table.integer('ticket_number').nullable();
    });
  }

  const numbered = await knex.raw(`
    UPDATE tickets t
       SET ticket_number = n.number
      FROM (
        SELECT id, 1000 + row_number() OVER (PARTITION BY org_id ORDER BY created_at, id) AS number
          FROM tickets
         WHERE org_id IS NOT NULL AND ticket_number IS NULL
      ) n
     WHERE t.id = n.id
  `);
  console.log(`✅ tickets: numbered ${numbered.rowCount} existing ticket(s)`);

  await knex.raw(`
    UPDATE companies c
       SET next_ticket_number = m.max_number + 1
      FROM (SELECT org_id, max(ticket_number) AS max_number FROM tickets GROUP BY org_id) m
     WHERE c.id = m.org_id AND m.max_number IS NOT NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS tickets_org_ticket_number_unique
      ON tickets (org_id, ticket_number)
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION assign_ticket_number() RETURNS trigger AS $$
    BEGIN
      IF NEW.ticket_number IS NULL AND NEW.org_id IS NOT NULL THEN
        UPDATE companies
           SET next_ticket_number = next_ticket_number + 1
         WHERE id = NEW.org_id
        RETURNING next_ticket_number - 1 INTO NEW.ticket_number;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await knex.raw(`DROP TRIGGER IF EXISTS tickets_assign_number ON tickets`);
  await knex.raw(`
    CREATE TRIGGER tickets_assign_number
      BEFORE INSERT ON tickets
      FOR EACH ROW EXECUTE FUNCTION assign_ticket_number()
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DROP TRIGGER IF EXISTS tickets_assign_number ON tickets`);
  await knex.raw(`DROP FUNCTION IF EXISTS assign_ticket_number()`);
  await knex.raw(`DROP INDEX IF EXISTS tickets_org_ticket_number_unique`);
  if (await knex.schema.hasColumn('tickets', 'ticket_number')) {
    await knex.schema.alterTable('tickets', (table) => table.dropColumn('ticket_number'));
  }
  if (await knex.schema.hasColumn('companies', 'next_ticket_number')) {
    await knex.schema.alterTable('companies', (table) => table.dropColumn('next_ticket_number'));
  }
};
