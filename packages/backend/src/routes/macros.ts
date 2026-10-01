import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { MacroService } from '@/services/MacroService';

/**
 * Macros. Any staff member uses the shared ones and their own; admins
 * manage the shared ones.
 */
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
    const [macros, options] = await Promise.all([
      MacroService.list(me),
      MacroService.options(me.tenantId),
    ]);
    res.json({ macros, options, canShare: me.role === 'admin' });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json({ macro: await MacroService.create(caller(req), req.body) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json({ macro: await MacroService.update(caller(req), req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await MacroService.remove(caller(req), req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/** POST /macros/:id/apply { ticketId } - make the changes, return the reply to review */
router.post('/:id/apply', async (req, res, next) => {
  try {
    res.json(
      await MacroService.apply(caller(req), req.params.id, String(req.body?.ticketId || ''))
    );
  } catch (error) {
    next(error);
  }
});

export default router;
