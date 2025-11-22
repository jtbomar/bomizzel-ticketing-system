/**
 * Phase 1c: Enhance user_company_associations table
 * Add tracking fields for org selection and defaults
 */
exports.up = async function(knex) {
  console.log('🚀 Enhancing user_company_associations table');

  // Add last_accessed_at column
  const hasLastAccessed = await knex.schema.hasColumn('user_company_associations', 'last_accessed_at');
  if (!hasLastAccessed) {
    await knex.schema.alterTable('user_company_associations', (table) => {
      table.timestamp('last_accessed_at').defaultTo(knex.fn.now());
      table.index('last_accessed_at');
    });
    console.log('✅ Added last_accessed_at column');
  }

  // Add is_default column
  const hasIsDefault = await knex.schema.hasColumn('user_company_associations', 'is_default');
  if (!hasIsDefault) {
    await knex.schema.alterTable('user_company_associations', (table) => {
      table.boolean('is_default').defaultTo(false);
      table.index('is_default');
    });
    console.log('✅ Added is_default column');
  }

  // Set first association as default for each user
  const users = await knex('user_company_associations')
    .select('user_id')
    .groupBy('user_id');

  for (const user of users) {
    const firstAssociation = await knex('user_company_associations')
      .where('user_id', user.user_id)
      .orderBy('created_at', 'asc')
      .first();

    if (firstAssociation) {
      await knex('user_company_associations')
        .where('id', firstAssociation.id)
        .update({ is_default: true });
    }
  }

  console.log(`✅ Set default organization for ${users.length} users`);
  console.log('✅ user_company_associations enhancement completed');
};

exports.down = async function(knex) {
  console.log('⚠️  Rolling back user_company_associations enhancements');

  await knex.schema.alterTable('user_company_associations', (table) => {
    table.dropColumn('is_default');
    table.dropColumn('last_accessed_at');
  });

  console.log('✅ Rollback completed');
};
