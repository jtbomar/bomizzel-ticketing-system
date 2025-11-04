const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  // Clear existing data
  await knex('ticket_history').del();
  await knex('file_attachments').del();
  await knex('ticket_notes').del();
  await knex('tickets').del();
  await knex('custom_fields').del();
  await knex('ticket_statuses').del();
  await knex('queues').del();
  await knex('team_memberships').del();
  await knex('user_company_associations').del();
  await knex('teams').del();
  await knex('companies').del();
  await knex('users').del();

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await knex('users')
    .insert([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'admin@bomizzel.com',
        password_hash: hashedPassword,
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        email_verified: true,
        preferences: JSON.stringify({
          theme: 'light',
          notifications: { email: true, browser: true },
          dashboard: { defaultView: 'kanban', ticketsPerPage: 25 },
        }),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'john.doe@customer.com',
        password_hash: hashedPassword,
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer',
        email_verified: true,
        preferences: JSON.stringify({
          theme: 'light',
          notifications: { email: true, browser: true },
          dashboard: { defaultView: 'list', ticketsPerPage: 25 },
        }),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'jane.smith@bomizzel.com',
        password_hash: hashedPassword,
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'employee',
        email_verified: true,
        preferences: JSON.stringify({
          theme: 'light',
          notifications: { email: true, browser: true },
          dashboard: { defaultView: 'kanban', ticketsPerPage: 25 },
        }),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        email: 'mike.johnson@bomizzel.com',
        password_hash: hashedPassword,
        first_name: 'Mike',
        last_name: 'Johnson',
        role: 'team_lead',
        email_verified: true,
        preferences: JSON.stringify({
          theme: 'light',
          notifications: { email: true, browser: true },
          dashboard: { defaultView: 'kanban', ticketsPerPage: 25 },
        }),
      },
    ])
    .returning('*');

  // Create companies
  const companies = await knex('companies')
    .insert([
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'Acme Corporation',
        domain: 'acme.com',
        description: 'A leading technology company',
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'TechStart Inc',
        domain: 'techstart.com',
        description: 'Innovative startup company',
      },
    ])
    .returning('*');

  // Create user-company associations
  await knex('user_company_associations').insert([
    {
      user_id: '550e8400-e29b-41d4-a716-446655440002', // John Doe
      company_id: '660e8400-e29b-41d4-a716-446655440001', // Acme Corporation
      role: 'admin',
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440002', // John Doe
      company_id: '660e8400-e29b-41d4-a716-446655440002', // TechStart Inc
      role: 'member',
    },
  ]);

  // Create teams
  const teams = await knex('teams')
    .insert([
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        name: 'Technical Support',
        description: 'Handles technical issues and bug reports',
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        name: 'Customer Success',
        description: 'Manages customer onboarding and account issues',
      },
    ])
    .returning('*');

  // Create team memberships
  await knex('team_memberships').insert([
    {
      user_id: '550e8400-e29b-41d4-a716-446655440003', // Jane Smith
      team_id: '770e8400-e29b-41d4-a716-446655440001', // Technical Support
      role: 'member',
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440004', // Mike Johnson
      team_id: '770e8400-e29b-41d4-a716-446655440001', // Technical Support
      role: 'lead',
    },
    {
      user_id: '550e8400-e29b-41d4-a716-446655440004', // Mike Johnson
      team_id: '770e8400-e29b-41d4-a716-446655440002', // Customer Success
      role: 'admin',
    },
  ]);

  // Create ticket statuses
  await knex('ticket_statuses').insert([
    {
      id: '880e8400-e29b-41d4-a716-446655440001',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
      name: 'open',
      label: 'Open',
      color: '#3B82F6',
      order: 1,
      is_default: true,
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440002',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
      name: 'in_progress',
      label: 'In Progress',
      color: '#F59E0B',
      order: 2,
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440003',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
      name: 'resolved',
      label: 'Resolved',
      color: '#10B981',
      order: 3,
      is_closed: true,
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440004',
      team_id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'open',
      label: 'Open',
      color: '#3B82F6',
      order: 1,
      is_default: true,
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440005',
      team_id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'under_review',
      label: 'Under Review',
      color: '#8B5CF6',
      order: 2,
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440006',
      team_id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'completed',
      label: 'Completed',
      color: '#10B981',
      order: 3,
      is_closed: true,
    },
  ]);

  // Create queues
  await knex('queues').insert([
    {
      id: '990e8400-e29b-41d4-a716-446655440001',
      name: 'Unassigned Technical Issues',
      description: 'New technical support tickets awaiting assignment',
      type: 'unassigned',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440002',
      name: "Jane's Queue",
      description: 'Technical support tickets assigned to Jane',
      type: 'employee',
      assigned_to_id: '550e8400-e29b-41d4-a716-446655440003',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440003',
      name: 'Customer Success Queue',
      description: 'Customer success and onboarding tickets',
      type: 'unassigned',
      team_id: '770e8400-e29b-41d4-a716-446655440002',
    },
  ]);

  // Create custom fields
  await knex('custom_fields').insert([
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440001',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
      name: 'severity',
      label: 'Severity Level',
      type: 'picklist',
      is_required: true,
      options: JSON.stringify(['Low', 'Medium', 'High', 'Critical']),
      order: 1,
    },
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440002',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
      name: 'browser',
      label: 'Browser',
      type: 'string',
      is_required: false,
      order: 2,
    },
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440003',
      team_id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'account_type',
      label: 'Account Type',
      type: 'picklist',
      is_required: true,
      options: JSON.stringify(['Free', 'Pro', 'Enterprise']),
      order: 1,
    },
  ]);

  // Create sample tickets
  await knex('tickets').insert([
    {
      id: 'bb0e8400-e29b-41d4-a716-446655440001',
      title: 'Login page not loading',
      description: 'The login page shows a blank screen when I try to access it from Chrome.',
      status: 'open',
      priority: 2,
      submitter_id: '550e8400-e29b-41d4-a716-446655440002',
      company_id: '660e8400-e29b-41d4-a716-446655440001',
      queue_id: '990e8400-e29b-41d4-a716-446655440001',
      team_id: '770e8400-e29b-41d4-a716-446655440001',
      custom_field_values: JSON.stringify({
        severity: 'High',
        browser: 'Chrome 118',
      }),
    },
    {
      id: 'bb0e8400-e29b-41d4-a716-446655440002',
      title: 'Need help with account setup',
      description:
        'I need assistance setting up my new enterprise account and configuring user permissions.',
      status: 'open',
      priority: 1,
      submitter_id: '550e8400-e29b-41d4-a716-446655440002',
      company_id: '660e8400-e29b-41d4-a716-446655440002',
      queue_id: '990e8400-e29b-41d4-a716-446655440003',
      team_id: '770e8400-e29b-41d4-a716-446655440002',
      custom_field_values: JSON.stringify({
        account_type: 'Enterprise',
      }),
    },
  ]);

  console.log('✅ Database seeded successfully');
};
