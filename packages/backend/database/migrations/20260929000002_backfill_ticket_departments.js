/**
 * Tickets were created with no department, so every department view showed
 * every ticket. Put each ticket that has none into its subscriber's default
 * department (or the first one, if none is marked default).
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('tickets', 'department_id'))) return;

  const result = await knex.raw(`
    UPDATE tickets t
       SET department_id = (
         SELECT dep.id FROM departments dep
          WHERE (dep.org_id = t.org_id OR dep.company_id = t.org_id)
            AND coalesce(dep.is_active, true)
          ORDER BY dep.is_default DESC NULLS LAST, dep.id ASC
          LIMIT 1
       )
     WHERE t.department_id IS NULL
       AND EXISTS (
         SELECT 1 FROM departments dep
          WHERE (dep.org_id = t.org_id OR dep.company_id = t.org_id)
            AND coalesce(dep.is_active, true)
       )
  `);
  console.log(
    `✅ tickets: put ${result.rowCount} ticket(s) in their subscriber's default department`
  );
};

exports.down = async function () {
  // Not reversible: which tickets had no department isn't recorded.
};
