import { db } from '@/config/database';

/**
 * A subscriber's name: its customer portal (portal.bomizzel.com/<name>) and
 * its support email. Stored in companies.support_email_slug; names it used
 * before are in subscriber_slug_aliases.
 */

export const PORTAL_NAME_MIN = 3;
export const PORTAL_NAME_MAX = 30;

// Ours, or likely to be mistaken for ours (subdomains, mail, the app)
const RESERVED = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'apps',
  'assets',
  'auth',
  'billing',
  'blog',
  'bomizzel',
  'bsi',
  'cdn',
  'dashboard',
  'dev',
  'docs',
  'email',
  'ftp',
  'help',
  'helpdesk',
  'imap',
  'info',
  'login',
  'mail',
  'mx',
  'noreply',
  'no-reply',
  'ns1',
  'ns2',
  'pop',
  'portal',
  'postmaster',
  'root',
  'security',
  'send',
  'signup',
  'smtp',
  'staging',
  'static',
  'status',
  'support',
  'system',
  'test',
  'webmail',
  'www',
]);

/** Where a subscriber's customers sign in. */
export const portalBaseUrl = (): string =>
  (process.env['PORTAL_URL'] || 'https://portal.bomizzel.com').replace(/\/+$/, '');

export const portalUrl = (name: string): string => `${portalBaseUrl()}/${name}`;

/** Why a name can't be used (format or reserved), or null. Doesn't check who has it. */
export const portalNameProblem = (name: string): string | null => {
  if (name.length < PORTAL_NAME_MIN || name.length > PORTAL_NAME_MAX) {
    return `Use ${PORTAL_NAME_MIN} to ${PORTAL_NAME_MAX} characters.`;
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    return 'Use lowercase letters, numbers and single dashes (not at the start or end).';
  }
  if (RESERVED.has(name)) return 'That name is reserved. Try another.';
  return null;
};

export const normalizePortalName = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

/** "Elena's Jewelry Repair" -> "elenas-jewelry-repair" */
export const portalNameFrom = (value: string): string => {
  const base = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PORTAL_NAME_MAX)
    .replace(/-+$/g, '');
  return base.length >= PORTAL_NAME_MIN ? base : `${base || 'help'}-desk`;
};

/** The subscriber using this name now or before, if any. */
export const portalNameOwner = async (name: string): Promise<string | null> => {
  const company = await db('companies').where('support_email_slug', name).first('id');
  if (company) return company.id;
  const alias = await db('subscriber_slug_aliases').where('slug', name).first('company_id');
  return alias?.company_id || null;
};

/** A free name based on `wanted` (wanted itself, or wanted-2, -3...). */
export const freePortalName = async (wanted: string): Promise<string> => {
  let base = portalNameFrom(wanted);
  if (portalNameProblem(base)) base = `${base.slice(0, PORTAL_NAME_MAX - 5)}-desk`;
  let name = base;
  for (let n = 2; portalNameProblem(name) || (await portalNameOwner(name)); n++) {
    name = `${base.slice(0, PORTAL_NAME_MAX - String(n).length - 1)}-${n}`;
  }
  return name;
};

/** For the sign-up form: can this name be had, and if not, why, and what instead. */
export const checkPortalName = async (
  value: unknown,
  forCompanyId?: string
): Promise<{ name: string; available: boolean; reason?: string; suggestion?: string }> => {
  const name = normalizePortalName(value);
  const problem = portalNameProblem(name);
  if (problem) {
    return { name, available: false, reason: problem, suggestion: await freePortalName(name) };
  }
  const owner = await portalNameOwner(name);
  if (owner && owner !== forCompanyId) {
    return {
      name,
      available: false,
      reason: 'That name is taken.',
      suggestion: await freePortalName(name),
    };
  }
  return { name, available: true };
};

/** The subscriber for a portal link or support address (current name or an old one). */
export const subscriberForPortalName = async (
  value: unknown
): Promise<{ id: string; name: string; slug: string; renamed: boolean } | null> => {
  const name = normalizePortalName(value);
  if (!name || name.length > 64) return null;
  const active = (q: any) =>
    q
      .whereNull('subscriber_id')
      .where((w: any) => w.where('is_active', true).orWhereNull('is_active'));
  let company = await active(db('companies').where('support_email_slug', name)).first(
    'id',
    'name',
    'support_email_slug'
  );
  let renamed = false;
  if (!company) {
    const alias = await db('subscriber_slug_aliases').where('slug', name).first('company_id');
    if (!alias) return null;
    company = await active(db('companies').where('id', alias.company_id)).first(
      'id',
      'name',
      'support_email_slug'
    );
    renamed = true;
  }
  if (!company?.support_email_slug) return null;
  return { id: company.id, name: company.name, slug: company.support_email_slug, renamed };
};

/**
 * Change a subscriber's name. The old one is kept as an alias so its email
 * address and portal link go on working; taking back one of your own old
 * names is fine.
 */
export const renamePortal = async (companyId: string, value: unknown): Promise<string> => {
  const { AppError } = await import('@/middleware/errorHandler');
  const check = await checkPortalName(value, companyId);
  if (!check.available)
    throw new AppError(check.reason || 'That name is taken.', 400, 'PORTAL_NAME');
  const company = await db('companies').where('id', companyId).first('support_email_slug');
  if (!company) throw new AppError('Subscriber not found', 404, 'NOT_FOUND');
  if (company.support_email_slug === check.name) return check.name;
  await db.transaction(async (trx) => {
    await trx('subscriber_slug_aliases').where('slug', check.name).del();
    if (company.support_email_slug) {
      await trx('subscriber_slug_aliases')
        .insert({ slug: company.support_email_slug, company_id: companyId })
        .onConflict('slug')
        .ignore();
    }
    await trx('companies').where('id', companyId).update({ support_email_slug: check.name });
  });
  return check.name;
};
