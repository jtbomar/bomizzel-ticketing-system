import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';
import { requireTenantId } from '../utils/tenant';

// Rows belong to the caller's subscriber (company_id). The list returned every
// subscriber's rows, create took company_id from the body (default
// 'bomizzel-internal'), and update/delete changed any row by id.

const router = Router();

// Get all user profiles
router.get('/', authenticate, async (req, res, next) => {
  try {
    const profiles = await db('user_profiles')
      .where({ is_active: true, company_id: requireTenantId(req.user) })
      .orderBy('name', 'asc');

    res.json({ profiles });
  } catch (error) {
    next(error);
  }
});

// Create user profile (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;

    const [profile] = await db('user_profiles')
      .insert({
        company_id: requireTenantId(req.user),
        name,
        description,
        permissions: JSON.stringify(permissions || {}),
        is_active: true,
      })
      .returning('*');

    res.status(201).json({ profile });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, is_active } = req.body;

    const [profile] = await db('user_profiles')
      .where({ id, company_id: requireTenantId(req.user) })
      .update({
        name,
        description,
        permissions: permissions ? JSON.stringify(permissions) : undefined,
        is_active,
        updated_at: db.fn.now(),
      })
      .returning('*');

    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

// Delete user profile
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    await db('user_profiles')
      .where({ id, company_id: requireTenantId(req.user) })
      .update({ is_active: false, updated_at: db.fn.now() });

    res.json({ message: 'User profile deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
