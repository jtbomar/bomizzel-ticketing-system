import { db } from '@/config/database';
import { tenantContextFor } from '@/utils/tenant';
import { sanitizeNoteHtml } from '@/utils/richText';
import { Brand, BOMIZZEL_BRAND, safeColor } from '@/utils/brandedEmail';

/**
 * A subscriber's brand for the email its customers get: the Rebranding page's
 * name, logo, colour, tagline and website (company_profiles), its signature,
 * and its support address.
 */

// Logos uploaded on the Rebranding page are stored as data: URIs, which mail
// apps won't show, so emails link to them here instead.
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export const parseDataUri = (value: unknown): { type: string; data: Buffer } | null => {
  const m = String(value || '').match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m || !LOGO_TYPES.includes(m[1]!.toLowerCase())) return null;
  return { type: m[1]!.toLowerCase(), data: Buffer.from(m[2]!, 'base64') };
};

/** Where mail apps can fetch from the API (the backend's public address). */
export const publicApiUrl = (): string => {
  const explicit = process.env['PUBLIC_API_URL'];
  if (explicit) return explicit.replace(/\/+$/, '');
  const railway = process.env['RAILWAY_PUBLIC_DOMAIN'];
  if (railway) return `https://${railway}`;
  return `http://localhost:${process.env['PORT'] || 3001}`;
};

const logoUrlFor = (companyId: string, profile: any): string | null => {
  const logo = String(profile?.logo || '').trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(logo)) return logo;
  if (!parseDataUri(logo)) return null;
  const version = profile.updated_at ? new Date(profile.updated_at).getTime() : 0;
  return `${publicApiUrl()}/api/public/brand-logo/${companyId}?v=${version}`;
};

export const cleanSignature = (html: unknown): string | null => {
  const clean = sanitizeNoteHtml(String(html || ''));
  // An editor left empty sends "<p></p>"
  return clean.replace(/<p>\s*<\/p>/g, '').trim() ? clean : null;
};

export class BrandingService {
  static async forSubscriber(orgId: string): Promise<Brand> {
    const [company, profile] = await Promise.all([
      db('companies').where('id', orgId).first('id', 'name', 'support_email_slug'),
      db('company_profiles').where('company_id', orgId).first(),
    ]);
    if (!company) return BOMIZZEL_BRAND;
    return {
      companyId: company.id,
      name: (profile?.company_name || '').trim() || company.name,
      tagline: (profile?.tagline || '').trim(),
      website: (profile?.linkback_url || '').trim(),
      color: safeColor(profile?.primary_color),
      logoUrl: logoUrlFor(company.id, profile),
      signatureHtml: profile?.email_signature_html || null,
      autoInviteContacts: !!profile?.auto_invite_contacts,
      supportSlug: company.support_email_slug || null,
    };
  }

  /**
   * The brand for an email to this person: their subscriber's when they're a
   * customer of one, otherwise Bomizzel's (staff, and anyone not yet placed).
   */
  static async forUser(userId: string): Promise<Brand> {
    const user = await db('users').where('id', userId).first('role');
    if (!user || user.role !== 'customer') return BOMIZZEL_BRAND;
    const { tenantId } = await tenantContextFor(userId);
    return tenantId ? this.forSubscriber(tenantId) : BOMIZZEL_BRAND;
  }

  /** An agent's own signature, else their company's. */
  static async signatureFor(brand: Brand, agentId?: string | null): Promise<string | null> {
    if (agentId) {
      const agent = await db('users').where('id', agentId).first('email_signature_html');
      if (agent?.email_signature_html) return agent.email_signature_html;
    }
    return brand.signatureHtml;
  }
}
