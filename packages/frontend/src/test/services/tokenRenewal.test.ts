import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { apiService } from '../../services/api';

/**
 * An expired access token is renewed with the refresh token and the request
 * retried, instead of signing the user out (which happened 15 minutes after
 * every login).
 */
describe('token renewal', () => {
  const client = (apiService as any).client;
  let calls: string[];

  beforeEach(() => {
    localStorage.clear();
    calls = [];
    // The API: only the renewed token is accepted
    client.defaults.adapter = async (config: any) => {
      const auth = config.headers?.Authorization || config.headers?.get?.('Authorization');
      calls.push(`${config.url} ${auth}`);
      if (auth !== 'Bearer new-token') {
        return Promise.reject(
          Object.assign(new Error('401'), {
            config,
            response: { status: 401, data: {}, headers: {}, config },
          })
        );
      }
      return { data: { ok: true, url: config.url }, status: 200, statusText: 'OK', headers: {}, config };
    };
    Object.defineProperty(window, 'location', {
      value: { href: '/agent', pathname: '/agent' },
      writable: true,
    });
  });

  it('renews once and retries, even when two requests fail together', async () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('refreshToken', 'refresh-1');
    const refresh = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { token: 'new-token', refreshToken: 'refresh-2' } });

    const [a, b] = await Promise.all([apiService.getTickets(), apiService.getMacros()]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0]![1]).toEqual({ refreshToken: 'refresh-1' });
    expect(localStorage.getItem('token')).toBe('new-token');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-2');
    expect(window.location.href).toBe('/agent');
    refresh.mockRestore();
  });

  it('signs out when the login can no longer be renewed', async () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('refreshToken', 'revoked');
    localStorage.setItem('user', '{}');
    const refresh = vi.spyOn(axios, 'post').mockRejectedValue(new Error('401'));

    await expect(apiService.getTickets()).rejects.toBeTruthy();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/login');
    refresh.mockRestore();
  });

  it('signs out straight away without a refresh token (logged in before this fix)', async () => {
    localStorage.setItem('token', 'expired-token');
    const refresh = vi.spyOn(axios, 'post');
    await expect(apiService.getTickets()).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
    refresh.mockRestore();
  });
});
