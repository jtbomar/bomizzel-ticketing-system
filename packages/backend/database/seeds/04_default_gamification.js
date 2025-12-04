/**
 * Seed default trophies and badges for gamification
 */
exports.seed = async function(knex) {
  console.log('🎮 Setting up default gamification...');

  // Get Bomar Corp organization
  const bomarOrg = await knex('organizations').where('name', 'Bomar Corp').first();
  
  if (!bomarOrg) {
    console.log('⚠️  Bomar Corp organization not found, skipping gamification setup');
    return;
  }

  // Check if trophies already exist
  const existingTrophies = await knex('trophies').where('company_id', bomarOrg.id).first();
  if (existingTrophies) {
    console.log('⏭️  Trophies already exist, skipping');
    return;
  }

  // Default trophies based on Zoho Desk
  const trophies = [
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'First Response',
      description: 'Respond to tickets quickly',
      icon: '⚡',
      category: 'response',
      criteria_type: 'time',
      criteria: JSON.stringify({ metric: 'first_response', operator: 'within', value: 20, unit: 'minutes' }),
      points: 3,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Ticket Resolved',
      description: 'Resolve tickets efficiently',
      icon: '✅',
      category: 'resolution',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'resolved', operator: 'count', value: 1 }),
      points: 5,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Customer Rating',
      description: 'Receive good customer ratings',
      icon: '⭐',
      category: 'rating',
      criteria_type: 'rating',
      criteria: JSON.stringify({ metric: 'rating', operator: 'equals', value: 'good' }),
      points: 8,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Speed Demon',
      description: 'Resolve tickets in less than 2 hours',
      icon: '🚀',
      category: 'speed',
      criteria_type: 'time',
      criteria: JSON.stringify({ metric: 'resolution_time', operator: 'less_than', value: 2, unit: 'hours' }),
      points: 10,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Close a ticket',
      description: 'Successfully close a ticket',
      icon: '🎯',
      category: 'resolution',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'closed', operator: 'count', value: 1 }),
      points: 5,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Update a ticket',
      description: 'Keep tickets updated with progress',
      icon: '📝',
      category: 'quality',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'updated', operator: 'count', value: 1 }),
      points: 1,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Respond to a ticket',
      description: 'Respond to customer inquiries',
      icon: '💬',
      category: 'response',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'responded', operator: 'count', value: 1 }),
      points: 1,
      is_active: true,
    },
  ];

  await knex('trophies').insert(trophies);
  console.log(`✅ Created ${trophies.length} default trophies`);

  // Default badges
  const badges = [
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Bronze Agent',
      description: 'Earn 100 points',
      icon: '🥉',
      level: 'bronze',
      required_points: 100,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Silver Agent',
      description: 'Earn 500 points',
      icon: '🥈',
      level: 'silver',
      required_points: 500,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Gold Agent',
      description: 'Earn 1000 points',
      icon: '🥇',
      level: 'gold',
      required_points: 1000,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Platinum Agent',
      description: 'Earn 5000 points',
      icon: '💎',
      level: 'platinum',
      required_points: 5000,
      is_active: true,
    },
  ];

  await knex('badges').insert(badges);
  console.log(`✅ Created ${badges.length} default badges`);

  console.log('✨ Gamification setup complete!');
};
