import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { JWTUtils } from '@/utils/jwt';
import { resolveSession, Audience } from '@/utils/session';
import { portalUrl, staffLoginUrl, subscriberForPortalName } from '@/utils/portalName';
import { publicApiUrl } from './BrandingService';
import { PortalService } from './PortalService';

/**
 * "Sign in with Google / Microsoft / Facebook" (like Zoho's "Sign in using").
 *
 * The provider only vouches for an email address: the person is the
 * Bomizzel login with that address, signed in where they asked (a company's
 * staff desk or customer portal, or bomizzel.com). On a customer portal,
 * someone new is signed up as its customer. Nobody else gets in.
 *
 * - Google: the email and Google's email_verified flag.
 * - Microsoft: the account's userPrincipalName, which a work tenant can only
 *   set on a domain it has verified (personal accounts: their own address).
 *   Not the `mail`/`email` attribute, which a tenant admin can set to anyone's
 *   address ("nOAuth").
 * - Facebook: the email Facebook returns, which it has confirmed.
 *
 * The round trip is tied to the browser that started it (a random value in
 * a short-lived cookie, also inside the signed state), so a captured callback
 * can't be replayed elsewhere. The sign-in reaches the site as a one-time
 * hand-off code (AuthService.exchangeHandoff), never as tokens in a URL.
 */

export type Provider = 'google' | 'microsoft' | 'facebook';

interface ProviderConfig {
  id: Provider;
  name: string;
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

const PROVIDERS: Record<Provider, () => ProviderConfig> = {
  google: () => ({
    id: 'google',
    name: 'Google',
    clientId: process.env['GOOGLE_CLIENT_ID'],
    clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  }),
  microsoft: () => ({
    id: 'microsoft',
    name: 'Microsoft',
    clientId: process.env['MICROSOFT_CLIENT_ID'],
    clientSecret: process.env['MICROSOFT_CLIENT_SECRET'],
    authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'openid email profile User.Read',
  }),
  facebook: () => ({
    id: 'facebook',
    name: 'Facebook',
    clientId: process.env['FACEBOOK_APP_ID'],
    clientSecret: process.env['FACEBOOK_APP_SECRET'],
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'email public_profile',
  }),
};

const STATE_SECRET = process.env['JWT_SECRET'] || 'your-super-secret-jwt-key';
export const OAUTH_COOKIE = 'bz_oauth';

/** Sites a sign-in can return to: Bomizzel's own, and a dev machine. */
const allowedOrigin = (origin: unknown): string | null => {
  if (typeof origin !== 'string') return null;
  try {
    const u = new URL(origin);
    const ok =
      (u.protocol === 'https:' && /^((www|portal|help)\.)?bomizzel\.com$/i.test(u.hostname)) ||
      (process.env['NODE_ENV'] !== 'production' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname));
    return ok ? u.origin : null;
  } catch {
    return null;
  }
};

const isDevOrigin = (origin: string) => /\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);

const configOf = (provider: string): ProviderConfig => {
  const make = PROVIDERS[provider as Provider];
  const cfg = make?.();
  if (!cfg || !cfg.clientId || !cfg.clientSecret) {
    throw new AppError('That sign-in option is not available', 404, 'OAUTH_PROVIDER_UNAVAILABLE');
  }
  return cfg;
};

const callbackUrl = (provider: Provider) => `${publicApiUrl()}/api/auth/oauth/${provider}/callback`;

interface State {
  provider: Provider;
  nonce: string;
  company?: string;
  audience?: Audience;
  origin: string;
}

/** Name parts from a display name, for someone new. */
const nameParts = (name: string, email: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const fallback = email.split('@')[0] || 'Customer';
  return {
    firstName: (parts[0] || fallback).slice(0, 50),
    lastName: (parts.slice(1).join(' ') || '-').slice(0, 50),
  };
};

const postForm = async (url: string, body: Record<string, string>) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    logger.warn('OAuth token exchange failed', { url, status: res.status, error: data?.error });
    throw new AppError('Sign-in was not completed. Please try again.', 401, 'OAUTH_FAILED');
  }
  return data;
};

