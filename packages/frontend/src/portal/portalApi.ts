import axios, { AxiosInstance } from 'axios';
import { getApiBaseUrl } from '../services/api';

/**
 * The customer portal's own API client and sign-in. Kept apart from the
 * app's (its own saved tokens), so a staff member signed in to the app and a
 * customer signed in to a portal in the same browser don't trip over each
 * other.
 */

const TOKEN = 'portal:token';
const REFRESH = 'portal:refreshToken';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: they'll be asked to sign in again
  }
};

export const portalTokens = {
  get: () => read(TOKEN),
  set: (token: string, refresh?: string | null) => {
    write(TOKEN, token);
    if (refresh) write(REFRESH, refresh);
  },
  clear: () => {
    write(TOKEN, null);
    write(REFRESH, null);
  },
};

/** Called when the sign-in can't be renewed (set by the portal). */
let onSignedOut: () => void = () => undefined;
export const setOnSignedOut = (fn: () => void) => {
  onSignedOut = fn;
};

const base = getApiBaseUrl();

export const portalApi: AxiosInstance = axios.create({ baseURL: base, timeout: 20000 });

portalApi.interceptors.request.use((config) => {
  const token = read(TOKEN);
  if (token)
    config.headers = { ...(config.headers as any), Authorization: `Bearer ${token}` } as any;
  return config;
});

let renewing: Promise<string> | null = null;
const renew = (): Promise<string> => {
  if (!renewing) {
    renewing = (async () => {
      const refreshToken = read(REFRESH);
      if (!refreshToken) throw new Error('No refresh token');
      const res = await axios.post(`${base}/auth/refresh`, { refreshToken });
      if (!res.data?.token) throw new Error('No token');
      portalTokens.set(res.data.token, res.data.refreshToken);
      return res.data.token as string;
    })().finally(() => {
      renewing = null;
    });
  }
  return renewing;
};

portalApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const isTokenCall = /\/auth\/(login|refresh)/.test(original?.url || '');
    if (error.response?.status === 401 && original && !original._retried && !isTokenCall) {
      original._retried = true;
      try {
        const token = await renew();
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return portalApi(original);
      } catch {
        portalTokens.clear();
        onSignedOut();
      }
    }
    return Promise.reject(error);
  }
);

/** The server's message for a failed call. */
export const portalError = (e: any, fallback = 'Something went wrong. Please try again.'): string =>
  e?.response?.data?.error?.message ||
  (typeof e?.response?.data?.error === 'string' ? e.response.data.error : '') ||
  e?.response?.data?.message ||
  fallback;

/** Customer portal links: help.bomizzel.com/<name>/... or, on the main site, /portal/<name>/... */
export const isPortalHost = (): boolean => /^help\./i.test(window.location.hostname);
/** A company's own staff sign-in: portal.bomizzel.com/<name>/login (the app runs there too) */
export const isStaffPortalHost = (): boolean => /^portal\./i.test(window.location.hostname);

/** Where customer portals live: VITE_PORTAL_URL, else help.bomizzel.com (here, on a dev machine) */
export const customerPortalBase = (): string => {
  const env = import.meta.env.VITE_PORTAL_URL as string | undefined;
  if (env) return env.replace(/\/+$/, '');
  if (isPortalHost()) return '';
  if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return '/portal';
  return 'https://help.bomizzel.com';
};
export const portalPath = (slug: string, path = ''): string =>
  `${isPortalHost() ? '' : '/portal'}/${slug}${path ? `/${path.replace(/^\//, '')}` : ''}`;
