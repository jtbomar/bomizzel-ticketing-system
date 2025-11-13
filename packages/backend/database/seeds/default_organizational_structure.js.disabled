/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  const companyId = 'bomizzel-internal';

  // Insert default organizational roles (company hierarchy)
  await knex('organizational_roles').insert([
    {
      company_id: companyId,
      name: 'President',
      description: 'Chief Executive Officer',
      hierarchy_level: 1,
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Vice President',
      description: 'Vice President',
      hierarchy_level: 2,
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Director',
      description: 'Department Director',
      hierarchy_level: 3,
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Manager',
      description: 'Team Manager',
      hierarchy_level: 4,
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Supervisor',
      description: 'Team Supervisor',
      hierarchy_level: 5,
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Team Lead',
      description: 'Team Lead',
      hierarchy_level: 6,
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Senior Agent',
      description: 'Senior Support Agent',
      hierarchy_level: 7,
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Agent',
      description: 'Support Agent',
      hierarchy_level: 8,
      is_active: true,
    },
  ]);

  // Insert default user profiles (functional roles)
  await knex('user_profiles').insert([
    {
      company_id: companyId,
      name: 'System Administrator',
      description: 'Full system access and configuration',
      permissions: JSON.stringify({
        canManageUsers: true,
        canManageSettings: true,
        canViewReports: true,
        canManageTickets: true,
      }),
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Support Administrator',
      description: 'Manage support operations and agents',
      permissions: JSON.stringify({
        canManageUsers: true,
        canManageSettings: false,
        canViewReports: true,
        canManageTickets: true,
      }),
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Technical Lead',
      description: 'Technical support specialist',
      permissions: JSON.stringify({
        canManageUsers: false,
        canManageSettings: false,
        canViewReports: true,
        canManageTickets: true,
      }),
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Customer Support Specialist',
      description: 'Handle customer inquiries and tickets',
      permissions: JSON.stringify({
        canManageUsers: false,
        canManageSettings: false,
        canViewReports: false,
        canManageTickets: true,
      }),
      is_active: true,
    },
    {
      company_id: companyId,
      name: 'Billing Specialist',
      description: 'Handle billing and payment issues',
      permissions: JSON.stringify({
        canManageUsers: false,
        canManageSettings: false,
        canViewReports: false,
        canManageTickets: true,
      }),
      is_active: true,
    },
  ]);

  console.log('✅ Default organizational roles and profiles seeded');
};
