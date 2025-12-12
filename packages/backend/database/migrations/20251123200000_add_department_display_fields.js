/**
 * Add display fields to departments table to match Zoho Desk functionality
 */
exports.up = async function (knex) {
  const hasDisplayName = await knex.schema.hasColumn('departments', 'display_name');
  const hasDisplayInHelpCenter = await knex.schema.hasColumn(
    'departments',
    'display_in_help_center'
  );

  if (!hasDisplayName || !hasDisplayInHelpCenter) {
    await knex.schema.alterTable('departments', (table) => {
      if (!hasDisplayName) {
        table.string('display_name', 255);
      }
      if (!hasDisplayInHelpCenter) {
        table.boolean('display_in_help_center').defaultTo(true);
      }
    });

    // Backfill display_name with name for existing departments
    if (!hasDisplayName) {
      await knex.raw(`
        UPDATE departments
        SET display_name = name
        WHERE display_name IS NULL
      `);
    }

    console.log('✅ Added display fields to departments table');
  } else {
    console.log('⏭️  Display fields already exist in departments table');
  }
};

exports.down = async function (knex) {
  await knex.schema.alterTable('departments', (table) => {
    table.dropColumn('display_name');
    table.dropColumn('display_in_help_center');
  });
};
