/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Get the admin user
  const adminUser = await knex('users').where('email', 'admin@bomizzel.com').first();
  
  if (!adminUser) {
    console.log('Admin user not found, skipping association');
    return;
  }

  // Get any company (use the first one available)
  const company = await knex('companies').first();
  
  if (!company) {
    console.log('No companies found, skipping association');
    return;
  }
  
  console.log('Found company:', company.name);

  // Check if association already exists
  const existingAssociation = await knex('user_company_associations')
    .where({
      user_id: adminUser.id,
      company_id: company.id
    })
    .first();

  if (existingAssociation) {
    console.log('Admin user already associated with company');
    return;
  }

  // Create the association
  await knex('user_company_associations').insert({
    user_id: adminUser.id,
    company_id: company.id,
    role: 'admin',
    created_at: new Date(),
    updated_at: new Date()
  });

  console.log('✅ Admin user associated with Bomizzel Services Inc.');
};