const getJson = async (url: string, accessToken: string) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok)
    throw new AppError('Sign-in was not completed. Please try again.', 401, 'OAUTH_FAILED');
  return (await res.json()) as any;
};

/** The provider's verified email and name for an authorization code. */
const identify = async (cfg: ProviderConfig, code: string) => {
  const token = await postForm(cfg.tokenUrl, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(cfg.id),
    client_id: cfg.clientId!,
    client_secret: cfg.clientSecret!,
  });
  let email = '';
  let name = '';
  if (cfg.id === 'google') {
    const me = await getJson(
      'https://openidconnect.googleapis.com/v1/userinfo',
      token.access_token
    );
    if (me.email_verified !== true && me.email_verified !== 'true') email = '';
    else email = me.email || '';
    name = me.name || '';
  } else if (cfg.id === 'microsoft') {
    const me = await getJson(
      'https://graph.microsoft.com/v1.0/me?$select=userPrincipalName,displayName',
      token.access_token
    );
    // userPrincipalName only (see the note at the top). Guests' "#EXT#" names aren't addresses.
    const upn = String(me.userPrincipalName || '');
    email = /^[^@\s#]+@[^@\s]+\.[^@\s]+$/.test(upn) ? upn : '';
    name = me.displayName || '';
  } else {
    const me = await getJson(
      'https://graph.facebook.com/v19.0/me?fields=id,name,email',
      token.access_token
    );
    email = me.email || '';
    name = me.name || '';
  }
  email = email.trim().toLowerCase();
  if (!email) {
    throw new AppError(
      `${cfg.name} didn't share a confirmed email address, so we can't match it to a Bomizzel account.`,
      401,
      'OAUTH_NO_EMAIL'
    );
  }
  return { email, name };
};

export class OAuthService {
  /** The sign-in options that are set up (frontend shows only these). */
  static providers(): Array<{ id: Provider; name: string }> {
    return (Object.keys(PROVIDERS) as Provider[])
      .map((p) => PROVIDERS[p]())
      .filter((c) => c.clientId && c.clientSecret)
      .map((c) => ({ id: c.id, name: c.name }));
  }

  /**
   * Begin: the provider's sign-in page, and the random value for the cookie.
   * `company` and `audience` say where they were signing in.
   */
  static start(
    provider: string,
    input: { company?: unknown; audience?: unknown; origin?: unknown }
  ): { redirect: string; nonce: string } {
    const cfg = configOf(provider);
    const origin = allowedOrigin(input.origin) || 'https://www.bomizzel.com';
    const company =
      typeof input.company === 'string' && /^[a-z0-9-]{1,64}$/i.test(input.company)
        ? input.company.toLowerCase()
        : undefined;
    const audience =
      input.audience === 'staff' || input.audience === 'portal' ? input.audience : undefined;
    const nonce = crypto.randomBytes(24).toString('base64url');
    const state = jwt.sign(
      { type: 'oauth_state', provider: cfg.id, nonce, company, audience, origin } as any,
      STATE_SECRET,
      { expiresIn: '10m' }
    );
    const params = new URLSearchParams({
      client_id: cfg.clientId!,
      redirect_uri: callbackUrl(cfg.id),
      response_type: 'code',
      scope: cfg.scope,
      state,
      ...(cfg.id === 'google' ? { prompt: 'select_account' } : {}),
      ...(cfg.id === 'microsoft' ? { prompt: 'select_account', response_mode: 'query' } : {}),
    });
    return { redirect: `${cfg.authorizeUrl}?${params.toString()}`, nonce };
  }

  /** Where the sign-in page was, for sending an error back to it. */
  static loginPageFor(stateToken: unknown): string {
    const s = this.readState(stateToken, true);
    if (!s) return 'https://www.bomizzel.com/login';
    if (isDevOrigin(s.origin)) {
      return s.audience === 'portal' && s.company
        ? `${s.origin}/portal/${s.company}/login`
        : `${s.origin}/login`;
    }
    if (s.audience === 'portal' && s.company) return `${portalUrl(s.company)}/login`;
    if (s.company) return staffLoginUrl(s.company);
    return `${s.origin}/login`;
  }

