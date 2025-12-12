import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = Router();

/**
 * POST /fix-migrations
 * Remove orphaned migration records and fix constraints
 */
router.post('/fix-migrations', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    console.log('🔧 Fixing database issues...');

    // Step 1: Remove orphaned migration records
    const deletedMigrations = await db('knex_migrations')
      .whereIn('name', [
        '20251115000000_rename_employee_role_to_agent.js',
        '20251115000001_rename_employee_queue_type_to_agent.js',
      ])
      .del();

    console.log(`✅ Removed ${deletedMigrations} orphaned migration records`);

    // Step 2: Drop problematic check constraints
    await db.raw(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    console.log('✅ Removed users_role_check constraint');

    await db.raw(`
      ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_type_check;
    `);
    console.log('✅ Removed queues_type_check constraint');

    res.json({
      success: true,
      message: 'Database fixed successfully',
      details: {
        migrationsRemoved: deletedMigrations,
        constraintsRemoved: ['users_role_check', 'queues_type_check'],
      },
    });
  } catch (error: any) {
    console.error('❌ Fix failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix database',
      details: error.message,
    });
  }
});

/**
 * GET /check-database
 * Check database status
 */
router.get('/check-database', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // Check migrations
    const migrations = await db('knex_migrations').select('*').orderBy('id', 'desc').limit(10);

    // Check for orphaned migrations
    const orphanedMigrations = await db('knex_migrations').whereIn('name', [
      '20251115000000_rename_employee_role_to_agent.js',
      '20251115000001_rename_employee_queue_type_to_agent.js',
    ]);

    // Check constraints
    const constraints = await db.raw(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass OR conrelid = 'queues'::regclass;
    `);

    res.json({
      success: true,
      migrations: migrations,
      orphanedMigrations: orphanedMigrations,
      constraints: constraints.rows,
      hasOrphanedMigrations: orphanedMigrations.length > 0,
    });
  } catch (error: any) {
    console.error('❌ Check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check database',
      details: error.message,
    });
  }
});

export default router;
