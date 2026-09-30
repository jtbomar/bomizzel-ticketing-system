import React from 'react';
import DOMPurify from 'dompurify';

/**
 * Shows a note: formatted HTML when it has some, plain text otherwise. The
 * HTML was cleaned on the server when it was saved; it's cleaned again here
 * before it touches the page.
 */

const ALLOWED_TAGS = [
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
];

const RichTextContent: React.FC<{ html?: string | null; text: string; className?: string }> = ({
  html,
  text,
  className = '',
}) => {
  if (!html) {
    return <p className={`whitespace-pre-wrap break-words ${className}`}>{text}</p>;
  }
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'data-color'],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:)/i,
  });
  return (
    <div
      className={`rich-text break-words ${className}`}
      // Sanitised above (and on the server when saved).
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};

export default RichTextContent;
