import { db } from '@/config/database';

/**
 * Support addresses. Each subscriber (tenant) has one:
 *   <slug>@<INBOUND_DOMAIN>              new tickets
 *   <slug>+<ticket token>@<INBOUND_DOMAIN>  replies on one ticket
 *
 * The ticket token is the first 12 hex digits of the ticket id - short enough
 * to keep the address under the 64-character limit for the part before @,
 * and it is only ever trusted together with the sender being allowed on that
 * ticket (see InboundEmailService).
 */

export const inboundDomain = (): string =>
  (process.env['INBOUND_EMAIL_DOMAIN'] || 'support.bomizzel.com').toLowerCase();

export const ticketToken = (ticketId: string): string => ticketId.replace(/-/g, '').slice(0, 12);

export const supportAddress = (slug: string, ticketId?: string): string =>
  `${slug}${ticketId ? `+${ticketToken(ticketId)}` : ''}@${inboundDomain()}`;

/** "Jane Doe <Jane@Acme.com>" -> { name: 'Jane Doe', email: 'jane@acme.com' } */
export const parseMailbox = (value: string): { name: string; email: string } | null => {
  if (!value) return null;
  const angle = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (angle ? angle[2] : value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { name: angle ? angle[1].trim() : '', email };
};

/** For an address at the inbound domain: the subscriber slug and ticket token. */
export const parseSupportAddress = (value: string): { slug: string; token?: string } | null => {
  const mailbox = parseMailbox(value);
  if (!mailbox) return null;
  const [local, domain] = mailbox.email.split('@');
  if (domain !== inboundDomain() || !local) return null;
  const [slug, token] = local.split('+');
  if (!slug) return null;
  return { slug, token: token && /^[0-9a-f]{12}$/.test(token) ? token : undefined };
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'support';

/**
 * Give a subscriber its support address if it has none yet (new sign-ups and
 * provisioned customers). Returns the slug.
 */
export const ensureSupportSlug = async (companyId: string): Promise<string> => {
  const company = await db('companies')
    .where('id', companyId)
    .first('name', 'domain', 'support_email_slug');
  if (!company) throw new Error(`Company ${companyId} not found`);
  if (company.support_email_slug) return company.support_email_slug;

  const base = slugify((company.domain || '').split('.')[0] || company.name || 'support');
  let slug = base;
  for (let n = 2; await db('companies').where('support_email_slug', slug).first('id'); n++) {
    slug = `${base}-${n}`;
  }
  await db('companies').where('id', companyId).update({ support_email_slug: slug });
  return slug;
};
