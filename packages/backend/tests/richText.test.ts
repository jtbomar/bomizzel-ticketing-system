import { sanitizeNoteHtml, noteHtmlToText, noteContent } from '../src/utils/richText';

describe('formatted note HTML', () => {
  it('keeps formatting, colours and highlights', () => {
    const html =
      '<p><strong>Bold</strong> <em>italic</em> <u>under</u> <s>gone</s> ' +
      '<span style="color: #dc2626">red</span> ' +
      '<mark data-color="#fef08a" style="background-color: #fef08a; color: inherit">marked</mark></p>' +
      '<ul><li>one</li><li>two</li></ul>';
    const clean = sanitizeNoteHtml(html);
    expect(clean).toContain('<strong>Bold</strong>');
    expect(clean).toContain('<em>italic</em>');
    expect(clean).toContain('<u>under</u>');
    expect(clean).toContain('<s>gone</s>');
    expect(clean).toContain('<span style="color:#dc2626">red</span>');
    expect(clean).toMatch(/<mark[^>]*background-color:#fef08a[^>]*>marked<\/mark>/);
    expect(clean).toContain('<ul><li>one</li><li>two</li></ul>');
  });

  it.each([
    ['a script', '<p>hi</p><script>alert(1)</script>', /script|alert/],
    ['an event handler', '<p onclick="alert(1)">hi</p>', /onclick|alert/],
    ['a javascript: link', '<a href="javascript:alert(1)">x</a>', /javascript/],
    [
      'an image (tracking pixel or onerror)',
      '<img src="https://x/y.png" onerror="alert(1)">',
      /img|onerror/,
    ],
    ['an iframe', '<iframe src="https://evil.example"></iframe>', /iframe|evil/],
    ['positioning styles', '<span style="position:fixed;top:0;color:red">x</span>', /position|top/],
    [
      'a style expression',
      '<span style="color: expression(alert(1))">x</span>',
      /expression|alert/,
    ],
    ['a form', '<form action="https://evil.example"><input name="p"></form>', /form|input|evil/],
  ])('removes %s', (_label, html, forbidden) => {
    expect(sanitizeNoteHtml(html)).not.toMatch(forbidden);
  });

  it('makes links open safely in a new tab', () => {
    expect(sanitizeNoteHtml('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>'
    );
  });

  it('derives the plain-text version', () => {
    expect(noteHtmlToText('<p>First &amp; <b>bold</b></p><ul><li>a</li><li>b</li></ul>')).toBe(
      'First & bold\n• a\n• b'
    );
  });

  it('stores plain notes as plain, and formatted notes with text derived from the HTML', () => {
    expect(noteContent('just text', undefined)).toEqual({
      content: 'just text',
      contentHtml: null,
    });
    expect(noteContent('ignored', '<p><em>hi</em></p><script>x</script>')).toEqual({
      content: 'hi',
      contentHtml: '<p><em>hi</em></p>',
    });
    // HTML that cleans down to nothing falls back to the plain content
    expect(noteContent('fallback', '<script>x</script>')).toEqual({
      content: 'fallback',
      contentHtml: null,
    });
  });
});
