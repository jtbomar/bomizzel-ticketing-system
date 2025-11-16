import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

/**
 * POST /reseed
 * Reseed the database with test data (admin only)
 * WARNING: This will delete and recreate all test data
 */
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    console.log('🔄 Starting database reseed...');
    
    // Run the seed command
    const { stdout, stderr } = await execAsync('npm run seed', {
      cwd: process.cwd(),
      timeout: 60000, // 60 second timeout
    });

    console.log('✅ Reseed completed');
    console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);

    res.json({
      success: true,
      message: 'Database reseeded successfully',
      output: stdout,
    });
  } catch (error: any) {
    console.error('❌ Reseed failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reseed database',
      details: error.message,
      output: error.stdout,
      errorOutput: error.stderr,
    });
  }
});

export default router;
