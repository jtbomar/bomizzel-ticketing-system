/**
 * Ensure all admin users have company associations
 */
exports.up = async function (knex) {
  // Get all admin users without company associations
  const adminsWithoutCompany = await knex('users')
    .leftJoin('user_company_associations', 'users.id', 'user_company_associations.user_id')
    .whereIn('users.role', ['admin', 'team_lead', 'employee'])
    .whereNull('user_company_associations.user_id')
    .select('users.id', 'users.email', 'users.role');

  if (adminsWithoutCompany.length === 0) {
    console.log('✅ All admin users already have company associations');
    return;
  }

  // Get the first company (or create one if none exists)
  let company = await knex('companies').orderBy('created_at').first();

  if (!company) {
    console.log('📦 No companies found, creating default company...');
    const [newCompany] = await knex('companies')
      .insert({
        name: 'Bomizzel',
        description: 'Default organization',
        timezone: 'UTC',
        date_format: 'MM/DD/YYYY',
        time_format: '12',
        currency: 'USD',
        language: 'en',
        is_trial: true,
        max_users: 10,
        max_tickets_per_month: 1000,
        is_active: true,
      })
      .returning('*');
    company = newCompany;
  }

  // Associate all admin users with the company
  const associations = adminsWithoutCompany.map((user) => ({
    user_id: user.id,
    company_id: company.id,
    role: user.role === 'admin' ? 'admin' : 'member',
  }));

  await knex('user_company_associations').insert(associations);

  console.log(`✅ Associated ${adminsWithoutCompany.length} users with company ${company.name}`);
};

exports.down = async function (knex) {
  // Don't remove associations on rollback - too risky
  console.log('⚠️  Rollback skipped - not removing user-company associations');
};
