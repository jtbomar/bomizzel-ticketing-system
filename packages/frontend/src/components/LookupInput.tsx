import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { recordPath } from '../utils/fields';

/**
 * A lookup field's input: shows the linked record (as a link), or a search
 * box to find one. `value` is the linked record's id ('' for none).
 */
const LookupInput: React.FC<{
  module: string;
  value: string;
  onChange: (id: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}> = ({ module, value, onChange, id, className = '', disabled }) => {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // The linked record's name
  useEffect(() => {
    if (!value) return setName('');
    let cancelled = false;
    apiService
      .lookup(module, { ids: [value] })
      .then((r) => !cancelled && setName(r[0]?.name || 'Record not found'))
      .catch(() => !cancelled && setName('Record'));
    return () => {
      cancelled = true;
    };
  }, [module, value]);

  // Search as you type
  useEffect(() => {
    if (!open) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      apiService
        .lookup(module, { q: query })
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => window.clearTimeout(timer.current);
  }, [module, query, open]);

  if (value) {
    return (
      <div
        className={`flex items-center gap-1 min-w-0 ${className.includes('w-full') ? 'w-full' : ''}`}
      >
        <Link
          to={recordPath(module, value)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
        >
          {name || '…'}
        </Link>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remove link"
            className="p-0.5 rounded text-gray-400 hover:text-red-600 shrink-0"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="search"
        value={query}
        disabled={disabled}
        placeholder="Search to link…"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    onChange(r.id);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {r.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default LookupInput;
