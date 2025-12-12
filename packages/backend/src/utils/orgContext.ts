import { db } from '@/config/database';

/**
 * Get the organization ID for the current user
 * Falls back to company_id if no org is set
 */
export async function getUserOrgId(userId: string): Promise<string> {
  // Get user's current org
  const user = await db('users').where('id', userId).first();
  let orgId = user?.current_org_id;

  // If no org is set, try to get the first organization for this user
  if (!orgId) {
    const userOrg = await db('user_organization_associations').where('user_id', userId).first();

    if (userOrg) {
      orgId = userOrg.org_id;
      // Update user's current_org_id for next time
      await db('users').where('id', userId).update({ current_org_id: orgId });
    } else {
      // Fallback: use company_id as org_id
      const userCompany = await db('user_company_associations').where('user_id', userId).first();

      if (userCompany) {
        orgId = userCompany.company_id;
      }
    }
  }

  if (!orgId) {
    throw new Error('User has no organization context');
  }

  return orgId;
}

/**
 * Get both company_id and org_id for the current user
 */
export async function getUserCompanyAndOrg(
  userId: string
): Promise<{ companyId: string; orgId: string }> {
  const userCompany = await db('user_company_associations').where('user_id', userId).first();

  if (!userCompany) {
    throw new Error('User not associated with any company');
  }

  const orgId = await getUserOrgId(userId);

  return {
    companyId: userCompany.company_id,
    orgId,
  };
}
