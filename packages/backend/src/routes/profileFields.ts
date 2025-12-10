import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = express.Router();

// Get profile field configuration
router.get('/', authenticate, async (req, res) => {
  try {
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const fields = await db('profile_field_config')
      .where('org_id', userCompany.company_id)
      .orderBy('display_order', 'asc');

    return res.json({ fields });
  } catch (error: any) {
    console.error('Error fetching profile fields:', error);
    return res.status(500).json({ error: 'Failed to fetch profile fields' });
  }
});

// Update profile field configuration
router.put('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { fields } = req.body;

    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    // Update each field configuration
    for (const field of fields) {
      await db('profile_field_config')
        .where('org_id', userCompany.company_id)
        .where('field_name', field.field_name)
        .update({
          is_enabled: field.is_enabled,
          is_required: field.is_required,
          display_order: field.display_order,
          updated_at: db.fn.now(),
        });
    }

    return res.json({ message: 'Profile fields updated successfully' });
  } catch (error: any) {
    console.error('Error updating profile fields:', error);
    return res.status(500).json({ error: 'Failed to update profile fields' });
  }
});

export default router;