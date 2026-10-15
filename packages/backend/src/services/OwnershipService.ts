import crypto from 'crypto';
import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { User } from '@/models/User';
import { STAFF_ROLES } from '@/utils/tenant';
import { PlanService } from './PlanService';

/**
 * A subscriber's owner: the one staff member whose membership of the
 * subscriber is user_company_associations.role = 'owner'. The owner is an
 * admin no other admin can demote, switch off or delete, and the only one who
 * can hand ownership to someone else. Platform admins can set the owner from
 * BSI (when an owner leaves).
 */

const ownerRow = (tenantId: string) =>
  db('user_company_associations as a')
    .join('users as u', 'u.id', 'a.user_id')
    .where({ 'a.company_id': tenantId, 'a.role': 'owner' })
    .orderBy('a.created_at', 'asc')
    .first('u.id', 'u.first_name', 'u.last_name', 'u.email', 'u.is_active');

/** The subscriber a staff member belongs to (their own company, not an account). */
const staffTenantOf = async (userId: string): Promise<string | null> => {
  const row = await db('user_company_associations as a')
    .join('companies as c', 'c.id', 'a.company_id')
    .join('users as u', 'u.id', 'a.user_id')
    .where('a.user_id', userId)
    .whereNull('c.subscriber_id')
    .whereIn('u.role', STAFF_ROLES)
    .first('c.id');
  return row?.id || null;
};

export class OwnershipService {
  static async owner(tenantId: string) {
    const o = await ownerRow(tenantId);
    return o
      ? { id: o.id, name: [o.first_name, o.last_name].filter(Boolean).join(' '), email: o.email }
      : null;
  }

  /** Is this user the owner of the subscriber they work for? */
  static async isOwner(userId: string): Promise<boolean> {
    const tenantId = await staffTenantOf(userId);
    if (!tenantId) return false;
    return (await ownerRow(tenantId))?.id === userId;
  }

  /**
   * Refuse changes to the owner by anyone else, and the owner removing
   * themselves (they hand ownership over first). `change` says what's being
   * done: 'edit' with the fields, 'deactivate' or 'delete'.
   */
  static async assertMayChange(
    targetId: string,
    actorId: string,
    change: { kind: 'edit'; role?: string; isActive?: boolean } | { kind: 'deactivate' | 'delete' }
  ): Promise<void> {
    if (!(await this.isOwner(targetId))) return;
    const removing =
      change.kind !== 'edit' ||
      (change.role !== undefined && change.role !== 'admin') ||
      change.isActive === false;
    if (actorId !== targetId) {
      const touchesAccess =
        change.kind !== 'edit' || change.role !== undefined || change.isActive !== undefined;
      if (touchesAccess) {
        throw new AppError(
          "That's the account owner. Only the owner can change their own account, or hand ownership to someone else first.",
          403,
          'OWNER_PROTECTED'
        );
      }
      return;
    }
    if (removing) {
      throw new AppError(
        "You're the account owner. Transfer ownership to someone else first.",
        400,
        'OWNER_MUST_TRANSFER'
      );
    }
  }

  /**
   * Make another staff member the owner (they become an admin). By the
   * current owner, or a platform admin (asPlatformAdmin) from BSI.
   */
  static async transfer(
    tenantId: string,
    newOwnerId: string,
    actorId: string,
    asPlatformAdmin = false
  ) {
    const current = await ownerRow(tenantId);
    if (!asPlatformAdmin && current?.id !== actorId) {
      throw new AppError('Only the account owner can transfer ownership', 403, 'OWNER_ONLY');
    }
    const target = await db('user_company_associations as a')
      .join('users as u', 'u.id', 'a.user_id')
      .where({ 'a.company_id': tenantId, 'a.user_id': newOwnerId })
      .whereIn('u.role', STAFF_ROLES)
      .first('u.id', 'u.is_active', 'u.role');
    if (!target) throw new AppError('Staff member not found', 404, 'NOT_FOUND');
    if (!target.is_active) {
      throw new AppError('Switch them on before making them the owner', 400, 'INACTIVE');
    }
    if (current?.id === newOwnerId) return this.owner(tenantId);

    await db.transaction(async (trx) => {
      await trx('user_company_associations')
        .where({ company_id: tenantId, role: 'owner' })
        .update({ role: 'admin', updated_at: new Date() });
      await trx('user_company_associations')
        .where({ company_id: tenantId, user_id: newOwnerId })
        .update({ role: 'owner', updated_at: new Date() });
      if (target.role !== 'admin') {
        await trx('users')
          .where('id', newOwnerId)
          .update({ role: 'admin', updated_at: new Date() });
      }
    });
    logger.warn('Ownership transferred', {
      tenantId,
      from: current?.id || null,
      to: newOwnerId,
      by: actorId,
      platformAdmin: asPlatformAdmin,
    });
    return this.owner(tenantId);
  }

  /**
   * BSI: add someone new as a subscriber's owner - an admin login they finish
   * setting up from the welcome email - and make them the owner.
   */
  static async addOwner(
    tenantId: string,
    input: { firstName: string; lastName: string; email: string },
    actorId: string
  ) {
    const email = input.email.trim().toLowerCase();
    if (await db('users').whereRaw('lower(email) = ?', [email]).first('id')) {
      throw new AppError('Someone already has a login with that email', 409, 'USER_EXISTS');
    }
    await PlanService.assertCan(tenantId, 'agent');
    const user = await User.createUser({
      email,
      // They choose their own from the welcome email
      password: crypto.randomBytes(24).toString('base64url'),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: 'admin',
      emailVerified: false,
    });
    await db('users').where('id', user.id).update({ current_org_id: tenantId });
    await db('user_company_associations').insert({
      user_id: user.id,
      company_id: tenantId,
      role: 'member',
    });
    const { OrgBillingService } = await import('./OrgBillingService');
    await OrgBillingService.syncSeats(tenantId);
    await this.transfer(tenantId, user.id, actorId, true);
    return user.id as string;
  }

  /** Staff of a subscriber, for picking a new owner. */
  static async staff(tenantId: string) {
    const rows = await db('user_company_associations as a')
      .join('users as u', 'u.id', 'a.user_id')
      .where('a.company_id', tenantId)
      .whereIn('u.role', STAFF_ROLES)
      .orderBy([{ column: 'u.first_name' }, { column: 'u.last_name' }])
      .select(
        'u.id',
        'u.first_name',
        'u.last_name',
        'u.email',
        'u.role',
        'u.is_active',
        'a.role as membership'
      );
    return rows.map((r: any) => ({
      id: r.id,
      name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      email: r.email,
      role: r.role,
      isActive: r.is_active,
      isOwner: r.membership === 'owner',
    }));
  }
}
