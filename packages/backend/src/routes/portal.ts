import { Router } from 'express';
import Joi from 'joi';
import { authenticate } from '@/middleware/auth';
import { authRateLimiter } from '@/middleware/rateLimiter';
import { validate } from '@/utils/validation';
import { PortalService } from '@/services/PortalService';
import { PortalAccessService } from '@/services/PortalAccessService';
import { AppError } from '@/middleware/errorHandler';
import { requireTenantId } from '@/utils/tenant';

/**
 * The customer portal, by portal name:
 *   GET  /api/portal/:slug                        name, logo, colours (public)
 *   POST /api/portal/:slug/signup                 a customer signs up (public)
 *   GET  /api/portal/:slug/session                who's signed in, what they can see
 *   POST /api/portal/:slug/access-request         ask to see the company's tickets
 *   GET  /api/portal/:slug/departments            to pick for a new ticket
 *   POST /api/portal/:slug/tickets                a new ticket
 *   POST /api/portal/:slug/tickets/:id/close      close one you opened
 * Ticket lists, details, notes and attachments use the ordinary /tickets and
 * /files routes, which limit contacts to what they may see.
 *
 * And the admins' side (/api/portal-access): deciding requests from the
 * email link or in the app, and allowing or revoking a contact's access.
 */
const router = Router();

router.get('/:slug', async (req, res, next) => {
  try {
    res.json(await PortalService.info(req.params.slug));
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:slug/signup',
  authRateLimiter,
  validate(
    Joi.object({
      firstName: Joi.string().trim().min(1).max(50).required(),
      lastName: Joi.string().trim().min(1).max(50).required(),
      email: Joi.string().trim().email().max(254).required(),
      password: Joi.string().min(8).max(200).required(),
      companyName: Joi.string().trim().max(150).allow('').optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const result = await PortalService.signUp(req.params.slug!, req.body);
      res.status(201).json(
        result.joined
          ? {
              joined: true,
              message: "You're signed up. Sign in with the password you already use.",
            }
          : { message: 'Check your email for a link to confirm your address' }
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:slug/session', authenticate, async (req, res, next) => {
  try {
    res.json(await PortalService.session(req.params.slug!, req.user!.id));
  } catch (error) {
    next(error);
  }
});

router.post('/:slug/access-request', authenticate, async (req, res, next) => {
  try {
    res.json(await PortalService.requestAccess(req.params.slug!, req.user!.id));
  } catch (error) {
    next(error);
  }
});

router.get('/:slug/departments', authenticate, async (req, res, next) => {
  try {
    res.json({ departments: await PortalService.departments(req.params.slug!, req.user!.id) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:slug/tickets',
  authenticate,
  validate(
    Joi.object({
      title: Joi.string().trim().min(1).max(255).required(),
      description: Joi.string().trim().min(1).max(20000).required(),
      departmentId: Joi.number().integer().allow(null).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const ticket = await PortalService.createTicket(req.params.slug!, req.user!.id, req.body);
      res.status(201).json({ ticket });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:slug/tickets/:ticketId/close', authenticate, async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.ticketId || '')) {
      throw new AppError('Ticket not found', 404, 'NOT_FOUND');
    }
    const ticket = await PortalService.closeTicket(
      req.params.slug!,
      req.user!.id,
      req.params.ticketId!
    );
    res.json({ ticket });
  } catch (error) {
    next(error);
  }
});

export default router;

/** The admins' side of portal access. */
export const portalAccessRouter = Router();

const adminOnly = (req: any, _res: any, next: any) =>
  req.user?.role === 'admin'
    ? next()
    : next(new AppError('Only admins can do this', 403, 'ADMIN_ONLY'));

const staffOnly = (req: any, _res: any, next: any) =>
  ['admin', 'employee', 'team_lead'].includes(req.user?.role)
    ? next()
    : next(new AppError('Insufficient permissions', 403, 'STAFF_ONLY'));

const decision = Joi.string().valid('approve', 'deny').required();

// From the email: what's being decided (GET never decides - mail scanners open links)
portalAccessRouter.get('/decision', async (req, res, next) => {
  try {
    res.json(await PortalAccessService.preview(String(req.query['token'] || '')));
  } catch (error) {
    next(error);
  }
});

portalAccessRouter.post(
  '/decision',
  authRateLimiter,
  validate(Joi.object({ token: Joi.string().max(2000).required(), decision })),
  async (req, res, next) => {
    try {
      res.json(await PortalAccessService.decideByToken(req.body.token, req.body.decision));
    } catch (error) {
      next(error);
    }
  }
);

portalAccessRouter.get('/requests', authenticate, staffOnly, async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'denied', 'all'].includes(String(req.query['status']))
      ? String(req.query['status'])
      : 'pending';
    res.json({ requests: await PortalAccessService.list(requireTenantId(req.user), status) });
  } catch (error) {
    next(error);
  }
});

portalAccessRouter.post(
  '/requests/:requestId/decide',
  authenticate,
  adminOnly,
  validate(Joi.object({ decision, companyId: Joi.string().uuid().allow(null).optional() })),
  async (req, res, next) => {
    try {
      res.json(
        await PortalAccessService.decide(
          requireTenantId(req.user),
          req.params.requestId!,
          req.body.decision,
          req.user!.id,
          req.body.companyId
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

// A contact's portal access, for their profile in the app
portalAccessRouter.get('/contacts/:userId', authenticate, staffOnly, async (req, res, next) => {
  try {
    res.json(await PortalAccessService.forContact(requireTenantId(req.user), req.params.userId!));
  } catch (error) {
    next(error);
  }
});

portalAccessRouter.post(
  '/contacts/:userId/allow',
  authenticate,
  adminOnly,
  validate(Joi.object({ companyId: Joi.string().uuid().allow(null).optional() })),
  async (req, res, next) => {
    try {
      await PortalAccessService.grant(
        requireTenantId(req.user),
        req.params.userId!,
        req.body.companyId || null,
        req.user!.id
      );
      res.json({ scope: 'company' });
    } catch (error) {
      next(error);
    }
  }
);

portalAccessRouter.post(
  '/contacts/:userId/revoke',
  authenticate,
  adminOnly,
  async (req, res, next) => {
    try {
      await PortalAccessService.revoke(requireTenantId(req.user), req.params.userId!);
      res.json({ scope: 'own' });
    } catch (error) {
      next(error);
    }
  }
);
