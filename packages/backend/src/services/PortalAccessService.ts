import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { EmailService } from './EmailService';
import { BOMIZZEL_BRAND, brandedLayout, button, escapeHtml } from '@/utils/brandedEmail';
import { isCompanyInTenant } from '@/utils/tenant';

/**
 * Asking to see your company's tickets on the portal. Someone who signs up
 * (or emailed in) sees only their own tickets until one of the subscriber's
 * admins approves them - from the email every admin gets (Approve / Deny),
 * or from the contact in the app.
 */

const SECRET = process.env['JWT_SECRET'] || 'your-super-secret-jwt-key';
const DECISION_DAYS = 14;

const frontendUrl = (): string =>
  (process.env['FRONTEND_URL'] || 'https://www.bomizzel.com').replace(/\/+$/, '');

type Decision = 'approve' | 'deny';

/** A link for one admin to decide one request, good for DECISION_DAYS. */
export const decisionToken = (requestId: string, adminId: string): string =>
  jwt.sign({ typ: 'portal_access', rid: requestId, aid: adminId }, SECRET, {
    expiresIn: `${DECISION_DAYS}d`,
  });

const readToken = (token: string): { rid: string; aid: string } => {
  try {
    const p = jwt.verify(String(token || ''), SECRET) as any;
    if (p?.typ !== 'portal_access' || !p.rid || !p.aid) throw new Error('wrong token');
    return { rid: p.rid, aid: p.aid };
  } catch {
    throw new AppError('This link has expired or is not valid', 400, 'INVALID_TOKEN');
  }
};

/** The subscriber's admins (owner/admin staff), who decide. */
const tenantAdmins = (tenantId: string) =>
  db('users as u')
    .join('user_company_associations as a', 'a.user_id', 'u.id')
    .where('a.company_id', tenantId)
    .where('u.role', 'admin')
    .where('u.is_active', true)
    .distinct('u.id', 'u.email', 'u.first_name');

const describe = async (requestId: string) => {
  const row = await db('portal_access_requests as r')
    .join('users as u', 'u.id', 'r.user_id')
    .leftJoin('companies as c', 'c.id', 'r.company_id')
    .join('companies as s', 's.id', 'r.org_id')
    .where('r.id', requestId)
    .first(
      'r.*',
      'u.email',
      'u.first_name',
      'u.last_name',
      'u.portal_scope',
      'c.name as account_name',
      's.name as subscriber_name'
    );
  return row || null;
};

const view = (r: any) => ({
  id: r.id,
  status: r.status,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
  companyName: r.company_name,
  account: r.company_id ? { id: r.company_id, name: r.account_name } : null,
  contact: {
    id: r.user_id,
    email: r.email,
    name: [r.first_name, r.last_name].filter(Boolean).join(' '),
  },
  subscriberName: r.subscriber_name,
});

export class PortalAccessService {
  /** Ask for access (once at a time per person and subscriber). */
  static async request(
    tenantId: string,
    userId: string,
    companyId: string | null,
    companyName?: string | null
  ) {
    const user = await db('users').where('id', userId).first('portal_scope', 'role');
    if (!user || user.role !== 'customer')
      throw new AppError('Contacts only', 403, 'CONTACTS_ONLY');
    if (user.portal_scope === 'company') return null; // already has it
    const pending = await db('portal_access_requests')
      .where({ org_id: tenantId, user_id: userId, status: 'pending' })
      .first('id');
    if (pending) return pending.id as string;
    const id = crypto.randomUUID();
    await db('portal_access_requests').insert({
      id,
      org_id: tenantId,
      user_id: userId,
      company_id: companyId,
      company_name: companyName ? String(companyName).slice(0, 150) : null,
    });
    return id;
  }

  /**
   * Tell the subscriber's admins about requests from someone whose email is
   * now confirmed (sign-up waits for that, so nobody is emailed about an
   * address that may not be real).
   */
  static async notifyAdmins(userId: string): Promise<number> {
    const user = await db('users').where('id', userId).first('email_verified');
    if (!user?.email_verified) return 0;
    const requests = await db('portal_access_requests')
      .where({ user_id: userId, status: 'pending' })
      .whereNull('admins_notified_at')
      .select('id', 'org_id');
    let sent = 0;
    for (const r of requests) {
      const details = await describe(r.id);
      const admins = await tenantAdmins(r.org_id);
      for (const admin of admins) {
        if (await this.sendDecisionEmail(details, admin)) sent++;
      }
      await db('portal_access_requests')
        .where('id', r.id)
        .update({ admins_notified_at: new Date() });
    }
    return sent;
  }