  private static readState(stateToken: unknown, ignoreExpiry = false): State | null {
    if (typeof stateToken !== 'string') return null;
    try {
      const s = jwt.verify(stateToken, STATE_SECRET, { ignoreExpiration: ignoreExpiry }) as any;
      return s?.type === 'oauth_state' ? s : null;
    } catch {
      return null;
    }
  }

  /**
   * Back from the provider: who they are, signed in where they asked. Returns
   * the address to send them to, with a one-time hand-off code after '#'.
   */
  static async finish(
    provider: string,
    input: { code?: unknown; state?: unknown; error?: unknown },
    cookieNonce: string | undefined
  ): Promise<string> {
    const cfg = configOf(provider);
    const state = this.readState(input.state);
    if (!state || state.provider !== cfg.id || !cookieNonce || cookieNonce !== state.nonce) {
      throw new AppError('This sign-in has expired. Please try again.', 400, 'OAUTH_STATE');
    }
    if (input.error || typeof input.code !== 'string') {
      throw new AppError('Sign-in was cancelled.', 400, 'OAUTH_CANCELLED');
    }
    const { email, name } = await identify(cfg, input.code);

    const tenant = state.company ? await subscriberForPortalName(state.company) : null;
    if (state.company && !tenant) throw new AppError('Company not found', 404, 'PORTAL_NOT_FOUND');

    let user = await db('users').whereRaw('lower(email) = ?', [email]).first();
    if (!user && state.audience === 'portal' && tenant) {
      // New on this customer portal: sign them up as its customer
      const { firstName, lastName } = nameParts(name, email);
      await PortalService.joinFromProvider(tenant.id, { email, firstName, lastName });
      user = await db('users').whereRaw('lower(email) = ?', [email]).first();
    } else if (user && state.audience === 'portal' && tenant) {
      // Has a login elsewhere on Bomizzel: joins this portal too (the
      // provider has just proven the address is theirs)
      await PortalService.joinFromProvider(tenant.id, {
        email,
        ...nameParts(name, email),
      });
    }
    if (!user) {
      throw new AppError(
        `There's no Bomizzel account for ${email}. Sign in with your email and password, or ask your administrator to add you.`,
        401,
        'OAUTH_NO_ACCOUNT'
      );
    }
    if (!user.is_active) throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    // The provider has confirmed the address
    if (!user.email_verified) {
      await db('users')
        .where('id', user.id)
        .update({ email_verified: true, updated_at: new Date() });
    }

    const session = await resolveSession(user, tenant?.id, state.audience);
    if (!session?.tenantId) {
      throw new AppError(
        state.audience === 'portal'
          ? `This account isn't a customer login${tenant ? ` for ${tenant.name}` : ''}.`
          : `This account isn't a staff login${tenant ? ` for ${tenant.name}` : ''}.`,
        403,
        state.audience === 'portal' ? 'NOT_A_PORTAL_CONTACT' : 'NOT_STAFF_HERE'
      );
    }
    const aud: Audience = session.role === 'customer' ? 'portal' : 'staff';
    const code = JWTUtils.generateHandoffToken({ userId: user.id, tid: session.tenantId, aud });
    const company = await db('companies').where('id', session.tenantId).first('support_email_slug');
    const slug = company?.support_email_slug;
    logger.info('Signed in with provider', { provider: cfg.id, userId: user.id, aud });

    if (isDevOrigin(state.origin) || !slug) {
      const path = aud === 'portal' && slug ? `/portal/${slug}` : '/agent';
      return `${state.origin}${path}#handoff=${code}`;
    }
    return aud === 'staff'
      ? `${staffLoginUrl(slug).replace(/\/login$/, '/agent')}#handoff=${code}`
      : `${portalUrl(slug)}#handoff=${code}`;
  }
}
