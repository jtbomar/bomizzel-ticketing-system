import express from 'express';
import { BusinessHoursService } from '../services/BusinessHoursService';
import { authenticate } from '../middleware/auth';
import { db } from '../config/database';

const router = express.Router();

// Get all business hours for a company
router.get('/', authenticate, async (req, res) => {
  try {
    const userRole = req.user!.role;
    
    // For admin/employee/team_lead, get all business hours across all companies
    if (['admin', 'employee', 'team_lead'].includes(userRole)) {
      const allBusinessHours = await db('business_hours')
        .select('*')
        .orderBy('company_id');
      return res.json(allBusinessHours);
    }
    
    // For customers, get business hours for their associated company
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const businessHours = await BusinessHoursService.getBusinessHours(companyId);
    return res.json(businessHours);
  } catch (error) {
    console.error('Error fetching business hours:', error);
    return res.status(500).json({ error: 'Failed to fetch business hours' });
  }
});

// Get specific business hours by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const businessHours = await BusinessHoursService.getBusinessHoursById(parseInt(id), companyId);
    
    if (!businessHours) {
      return res.status(404).json({ error: 'Business hours not found' });
    }

    return res.json(businessHours);
  } catch (error) {
    console.error('Error fetching business hours:', error);
    return res.status(500).json({ error: 'Failed to fetch business hours' });
  }
});

// Create new business hours
router.post('/', authenticate, async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const { businessHours, schedule } = req.body;

    if (!businessHours || !schedule) {
      return res.status(400).json({ error: 'Business hours and schedule are required' });
    }

    // Validate schedule has all 7 days
    if (!Array.isArray(schedule) || schedule.length !== 7) {
      return res.status(400).json({ error: 'Schedule must contain all 7 days of the week' });
    }

    // Validate day_of_week values
    const dayNumbers = schedule.map(s => s.day_of_week).sort();
    const expectedDays = [0, 1, 2, 3, 4, 5, 6];
    if (JSON.stringify(dayNumbers) !== JSON.stringify(expectedDays)) {
      return res.status(400).json({ error: 'Schedule must contain days 0-6 (Sunday-Saturday)' });
    }

    const businessHoursData = {
      ...businessHours,
      company_id: companyId
    };

    const result = await BusinessHoursService.createBusinessHours(businessHoursData, schedule);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating business hours:', error);
    return res.status(500).json({ error: 'Failed to create business hours' });
  }
});

// Update business hours
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const { businessHours, schedule } = req.body;

    if (!businessHours) {
      return res.status(400).json({ error: 'Business hours data is required' });
    }

    // If schedule is provided, validate it
    if (schedule) {
      if (!Array.isArray(schedule) || schedule.length !== 7) {
        return res.status(400).json({ error: 'Schedule must contain all 7 days of the week' });
      }

      const dayNumbers = schedule.map(s => s.day_of_week).sort();
      const expectedDays = [0, 1, 2, 3, 4, 5, 6];
      if (JSON.stringify(dayNumbers) !== JSON.stringify(expectedDays)) {
        return res.status(400).json({ error: 'Schedule must contain days 0-6 (Sunday-Saturday)' });
      }
    }

    const result = await BusinessHoursService.updateBusinessHours(
      parseInt(id), 
      companyId, 
      businessHours, 
      schedule
    );

    if (!result) {
      return res.status(404).json({ error: 'Business hours not found' });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error updating business hours:', error);
    return res.status(500).json({ error: 'Failed to update business hours' });
  }
});

// Delete business hours
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const success = await BusinessHoursService.deleteBusinessHours(parseInt(id), companyId);

    if (!success) {
      return res.status(404).json({ error: 'Business hours not found' });
    }

    return res.json({ message: 'Business hours deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting business hours:', error);
    if (error.message === 'Cannot delete the only business hours configuration') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to delete business hours' });
  }
});

// Get default business hours
router.get('/default/current', authenticate, async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const businessHours = await BusinessHoursService.getDefaultBusinessHours(companyId);
    
    if (!businessHours) {
      // Create default business hours if none exist
      const defaultBusinessHours = await BusinessHoursService.createDefaultBusinessHours(companyId);
      return res.json(defaultBusinessHours);
    }

    return res.json(businessHours);
  } catch (error) {
    console.error('Error fetching default business hours:', error);
    return res.status(500).json({ error: 'Failed to fetch default business hours' });
  }
});

// Check if current time is within business hours
router.get('/check/current-status', authenticate, async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const businessHours = await BusinessHoursService.getDefaultBusinessHours(companyId);
    
    if (!businessHours) {
      return res.json({ 
        isWithinBusinessHours: false, 
        message: 'No business hours configured' 
      });
    }

    const currentTime = new Date();
    const isWithinHours = BusinessHoursService.isWithinBusinessHours(
      businessHours.schedule, 
      currentTime, 
      businessHours.timezone
    );

    return res.json({
      isWithinBusinessHours: isWithinHours,
      currentTime: currentTime.toISOString(),
      timezone: businessHours.timezone,
      businessHoursTitle: businessHours.title
    });
  } catch (error) {
    console.error('Error checking business hours status:', error);
    return res.status(500).json({ error: 'Failed to check business hours status' });
  }
});

export default router;