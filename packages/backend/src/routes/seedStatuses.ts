import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /seed-statuses
 * One-time endpoint to seed default ticket statuses for all teams
 * Admin only
 */
router.post('/seed-statuses', authenticate, authorize('admin'), async (req, res) => {
  try {
    console.log('🌱 Seeding default ticket statuses...');

    // Get all teams
    const teams = await db('teams').select('id', 'name');

    if (teams.length === 0) {
      return res.json({
        success: true,
        message: 'No teams found',
        teamsProcessed: 0,
      });
    }

    // Default statuses
    const defaultStatuses = [
      { name: 'open', label: 'Open', color: '#EF4444', order: 1, is_default: true, is_closed: false },
      { name: 'in_progress', label: 'In Progress', color: '#F59E0B', order: 2, is_default: false, is_closed: false },
      { name: 'waiting', label: 'Waiting', color: '#3B82F6', order: 3, is_default: false, is_closed: false },
      { name: 'resolved', label: 'Resolved', color: '#10B981', order: 4, is_default: false, is_closed: true },
    ];

    let teamsProcessed = 0;
    let statusesCreated = 0;

    for (const team of teams) {
      // Check if team already has statuses
      const existingStatuses = await db('ticket_statuses')
        .where('team_id', team.id)
        .count('* as count')
        .first();

      const count = parseInt(existingStatuses?.count as string || '0');

      if (count > 0) {
        console.log(`Team ${team.name} already has ${count} statuses, skipping`);
        continue;
      }

      // Insert default statuses
      for (const status of defaultStatuses) {
        await db('ticket_statuses').insert({
          id: uuidv4(),
          team_id: team.id,
          name: status.name,
          label: status.label,
          color: status.color,
          order: status.order,
          is_default: status.is_default,
          is_closed: status.is_closed,
          is_active: true,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
        statusesCreated++;
      }

      teamsProcessed++;
      console.log(`✅ Created default statuses for team ${team.name}`);
    }

    console.log(`✅ Seeded ${statusesCreated} statuses for ${teamsProcessed} teams`);

    res.json({
      success: true,
      message: 'Default ticket statuses seeded successfully',
      teamsProcessed,
      statusesCreated,
      teams: teams.map(t => t.name),
    });
  } catch (error: any) {
    console.error('Failed to seed statuses:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
