// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RichTextEditor from '../../components/RichTextEditor';

/**
 * The formatting toolbar has to follow the cursor. It didn't redraw as you
 * typed, so after turning bold off the B button still looked on - and a
 * second click turned it back on.
 */
const Harness: React.FC<{ onHtml: (html: string) => void }> = ({ onHtml }) => {
  const [html, setHtml] = useState('<p><strong>test</strong></p>');
  return (
    <RichTextEditor
      value={html}
      onChange={(v) => {
        setHtml(v.html);
        onHtml(v.html);
      }}
    />
  );
};

describe('RichTextEditor toolbar', () => {
  it('shows bold as off after turning it off, and new text is plain', async () => {
    let latest = '';
    render(<Harness onHtml={(h) => (latest = h)} />);
    const bold = await screen.findByRole('button', { name: /bold/i });
    const editable = document.querySelector('[contenteditable="true"]') as HTMLElement;
    const editor = (editable as any).editor;

    await act(async () => {
      editor.commands.focus('end');
    });
    expect(bold.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      fireEvent.click(bold);
    });
    expect(bold.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      editor.commands.insertContent(' plain');
    });
    expect(latest).toBe('<p><strong>test</strong> plain</p>');
    expect(bold.getAttribute('aria-pressed')).toBe('false');
  });
});
