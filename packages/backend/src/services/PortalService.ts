import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { User } from '@/models/User';
import { CryptoUtils } from '@/utils/crypto';
import { subscriberForPortalName } from '@/utils/portalName';
import { BrandingService, portalIconUrl } from './BrandingService';
import { AccountEmailService } from './AccountEmailService';
import { PortalAccessService } from './PortalAccessService';
import { PlanService } from './PlanService';
import { TicketService } from './TicketService';
import { PERSONAL_DOMAINS } from './InboundEmailService';

/**
 * The customer portal (portal.bomizzel.com/<name>): a subscriber's customers
 * sign up, sign in, and work their tickets there. Staff work in the app.
 */

const notFound = () => new AppError('Portal not found', 404, 'PORTAL_NOT_FOUND');

export const subscriberOrThrow = async (slug: string) => {
  const s = await subscriberForPortalName(slug);
  if (!s) throw notFound();
  return s;
};

export class PortalService {
  /** What the portal shows before sign-in: name, logo, colours. Public. */
  static async info(slug: string) {
    const s = await subscriberOrThrow(slug);
    const [brand, profile] = await Promise.all([
      BrandingService.forSubscriber(s.id),
      db('company_profiles').where('company_id', s.id).first('logo', 'favicon', 'updated_at'),
    ]);
    return {
      portalName: s.slug,
      // An old name: the portal should move to the current one
      renamed: s.renamed,
      name: brand.name,
      tagline: brand.tagline,
      website: brand.website,
      color: brand.color,
      logoUrl: brand.logoUrl,
      // For the browser tab
      iconUrl: portalIconUrl(s.id, profile),
    };
  }

