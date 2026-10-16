import axios from 'axios';
import { getApiBaseUrl } from '../services/api';
import { isPortalHost, isStaffPortalHost, portalTokens } from '../portal/portalApi';
import { storeSignIn } from '../contexts/AuthContext';

/**
 * A company's staff desk lives at portal.bomizzel.com/<name>/... (like Zoho's
 * help.dakcs.com/agent/<portal>/...): the whole app under the company's name,
 * so the address says whose desk it is and bookmarks keep the company.
 */

// The app's own top-level pages: never a company name
const APP_PAGES = new Set([
  'admin',
  'agent',
  'assets',
  'bsi',
  'check-email',
  'color-picker-demo',
  'company-register',
  'create-ticket',
  'customer',
  'data-management',
  'employee',
  'forgot-password',
  'login',
  'macros',
  'portal',
  'portal-access',
  'pricing',
  'privacy',
  'register',
  'reports',
  'reset-password',
  'simple-ticket-test',
  'test',
  'test-ticket-form',
  'verify-email',
  'visual-reports',
]);

/** The company name in the address (portal.bomizzel.com/<name>/...), as typed, or ''. */
export const companyInAddress = (): string => {
  if (!isStaffPortalHost()) return '';
  const first = window.location.pathname.split('/')[1] || '';
  return /^[a-z0-9-]{3,64}$/i.test(first) && !APP_PAGES.has(first.toLowerCase()) ? first : '';
};

/** The company the app's sign-in is for (kept at sign-in), if known. */
export const signedInCompany = (): {
  id: string;
  name: string;
  portalName: string | null;
} | null => {
  try {
    return JSON.parse(localStorage.getItem('company') || 'null');
  } catch {
    return null;
  }
};

/** Is this a real Bomizzel site (not a dev machine or preview), where companies have addresses? */
export const onBomizzelSite = (): boolean => /(^|\.)bomizzel\.com$/i.test(window.location.hostname);

/**
 * Arriving from a hand-off link (#handoff=<code>): sign in here with it. The
 * code is spent once and taken out of the address. Runs before the app
 * renders, so the first screen is already signed in.
 */
export const takeHandoff = async (): Promise<void> => {
  const match = window.location.hash.match(/(?:^#|&)handoff=([^&]+)/);
  if (!match) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  try {
    const res = await axios.post(`${getApiBaseUrl()}/auth/handoff/exchange`, {
      code: decodeURIComponent(match[1]!),
    });
    if (isPortalHost()) portalTokens.set(res.data.token, res.data.refreshToken);
    else storeSignIn(res.data);
  } catch {
    // Expired or used: they sign in as usual
  }
};
