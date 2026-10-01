import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { AssignmentRuleService } from '@/services/AssignmentRuleService';

/**
 * Settings > Assignment Rules. Admins of a subscriber manage that
 * subscriber's rules only.
 */
const router = Router();
router.use(authenticate, requireStaff, authorize('admin'));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/', async (req, res, next) => {
  try {
    const tenantId = requireTenantId(req.user);
    const [rules, options] = await Promise.all([
      AssignmentRuleService.list(tenantId),
      AssignmentRuleService.options(tenantId),
    ]);
    res.json({ rules, options });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const rule = await AssignmentRuleService.create(
      requireTenantId(req.user),
      req.user!.id,
      req.body
    );
    res.status(201).json({ rule });
  } catch (error) {
    next(error);
  }
});

// Before /:id so "order" isn't taken for a rule id
router.put('/order', async (req, res, next) => {
  try {
    const ids: unknown = req.body?.ruleIds;
    if (
      !Array.isArray(ids) ||
      ids.length > 500 ||
      !ids.every((id) => typeof id === 'string' && UUID.test(id))
    ) {
      res.status(400).json({ error: 'ruleIds must be a list of rule ids' });
      return;
    }
    const rules = await AssignmentRuleService.reorder(requireTenantId(req.user), ids);
    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    const rule = await AssignmentRuleService.update(
      requireTenantId(req.user),
      req.params.id,
      req.body
    );
    res.json({ rule });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    await AssignmentRuleService.remove(requireTenantId(req.user), req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
