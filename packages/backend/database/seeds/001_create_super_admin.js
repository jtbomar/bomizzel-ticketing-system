const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Delete existing super admin if exists
  await knex('users').where('email', 'jeffrey.t.bomar@gmail.com').del();
  
  // Check if BSI company exists, if not create it
  let bsiCompany = await knex('companies')
    .where('name', 'Bomizzel Services Inc.')
    .first();

  if (!bsiCompany) {
    [bsiCompany] = await knex('companies')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Bomizzel Services Inc.',
        domain: 'bomizzel.com',
        description: 'Bomizzel Ticketing System - SaaS Provider',
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');
  }

  // Hash password: "BomizzelAdmin2024!" (you should change this after first login)
  const hashedPassword = await bcrypt.hash('BomizzelAdmin2024!', 12);

  // Create Jeff Bomar super admin account
  const [adminUser] = await knex('users')
    .insert({
      id: knex.raw('gen_random_uuid()'),
      email: 'jeffrey.t.bomar@gmail.com',
      password_hash: hashedPassword,
      first_name: 'Jeff',
      last_name: 'Bomar',
      role: 'admin',
      is_active: true,
      email_verified: true,
      preferences: JSON.stringify({
        theme: 'light',
        notifications: {
          email: true,
          browser: true,
          ticketAssigned: true,
          ticketUpdated: true,
          ticketResolved: true,
        },
        dashboard: {
          defaultView: 'kanban',
          ticketsPerPage: 25,
        },
      }),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    })
    .returning('*');

  // Associate Jeff with BSI company as owner/admin
  await knex('user_company_associations')
    .insert({
      user_id: adminUser.id,
      company_id: bsiCompany.id,
      role: 'owner',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    })
    .onConflict(['user_id', 'company_id'])
    .ignore();

  console.log('✅ Super Admin Created:');
  console.log('   Email: jeffrey.t.bomar@gmail.com');
  console.log('   Password: BomizzelAdmin2024!');
  console.log('   Company: Bomizzel Services Inc.');
  console.log('   Role: Super Admin');
  console.log('');
  console.log('⚠️  IMPORTANT: Change your password after first login!');
};
