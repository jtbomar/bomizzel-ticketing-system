import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../services/api';

/**
 * "Sign in using" Google / Microsoft / Facebook (like Zoho's). Only the ones
 * set up on the server show. `company` and `audience` say where they're
 * signing in: a company's staff desk, its customer portal, or bomizzel.com.
 */

const ICONS: Record<string, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  ),
  microsoft: (
    <svg viewBox="0 0 21 21" className="h-5 w-5" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  ),
};

/** An error a provider sign-in sent back (#oauth_error=...), taken out of the address. */
export const takeOAuthError = (): string => {
  const m = window.location.hash.match(/(?:^#|&)oauth_error=([^&]*)/);
  if (!m) return '';
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return 'Sign-in was not completed. Please try again.';
  }
};

const SocialSignIn: React.FC<{
  company?: string;
  audience?: 'staff' | 'portal';
  label?: string;
  className?: string;
}> = ({ company, audience, label = 'Sign in using', className = '' }) => {
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let live = true;
    axios
      .get(`${getApiBaseUrl()}/auth/oauth/providers`)
      .then((r) => live && setProviders(r.data.providers || []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!providers.length) return null;

  const go = (id: string) => {
    const q = new URLSearchParams({ origin: window.location.origin });
    if (company) q.set('company', company);
    if (audience) q.set('audience', audience);
    window.location.assign(`${getApiBaseUrl()}/auth/oauth/${id}/start?${q.toString()}`);
  };

  return (
    <div className={className}>
      <p className="text-sm text-gray-600">{label}</p>
      <div className="mt-2 flex gap-2">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(p.id)}
            title={`${label} ${p.name}`}
            aria-label={`${label} ${p.name}`}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            {ICONS[p.id] || p.name[0]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SocialSignIn;
