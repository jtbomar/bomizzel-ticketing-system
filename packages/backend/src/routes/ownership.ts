import { Router } from 'express';
import Joi from 'joi';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/utils/validation';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import { OwnershipService } from '@/services/OwnershipService';

/**
 * The account owner, for staff:
 *   GET  /api/ownership            who the owner is, and whether it's you
 *   POST /api/ownership/transfer   { userId } hand ownership over (the owner only)
 */
const router = Router();

router.get('/', authenticate, requireStaff, async (req, res, next) => {
  try {
    const owner = await OwnershipService.owner(requireTenantId(req.user));
    res.json({ owner, isOwner: owner?.id === req.user!.id });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/transfer',
  authenticate,
  requireStaff,
  validate(Joi.object({ userId: Joi.string().uuid().required() })),
  async (req, res, next) => {
    try {
      const owner = await OwnershipService.transfer(
        requireTenantId(req.user),
        req.body.userId,
        req.user!.id
      );
      res.json({ owner, isOwner: owner?.id === req.user!.id });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
