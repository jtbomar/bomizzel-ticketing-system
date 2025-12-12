import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = Router();

/**
 * POST /seed-business-hours
 * Create default business hours for all companies
 */
router.post('/seed-business-hours', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    console.log('🕐 Creating business hours for all companies...');

    const companies = await db('companies').select('id', 'name');
    let created = 0;

    for (const company of companies) {
      // Check if business hours already exist
      const existing = await db('business_hours').where('company_id', company.id).first();

      if (existing) {
        console.log(`  ⏭️  ${company.name} already has business hours`);
        continue;
      }

      // Create business hours
      const [bhId] = await db('business_hours')
        .insert({
          company_id: company.id,
          title: 'Standard Business Hours',
          description: 'Monday to Friday, 9 AM to 5 PM',
          timezone: 'America/New_York',
          is_active: true,
          is_default: true,
        })
        .returning('id');

      const id = typeof bhId === 'object' ? bhId.id : bhId;

      // Create schedule
      const schedule = [
        { day_of_week: 0, is_working_day: false, start_time: null, end_time: null },
        {
          day_of_week: 1,
          is_working_day: true,
          start_time: '09:00:00',
          end_time: '17:00:00',
          break_start: '12:00:00',
          break_end: '13:00:00',
        },
        {
          day_of_week: 2,
          is_working_day: true,
          start_time: '09:00:00',
          end_time: '17:00:00',
          break_start: '12:00:00',
          break_end: '13:00:00',
        },
        {
          day_of_week: 3,
          is_working_day: true,
          start_time: '09:00:00',
          end_time: '17:00:00',
          break_start: '12:00:00',
          break_end: '13:00:00',
        },
        {
          day_of_week: 4,
          is_working_day: true,
          start_time: '09:00:00',
          end_time: '17:00:00',
          break_start: '12:00:00',
          break_end: '13:00:00',
        },
        {
          day_of_week: 5,
          is_working_day: true,
          start_time: '09:00:00',
          end_time: '17:00:00',
          break_start: '12:00:00',
          break_end: '13:00:00',
        },
        { day_of_week: 6, is_working_day: false, start_time: null, end_time: null },
      ];

      await db('business_hours_schedule').insert(
        schedule.map((s) => ({ ...s, business_hours_id: id }))
      );

      created++;
      console.log(`  ✅ Created business hours for ${company.name}`);
    }

    res.json({
      success: true,
      message: `Created business hours for ${created} companies`,
      companiesProcessed: companies.length,
      created,
    });
  } catch (error: any) {
    console.error('❌ Failed to seed business hours:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed business hours',
      details: error.message,
    });
  }
});

/**
 * POST /seed-holiday-lists
 * Create default holiday lists for all companies
 */
router.post('/seed-holiday-lists', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    console.log('🎄 Creating holiday lists for all companies...');

    const companies = await db('companies').select('id', 'name');
    let created = 0;

    for (const company of companies) {
      // Check if holiday list already exists
      const existing = await db('holiday_lists').where('company_id', company.id).first();

      if (existing) {
        console.log(`  ⏭️  ${company.name} already has holiday lists`);
        continue;
      }

      // Create holiday list
      const [listId] = await db('holiday_lists')
        .insert({
          company_id: company.id,
          name: 'US Federal Holidays 2025',
          description: 'Standard US federal holidays',
          is_active: true,
          is_default: true,
        })
        .returning('id');

      const id = typeof listId === 'object' ? listId.id : listId;

      // Create holidays
      const holidays = [
        { name: "New Year's Day", date: '2025-01-01', is_recurring: true },
        { name: 'Martin Luther King Jr. Day', date: '2025-01-20', is_recurring: true },
        { name: "Presidents' Day", date: '2025-02-17', is_recurring: true },
        { name: 'Memorial Day', date: '2025-05-26', is_recurring: true },
        { name: 'Independence Day', date: '2025-07-04', is_recurring: true },
        { name: 'Labor Day', date: '2025-09-01', is_recurring: true },
        { name: 'Thanksgiving', date: '2025-11-27', is_recurring: true },
        { name: 'Christmas', date: '2025-12-25', is_recurring: true },
      ];

      await db('holidays').insert(holidays.map((h) => ({ ...h, holiday_list_id: id })));

      created++;
      console.log(`  ✅ Created holiday list for ${company.name}`);
    }

    res.json({
      success: true,
      message: `Created holiday lists for ${created} companies`,
      companiesProcessed: companies.length,
      created,
    });
  } catch (error: any) {
    console.error('❌ Failed to seed holiday lists:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed holiday lists',
      details: error.message,
    });
  }
});

export default router;
