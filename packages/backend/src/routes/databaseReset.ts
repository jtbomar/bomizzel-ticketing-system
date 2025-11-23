import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = Router();

/**
 * POST /api/database-reset/nuclear
 * DANGER: Drops all tables and recreates from migrations
 * Admin only, requires confirmation
 */
router.post('/nuclear', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { confirmation } = req.body;
    
    if (confirmation !== 'DELETE_EVERYTHING') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Send { confirmation: "DELETE_EVERYTHING" }',
      });
    }

    console.log('💣 NUCLEAR RESET initiated by:', req.user?.email);
    
    // Drop all tables
    await db.raw(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    console.log('✅ All tables dropped');
    
    // Run migrations
    await db.migrate.latest();
    
    console.log('✅ Migrations completed');

    res.json({
      success: true,
      message: 'Database reset complete. All tables recreated from migrations.',
    });
  } catch (error: any) {
    console.error('❌ Database reset failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/database-reset/cleanup-migrations
 * Remove specific migration records
 */
router.post('/cleanup-migrations', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deleted = await db('knex_migrations')
      .whereIn('name', [
        '20251122100000_add_org_id_to_tables.js',
        '20251122110000_backfill_org_id_data.js',
        '20251122120000_enhance_user_company_associations.js'
      ])
      .del();
    
    res.json({
      success: true,
      message: `Removed ${deleted} old migration records`,
      deleted,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
