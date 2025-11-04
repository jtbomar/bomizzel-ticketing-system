import { Router } from 'express';
import { ticketLayoutService } from '../services/TicketLayoutService';
// Note: Using simple validation for now since the full middleware has issues
import { authenticate } from '../middleware/auth';
import Joi from 'joi';

const router = Router();

// Simplified validation - will add proper validation later

/**
 * Get all layouts for a team
 * GET /ticket-layouts?teamId=xxx
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const layouts = await ticketLayoutService.getLayoutsByTeam(teamId as string);
    return res.json({ layouts });
  } catch (error) {
    console.error('Error fetching ticket layouts:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket layouts' });
  }
});

/**
 * Get a specific layout by ID
 * GET /ticket-layouts/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { includeFields = 'true' } = req.query;
    
    const layout = await ticketLayoutService.getLayoutById(
      id, 
      includeFields === 'true'
    );
    
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    return res.json(layout);
  } catch (error) {
    console.error('Error fetching ticket layout:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket layout' });
  }
});

/**
 * Get the default layout for a team
 * GET /ticket-layouts/team/:teamId/default
 */
router.get('/team/:teamId/default', authenticate, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    const layout = await ticketLayoutService.getDefaultLayout(teamId);
    
    if (!layout) {
      return res.status(404).json({ error: 'No default layout found for team' });
    }

    return res.json(layout);
  } catch (error) {
    console.error('Error fetching default layout:', error);
    return res.status(500).json({ error: 'Failed to fetch default layout' });
  }
});

/**
 * Create a new ticket layout
 * POST /ticket-layouts
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.body;
    
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const layout = await ticketLayoutService.createLayout(teamId, req.body);
    return res.status(201).json(layout);
  } catch (error) {
    console.error('Error creating ticket layout:', error);
    return res.status(500).json({ error: 'Failed to create ticket layout' });
  }
});

/**
 * Update a ticket layout
 * PUT /ticket-layouts/:id
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const layout = await ticketLayoutService.updateLayout(id, req.body);
    
    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    return res.json(layout);
  } catch (error) {
    console.error('Error updating ticket layout:', error);
    return res.status(500).json({ error: 'Failed to update ticket layout' });
  }
});

/**
 * Delete a ticket layout (soft delete)
 * DELETE /ticket-layouts/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await ticketLayoutService.deleteLayout(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    return res.json({ message: 'Layout deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket layout:', error);
    return res.status(500).json({ error: 'Failed to delete ticket layout' });
  }
});

/**
 * Duplicate a ticket layout
 * POST /ticket-layouts/:id/duplicate
 */
router.post('/:id/duplicate', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'New layout name is required' });
    }

    const layout = await ticketLayoutService.duplicateLayout(id, name);
    
    if (!layout) {
      return res.status(404).json({ error: 'Original layout not found' });
    }

    return res.status(201).json(layout);
  } catch (error) {
    console.error('Error duplicating ticket layout:', error);
    return res.status(500).json({ error: 'Failed to duplicate ticket layout' });
  }
});

export default router;