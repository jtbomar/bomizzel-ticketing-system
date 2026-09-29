import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';
import { requireTenantId } from '../utils/tenant';

// Rows belong to the caller's subscriber (company_id). The list returned every
// subscriber's rows, create took company_id from the body (default
// 'bomizzel-internal'), and update/delete changed any row by id.

const router = Router();

// Get all organizational roles
router.get('/', authenticate, async (req, res, next) => {
  try {
    const roles = await db('organizational_roles')
      .where({ is_active: true, company_id: requireTenantId(req.user) })
      .orderBy('hierarchy_level', 'asc');

    res.json({ roles });
  } catch (error) {
    next(error);
  }
});

// Create organizational role (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, description, hierarchy_level } = req.body;

    const [role] = await db('organizational_roles')
      .insert({
        company_id: requireTenantId(req.user),
        name,
        description,
        hierarchy_level,
        is_active: true,
      })
      .returning('*');

    res.status(201).json({ role });
  } catch (error) {
    next(error);
  }
});

// Update organizational role
router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, hierarchy_level, is_active } = req.body;

    const [role] = await db('organizational_roles')
      .where({ id, company_id: requireTenantId(req.user) })
      .update({
        name,
        description,
        hierarchy_level,
        is_active,
        updated_at: db.fn.now(),
      })
      .returning('*');

    res.json({ role });
  } catch (error) {
    next(error);
  }
});

// Delete organizational role
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    await db('organizational_roles')
      .where({ id, company_id: requireTenantId(req.user) })
      .update({ is_active: false, updated_at: db.fn.now() });

    res.json({ message: 'Organizational role deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
