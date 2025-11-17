import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = Router();

/**
 * POST /cleanup-duplicate-departments
 * Keep only one set of departments (for the first company) and delete the rest
 * This fixes the issue where departments were created per customer company
 * instead of being Bomizzel's internal departments
 */
router.post('/cleanup-duplicate-departments', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    console.log('🧹 Cleaning up duplicate departments...');
    
    // Get all companies
    const companies = await db('companies').select('id', 'name').orderBy('created_at');
    
    if (companies.length === 0) {
      return res.json({ success: true, message: 'No companies found' });
    }
    
    // Keep departments for the first company (this will represent Bomizzel's departments)
    const keepCompanyId = companies[0].id;
    const keepCompanyName = companies[0].name;
    
    console.log(`Keeping departments for: ${keepCompanyName} (${keepCompanyId})`);
    
    // Get departments to keep
    const departmentsToKeep = await db('departments')
      .where('company_id', keepCompanyId)
      .select('id', 'name');
    
    // Delete departments for all other companies
    const deleted = await db('departments')
      .whereNot('company_id', keepCompanyId)
      .del();
    
    console.log(`✅ Deleted ${deleted} duplicate departments`);
    console.log(`✅ Kept ${departmentsToKeep.length} departments for ${keepCompanyName}`);
    
    res.json({
      success: true,
      message: `Cleaned up duplicate departments`,
      details: {
        kept: departmentsToKeep.length,
        deleted: deleted,
        keptFor: keepCompanyName,
        departments: departmentsToKeep.map(d => d.name)
      }
    });
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup departments',
      details: error.message,
    });
  }
});

export default router;
