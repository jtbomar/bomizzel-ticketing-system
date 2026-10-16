import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { authorize } from '@/middleware/auth';
import { LookupService } from '@/services/LookupService';
import { RecordService } from '@/services/RecordService';
import { CustomerModule, CustomerOverviewService } from '@/services/CustomerOverviewService';

/**
 * Accounts and contacts through their layouts:
 *   GET /api/records/accounts/:id, PUT { values, customFieldValues }
 *   GET /api/records/contacts/:id, PUT ...
 * Staff of the record's subscriber only.
 */
const router = Router();
router.use(authenticate, requireStaff);

const moduleOf = (name: string) =>
  name === 'accounts' || name === 'contacts' || /^cm_[a-z0-9_]{1,60}$/.test(name) ? name : null;

// A custom module's records, and adding one
router.get('/:module', async (req, res, next) => {
  try {
    const module = moduleOf(req.params.module);
    if (!module) {
      res.status(404).json({ error: 'Unknown module' });
      return;
    }
    res.json(
      await RecordService.list(
        requireTenantId(req.user),
        module,
        String(req.query['q'] || ''),
        Number(req.query['page']) || 1
      )
    );
  } catch (error) {
    next(error);
  }
});

router.post('/:module', async (req, res, next) => {
  try {
    const module = moduleOf(req.params.module);
    if (!module) {
      res.status(404).json({ error: 'Unknown module' });
      return;
    }
    const { values, customFieldValues } = req.body || {};
    const record = await RecordService.create(requireTenantId(req.user), module, req.user!.id, {
      values,
      customFieldValues,
    });
    res.status(201).json({ record });
  } catch (error) {
    next(error);
  }
});

// What links to a record (lookup fields elsewhere pointing at it)
router.get('/:module/:id/related', async (req, res, next) => {
  try {
    const module =
      moduleOf(req.params.module) || (req.params.module === 'tickets' ? 'tickets' : null);
    if (!module) {
      res.status(404).json({ error: 'Unknown module' });
      return;
    }
    res.json({
      related: await LookupService.related(requireTenantId(req.user), module, req.params.id),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:module/:id', authorize('admin'), async (req, res, next) => {
  try {
    const module = moduleOf(req.params.module);
    if (!module) {
      res.status(404).json({ error: 'Unknown module' });
      return;
    }
    await RecordService.remove(requireTenantId(req.user), module, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * The account and contact pages' overview (CustomerOverviewService):
 *   GET /:module/:id/overview      counts, channels, happiness, handling times
 *   GET /:module/:id/tickets       ?filter=all|open|on_hold&page=
 *   GET /:module/:id/people        an account's contacts / a contact's accounts
 *   GET /:module/:id/history       what happened on their tickets
 *   GET /:module/:id/attachments   files on their tickets
 */
const customerModule = (name: string): CustomerModule | null =>
  name === 'accounts' || name === 'contacts' ? name : null;

router.get('/:module/:id/:part', async (req, res, next) => {
  try {
    const module = customerModule(req.params.module);
    if (!module) {
      res.status(404).json({ error: 'Unknown module' });
      return;
    }
    const tenantId = requireTenantId(req.user);
    const id = req.params.id;
    switch (req.params.part) {
      case 'overview':
        res.json(await CustomerOverviewService.overview(tenantId, module, id));
        return;
      case 'tickets': {
        const f = String(req.query['filter'] || 'all');
        const filter = f === 'open' || f === 'on_hold' ? f : 'all';
        const page = Math.max(1, parseInt(String(req.query['page'] || '1'), 10) || 1);
        res.json(await CustomerOverviewService.tickets(tenantId, module, id, filter, page));
        return;
      }
      case 'people':
        res.json(await CustomerOverviewService.people(tenantId, module, id));
        return;
      case 'history':
        res.json(await CustomerOverviewService.history(tenantId, module, id));
        return;
      case 'attachments':
        res.json(await CustomerOverviewService.attachments(tenantId, module, id));
        return;
      default:
        res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    next(error);
  }
});

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
