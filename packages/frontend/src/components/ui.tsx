import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Small shared pieces for the settings editors (macros, assignment rules):
 * a side panel, an on/off switch, and a row of toggle chips.
 */

/** A panel that slides in from the right, over the page. Esc or the backdrop closes it. */
export const Drawer: React.FC<{
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}> = ({ title, onClose, footer, children, width = 'max-w-xl' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col`}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
};

/** An on/off switch. */
export const Switch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  showLabel?: boolean;
}> = ({ checked, onChange, label, showLabel }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
    {showLabel && <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>}
  </label>
);

/** Choices as chips you click on and off (several can be on). */
export const Chips: React.FC<{
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  single?: boolean;
}> = ({ options, selected, onChange, label, single }) => (
  <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
    {options.map((o) => {
      const on = selected.includes(o.value);
      return (
        <button
          key={o.value}
          type="button"
          aria-pressed={on}
          onClick={() =>
            onChange(
              single
                ? [o.value]
                : on
                  ? selected.filter((v) => v !== o.value)
                  : [...selected, o.value]
            )
          }
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            on
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

/** Shared input look for the editors. */
export const fieldClass =
  'w-full px-3 py-2 text-sm bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';

export const errorText = (error: any): string =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  String(error);
