import React, { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';

/**
 * The formatted note / comment box: bold, italic, underline, strikethrough,
 * text colour, highlight, lists and links (Ctrl+B / Ctrl+I / Ctrl+U work).
 * Pasted or dropped files go to `onFiles` (attached to the ticket) rather
 * than into the text.
 *
 * The HTML it produces is cleaned again on the server before it's stored.
 */

const TEXT_COLORS = [
  { name: 'Black', value: '#111827' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Grey', value: '#6b7280' },
];

const HIGHLIGHTS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
];

export interface RichTextValue {
  html: string;
  text: string;
  isEmpty: boolean;
}

interface Props {
  /** HTML to start with (or to reset to - pass '' after sending). */
  value: string;
  onChange: (value: RichTextValue) => void;
  onFiles?: (files: File[]) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}

const ToolbarButton: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, active, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={!!active}
    onMouseDown={(e) => e.preventDefault()} // keep the text selection
    onClick={onClick}
    className={`h-8 min-w-8 px-2 rounded text-sm transition-colors ${
      active
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

const Swatches: React.FC<{
  label: string;
  colors: { name: string; value: string }[];
  onPick: (value: string) => void;
  onClear: () => void;
  icon: React.ReactNode;
}> = ({ label, colors, onPick, onClear, icon }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <ToolbarButton label={label} onClick={() => setOpen((o) => !o)}>
        {icon}
      </ToolbarButton>
      {open && (
        <div
          className="absolute z-20 mt-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg flex gap-1"
          onMouseLeave={() => setOpen(false)}
        >
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.name}
              aria-label={`${label}: ${c.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(c.value);
                setOpen(false);
              }}
              className="w-6 h-6 rounded border border-gray-300"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            title="None"
            aria-label={`${label}: none`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="w-6 h-6 rounded border border-gray-300 text-xs text-gray-500"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link address', previous || 'https://');
    if (url === null) return;
    if (!url.trim() || url === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-gray-200 dark:border-gray-700">
      <ToolbarButton
        label="Bold (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        label="Italic (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        label="Underline (Ctrl+U)"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
      <Swatches
        label="Text colour"
        colors={TEXT_COLORS}
        onPick={(value) => editor.chain().focus().setColor(value).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
        icon={
          <span className="font-semibold" style={{ borderBottom: '3px solid #dc2626' }}>
            A
          </span>
        }
      />
      <Swatches
        label="Highlight"
        colors={HIGHLIGHTS}
        onPick={(value) => editor.chain().focus().toggleHighlight({ color: value }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
        icon={
          <span className="px-1 rounded" style={{ backgroundColor: '#fef08a' }}>
            H
          </span>
        }
      />
      <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive('link')} onClick={addLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton
        label="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        ⌫
      </ToolbarButton>
    </div>
  );
};

const filesFrom = (list: DataTransfer | null): File[] =>
  Array.from(list?.files || []).map((file) => {
    if (file.type.startsWith('image/') && (!file.name || file.name === 'image.png')) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      return new File([file], `screenshot-${stamp}.${file.type.split('/')[1] || 'png'}`, {
        type: file.type,
      });
    }
    return file;
  });

const RichTextEditor: React.FC<Props> = ({
  value,
  onChange,
  onFiles,
  placeholder = 'Write a note...',
  minHeight = 120,
  disabled = false,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'rich-text px-3 py-2 focus:outline-none text-gray-900 dark:text-white',
        style: `min-height:${minHeight}px`,
        'aria-label': placeholder,
      },
      // Files pasted or dropped are attachments, not part of the text.
      handlePaste: (_view, event) => {
        const files = filesFrom(event.clipboardData);
        if (files.length && onFiles) {
          onFiles(files);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = filesFrom((event as DragEvent).dataTransfer);
        if (files.length && onFiles) {
          event.preventDefault();
          onFiles(files);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) =>
      onChange({ html: e.getHTML(), text: e.getText(), isEmpty: e.isEmpty }),
  });

  // Resetting from outside (e.g. value set back to '' after sending).
  useEffect(() => {
    if (editor && value !== editor.getHTML() && (value === '' || !editor.isFocused)) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500">
      {editor && <Toolbar editor={editor} />}
      <div className="relative">
        {editor?.isEmpty && (
          <div className="pointer-events-none absolute left-3 top-2 text-gray-400">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
