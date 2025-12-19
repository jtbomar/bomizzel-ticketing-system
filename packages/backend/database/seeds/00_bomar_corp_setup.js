const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  console.log('🌱 Setting up Bomar Corp...\n');

  // Check if setup already exists
  const existingOrg = await knex('companies').where('name', 'Bomar Corp').first();
  const existingUsers = await knex('users').where('email', 'jeff@bomar.com').first();

  if (existingOrg && existingUsers) {
    console.log('⏭️  Bomar Corp setup already complete, skipping seed');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Bomar Corp Organization (service provider)
  let bomarOrg = await knex('companies').where('name', 'Bomar Corp').first();
  if (!bomarOrg) {
    const bomarOrgId = uuidv4();
    await knex('companies').insert({
      id: bomarOrgId,
      name: 'Bomar Corp',
      domain: 'bomarcorp.com',
      description: 'Bomar Corp - Ticketing Service Provider',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    bomarOrg = await knex('companies').where('name', 'Bomar Corp').first();
    console.log('✅ Created Bomar Corp organization');
  } else {
    console.log('⏭️  Bomar Corp organization already exists');
  }

  // 2. Create Bomar Corp Users/Agents
  const agentEmails = [
    'jeff@bomar.com',
    'elena@bomar.com',
    'jeremy@bomar.com',
    'elisa@bomar.com',
    'alaura@bomar.com',
  ];
  const existingAgents = await knex('users').whereIn('email', agentEmails);

  if (existingAgents.length === 0) {
    const agents = [
      {
        id: uuidv4(),
        firstName: 'Jeff',
        lastName: 'Bomar',
        email: 'jeff@bomar.com',
        role: 'admin',
      }, // Super Admin
      {
        id: uuidv4(),
        firstName: 'Elena',
        lastName: 'Bomar',
        email: 'elena@bomar.com',
        role: 'admin',
      }, // Admin
      {
        id: uuidv4(),
        firstName: 'Jeremy',
        lastName: 'Bomar',
        email: 'jeremy@bomar.com',
        role: 'employee',
      }, // Agent
      {
        id: uuidv4(),
        firstName: 'Elisa',
        lastName: 'Bomar',
        email: 'elisa@bomar.com',
        role: 'employee',
      }, // Agent
      {
        id: uuidv4(),
        firstName: 'Alaura',
        lastName: 'Bomar',
        email: 'alaura@bomar.com',
        role: 'employee',
      }, // Agent
    ];

    for (const agent of agents) {
      await knex('users').insert({
        id: agent.id,
        email: agent.email,
        password_hash: passwordHash,
        first_name: agent.firstName,
        last_name: agent.lastName,
        role: agent.role,
        is_active: true,
        email_verified: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
    console.log('✅ Created 5 Bomar Corp agents (2 admins, 3 employees)');
  } else {
    console.log('⏭️  Bomar Corp agents already exist');
  }

  // Get all agents for later use
  const agents = await knex('users').whereIn('email', agentEmails);

  // 3. Create Teams
  let supportTeam = await knex('teams').where('name', 'Support Team').first();
  if (!supportTeam) {
    const supportTeamId = uuidv4();
    await knex('teams').insert({
      id: supportTeamId,
      name: 'Support Team',
      description: 'Customer support team',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    supportTeam = await knex('teams').where('name', 'Support Team').first();

    // Assign all agents to support team
    for (const agent of agents) {
      await knex('team_memberships').insert({
        user_id: agent.id,
        team_id: supportTeam.id,
        role: 'member',
        created_at: knex.fn.now(),
      });
    }
    console.log('✅ Created Support Team and assigned agents');
  } else {
    console.log('⏭️  Support Team already exists');
  }

  // 4. Create Queue
  let queue = await knex('queues').where('name', 'General Queue').first();
  let queueId;
  if (!queue) {
    queueId = uuidv4();
    await knex('queues').insert({
      id: queueId,
      name: 'General Queue',
      team_id: supportTeam.id,
      type: 'unassigned',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    queue = await knex('queues').where('name', 'General Queue').first();
    console.log('✅ Created General Queue');
  } else {
    queueId = queue.id;
    console.log('⏭️  General Queue already exists');
  }

  // 5. Create Departments (belong to Bomar Corp)
  const existingDepts = await knex('departments').where('company_id', bomarOrg.id);
  if (existingDepts.length === 0) {
    const departments = [
      { name: 'General Support', description: 'General customer support', color: '#3B82F6' },
      { name: 'Technical Support', description: 'Technical issues', color: '#10B981' },
      { name: 'Sales', description: 'Sales inquiries', color: '#F59E0B' },
    ];

    for (const dept of departments) {
      await knex('departments').insert({
        company_id: bomarOrg.id,
        name: dept.name,
        description: dept.description,
        color: dept.color,
        is_active: true,
        is_default: dept.name === 'General Support',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
    console.log('✅ Created 3 departments');
  } else {
    console.log('⏭️  Departments already exist');
  }

  // 6. Create 5 Customer Accounts (companies)
  const customerAccounts = [
    { name: 'TechStart Inc', domain: 'techstart.com', description: 'Technology startup' },
    { name: 'Global Industries', domain: 'globalind.com', description: 'Manufacturing company' },
    { name: 'Digital Solutions', domain: 'digitalsol.com', description: 'Digital agency' },
    { name: 'Healthcare Plus', domain: 'healthplus.com', description: 'Healthcare provider' },
    { name: 'Retail Masters', domain: 'retailmasters.com', description: 'Retail chain' },
  ];

  const accountIds = [];
  for (const account of customerAccounts) {
    const accountId = uuidv4();
    await knex('companies').insert({
      id: accountId,
      name: account.name,
      domain: account.domain,
      description: account.description,
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    accountIds.push({ id: accountId, name: account.name, domain: account.domain });
  }
  console.log('✅ Created 5 customer accounts');

  // 7. Create 3 customers per account (15 total)
  const customerNames = [
    ['John Smith', 'Jane Doe', 'Bob Wilson'],
    ['Alice Johnson', 'Charlie Brown', 'Diana Prince'],
    ['Eve Adams', 'Frank Castle', 'Grace Hopper'],
    ['Henry Ford', 'Iris West', 'Jack Ryan'],
    ['Kate Bishop', 'Leo Valdez', 'Maya Lopez'],
  ];

  const allCustomers = [];
  for (let i = 0; i < accountIds.length; i++) {
    const account = accountIds[i];
    for (let j = 0; j < 3; j++) {
      const [firstName, lastName] = customerNames[i][j].split(' ');
      const customerId = uuidv4();
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${account.domain}`;

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

      // Associate customer with their company
      await knex('user_company_associations').insert({
        user_id: customerId,
        company_id: account.id,
        role: 'member',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });

      allCustomers.push({
        id: customerId,
        name: `${firstName} ${lastName}`,
        companyId: account.id,
        companyName: account.name,
      });
    }
  }
  console.log('✅ Created 15 customers (3 per account)');

  // 8. Create 5 tickets per customer (75 total tickets)
  const ticketTitles = [
    'Cannot login to account',
    'Password reset not working',
    'Dashboard loading slowly',
    'Export feature broken',
    'Mobile app crashes',
  ];

  const statuses = ['open', 'in_progress', 'waiting', 'resolved', 'open'];
  const priorities = [2, 1, 0, 1, 2]; // high, medium, low, medium, high

  let ticketCount = 0;
  for (const customer of allCustomers) {
    for (let i = 0; i < 5; i++) {
      const assignedAgent = agents[ticketCount % agents.length];

      await knex('tickets').insert({
        id: uuidv4(),
        title: ticketTitles[i],
        description: `${ticketTitles[i]} - Reported by ${customer.name} from ${customer.companyName}`,
        status: statuses[i],
        priority: priorities[i],
        submitter_id: customer.id,
        company_id: customer.companyId,
        assigned_to_id: assignedAgent.id,
        queue_id: queueId,
        team_id: supportTeamId,
        custom_field_values: JSON.stringify({}),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
      ticketCount++;
    }
  }
  console.log(`✅ Created ${ticketCount} tickets (5 per customer, assigned to agents)`);

  console.log('\n✨ Bomar Corp setup complete!');
  console.log('\n📊 Summary:');
  console.log('   - Organization: Bomar Corp');
  console.log('   - Agents: 5 (Jeff & Elena = Admins, Jeremy, Elisa, Alaura = Employees)');
  console.log('   - Customer Accounts: 5');
  console.log('   - Customers: 15 (3 per account)');
  console.log('   - Tickets: 75 (5 per customer, all assigned)');
  console.log('   - Departments: 3 (General, Technical, Sales)');
  console.log('   - Teams: 1 (Support Team)');
  console.log('\n🔐 Login credentials:');
  console.log('   Super Admin: jeff@bomar.com / password123');
  console.log('   Admin: elena@bomar.com / password123');
  console.log('   Agents: jeremy@bomar.com, elisa@bomar.com, alaura@bomar.com / password123');
  console.log('   Any customer: [firstname].[lastname]@[company].com / password123');
};
