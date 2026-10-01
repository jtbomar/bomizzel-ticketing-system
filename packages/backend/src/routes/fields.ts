import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { FieldService } from '@/services/FieldService';

/**
 * Fields and layouts, per module (/api/fields/tickets).
 * Staff read them (to show the forms); admins change them.
 */
const router = Router();
router.use(authenticate, requireStaff);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/:module', async (req, res, next) => {
  try {
    res.json(await FieldService.layout(requireTenantId(req.user), req.params.module));
  } catch (error) {
    next(error);
  }
});

router.put('/:module/layout', authorize('admin'), async (req, res, next) => {
  try {
    res.json(
      await FieldService.saveLayout(
        requireTenantId(req.user),
        req.params.module,
        req.body?.sections
      )
    );
  } catch (error) {
    next(error);
  }
});

router.post('/:module', authorize('admin'), async (req, res, next) => {
  try {
    const field = await FieldService.createField(
      requireTenantId(req.user),
      req.params.module,
      req.body
    );
    res.status(201).json({ field });
  } catch (error) {
    next(error);
  }
});

router.put('/:module/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }
    const field = await FieldService.updateField(
      requireTenantId(req.user),
      req.params.module,
      req.params.id,
      req.body
    );
    res.json({ field });
  } catch (error) {
    next(error);
  }
});

router.delete('/:module/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) {
      res.status(404).json({ error: 'Field not found' });
      return;
    }
    await FieldService.deleteField(requireTenantId(req.user), req.params.module, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
