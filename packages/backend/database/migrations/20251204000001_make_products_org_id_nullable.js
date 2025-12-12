/**
 * Make org_id nullable in products table for backwards compatibility
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('products', (table) => {
    table.uuid('org_id').nullable().alter();
  });
  console.log('✅ Made products.org_id nullable');
};

exports.down = async function (knex) {
  // No rollback needed
};
