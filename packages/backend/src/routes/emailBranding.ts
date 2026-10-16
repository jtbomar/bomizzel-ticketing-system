import { Router } from 'express';
import { db } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { requireStaff, requireTenantId } from '@/utils/tenant';
import {
  BrandingService,
  cleanSignature,
  faviconOf,
  parseDataUri,
  portalBackgroundOf,
} from '@/services/BrandingService';
import { accountEmails } from '@/services/AccountEmailService';
import { ticketEmails } from '@/services/TicketEmailService';

/**
 * Branded email to customers:
 *   GET  /api/email-branding/my-signature   an agent's own signature
 *   PUT  /api/email-branding/my-signature   { html } ('' removes it)
 *   GET  /api/email-branding/preview?kind=welcome|reply|receipt|update[&signature=html][&mine=1]
 *        what a customer would get, in the caller's subscriber's brand (mine:
 *        the signature is an agent's own, so an empty one falls back to the
 *        company's)
 * And, with no sign-in (mail apps fetch it):
 *   GET  /api/public/brand-logo/:companyId  the Rebranding page's logo
 */
const router = Router();

router.get('/my-signature', authenticate, requireStaff, async (req, res, next) => {
  try {
    const row = await db('users').where('id', req.user!.id).first('email_signature_html');
    res.json({ html: row?.email_signature_html || '' });
  } catch (error) {
    next(error);
  }
});

router.put('/my-signature', authenticate, requireStaff, async (req, res, next) => {
  try {
    if (typeof req.body?.html !== 'string') {
      throw new AppError('html must be text', 400, 'VALIDATION_ERROR');
    }
    const html = cleanSignature(req.body.html);
    await db('users')
      .where('id', req.user!.id)
      .update({ email_signature_html: html, updated_at: new Date() });
    res.json({ html: html || '' });
  } catch (error) {
    next(error);
  }
});

router.get('/preview', authenticate, requireStaff, async (req, res, next) => {
  try {
    const brand = await BrandingService.forSubscriber(requireTenantId(req.user));
    const kind = String(req.query['kind'] || 'welcome');
    // A signature still being edited previews before it's saved
    const draft = typeof req.query['signature'] === 'string' ? req.query['signature'] : null;
    const me = await db('users').where('id', req.user!.id).first('first_name', 'last_name');
    const signature =
      draft !== null
        ? cleanSignature(draft) || (req.query['mine'] ? brand.signatureHtml : null)
        : await BrandingService.signatureFor(brand, kind === 'reply' ? req.user!.id : null);
    const ticket = { title: 'Generator making a knocking noise' };
    const link = '#';
    const summary = { title: ticket.title, ref: '#1001', status: 'In Progress', link: '#' };

    let content: { subject: string; html: string };
    if (kind === 'reply') {
      const reply = ticketEmails.reply(
        brand,
        summary,
        {
          content:
            'Thanks for the details. A technician can come out Thursday morning to take a look - does that work for you?',
        },
        [me?.first_name, me?.last_name].filter(Boolean).join(' '),
        signature,
        'in_progress'
      );
      content = { subject: `Re: [#1001] ${ticket.title}`, html: reply.html };
    } else if (kind === 'receipt') {
      const receipt = ticketEmails.receipt(
        brand,
        { ...summary, status: 'Open' },
        'Alex',
        signature,
        'open'
      );
      content = { subject: `Re: [#1001] ${ticket.title}`, html: receipt.html };
    } else if (kind === 'update') {
      const update = ticketEmails.update(
        brand,
        { ...summary, status: 'Resolved' },
        { kind: 'status', from: 'in_progress', to: 'resolved' },
        'Alex',
        signature,
        'resolved'
      );
      content = { subject: `Re: [#1001] ${ticket.title}`, html: update.html };
    } else {
      const welcome = accountEmails.welcome(brand, 'Alex', link, signature);
      content = { subject: welcome.subject, html: welcome.html };
    }
    res.json({ ...content, from: `${brand.name}${kind === 'welcome' ? '' : ' Support'}` });
  } catch (error) {
    next(error);
  }
});

export default router;

/** Public: a subscriber's logo, for the emails that show it. */
export const publicBrandingRouter = Router();

publicBrandingRouter.get('/brand-logo/:companyId', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(companyId || '')) {
      res.status(404).end();
      return;
    }
    const profile = await db('company_profiles').where('company_id', companyId).first('logo');
    const image = parseDataUri(profile?.logo);
    if (!image) {
      res.status(404).end();
      return;
    }
    // Mail apps and the preview (another origin) load it
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', image.type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.data);
  } catch (error) {
    next(error);
  }
});

/** Public: a subscriber's favicon, for its portal's browser tab. */
publicBrandingRouter.get('/brand-favicon/:companyId', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(companyId || '')) {
      res.status(404).end();
      return;
    }
    const profile = await db('company_profiles').where('company_id', companyId).first('favicon');
    const image = faviconOf(profile?.favicon);
    if (!image) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', image.type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.data);
  } catch (error) {
    next(error);
  }
});

/** Public: a subscriber's portal background picture. */
publicBrandingRouter.get('/portal-background/:companyId', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(companyId || '')) {
      res.status(404).end();
      return;
    }
    const profile = await db('company_profiles')
      .where('company_id', companyId)
      .first('portal_background');
    const image = portalBackgroundOf(profile?.portal_background);
    if (!image) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', image.type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.data);
  } catch (error) {
    next(error);
  }
});
