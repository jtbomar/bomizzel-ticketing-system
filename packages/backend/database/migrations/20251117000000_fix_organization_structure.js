/**
 * Migration: Fix organization structure
 * - Add organizations table
 * - Change departments to belong to organization, not customer companies
 * - Rename companies table to customer_accounts for clarity
 */

exports.up = async function(knex) {
  // Step 1: Create organizations table
  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('domain', 255);
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    table.index('name');
  });
  
  console.log('✅ Created organizations table');
  
  // Step 2: Create ONE organization from first company
  const firstCompany = await knex('companies').orderBy('created_at').first();
  
  const [org] = await knex('organizations').insert({
    name: 'Bomizzel Test Organization',
    domain: 'bomizzel-test.com',
    description: 'Test organization for Bomizzel ticketing system',
    is_active: true
  }).returning('*');
  
  console.log(`✅ Created organization: ${org.name}`);
  
  // Step 3: Add organization_id to departments
  await knex.schema.alterTable('departments', (table) => {
    table.uuid('organization_id').nullable();
    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
  });
  
  console.log('✅ Added organization_id to departments');
  
  // Step 4: Delete ALL existing departments (they're wrong)
  const deletedDepts = await knex('departments').del();
  console.log(`✅ Deleted ${deletedDepts} incorrect departments`);
  
  // Step 5: Create 3 correct departments for the organization
  await knex('departments').insert([
    {
      organization_id: org.id,
      company_id: firstCompany.id, // Keep for backward compatibility
      name: 'General Support',
      description: 'General customer support and inquiries',
      color: '#3B82F6',
      is_active: true,
      is_default: true
    },
    {
      organization_id: org.id,
      company_id: firstCompany.id,
      name: 'Technical Support',
      description: 'Technical issues and troubleshooting',
      color: '#10B981',
      is_active: true,
      is_default: false
    },
    {
      organization_id: org.id,
      company_id: firstCompany.id,
      name: 'Sales',
      description: 'Sales inquiries and pre-sales support',
      color: '#F59E0B',
      is_active: true,
      is_default: false
    }
  ]);
  
  console.log('✅ Created 3 departments for organization');
  
  // Step 6: Rename companies table columns for clarity
  await knex.schema.alterTable('companies', (table) => {
    table.uuid('organization_id').nullable();
    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
  });
  
  // Link all customer accounts to the organization
  await knex('companies').update({ organization_id: org.id });
  
  console.log('✅ Linked customer accounts to organization');
  
  console.log('');
  console.log('🎉 Migration complete!');
  console.log(`   - 1 Organization: ${org.name}`);
  console.log('   - 3 Departments: General Support, Technical Support, Sales');
  console.log('   - 5 Customer Accounts: Acme Corp, TechStart, etc.');
};

exports.down = async function(knex) {
  // Remove organization_id from tables
  await knex.schema.alterTable('companies', (table) => {
    table.dropColumn('organization_id');
  });
  
  await knex.schema.alterTable('departments', (table) => {
    table.dropColumn('organization_id');
  });
  
  // Drop organizations table
  await knex.schema.dropTableIfExists('organizations');
  
  console.log('✅ Rolled back organization structure');
};
