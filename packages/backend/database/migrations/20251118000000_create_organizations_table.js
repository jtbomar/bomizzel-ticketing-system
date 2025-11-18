/**
 * Create organizations table for service providers (like Bomar Corp)
 * Separate from companies table which is for customer accounts
 */
exports.up = async function(knex) {
  // 1. Create organizations table
  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('domain');
    table.text('description');
    table.string('logo_url');
    table.jsonb('settings').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('name');
    table.index('domain');
  });

  // 2. Modify departments to reference organizations instead of companies
  await knex.schema.alterTable('departments', (table) => {
    table.uuid('organization_id');
    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
  });

  // 3. Migrate Bomar Corp from companies to organizations
  const bomarCorp = await knex('companies').where('name', 'like', '%Bomar%').first();
  
  if (bomarCorp) {
    // Create organization
    const [orgId] = await knex('organizations').insert({
      id: bomarCorp.id, // Keep same ID
      name: bomarCorp.name,
      domain: bomarCorp.domain,
      description: bomarCorp.description,
      is_active: bomarCorp.is_active,
      created_at: bomarCorp.created_at,
      updated_at: bomarCorp.updated_at,
    }).returning('id');

    // Update departments to reference organization
    await knex('departments')
      .where('company_id', bomarCorp.id)
      .update({ organization_id: orgId });

    // Remove Bomar Corp from companies
    await knex('companies').where('id', bomarCorp.id).del();
    
    console.log('✅ Migrated Bomar Corp to organizations table');
  }

  // 4. Make company_id nullable in departments (since they now use organization_id)
  await knex.schema.alterTable('departments', (table) => {
    table.uuid('company_id').nullable().alter();
  });

  console.log('✅ Created organizations table and migrated data');
};

exports.down = async function(knex) {
  // Reverse migration
  await knex.schema.alterTable('departments', (table) => {
    table.dropColumn('organization_id');
  });
  
  await knex.schema.dropTableIfExists('organizations');
};
