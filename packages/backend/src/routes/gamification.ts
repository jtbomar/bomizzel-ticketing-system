import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = express.Router();

// Get all trophies
router.get('/trophies', authenticate, async (req, res) => {
  try {
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const trophies = await db('trophies')
      .where('company_id', userCompany.company_id)
      .orderBy('category', 'asc')
      .orderBy('points', 'desc');

    return res.json(trophies);
  } catch (error: any) {
    console.error('Error fetching trophies:', error);
    return res.status(500).json({ error: 'Failed to fetch trophies' });
  }
});

// Create trophy (admin only)
router.post('/trophies', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, icon, category, criteria_type, criteria, points } = req.body;

    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const [trophy] = await db('trophies')
      .insert({
        company_id: userCompany.company_id,
        name,
        description,
        icon,
        category,
        criteria_type,
        criteria: JSON.stringify(criteria),
        points,
        is_active: true,
      })
      .returning('*');

    return res.status(201).json(trophy);
  } catch (error: any) {
    console.error('Error creating trophy:', error);
    return res.status(500).json({ error: 'Failed to create trophy' });
  }
});

// Update trophy
router.put('/trophies/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [trophy] = await db('trophies')
      .where('id', id)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return res.json(trophy);
  } catch (error: any) {
    console.error('Error updating trophy:', error);
    return res.status(500).json({ error: 'Failed to update trophy' });
  }
});

// Get all badges
router.get('/badges', authenticate, async (req, res) => {
  try {
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const badges = await db('badges')
      .where('company_id', userCompany.company_id)
      .orderBy('required_points', 'asc');

    return res.json(badges);
  } catch (error: any) {
    console.error('Error fetching badges:', error);
    return res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// Create badge (admin only)
router.post('/badges', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, icon, level, required_points } = req.body;

    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const [badge] = await db('badges')
      .insert({
        company_id: userCompany.company_id,
        name,
        description,
        icon,
        level,
        required_points,
        is_active: true,
      })
      .returning('*');

    return res.status(201).json(badge);
  } catch (error: any) {
    console.error('Error creating badge:', error);
    return res.status(500).json({ error: 'Failed to create badge' });
  }
});

// Update badge
router.put('/badges/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [badge] = await db('badges')
      .where('id', id)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning('*');

    return res.json(badge);
  } catch (error: any) {
    console.error('Error updating badge:', error);
    return res.status(500).json({ error: 'Failed to update badge' });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const leaderboard = await db('user_gamification_stats as ugs')
      .join('users as u', 'ugs.user_id', 'u.id')
      .where('ugs.company_id', userCompany.company_id)
      .select(
        'u.id',
        'u.first_name',
        'u.last_name',
        'u.email',
        'ugs.total_points',
        'ugs.trophies_earned',
        'ugs.badges_earned'
      )
      .orderBy('ugs.total_points', 'desc')
      .limit(50);

    return res.json(leaderboard);
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
