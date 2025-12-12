/**
 * Fix departments - assign all to Bomizzel Inc
 */
exports.up = async function (knex) {
  console.log('🔧 Fixing department associations...');

  // Find Bomizzel Inc
  const bomizzel = await knex('companies')
    .where('name', 'ILIKE', '%bomizzel%')
    .orWhere('name', 'ILIKE', '%test%')
    .first();

  if (!bomizzel) {
    console.log('❌ Bomizzel organization not found!');
    return;
  }

  console.log(`✅ Found: ${bomizzel.name} (${bomizzel.id})`);

  // Update all departments
  const updated = await knex('departments').update({
    company_id: bomizzel.id,
    updated_at: knex.fn.now(),
  });

  console.log(`✅ Updated ${updated} departments to ${bomizzel.name}`);
};

exports.down = function (knex) {
  // No rollback needed
};
