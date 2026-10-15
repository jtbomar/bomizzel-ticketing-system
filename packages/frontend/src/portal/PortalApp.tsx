import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';
import { portalApi, portalError, portalPath, portalTokens, setOnSignedOut } from './portalApi';
import {
  PortalForgotPassword,
  PortalLogin,
  PortalResetPassword,
  PortalSignup,
  PortalVerifyEmail,
} from './PortalAuthPages';
import { PortalNewTicket, PortalTicketList, PortalTicketView } from './PortalTicketPages';

/**
 * A subscriber's customer portal: portal.bomizzel.com/<name> (or the main
 * site's /portal/<name>). In the subscriber's brand; its customers sign up,
 * sign in, and open, follow, reply to and close their tickets.
 */

export interface PortalBrand {
  portalName: string;
  renamed: boolean;
  name: string;
  tagline: string;
  website: string;
  color: string;
  logoUrl: string | null;
}

export interface PortalSession {
  user: { id: string; firstName: string; lastName: string; email: string };
  account: { id: string; name: string };
  scope: 'own' | 'company';
  accessRequest: { status: string; createdAt: string } | null;
}

interface PortalContextValue {
  slug: string;
  brand: PortalBrand;
  session: PortalSession | null;
  loadSession: () => Promise<PortalSession | null>;
  signIn: (token: string, refreshToken?: string) => Promise<PortalSession>;
  signOut: () => void;
  path: (p?: string) => string;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export const usePortal = (): PortalContextValue => {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal outside the portal');
  return ctx;
};

/** White text on dark brand colours, near-black on light ones. */
const textOn = (hex: string): string => {
  const n = parseInt((hex || '#2563eb').replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.45 ? '#111827' : '#ffffff';
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 text-center text-gray-600">
    <div>{children}</div>
  </div>
);

/** Pages only for signed-in contacts of this portal. */
const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, path } = usePortal();
  const location = useLocation();
  if (!session) {
    return (
      <Navigate to={`${path('login')}?next=${encodeURIComponent(location.pathname)}`} replace />
    );
  }
  return <>{children}</>;
};

const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { brand, session, signOut, path } = usePortal();
  const navigate = useNavigate();
  return (
    <div
      className="min-h-screen bg-gray-50 text-gray-900"
      style={{ ['--brand' as any]: brand.color, ['--on-brand' as any]: textOn(brand.color) }}
    >
      <header
        className="bg-white border-b border-gray-200"
        style={{ borderTop: `4px solid ${brand.color}` }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(path())}
            className="flex items-center gap-3 min-w-0"
          >
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-10 max-w-[180px] object-contain"
              />
            ) : (
              <span className="text-lg font-bold truncate" style={{ color: brand.color }}>
                {brand.name}
              </span>
            )}
            <span className="hidden sm:inline text-sm text-gray-500 whitespace-nowrap">
              Support
            </span>
          </button>
          {session && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden sm:inline text-gray-600 truncate max-w-[200px]">
                {session.user.firstName} {session.user.lastName}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="text-gray-600 hover:text-gray-900 underline"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
      <footer className="max-w-4xl mx-auto px-4 pb-8 text-center text-xs text-gray-400">
        {brand.name}
        {brand.tagline ? ` · ${brand.tagline}` : ''}
      </footer>
    </div>
  );
};

const PortalApp: React.FC = () => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<PortalBrand | null>(null);
  const [missing, setMissing] = useState(false);
  const [session, setSession] = useState<PortalSession | null>(null);
  const [checked, setChecked] = useState(false);
  const path = useCallback((p = '') => portalPath(slug, p), [slug]);

  useEffect(() => {
    let cancelled = false;
    portalApi
      .get(`/portal/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (cancelled) return;
        // An old name: go to the current one
        if (r.data.renamed && r.data.portalName !== slug) {
          navigate(window.location.pathname.replace(`/${slug}`, `/${r.data.portalName}`), {
            replace: true,
          });
          return;
        }
        setBrand(r.data);
        document.title = `${r.data.name} Support`;
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  const loadSession = useCallback(async () => {
    if (!portalTokens.get()) {
      setSession(null);
      return null;
    }
    try {
      const r = await portalApi.get(`/portal/${encodeURIComponent(slug)}/session`);
      setSession(r.data);
      return r.data as PortalSession;
    } catch {
      setSession(null);
      return null;
    }
  }, [slug]);

  useEffect(() => {
    setOnSignedOut(() => {
      setSession(null);
      navigate(portalPath(slug, 'login'));
    });
    loadSession().finally(() => setChecked(true));
  }, [slug, loadSession, navigate]);

  const signIn = async (token: string, refreshToken?: string) => {
    portalTokens.set(token, refreshToken);
    try {
      const r = await portalApi.get(`/portal/${encodeURIComponent(slug)}/session`);
      setSession(r.data);
      return r.data as PortalSession;
    } catch (e) {
      portalTokens.clear();
      throw new Error(portalError(e, "This account can't sign in to this portal."));
    }
  };

  const signOut = () => {
    const token = portalTokens.get();
    if (token) portalApi.post('/auth/logout').catch(() => undefined);
    portalTokens.clear();
    setSession(null);
    navigate(path('login'));
  };

  if (missing) {
    return (
      <Centered>
        <h1 className="text-xl font-semibold text-gray-900">Support portal not found</h1>
        <p className="mt-2 text-sm">Check the link you were given.</p>
      </Centered>
    );
  }
  if (!brand || !checked) {
    return (
      <Centered>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-400 mx-auto" />
      </Centered>
    );
  }

  return (
    <PortalContext.Provider value={{ slug, brand, session, loadSession, signIn, signOut, path }}>
      <PortalLayout>
        <Routes>
          <Route path="login" element={<PortalLogin />} />
          <Route path="signup" element={<PortalSignup />} />
          <Route path="forgot-password" element={<PortalForgotPassword />} />
          <Route path="reset-password" element={<PortalResetPassword />} />
          <Route path="verify-email" element={<PortalVerifyEmail />} />
          <Route
            path=""
            element={
              <SignedIn>
                <PortalTicketList />
              </SignedIn>
            }
          />
          <Route
            path="tickets/new"
            element={
              <SignedIn>
                <PortalNewTicket />
              </SignedIn>
            }
          />
          <Route
            path="tickets/:ticketId"
            element={
              <SignedIn>
                <PortalTicketView />
              </SignedIn>
            }
          />
          <Route path="*" element={<Navigate to={path()} replace />} />
        </Routes>
      </PortalLayout>
    </PortalContext.Provider>
  );
};

export default PortalApp;
