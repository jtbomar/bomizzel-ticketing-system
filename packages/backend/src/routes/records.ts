import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { RecordService } from '@/services/RecordService';

/**
 * Accounts and contacts through their layouts:
 *   GET /api/records/accounts/:id, PUT { values, customFieldValues }
 *   GET /api/records/contacts/:id, PUT ...
 * Staff of the record's subscriber only.
 */
const router = Router();
router.use(authenticate, requireStaff);

const moduleOf = (name: string) => (name === 'accounts' || name === 'contacts' ? name : null);

router.get('/:module/:id', async (req, res, next) => {
  try {
    const module = moduleOf(req.params.module);
    if (!module) {
      res.status(404).json({ error: 'Unknown module' });
      return;
    }
    res.json({ record: await RecordService.get(requireTenantId(req.user), module, req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.put('/:module/:id', async (req, res, next) => {
  try {
    const module = moduleOf(req.params.module);
    if (!module) {
      res.status(404).json({ error: 'Unknown module' });
      return;
    }
    const { values, customFieldValues } = req.body || {};
    if (
      values !== undefined &&
      (typeof values !== 'object' || values === null || Array.isArray(values))
    ) {
      res.status(400).json({ error: 'values must be an object' });
      return;
    }
    const record = await RecordService.update(requireTenantId(req.user), module, req.params.id, {
      values,
      customFieldValues,
    });
    res.json({ record });
  } catch (error) {
    next(error);
  }
});

export default router;