  private static async sendDecisionEmail(r: any, admin: any): Promise<boolean> {
    if (!EmailService.isInitialized()) return false;
    const token = decisionToken(r.id, admin.id);
    const link = (d: Decision) =>
      `${frontendUrl()}/portal-access?token=${encodeURIComponent(token)}&decision=${d}`;
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email;
    const company = r.account_name || r.company_name || 'their company';
    const html = brandedLayout(
      BOMIZZEL_BRAND,
      `<h1 style="margin:0 0 16px;font-size:20px;">Portal access request</h1>
<p style="margin:0 0 14px;line-height:1.55;">Hi ${escapeHtml(admin.first_name || '')},</p>
<p style="margin:0 0 14px;line-height:1.55;"><strong>${escapeHtml(name)}</strong> (${escapeHtml(r.email)}) signed up on ${escapeHtml(r.subscriber_name)}'s customer portal and is asking to see <strong>${escapeHtml(company)}</strong>'s tickets.</p>
<p style="margin:0 0 14px;line-height:1.55;">Until someone approves, they only see the tickets they opened themselves. Any admin can decide; the first decision counts.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px;">${button({ ...BOMIZZEL_BRAND, color: '#15803d' }, 'Approve', link('approve'))}</td>
<td>${button({ ...BOMIZZEL_BRAND, color: '#b91c1c' }, 'Deny', link('deny'))}</td>
</tr></table>
<p style="margin:0;font-size:13px;color:#6b7280;">You can also open the contact in Bomizzel and click "Allow portal access". These buttons work for ${DECISION_DAYS} days.</p>`,
      { preheader: `${name} is asking to see ${company}'s tickets.` }
    );
    const text = `${name} (${r.email}) signed up on ${r.subscriber_name}'s customer portal and is asking to see ${company}'s tickets.\n\nApprove: ${link('approve')}\nDeny: ${link('deny')}\n\nUntil someone approves, they only see the tickets they opened themselves.`;
    try {
      await EmailService.send({
        to: [admin.email],
        subject: `${name} is asking for portal access`,
        html,
        text,
        headers: { 'X-Notification-Type': 'portal_access_request' },
      });
      return true;
    } catch (error) {
      logger.error('Portal access email failed', {
        requestId: r.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /** Requests for a subscriber (pending first), for the app. */
  static async list(tenantId: string, status = 'pending') {
    const rows = await db('portal_access_requests as r')
      .join('users as u', 'u.id', 'r.user_id')
      .leftJoin('companies as c', 'c.id', 'r.company_id')
      .join('companies as s', 's.id', 'r.org_id')
      .where('r.org_id', tenantId)
      .modify((q) => {
        if (status !== 'all') q.where('r.status', status);
      })
      .orderBy('r.created_at', 'desc')
      .limit(200)
      .select(
        'r.*',
        'u.email',
        'u.first_name',
        'u.last_name',
        'c.name as account_name',
        's.name as subscriber_name'
      );
    return rows.map(view);
  }

  /** What the link in the email shows before the admin decides. */
  static async preview(token: string) {
    const { rid, aid } = readToken(token);
    const r = await describe(rid);
    const admin = await db('users').where('id', aid).first('first_name', 'role');
    if (!r || !admin) throw new AppError('This request no longer exists', 404, 'NOT_FOUND');
    return { ...view(r), adminName: admin.first_name };
  }

  /** Decide from the email link (no sign-in: the link is the admin's). */
  static async decideByToken(token: string, decision: Decision) {
    const { rid, aid } = readToken(token);
    const r = await db('portal_access_requests').where('id', rid).first('org_id');
    if (!r) throw new AppError('This request no longer exists', 404, 'NOT_FOUND');
    return this.decide(r.org_id, rid, decision, aid);
  }

  /**
   * Approve (they see their company's tickets) or deny (they keep seeing only
   * their own). Only an admin of the request's subscriber; the first decision
   * stands. Approving can move them to another of the subscriber's accounts.
   */
  static async decide(
    tenantId: string,
    requestId: string,
    decision: Decision,
    adminId: string,
    companyId?: string | null
  ) {
    const admin = await db('users as u')
      .join('user_company_associations as a', 'a.user_id', 'u.id')
      .where({ 'u.id': adminId, 'a.company_id': tenantId, 'u.role': 'admin', 'u.is_active': true })
      .first('u.id');
    if (!admin) throw new AppError('Only an admin of this company can decide', 403, 'ADMIN_ONLY');
    const r = await db('portal_access_requests').where({ id: requestId, org_id: tenantId }).first();
    if (!r) throw new AppError('Request not found', 404, 'NOT_FOUND');
    if (r.status !== 'pending') {
      const decided = await describe(requestId);
      return { ...view(decided), alreadyDecided: true };
    }
    if (decision === 'approve') {
      await this.grant(tenantId, r.user_id, companyId || r.company_id, adminId);
    }
    await db('portal_access_requests')
      .where('id', requestId)
      .update({
        status: decision === 'approve' ? 'approved' : 'denied',
        decided_by: adminId,
        decided_at: new Date(),
        updated_at: new Date(),
        ...(decision === 'approve' && companyId ? { company_id: companyId } : {}),
      });
    logger.info('Portal access decided', { requestId, decision, adminId });
    return { ...view(await describe(requestId)), alreadyDecided: false };
  }

  /**
   * Let a contact see their company's tickets (the in-app "Allow portal
   * access"), optionally moving them to another account of the subscriber.
   * Any pending request of theirs is approved with it.
   */
  static async grant(tenantId: string, userId: string, companyId: string | null, adminId: string) {
    const user = await db('users').where('id', userId).first('role');
    if (!user || user.role !== 'customer')
      throw new AppError('Contact not found', 404, 'NOT_FOUND');
    const accounts = db('companies').select('id').where('subscriber_id', tenantId);
    const current = await db('user_company_associations')
      .where('user_id', userId)
      .whereIn('company_id', accounts)
      .select('company_id');
    if (!current.length && !companyId) throw new AppError('Contact not found', 404, 'NOT_FOUND');
    if (companyId && !current.some((c: any) => c.company_id === companyId)) {
      if (companyId === tenantId || !(await isCompanyInTenant(companyId, tenantId))) {
        throw new AppError('Account not found', 404, 'NOT_FOUND');
      }
      // Moved to the chosen account (from the one they were placed in)
      await db.transaction(async (trx) => {
        await trx('user_company_associations')
          .where('user_id', userId)
          .whereIn('company_id', accounts)
          .del();
        await trx('user_company_associations').insert({
          user_id: userId,
          company_id: companyId,
          role: 'member',
        });
        await trx('tickets')
          .where({ submitter_id: userId, org_id: tenantId })
          .update({ company_id: companyId });
      });
    }
    await db('users')
      .where('id', userId)
      .update({ portal_scope: 'company', updated_at: new Date() });
    await db('portal_access_requests')
      .where({ org_id: tenantId, user_id: userId, status: 'pending' })
      .update({
        status: 'approved',
        decided_by: adminId,
        decided_at: new Date(),
        updated_at: new Date(),
      });
  }

  /** A contact's access and any request waiting, for their profile. */
  static async forContact(tenantId: string, userId: string) {
    const accounts = db('companies').select('id').where('subscriber_id', tenantId);
    const member = await db('user_company_associations as a')
      .join('users as u', 'u.id', 'a.user_id')
      .where('a.user_id', userId)
      .where('u.role', 'customer')
      .whereIn('a.company_id', accounts)
      .first('u.portal_scope');
    if (!member) throw new AppError('Contact not found', 404, 'NOT_FOUND');
    const pending = await db('portal_access_requests as r')
      .join('users as u', 'u.id', 'r.user_id')
      .leftJoin('companies as c', 'c.id', 'r.company_id')
      .join('companies as s', 's.id', 'r.org_id')
      .where({ 'r.org_id': tenantId, 'r.user_id': userId, 'r.status': 'pending' })
      .first(
        'r.*',
        'u.email',
        'u.first_name',
        'u.last_name',
        'c.name as account_name',
        's.name as subscriber_name'
      );
    return {
      scope: member.portal_scope === 'company' ? 'company' : 'own',
      pendingRequest: pending ? view(pending) : null,
    };
  }

  /** Back to only their own tickets. */
  static async revoke(tenantId: string, userId: string) {
    const accounts = db('companies').select('id').where('subscriber_id', tenantId);
    const member = await db('user_company_associations')
      .where('user_id', userId)
      .whereIn('company_id', accounts)
      .first('company_id');
    if (!member) throw new AppError('Contact not found', 404, 'NOT_FOUND');
    await db('users')
      .where({ id: userId, role: 'customer' })
      .update({ portal_scope: 'own', updated_at: new Date() });
  }
}
