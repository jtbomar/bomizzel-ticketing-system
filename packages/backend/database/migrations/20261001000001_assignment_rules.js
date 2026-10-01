/**
 * Assignment rules: give new tickets to an agent automatically.
 *
 * Each subscriber has an ordered list. A rule matches on any of department,
 * account, priority, channel and words in the subject/description (all the
 * ones it sets must match; one with none set matches every ticket). The
 * first matching rule assigns the ticket, to one agent or round-robin
 * through several (last_agent_id is whose turn it was).
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('assignment_rules')) return;
  await knex.schema.createTable('assignment_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.string('name', 120).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('position').notNullable().defaultTo(0);
    // { departmentIds, companyIds, priorities, channels, keywords }
    table.jsonb('conditions').notNullable().defaultTo('{}');
    table.string('method', 16).notNullable(); // specific | round_robin
    table.jsonb('agent_ids').notNullable().defaultTo('[]');
    table.uuid('last_agent_id').nullable();
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.index(['org_id', 'position']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('assignment_rules');
};
