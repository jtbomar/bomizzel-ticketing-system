import { noteHtmlToText } from '@/utils/richText';

/**
 * The look of an email: a subscriber's brand on mail to its customers, or
 * Bomizzel's on mail about a Bomizzel account. Built from tables and inline
 * styles, which is what mail apps render reliably.
 */

export interface Brand {
  // The subscriber (null for Bomizzel itself)
  companyId: string | null;
  name: string;
  tagline: string;
  website: string;
  // #rrggbb
  color: string;
  // A URL a mail app can load (never a data: URI - Gmail and Outlook drop those)
  logoUrl: string | null;
  // Company signature, cleaned HTML
  signatureHtml: string | null;
  autoInviteContacts: boolean;
  // <slug>@support.<domain>: where replies go
  supportSlug: string | null;
}

export const DEFAULT_COLOR = '#2563eb';

export const BOMIZZEL_BRAND: Brand = {
  companyId: null,
  name: 'Bomizzel',
  tagline: '',
  website: '',
  color: DEFAULT_COLOR,
  logoUrl: null,
  signatureHtml: null,
  autoInviteContacts: false,
  supportSlug: null,
};

export const escapeHtml = (value: string): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

/** A colour safe to put in a style attribute, or the default. */
export const safeColor = (value: unknown): string => {
  const v = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase();
  }
  return DEFAULT_COLOR;
};

/** White text on dark brand colours, near-black on light ones. */
export const textOn = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#111827' : '#ffffff';
};

const safeUrl = (url: string): string | null =>
  /^https?:\/\/[^\s"'<>]+$/i.test(url.trim()) ? url.trim() : null;

/** Paragraphs from plain text. */
export const paragraphs = (text: string): string =>
  escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

export const button = (brand: Brand, label: string, link: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:6px;background:${brand.color};">` +
  `<a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;font-weight:bold;font-size:15px;color:${textOn(brand.color)};text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>` +
  `</td></tr></table>`;

/** A signature under the message (already-cleaned HTML). */
export const signatureHtml = (html: string | null | undefined): string =>
  html && html.trim()
    ? `<div style="margin:22px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;color:#374151;font-size:14px;line-height:1.5;">${html}</div>`
    : '';

export const signatureText = (html: string | null | undefined): string =>
  html && html.trim() ? `\n\n--\n${noteHtmlToText(html)}` : '';

/**
 * The whole email. `topNote` sits above the card (the reply marker on ticket
 * mail); `footerNote` is a small line at the bottom of the card.
 */
export const brandedLayout = (
  brand: Brand,
  bodyHtml: string,
  options: { topNote?: string; footerNote?: string; preheader?: string } = {}
): string => {
  const logo = brand.logoUrl ? safeUrl(brand.logoUrl) : null;
  const header = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.name)}" style="display:block;max-height:56px;max-width:240px;height:auto;border:0;">`
    : `<span style="font-size:20px;font-weight:bold;color:${brand.color};">${escapeHtml(brand.name)}</span>`;
  const website = brand.website ? safeUrl(brand.website) : null;
  const footerBits = [
    `<strong style="color:#374151;">${escapeHtml(brand.name)}</strong>`,
    brand.tagline ? escapeHtml(brand.tagline) : '',
    website
      ? `<a href="${escapeHtml(website)}" style="color:${brand.color};text-decoration:none;">${escapeHtml(website.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>`
      : '',
  ].filter(Boolean);

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(brand.name)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(options.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;"><tr><td style="padding:24px 12px;">
${options.topNote ? `<p style="max-width:600px;margin:0 auto 10px;font-size:12px;color:#9ca3af;">${escapeHtml(options.topNote)}</p>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border-top:4px solid ${brand.color};">
<tr><td style="padding:24px 32px 8px;">${header}</td></tr>
<tr><td style="padding:12px 32px 28px;font-size:15px;">${bodyHtml}
${options.footerNote ? `<p style="margin:24px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(options.footerNote)}</p>` : ''}
</td></tr>
</table>
<p style="max-width:600px;margin:14px auto 0;font-size:12px;line-height:1.6;color:#6b7280;text-align:center;">${footerBits.join(' &middot; ')}</p>
</td></tr></table>
</body></html>`;
};
