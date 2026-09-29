import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';

/**
 * Tenant isolation helpers.
 *
 * Bomizzel works like Zoho Desk: a SUBSCRIBER (the tenant - a company that
 * signed up) has staff, ACCOUNTS (its customers' companies,
 * companies.subscriber_id = the subscriber) and CONTACTS (users.role
 * 'customer', members of an account).
 *
 * - Staff see only their own subscriber's data.
 * - Contacts see only tickets of the account(s) they belong to - their own and
 *   their co-workers' - and nothing of other accounts.
 *
 * req.user.tenantId is worked out in `authenticate`. Anything that is not
 * found in the caller's tenant is reported as 404, so ids from other tenants
 * can't be probed.
 */

type TenantUser = {
  id: string;
  role: string;
  tenantId?: string;
  companies?: string[];
};

export const STAFF_ROLES = ['admin', 'employee', 'team_lead'];

export const isStaff = (user?: { role?: string }): boolean =>
  !!user?.role && STAFF_ROLES.includes(user.role);

/** The caller's tenant, or a 403 when they belong to none. */
export const requireTenantId = (user?: TenantUser): string => {
  if (!user?.tenantId) {
    throw new AppError('No subscriber account for this user', 403, 'NO_TENANT');
  }
  return user.tenantId;
};

/** Express middleware: staff of some tenant only. */
export const requireStaff = (req: any, _res: any, next: (err?: unknown) => void): void => {
  if (!req.user) return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
  if (!isStaff(req.user)) return next(new AppError('Insufficient permissions', 403, 'STAFF_ONLY'));
  if (!req.user.tenantId) return next(new AppError('No subscriber account for this user', 403, 'NO_TENANT'));
  next();
};

const notFound = (what: string): AppError =>
  new AppError(`${what} not found`, 404, `${what.toUpperCase().replace(/ /g, '_')}_NOT_FOUND`);

/**
 * Can this user see this ticket? Staff: it's in their tenant. Contacts: it's
 * in their tenant and belongs to one of their accounts.
 */
export const canAccessTicket = (
  user: TenantUser | undefined,
  ticket: { org_id?: string | null; company_id?: string | null }
): boolean => {
  if (!user?.tenantId || !ticket || ticket.org_id !== user.tenantId) return false;
  if (isStaff(user)) return true;
  return !!ticket.company_id && (user.companies || []).includes(ticket.company_id);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Load a ticket the user may see, or throw 404 (400 for a malformed id). */
export const getTicketInTenant = async (user: TenantUser | undefined, ticketId: string) => {
  if (!UUID.test(String(ticketId))) {
    throw new AppError('Invalid ticket ID', 400, 'VALIDATION_ERROR');
  }
  const ticket = await db('tickets').where('id', ticketId).first();
  if (!ticket || !canAccessTicket(user, ticket)) throw notFound('Ticket');
  return ticket;
};

/** True when the company is the tenant itself or one of its accounts. */
export const isCompanyInTenant = async (companyId: string, tenantId: string): Promise<boolean> => {
  if (!companyId || !tenantId) return false;
  if (companyId === tenantId) return true;
  const row = await db('companies').where({ id: companyId, subscriber_id: tenantId }).first('id');
  return !!row;
};

export const assertCompanyInTenant = async (companyId: string, tenantId: string): Promise<void> => {
  if (!(await isCompanyInTenant(companyId, tenantId))) throw notFound('Company');
};

/**
 * Company ids a tenant owns: the subscriber itself plus all its accounts. Use
 * as a subquery: .whereIn('company_id', tenantCompanyIds(tenantId)).
 */
export const tenantCompanyIds = (tenantId: string) =>
  db('companies')
    .select('id')
    .where('id', tenantId)
    .orWhere('subscriber_id', tenantId);

/**
 * User ids in a tenant: members of the subscriber (staff) or of any of its
 * accounts (contacts). Use as a subquery.
 */
export const tenantUserIds = (tenantId: string) =>
  db('user_company_associations')
    .select('user_id')
    .whereIn('company_id', tenantCompanyIds(tenantId));

export const isUserInTenant = async (userId: string, tenantId: string): Promise<boolean> => {
  if (!userId || !tenantId) return false;
  const row = await db('user_company_associations')
    .where('user_id', userId)
    .whereIn('company_id', tenantCompanyIds(tenantId))
    .first('user_id');
  return !!row;
};

export const assertUserInTenant = async (userId: string, tenantId: string): Promise<void> => {
  if (!(await isUserInTenant(userId, tenantId))) throw notFound('User');
};

export const assertTeamInTenant = async (teamId: string, tenantId: string): Promise<void> => {
  const row = teamId && tenantId && (await db('teams').where({ id: teamId, org_id: tenantId }).first('id'));
  if (!row) throw notFound('Team');
};

export const assertQueueInTenant = async (queueId: string, tenantId: string): Promise<void> => {
  const row = queueId && tenantId && (await db('queues').where({ id: queueId, org_id: tenantId }).first('id'));
  if (!row) throw notFound('Queue');
};
