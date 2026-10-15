import { AsyncLocalStorage } from 'async_hooks';
import { db } from '@/config/database';
import { STAFF_ROLES } from '@/utils/tenant';

/**
 * Which subscriber a sign-in is for, and the person's role there.
 *
 * One login can be staff of one subscriber and a contact (customer) of any
 * number of others - Gleason's owner is also a customer in Bomizzel's help
 * desk. So the role isn't users.role alone: it depends on the subscriber the
 * session is for.
 *
 * - Staff of tenant T: an association with T's own company, and a staff
 *   users.role. Their role there is users.role.
 * - Contact of tenant T: an association with one of T's accounts
 *   (companies.subscriber_id = T). Their role there is 'customer'.
 *
 * The tenant is chosen at sign-in (the company's /<name>/login or its
 * help.bomizzel.com/<name> portal) and carried in the token, so one person's
 * staff and customer sessions don't disturb each other. users.current_org_id
 * only picks one for old tokens and sign-ins that don't name a company.
 */

export type Audience = 'staff' | 'portal';

export interface Session {
  userId: string;
  tenantId?: string;
  role: string;
  /** The person's companies in this tenant: its own company (staff) or their accounts */
  companies: string[];
  /** A contact not approved for their company's tickets: only their own */
  ownTicketsOnly: boolean;
}

interface Membership {
  companyId: string;
  subscriberId: string | null;
}

const memberships = async (userId: string): Promise<Membership[]> =>
  db('user_company_associations as a')
    .join('companies as c', 'c.id', 'a.company_id')
    .where('a.user_id', userId)
    .orderBy('a.created_at', 'asc')
    .select('a.company_id as companyId', 'c.subscriber_id as subscriberId');

/** The tenants a person is staff of, and the ones they are a contact of. */
const tenantsOf = (user: { role: string }, rows: Membership[]) => {
  const staffRole = STAFF_ROLES.includes(user.role);
  const staff = new Set<string>();
  const contact = new Set<string>();
  for (const r of rows) {
    if (r.subscriberId) contact.add(r.subscriberId);
    else if (staffRole) staff.add(r.companyId);
    // A non-staff login on a subscriber's own company: treat as its contact
    else contact.add(r.companyId);
  }
  return { staff, contact };
};

/**
 * The session for a user in a tenant, or null when they have no place there
 * (or not the kind the audience asks for). Without a tenant: their staff
 * tenant, else current_org_id when it's one of theirs, else their first.
 */
export const resolveSession = async (
  user: { id: string; role: string; current_org_id?: string | null; portal_scope?: string | null },
  tenantId?: string | null,
  audience?: Audience
): Promise<Session | null> => {
  const rows = await memberships(user.id);
  const { staff, contact } = tenantsOf(user, rows);

  let tid = tenantId || undefined;
  if (!tid) {
    const preferred = user.current_org_id || undefined;
    if (audience === 'portal') {
      tid = preferred && contact.has(preferred) ? preferred : [...contact][0];
    } else if (audience === 'staff') {
      tid = [...staff][0];
    } else {
      tid =
        preferred && (staff.has(preferred) || contact.has(preferred))
          ? preferred
          : [...staff][0] || [...contact][0];
    }
    if (!tid) {
      // Belongs to no subscriber at all: no tenant data, as before
      if (audience) return null;
      return { userId: user.id, role: user.role, companies: [], ownTicketsOnly: false };
    }
  }

  const asStaff = audience !== 'portal' && staff.has(tid);
  const asContact = !asStaff && audience !== 'staff' && contact.has(tid);
  if (!asStaff && !asContact) return null;

  const companies = rows
    .filter((r) =>
      asStaff ? r.companyId === tid && !r.subscriberId : (r.subscriberId || r.companyId) === tid
    )
    .map((r) => r.companyId);
  const role = asStaff ? user.role : 'customer';
  return {
    userId: user.id,
    tenantId: tid,
    role,
    companies,
    ownTicketsOnly: role === 'customer' && user.portal_scope !== 'company',
  };
};

/** The signed-in request's session, for services handed only a user id. */
export const sessionStore = new AsyncLocalStorage<Session>();

/** The current request's session if it is this user's. */
export const currentSessionFor = (userId: string): Session | undefined => {
  const s = sessionStore.getStore();
  return s && s.userId === userId ? s : undefined;
};

/**
 * The role to act on for a user row a service loaded: the session's role when
 * it's the signed-in user, else their stored role.
 */
export const roleOf = (
  user: { id: string; role: string } | null | undefined
): string | undefined => (user ? (currentSessionFor(user.id)?.role ?? user.role) : undefined);
