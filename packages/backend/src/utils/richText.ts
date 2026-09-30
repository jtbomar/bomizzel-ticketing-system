import sanitizeHtml from 'sanitize-html';

/**
 * Formatted note HTML, cleaned down to formatting only. Anything else -
 * scripts, event handlers, iframes, images, forms, style other than colours -
 * is removed, so a note can't carry code into another user's browser or into
 * a customer's inbox.
 */

const COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i,
  /^[a-z]{3,20}$/i,
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'del',
    'mark',
    'span',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'code',
    'pre',
    'h1',
    'h2',
    'h3',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['style'],
    mark: ['style', 'data-color'],
    p: ['style'],
  },
  allowedStyles: {
    span: { color: COLOR, 'background-color': COLOR },
    mark: { 'background-color': COLOR, color: COLOR },
    p: { 'text-align': [/^(left|right|center)$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    // Links open in a new tab and don't hand the opener to the target.
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
  },
};

const MAX_HTML = 200_000;

export const sanitizeNoteHtml = (html: string): string =>
  sanitizeHtml(String(html || '').slice(0, MAX_HTML), OPTIONS).trim();

/** The plain-text version of note HTML: paragraphs and list items on their own lines. */
export const noteHtmlToText = (html: string): string =>
  sanitizeHtml(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h[1-6]|blockquote|pre)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• '),
    { allowedTags: [], allowedAttributes: {} }
  )
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * The content and HTML to store for a note. With HTML, the HTML is cleaned
 * and the text is derived from it (so the two always agree); without, it's a
 * plain note.
 */
export const noteContent = (
  content: string | undefined,
  contentHtml: string | undefined | null
): { content: string; contentHtml: string | null } => {
  if (contentHtml && contentHtml.trim()) {
    const clean = sanitizeNoteHtml(contentHtml);
    const text = noteHtmlToText(clean);
    if (text) return { content: text, contentHtml: clean };
  }
  return { content: String(content || '').trim(), contentHtml: null };
};
