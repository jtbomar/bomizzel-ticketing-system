import { Router, Request, Response } from 'express';
import { authRateLimiter } from '@/middleware/rateLimiter';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { OAUTH_COOKIE, OAuthService } from '@/services/OAuthService';

/**
 * Sign in with Google, Microsoft or Facebook (services/OAuthService.ts).
 *
 * GET /auth/oauth/providers          the options that are set up
 * GET /auth/oauth/:provider/start    to the provider (?company=&audience=&origin=)
 * GET /auth/oauth/:provider/callback back from it: on to the desk or portal
 */
const router = Router();
const COOKIE_PATH = '/api/auth/oauth';

const readCookie = (req: Request, name: string): string | undefined => {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
};

const setCookie = (res: Response, value: string, maxAge: number) => {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${OAUTH_COOKIE}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
  );
};

router.get('/providers', (_req, res) => {
  res.json({ providers: OAuthService.providers() });
});

router.get('/:provider/start', authRateLimiter, (req, res, next) => {
  try {
    const { redirect, nonce } = OAuthService.start(req.params.provider!, req.query);
    setCookie(res, nonce, 600);
    res.redirect(302, redirect);
  } catch (error) {
    next(error);
  }
});

router.get('/:provider/callback', async (req, res) => {
  const nonce = readCookie(req, OAUTH_COOKIE);
  setCookie(res, '', 0);
  try {
    res.redirect(302, await OAuthService.finish(req.params.provider!, req.query, nonce));
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : 'Sign-in was not completed. Please try again.';
    if (!(error instanceof AppError)) logger.error('OAuth sign-in failed', { error });
    res.redirect(
      302,
      `${OAuthService.loginPageFor(req.query['state'])}#oauth_error=${encodeURIComponent(message)}`
    );
  }
});

export default router;
