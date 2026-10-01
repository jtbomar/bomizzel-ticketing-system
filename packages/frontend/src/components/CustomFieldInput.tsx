import React from 'react';
import type { CustomFieldDef } from '../utils/fields';
import LookupInput from './LookupInput';

/**
 * The input for one custom field, by its type. Used on the ticket form, in
 * the ticket view, and in macros. `value` is the stored value; onChange gets
 * the new one ('' / [] means empty).
 */
interface Props {
  field: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Called when a typed value is done (blur), for saving as you go. */
  onCommit?: (value: unknown) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const base =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';

const CustomFieldInput: React.FC<Props> = ({
  field,
  value,
  onChange,
  onCommit,
  id,
  className = base,
  disabled,
}) => {
  const text = value === undefined || value === null ? '' : String(value);
  const commit = (v: unknown) => onCommit?.(v);

  switch (field.type) {
    case 'lookup':
      return (
        <LookupInput
          id={id}
          module={field.lookupModule || ''}
          value={text}
          disabled={disabled}
          onChange={(v) => {
            onChange(v);
            commit(v);
          }}
          className={className}
        />
      );
    case 'textarea':
      return (
        <textarea
          id={id}
          rows={3}
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className={className}
        />
      );
    case 'checkbox':
      return (
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.checked);
            commit(e.target.checked);
          }}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      );
    case 'picklist':
      return (
        <select
          id={id}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            commit(e.target.value);
          }}
          className={className}
        >
          <option value="">-None-</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {/* A value whose choice was since removed still shows */}
          {text && !field.options.includes(text) && <option value={text}>{text}</option>}
        </select>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div
          id={id}
          role="group"
          aria-label={field.label}
          className="flex flex-wrap gap-x-4 gap-y-1"
        >
          {field.options.map((o) => (
            <label
              key={o}
              className="flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200"
            >
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(o)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, o]
                    : selected.filter((x) => x !== o);
                  onChange(next);
                  commit(next);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    default: {
      const type =
        field.type === 'number' || field.type === 'decimal'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : field.type === 'email'
              ? 'email'
              : field.type === 'phone'
                ? 'tel'
                : field.type === 'url'
                  ? 'url'
                  : 'text';
      return (
        <input
          id={id}
          type={type}
          step={field.type === 'decimal' ? 'any' : field.type === 'number' ? 1 : undefined}
          value={text}
          disabled={disabled}
          placeholder={field.type === 'url' ? 'https://' : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className={className}
        />
      );
    }
  }
};

export default CustomFieldInput;
