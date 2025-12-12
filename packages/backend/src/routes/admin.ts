import { Router } from 'express';
import { execSync } from 'child_process';
import path from 'path';

const router = Router();

/**
 * EMERGENCY: Manual database reseed endpoint
 * This is a temporary endpoint to fix login issues
 */
router.post('/emergency-reseed', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY RESEED TRIGGERED');
    
    // Get the backend directory
    const backendDir = path.resolve(__dirname, '../..');
    const env = process.env.NODE_ENV || 'production';
    
    console.log('📂 Backend directory:', backendDir);
    console.log('🌍 Environment:', env);
    
    // Run migrations first
    console.log('🔄 Running migrations...');
    const migrateCommand = `cd ${backendDir} && npx knex migrate:latest --knexfile knexfile.js --env ${env}`;
    execSync(migrateCommand, { stdio: 'inherit' });
    
    // Run seeds
    console.log('🌱 Running seeds...');
    const seedCommand = `cd ${backendDir} && npx knex seed:run --knexfile knexfile.js --env ${env}`;
    execSync(seedCommand, { stdio: 'inherit' });
    
    console.log('✅ Emergency reseed completed');
    
    res.json({
      success: true,
      message: 'Database reseed completed successfully',
      credentials: {
        superAdmin: 'jeff@bomar.com / password123',
        admin: 'elena@bomar.com / password123',
        agent: 'jeremy@bomar.com / password123'
      }
    });
    
  } catch (error) {
    console.error('❌ Emergency reseed failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Check database health
 */
router.get('/db-health', async (req, res) => {
  try {
    // This is a simple health check
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

export default router;