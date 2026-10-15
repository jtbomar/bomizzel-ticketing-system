import React, { useEffect, useState } from 'react';

export interface PortalNameCheck {
  name: string;
  available: boolean;
  reason?: string;
  suggestion?: string;
  url?: string;
}

/**
 * A portal name field (customers at help.bomizzel.com/<name>, staff sign in at
 * portal.bomizzel.com/<name>, also the support email name): lowercase as you type, and says whether the name is free.
 * `check` asks the server; `onStatus` reports whether the value can be used.
 */
const PortalNameInput: React.FC<{
  id?: string;
  value: string;
  onChange: (value: string) => void;
  check: (name: string) => Promise<PortalNameCheck>;
  onStatus?: (ok: boolean) => void;
  className?: string;
}> = ({ id = 'portalName', value, onChange, check, onStatus, className = '' }) => {
  const [result, setResult] = useState<PortalNameCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!value) {
      setResult(null);
      onStatus?.(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const r = await check(value);
        if (!cancelled) {
          setResult(r);
          onStatus?.(r.available);
        }
      } catch {
        if (!cancelled) {
          setResult(null);
          onStatus?.(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // check/onStatus are stable enough; re-run only when the name changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <div className="mt-1 flex rounded-md shadow-sm">
        <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 whitespace-nowrap">
          help.bomizzel.com/
        </span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-status`}
          className={`block w-full min-w-0 flex-1 rounded-none rounded-r-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        />
      </div>
      <p id={`${id}-status`} className="mt-1 text-xs min-h-[1rem]" aria-live="polite">
        {checking ? (
          <span className="text-gray-500">Checking…</span>
        ) : result?.available ? (
          <span className="text-green-700">
            Available. Support email: {value}@support.bomizzel.com
          </span>
        ) : result ? (
          <span className="text-red-600">
            {result.reason}
            {result.suggestion && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => onChange(result.suggestion!)}
                  className="underline text-blue-700"
                >
                  Use “{result.suggestion}”
                </button>
              </>
            )}
          </span>
        ) : null}
      </p>
    </div>
  );
};

export default PortalNameInput;
