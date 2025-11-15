import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

// Temporary setup endpoint to run migrations
router.post('/migrate', async (_req: Request, res: Response) => {
  try {
    console.log('Running migrations...');
    const { stdout: migrateOut, stderr: migrateErr } = await execAsync('npx knex migrate:latest --knexfile knexfile.js');
    console.log('Migration output:', migrateOut);
    if (migrateErr) console.error('Migration errors:', migrateErr);

    console.log('Running seeds...');
    const { stdout: seedOut, stderr: seedErr } = await execAsync('npx knex seed:run --knexfile knexfile.js');
    console.log('Seed output:', seedOut);
    if (seedErr) console.error('Seed errors:', seedErr);

    res.json({
      success: true,
      message: 'Database initialized successfully',
      migration: migrateOut,
      seed: seedOut
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    });
  }
});

export default router;