  /**
   * Sign up on a portal. They're placed in the subscriber's account for their
   * email's domain (or a new one with the company name they gave), see only
   * their own tickets, and ask for their company's - the admins are emailed
   * once the address is confirmed.
   */
  static async signUp(
    slug: string,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      companyName?: string;
    }
  ) {
    const s = await subscriberOrThrow(slug);
    const email = input.email.trim().toLowerCase();
    if (await db('users').whereRaw('lower(email) = ?', [email]).first('id')) {
      throw new AppError(
        'There is already an account for this email. Sign in, or use "Forgot password" to set a password.',
        409,
        'ACCOUNT_EXISTS'
      );
    }

    const user = await User.createUser({
      email,
      password: input.password,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: 'customer',
      emailVerified: false,
    });
    await db('users').where('id', user.id).update({ current_org_id: s.id, portal_scope: 'own' });

    const companyName = (input.companyName || '').trim().slice(0, 150);
    const domain = email.split('@')[1] || '';
    let companyId: string | undefined;
    if (domain && !PERSONAL_DOMAINS.has(domain)) {
      const existing = await db('companies')
        .where('subscriber_id', s.id)
        .whereRaw('lower(domain) = ?', [domain])
        .first('id');
      companyId = existing?.id;
    }
    if (!companyId) {
      const personal = PERSONAL_DOMAINS.has(domain);
      const [created] = await db('companies')
        .insert({
          name: (companyName || `${input.firstName} ${input.lastName} (${email})`).slice(0, 255),
          domain: personal ? null : domain || null,
          subscriber_id: s.id,
          description: 'Created from portal sign-up',
        })
        .returning('id');
      companyId = (created.id ?? created) as string;
    }
    await db('user_company_associations').insert({
      user_id: user.id,
      company_id: companyId,
      role: 'member',
    });
    await PortalAccessService.request(s.id, user.id, companyId, companyName || null);

    const { token, expiresAt } = CryptoUtils.generateEmailVerificationToken();
    await User.setEmailVerificationToken(user.id, token, expiresAt);
    await AccountEmailService.sendVerification(
      { email, first_name: user.first_name },
      token,
      await BrandingService.forSubscriber(s.id)
    );
    return { userId: user.id };
  }

  /**
   * Signed in on this portal: the person must be a contact of this
   * subscriber. Makes it their current subscriber (a contact can belong to
   * several) and says what they can see.
   */
  static async session(slug: string, userId: string) {
    const s = await subscriberOrThrow(slug);
    const user = await db('users')
      .where('id', userId)
      .first('id', 'role', 'portal_scope', 'first_name', 'last_name', 'email');
    const accounts = await db('user_company_associations as a')
      .join('companies as c', 'c.id', 'a.company_id')
      .where('a.user_id', userId)
      .where('c.subscriber_id', s.id)
      .select('c.id', 'c.name');
    if (!user || user.role !== 'customer' || !accounts.length) {
      throw new AppError(
        "This account isn't a customer account for this portal.",
        403,
        'NOT_A_PORTAL_CONTACT'
      );
    }
    await db('users').where('id', userId).update({ current_org_id: s.id });
    const request = await db('portal_access_requests')
      .where({ org_id: s.id, user_id: userId })
      .orderBy('created_at', 'desc')
      .first('status', 'created_at');
    return {
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      },
      account: accounts[0],
      // 'company': all of their company's tickets; 'own': only theirs
      scope: user.portal_scope === 'company' ? 'company' : 'own',
      accessRequest: request ? { status: request.status, createdAt: request.created_at } : null,
    };
  }

  /** Ask (again) to see their company's tickets. */
  static async requestAccess(slug: string, userId: string) {
    const { s, account } = await this.contactIn(slug, userId);
    const id = await PortalAccessService.request(s.id, userId, account, null);
    await PortalAccessService.notifyAdmins(userId);
    return { requested: !!id };
  }

  /** Departments a customer can pick for a new ticket. */
  static async departments(slug: string, userId: string) {
    const { s } = await this.contactIn(slug, userId);
    const rows = await db('departments')
      .where((q) => q.where('org_id', s.id).orWhere('company_id', s.id))
      .where((q) => q.where('is_active', true).orWhereNull('is_active'))
      .where((q) => q.where('display_in_help_center', true).orWhereNull('display_in_help_center'))
      .orderBy([{ column: 'is_default', order: 'desc' }, { column: 'name' }])
      .select('id', 'name', 'display_name', 'is_default');
    return rows.map((d: any) => ({
      id: d.id,
      name: d.display_name || d.name,
      isDefault: !!d.is_default,
    }));
  }

  /** A new ticket from the portal: in their account, the subscriber's first team. */
  static async createTicket(
    slug: string,
    userId: string,
    input: { title: string; description: string; departmentId?: number | null }
  ) {
    const { s, account } = await this.contactIn(slug, userId);
    await PlanService.assertCan(s.id, 'ticket');
    const team = await db('teams')
      .where('org_id', s.id)
      .where((q) => q.where('is_active', true).orWhereNull('is_active'))
      .orderBy('created_at', 'asc')
      .first('id');
    if (!team) throw new AppError("This help desk isn't taking tickets yet.", 409, 'NO_TEAM');
    return TicketService.createTicket(
      {
        title: input.title,
        description: input.description,
        companyId: account,
        teamId: team.id,
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      } as any,
      userId
    );
  }

  /** Close a ticket they opened (right away: resolution "fixed"). */
  static async closeTicket(slug: string, userId: string, ticketId: string) {
    const { s } = await this.contactIn(slug, userId);
    const ticket = await db('tickets')
      .where({ id: ticketId, org_id: s.id })
      .first('submitter_id', 'status');
    if (!ticket) throw new AppError('Ticket not found', 404, 'NOT_FOUND');
    if (ticket.submitter_id !== userId) {
      throw new AppError('Only the person who opened a ticket can close it', 403, 'NOT_SUBMITTER');
    }
    if (ticket.status === 'closed') return TicketService.getTicket(ticketId, userId, 'customer');
    return TicketService.updateTicketStatus(ticketId, 'closed', userId, 'customer', 'fixed');
  }

  private static async contactIn(slug: string, userId: string) {
    const s = await subscriberOrThrow(slug);
    const account = await db('user_company_associations as a')
      .join('companies as c', 'c.id', 'a.company_id')
      .join('users as u', 'u.id', 'a.user_id')
      .where({ 'a.user_id': userId, 'c.subscriber_id': s.id, 'u.role': 'customer' })
      .orderBy('a.created_at', 'asc')
      .first('c.id');
    if (!account) {
      throw new AppError(
        "This account isn't a customer account for this portal.",
        403,
        'NOT_A_PORTAL_CONTACT'
      );
    }
    // Their tickets on this portal are this subscriber's
    await db('users')
      .where('id', userId)
      .where((q) => q.whereNull('current_org_id').orWhereNot('current_org_id', s.id))
      .update({ current_org_id: s.id });
    return { s, account: account.id as string };
  }
}
