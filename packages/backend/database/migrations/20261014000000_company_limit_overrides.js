/**
 * Limits set for one subscriber (BSI > Give limits), over its plan's.
 *
 * companies.limit_overrides: jsonb, null when none. Keys are the plan limits
 * (agents, ticketsPerMonth, departments, macros, ticketFields - a number, or
 * null for no limit - and assignmentRules, roundRobin, recordFields,
 * customModules - true/false). A key that isn't there follows the plan.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('companies', 'limit_overrides'))) {
    await knex.schema.alterTable('companies', (t) => t.jsonb('limit_overrides').nullable());
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('companies', 'limit_overrides')) {
    await knex.schema.alterTable('companies', (t) => t.dropColumn('limit_overrides'));
  }
};
