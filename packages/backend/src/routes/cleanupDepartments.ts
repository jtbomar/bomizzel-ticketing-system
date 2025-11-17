import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = Router();

/**
 * POST /cleanup-test-data
 * Clean up test data to have only ONE organization with proper structure
 * - Keep first company as the test organization
 * - Rename it to "Bomizzel Test Organization"
 * - Delete other 4 companies (they'll become customer accounts later)
 * - Keep only 3 departments for the one organization
 */
router.post('/cleanup-test-data', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    console.log('🧹 Cleaning up test data for single-tenant setup...');
    
    // Get all companies
    const companies = await db('companies').select('id', 'name').orderBy('created_at');
    
    if (companies.length === 0) {
      return res.json({ success: true, message: 'No companies found' });
    }
    
    // Keep first company as the test organization
    const keepCompanyId = companies[0].id;
    const keepCompanyName = companies[0].name;
    const otherCompanies = companies.slice(1);
    
    console.log(`Keeping organization: ${keepCompanyName} (${keepCompanyId})`);
    console.log(`Will delete ${otherCompanies.length} other companies`);
    
    // Rename the kept company to "Bomizzel Test Organization"
    await db('companies')
      .where('id', keepCompanyId)
      .update({
        name: 'Bomizzel Test Organization',
        domain: 'bomizzel-test.com',
        description: 'Test organization for Bomizzel ticketing system',
        updated_at: db.fn.now()
      });
    
    console.log(`✅ Renamed to "Bomizzel Test Organization"`);
    
    // Get departments to keep
    const departmentsToKeep = await db('departments')
      .where('company_id', keepCompanyId)
      .select('id', 'name');
    
    // Delete all other companies (this will cascade delete their departments, users, etc.)
    const deletedCompanies = await db('companies')
      .whereNot('id', keepCompanyId)
      .del();
    
    console.log(`✅ Deleted ${deletedCompanies} companies`);
    console.log(`✅ Kept ${departmentsToKeep.length} departments`);
    
    // Get final counts
    const finalCompanyCount = await db('companies').count('* as count').first();
    const finalDeptCount = await db('departments').count('* as count').first();
    const finalUserCount = await db('users').count('* as count').first();
    
    res.json({
      success: true,
      message: 'Test data cleaned up successfully',
      details: {
        organizationName: 'Bomizzel Test Organization',
        organizationId: keepCompanyId,
        departments: departmentsToKeep.map(d => d.name),
        deletedCompanies: deletedCompanies,
        finalCounts: {
          companies: finalCompanyCount?.count || 0,
          departments: finalDeptCount?.count || 0,
          users: finalUserCount?.count || 0
        }
      }
    });
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup test data',
      details: error.message,
    });
  }
});

export default router;
