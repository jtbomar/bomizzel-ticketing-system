import express from 'express';
import { HolidayListService } from '../services/HolidayListService';
import { authenticate } from '../middleware/auth';
import { db } from '../config/database';

const router = express.Router();

// Get all holiday lists for a company
router.get('/', authenticate, async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const holidayLists = await HolidayListService.getHolidayLists(companyId);
    return res.json(holidayLists);
  } catch (error) {
    console.error('Error fetching holiday lists:', error);
    return res.status(500).json({ error: 'Failed to fetch holiday lists' });
  }
});

// Get specific holiday list by ID
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

    const holidayList = await HolidayListService.getHolidayListById(parseInt(id), companyId);
    
    if (!holidayList) {
      return res.status(404).json({ error: 'Holiday list not found' });
    }

    return res.json(holidayList);
  } catch (error) {
    console.error('Error fetching holiday list:', error);
    return res.status(500).json({ error: 'Failed to fetch holiday list' });
  }
});

// Create new holiday list
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

    const { holidayList, holidays } = req.body;

    if (!holidayList) {
      return res.status(400).json({ error: 'Holiday list data is required' });
    }

    const holidayListData = {
      ...holidayList,
      company_id: companyId
    };

    const result = await HolidayListService.createHolidayList(holidayListData, holidays || []);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating holiday list:', error);
    return res.status(500).json({ error: 'Failed to create holiday list' });
  }
});

// Update holiday list
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

    const { holidayList, holidays } = req.body;

    if (!holidayList) {
      return res.status(400).json({ error: 'Holiday list data is required' });
    }

    const result = await HolidayListService.updateHolidayList(
      parseInt(id), 
      companyId, 
      holidayList, 
      holidays
    );

    if (!result) {
      return res.status(404).json({ error: 'Holiday list not found' });
    }

    return res.json(result);
  } catch (error) {
    console.error('Error updating holiday list:', error);
    return res.status(500).json({ error: 'Failed to update holiday list' });
  }
});

// Delete holiday list
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

    const success = await HolidayListService.deleteHolidayList(parseInt(id), companyId);

    if (!success) {
      return res.status(404).json({ error: 'Holiday list not found' });
    }

    return res.json({ message: 'Holiday list deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting holiday list:', error);
    if (error.message === 'Cannot delete the only holiday list configuration') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to delete holiday list' });
  }
});

// Get default holiday list
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

    const holidayList = await HolidayListService.getDefaultHolidayList(companyId);
    
    if (!holidayList) {
      // Create default US holiday list if none exist
      const defaultHolidayList = await HolidayListService.createDefaultUSHolidayList(companyId);
      return res.json(defaultHolidayList);
    }

    return res.json(holidayList);
  } catch (error) {
    console.error('Error fetching default holiday list:', error);
    return res.status(500).json({ error: 'Failed to fetch default holiday list' });
  }
});

// Check if a date is a holiday
router.get('/check/:date', authenticate, async (req, res) => {
  try {
    const { date } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    const isHoliday = await HolidayListService.isHoliday(companyId, date);

    return res.json({
      date,
      isHoliday,
      message: isHoliday ? 'This date is a holiday' : 'This date is not a holiday'
    });
  } catch (error) {
    console.error('Error checking holiday status:', error);
    return res.status(500).json({ error: 'Failed to check holiday status' });
  }
});

export default router;