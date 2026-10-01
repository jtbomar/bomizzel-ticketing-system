import React, { useEffect, useState } from 'react';
import CustomFieldInput from './CustomFieldInput';
import type { CustomFieldDef } from '../utils/fields';

/**
 * A record's properties as a compact label / value list, edited in place:
 * the ticket page's left column, and the account and contact pages.
 */

// Property controls look like plain text until hovered or focused
export const ghost =
  'w-full text-sm text-gray-900 dark:text-gray-100 bg-transparent border border-transparent rounded-md px-2 py-1 -mx-2 hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800';

export const Row: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  children,
}) => (
  <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2 min-h-[2rem]">
    <label htmlFor={htmlFor} className="text-xs text-gray-500 dark:text-gray-400 truncate">
      {label}
    </label>
    <div className="min-w-0">{children}</div>
  </div>
);

// A custom field property, saved when changed (pick lists, checkboxes) or on
// leaving it (text). Kept outside the page so typing isn't lost when the page
// re-renders.
export const CustomProperty: React.FC<{
  field: CustomFieldDef;
  saved: unknown;
  onSave: (value: unknown) => void;
}> = ({ field, saved, onSave }) => {
  const [value, setValue] = useState<unknown>(saved);
  useEffect(() => setValue(saved), [saved]);
  const commit = (v: unknown) => {
    if (JSON.stringify(v ?? '') === JSON.stringify(saved ?? '')) return;
    onSave(v);
  };
  const wide = field.type === 'textarea' || field.type === 'multiselect';
  const id = `prop-${field.key}`;
  const input = (
    <CustomFieldInput
      id={id}
      field={field}
      value={value}
      onChange={setValue}
      onCommit={commit}
      className={ghost}
    />
  );
  return wide ? (
    <div className="space-y-1 py-1">
      <label htmlFor={id} className="text-xs text-gray-500 dark:text-gray-400">
        {field.label}
        {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="px-2">{input}</div>
    </div>
  ) : (
    <Row label={field.isRequired ? `${field.label} *` : field.label} htmlFor={id}>
      {field.type === 'checkbox' ? <div className="px-0.5 py-1">{input}</div> : input}
    </Row>
  );
};
