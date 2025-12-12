const { v4: uuidv4 } = require('uuid');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  console.log('🌱 Seeding default ticket statuses for existing teams...');

  // Get all teams
  const teams = await knex('teams').select('id');

  if (teams.length === 0) {
    console.log('No teams found, skipping status seeding');
    return;
  }

  // Default statuses to create for each team
  const defaultStatuses = [
    { name: 'open', label: 'Open', color: '#EF4444', order: 1, is_default: true, is_closed: false },
    {
      name: 'in_progress',
      label: 'In Progress',
      color: '#F59E0B',
      order: 2,
      is_default: false,
      is_closed: false,
    },
    {
      name: 'waiting',
      label: 'Waiting',
      color: '#3B82F6',
      order: 3,
      is_default: false,
      is_closed: false,
    },
    {
      name: 'resolved',
      label: 'Resolved',
      color: '#10B981',
      order: 4,
      is_default: false,
      is_closed: true,
    },
  ];

  // Create statuses for each team
  for (const team of teams) {
    // Check if team already has statuses
    const existingStatuses = await knex('ticket_statuses')
      .where('team_id', team.id)
      .count('* as count')
      .first();

    if (existingStatuses && parseInt(existingStatuses.count) > 0) {
      console.log(`Team ${team.id} already has statuses, skipping`);
      continue;
    }

    // Insert default statuses
    for (const status of defaultStatuses) {
      await knex('ticket_statuses').insert({
        id: uuidv4(),
        team_id: team.id,
        name: status.name,
        label: status.label,
        color: status.color,
        order: status.order,
        is_default: status.is_default,
        is_closed: status.is_closed,
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }

    console.log(`✅ Created default statuses for team ${team.id}`);
  }

  console.log('✅ Default ticket statuses seeded successfully');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Don't delete statuses on rollback as they might be in use
  console.log('Rollback: Keeping ticket statuses (they may be in use)');
};
