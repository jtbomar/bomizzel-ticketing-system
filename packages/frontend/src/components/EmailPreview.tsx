import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { errorText } from './ui';

type Kind = 'welcome' | 'reply' | 'receipt';

const KINDS: [Kind, string][] = [
  ['welcome', 'Welcome'],
  ['reply', 'Ticket reply'],
  ['receipt', 'Ticket received'],
];

/**
 * What a customer gets, in this company's brand: the server builds the real
 * email (sample content) and it's shown here in a sandboxed frame. `signature`
 * previews a signature that isn't saved yet.
 */
const EmailPreview: React.FC<{
  kinds?: Kind[];
  signature?: string;
  // The signature is an agent's own (empty means the company's is used)
  mine?: boolean;
  refreshKey?: string | number;
}> = ({ kinds = ['welcome', 'reply', 'receipt'], signature, mine, refreshKey }) => {
  const [kind, setKind] = useState<Kind>(kinds[0]!);
  const [preview, setPreview] = useState<{ subject: string; html: string; from: string } | null>(
    null
  );
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // Wait for typing to settle before asking again
    const timer = setTimeout(async () => {
      try {
        const p = await apiService.getEmailPreview(kind, signature, mine);
        if (!cancelled) {
          setPreview(p);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, signature, mine, refreshKey]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</span>
        {kinds.length > 1 && (
          <div role="tablist" className="flex gap-1">
            {KINDS.filter(([k]) => kinds.includes(k)).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`px-2.5 py-1 text-xs rounded-md ${
                  kind === k
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {error ? (
        <p className="p-4 text-sm text-red-600">{error}</p>
      ) : !preview ? (
        <p className="p-4 text-sm text-gray-500">Loading preview…</p>
      ) : (
        <>
          <div className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 space-y-0.5">
            <div>
              <span className="text-gray-400">From:</span> {preview.from}
            </div>
            <div>
              <span className="text-gray-400">Subject:</span> {preview.subject}
            </div>
          </div>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className="w-full bg-[#f3f4f6]"
            style={{ height: 560, border: 0 }}
          />
        </>
      )}
    </div>
  );
};

export default EmailPreview;
