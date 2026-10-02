import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { ViewService } from '@/services/ViewService';

/** Saved ticket views: shared ones (admins) and each agent's own. */
const router = Router();
router.use(authenticate, requireStaff);

const caller = (req: any) => ({
  id: req.user!.id as string,
  role: req.user!.role as string,
  tenantId: requireTenantId(req.user),
});

router.get('/', async (req, res, next) => {
  try {
    const me = caller(req);
    res.json({ views: await ViewService.list(me), canShare: me.role === 'admin' });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json({ view: await ViewService.create(caller(req), req.body) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json({ view: await ViewService.update(caller(req), req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await ViewService.remove(caller(req), req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
