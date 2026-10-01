import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { LookupService } from '@/services/LookupService';

/**
 * GET /api/lookup/:module?q=text  - records to link to
 * GET /api/lookup/:module?ids=a,b - names of linked records
 */
const router = Router();
router.use(authenticate, requireStaff);

router.get('/:module', async (req, res, next) => {
  try {
    const tenantId = requireTenantId(req.user);
    const ids = typeof req.query['ids'] === 'string' ? req.query['ids'].split(',') : null;
    const records = ids
      ? await LookupService.names(tenantId, req.params.module, ids)
      : await LookupService.search(tenantId, req.params.module, String(req.query['q'] || ''));
    res.json({ records });
  } catch (error) {
    next(error);
  }
});

export default router;
