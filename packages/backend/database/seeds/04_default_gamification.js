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
    // Response Trophies
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
      name: 'Lightning Fast',
      description: 'Respond within 5 minutes',
      icon: '⚡',
      category: 'response',
      criteria_type: 'time',
      criteria: JSON.stringify({ metric: 'first_response', operator: 'within', value: 5, unit: 'minutes' }),
      points: 10,
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
    // Resolution Trophies
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
      name: 'Problem Solver',
      description: 'Resolve 10 tickets in a day',
      icon: '🧩',
      category: 'resolution',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'resolved', operator: 'count', value: 10, period: 'day' }),
      points: 15,
      is_active: true,
    },
    // Speed Trophies
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
      name: 'Flash',
      description: 'Resolve in under 30 minutes',
      icon: '⚡',
      category: 'speed',
      criteria_type: 'time',
      criteria: JSON.stringify({ metric: 'resolution_time', operator: 'less_than', value: 30, unit: 'minutes' }),
      points: 20,
      is_active: true,
    },
    // Rating Trophies
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
      name: 'Five Star Service',
      description: 'Get 5 excellent ratings',
      icon: '🌟',
      category: 'rating',
      criteria_type: 'rating',
      criteria: JSON.stringify({ metric: 'rating', operator: 'equals', value: 'excellent', count: 5 }),
      points: 25,
      is_active: true,
    },
    // Quality Trophies
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
      name: 'Detail Oriented',
      description: 'Add detailed notes to tickets',
      icon: '📋',
      category: 'quality',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'detailed_notes', operator: 'count', value: 5 }),
      points: 5,
      is_active: true,
    },
    // Volume Trophies
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Busy Bee',
      description: 'Handle 25 tickets',
      icon: '🐝',
      category: 'volume',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'handled', operator: 'count', value: 25 }),
      points: 10,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Workhorse',
      description: 'Handle 100 tickets',
      icon: '🏇',
      category: 'volume',
      criteria_type: 'tickets',
      criteria: JSON.stringify({ metric: 'handled', operator: 'count', value: 100 }),
      points: 50,
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
      name: 'Rookie',
      description: 'Just getting started',
      icon: '🌱',
      level: 'bronze',
      required_points: 50,
      is_active: true,
    },
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
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Diamond Elite',
      description: 'Earn 10000 points',
      icon: '💠',
      level: 'diamond',
      required_points: 10000,
      is_active: true,
    },
    {
      company_id: bomarOrg.id,
      org_id: bomarOrg.id,
      name: 'Legend',
      description: 'Earn 25000 points',
      icon: '👑',
      level: 'diamond',
      required_points: 25000,
      is_active: true,
    },
  ];

  await knex('badges').insert(badges);
  console.log(`✅ Created ${badges.length} default badges`);

  console.log('✨ Gamification setup complete!');
};
