const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  console.log('🌱 Creating comprehensive test data...');

  // Hash password
  const passwordHash = await bcrypt.hash('password123', 10);

  // Get or create admin user
  let admin = await knex('users').where('email', 'admin@bomizzel.com').first();
  const adminId = admin ? admin.id : uuidv4();
  
  if (!admin) {
    await knex('users').insert({
      id: adminId,
      email: 'admin@bomizzel.com',
      password_hash: passwordHash,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      email_verified: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }

  // Create 4 employee agents
  const agents = [];
  const agentNames = [
    { first: 'Sarah', last: 'Johnson', email: 'sarah@bomizzel.com' },
    { first: 'Mike', last: 'Chen', email: 'mike@bomizzel.com' },
    { first: 'Emily', last: 'Rodriguez', email: 'emily@bomizzel.com' },
    { first: 'David', last: 'Kim', email: 'david@bomizzel.com' },
  ];

  for (const agent of agentNames) {
    const agentId = uuidv4();
    await knex('users').insert({
      id: agentId,
      email: agent.email,
      password_hash: passwordHash,
      first_name: agent.first,
      last_name: agent.last,
      role: 'employee',
      is_active: true,
      email_verified: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    agents.push({ id: agentId, ...agent });
  }

  // Create 2 teams
  const supportTeamId = uuidv4();
  const techTeamId = uuidv4();

  await knex('teams').insert([
    {
      id: supportTeamId,
      name: 'Customer Support',
      description: 'General customer support team',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: techTeamId,
      name: 'Technical Support',
      description: 'Technical issues and bugs',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ]);

  // Assign agents to teams (2 per team)
  await knex('team_memberships').insert([
    { user_id: agents[0].id, team_id: supportTeamId, role: 'member', created_at: knex.fn.now() },
    { user_id: agents[1].id, team_id: supportTeamId, role: 'member', created_at: knex.fn.now() },
    { user_id: agents[2].id, team_id: techTeamId, role: 'member', created_at: knex.fn.now() },
    { user_id: agents[3].id, team_id: techTeamId, role: 'member', created_at: knex.fn.now() },
  ]);

  // Create queues for teams
  const supportQueueId = uuidv4();
  const techQueueId = uuidv4();

  await knex('queues').insert([
    {
      id: supportQueueId,
      name: 'Support Queue',
      team_id: supportTeamId,
      type: 'unassigned',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: techQueueId,
      name: 'Tech Queue',
      team_id: techTeamId,
      type: 'unassigned',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ]);

  // Create 5 companies (accounts)
  const companies = [
    { name: 'Acme Corporation', domain: 'acme.com', description: 'Enterprise software solutions' },
    { name: 'TechStart Inc', domain: 'techstart.com', description: 'Innovative startup' },
    { name: 'Global Industries', domain: 'globalind.com', description: 'Manufacturing company' },
    { name: 'Digital Solutions LLC', domain: 'digitalsol.com', description: 'Digital marketing agency' },
    { name: 'Healthcare Plus', domain: 'healthplus.com', description: 'Healthcare services provider' },
  ];

  const companyIds = [];
  for (const company of companies) {
    const companyId = uuidv4();
    await knex('companies').insert({
      id: companyId,
      name: company.name,
      domain: company.domain,
      description: company.description,
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    companyIds.push(companyId);
  }

  // Create 4 customers per company (20 total)
  const customers = [];
  const firstNames = ['John', 'Jane', 'Robert', 'Lisa'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore'];

  for (let i = 0; i < companyIds.length; i++) {
    for (let j = 0; j < 4; j++) {
      const customerId = uuidv4();
      const firstName = firstNames[j];
      const lastName = lastNames[(i * 4 + j) % lastNames.length];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${companies[i].domain}`;

      await knex('users').insert({
        id: customerId,
        email: email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'customer',
        is_active: true,
        email_verified: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });

      // Associate customer with company
      await knex('user_company_associations').insert({
        user_id: customerId,
        company_id: companyIds[i],
        role: 'member',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });

      customers.push({ id: customerId, companyId: companyIds[i], name: `${firstName} ${lastName}` });
    }
  }

  // Create 4 custom field templates for different ticket types
  const templates = [
    {
      teamId: supportTeamId,
      name: 'Bug Report',
      fields: [
        { name: 'severity', label: 'Severity', type: 'picklist', options: ['Low', 'Medium', 'High', 'Critical'], required: true },
        { name: 'browser', label: 'Browser', type: 'string', required: false },
        { name: 'steps_to_reproduce', label: 'Steps to Reproduce', type: 'string', required: true },
      ],
    },
    {
      teamId: supportTeamId,
      name: 'Feature Request',
      fields: [
        { name: 'priority', label: 'Priority', type: 'picklist', options: ['Low', 'Medium', 'High'], required: true },
        { name: 'use_case', label: 'Use Case', type: 'string', required: true },
        { name: 'expected_users', label: 'Expected Users', type: 'integer', required: false },
      ],
    },
    {
      teamId: techTeamId,
      name: 'Technical Issue',
      fields: [
        { name: 'error_code', label: 'Error Code', type: 'string', required: false },
        { name: 'system_version', label: 'System Version', type: 'string', required: true },
        { name: 'impact_level', label: 'Impact Level', type: 'picklist', options: ['Minor', 'Moderate', 'Major', 'Critical'], required: true },
      ],
    },
    {
      teamId: techTeamId,
      name: 'Account Support',
      fields: [
        { name: 'account_type', label: 'Account Type', type: 'picklist', options: ['Free', 'Pro', 'Enterprise'], required: true },
        { name: 'issue_category', label: 'Issue Category', type: 'picklist', options: ['Billing', 'Access', 'Settings', 'Other'], required: true },
        { name: 'account_age_days', label: 'Account Age (days)', type: 'integer', required: false },
      ],
    },
  ];

  for (const template of templates) {
    for (const field of template.fields) {
      const fieldId = uuidv4();
      await knex('custom_fields').insert({
        id: fieldId,
        team_id: template.teamId,
        name: field.name,
        label: field.label,
        type: field.type,
        options: field.options ? JSON.stringify(field.options) : null,
        is_required: field.required,
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }

  // Create 10 tickets per company (50 total) - 2 per agent
  const ticketTitles = [
    'Login page not loading',
    'Cannot reset password',
    'Dashboard shows incorrect data',
    'Export feature not working',
    'Mobile app crashes on startup',
    'Payment processing failed',
    'Email notifications not received',
    'Search function returns no results',
    'Profile picture upload fails',
    'Integration with third-party service broken',
  ];

  const statuses = ['open', 'in_progress', 'waiting', 'resolved'];
  let ticketIndex = 0;

  for (let companyIndex = 0; companyIndex < companyIds.length; companyIndex++) {
    const companyCustomers = customers.filter(c => c.companyId === companyIds[companyIndex]);
    
    for (let i = 0; i < 10; i++) {
      const ticketId = uuidv4();
      const customer = companyCustomers[i % companyCustomers.length];
      const agent = agents[i % agents.length]; // Distribute evenly among agents
      const teamId = i < 5 ? supportTeamId : techTeamId;
      const queueId = i < 5 ? supportQueueId : techQueueId;
      const status = statuses[i % statuses.length];

      await knex('tickets').insert({
        id: ticketId,
        title: ticketTitles[i],
        description: `This is a test ticket for ${ticketTitles[i]}. Customer needs assistance with this issue.`,
        status: status,
        priority: i % 3,
        submitter_id: customer.id,
        company_id: companyIds[companyIndex],
        assigned_to_id: i % 2 === 0 ? agent.id : null, // Assign every other ticket
        queue_id: queueId,
        team_id: teamId,
        custom_field_values: JSON.stringify({}),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });

      ticketIndex++;
    }
  }

  console.log('✅ Created comprehensive test data:');
  console.log(`   - 1 Admin user`);
  console.log(`   - 4 Agent users (employees)`);
  console.log(`   - 5 Companies (accounts)`);
  console.log(`   - 20 Customers (4 per company)`);
  console.log(`   - 2 Teams with queues`);
  console.log(`   - 4 Custom field templates`);
  console.log(`   - 50 Tickets (10 per company, ~2 per agent)`);
  console.log('');
  console.log('📧 Login credentials:');
  console.log('   Admin: admin@bomizzel.com / password123');
  console.log('   Agents: sarah@bomizzel.com, mike@bomizzel.com, emily@bomizzel.com, david@bomizzel.com / password123');
  console.log('   Customers: Use any customer email / password123');
};
