import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { ModuleService } from '@/services/ModuleService';

/** Custom modules: staff see them; admins add, rename and delete them. */
const router = Router();
router.use(authenticate, requireStaff);

router.get('/', async (req, res, next) => {
  try {
    res.json({ modules: await ModuleService.list(requireTenantId(req.user)) });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    res
      .status(201)
      .json({ module: await ModuleService.create(requireTenantId(req.user), req.body || {}) });
  } catch (error) {
    next(error);
  }
});

router.put('/:key', authorize('admin'), async (req, res, next) => {
  try {
    res.json({
      module: await ModuleService.rename(requireTenantId(req.user), req.params.key, req.body || {}),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:key', authorize('admin'), async (req, res, next) => {
  try {
    await ModuleService.remove(requireTenantId(req.user), req.params.key);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
