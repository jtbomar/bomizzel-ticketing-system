import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { errorText } from './ui';

/**
 * Customer portal access, staff side. A contact who signed up on the portal
 * (or emailed in) sees only the tickets they opened until an admin lets them
 * see their company's. PortalAccessCard sits on the contact's page;
 * PortalAccessRequests lists everyone waiting.
 */

interface AccessRequest {
  id: string;
  status: string;
  createdAt: string;
  companyName: string | null;
  account: { id: string; name: string } | null;
  contact: { id: string; email: string; name: string };
}

const useAccounts = (enabled: boolean) => {
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!enabled) return;
    apiService
      .getCompanies({ limit: 500 })
      .then((r: any) =>
        setAccounts((r.data || r.companies || []).map((c: any) => ({ id: c.id, name: c.name })))
      )
      .catch(() => undefined);
  }, [enabled]);
  return accounts;
};

export const PortalAccessCard: React.FC<{ contactId: string; onChanged?: () => void }> = ({
  contactId,
  onChanged,
}) => {
  const { user } = useAuth() as any;
  const isAdmin = user?.role === 'admin';
  const [state, setState] = useState<{
    scope: 'own' | 'company';
    pendingRequest: AccessRequest | null;
  } | null>(null);
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const accounts = useAccounts(isAdmin);

  const load = useCallback(() => {
    apiService.client
      .get(`/portal-access/contacts/${contactId}`)
      .then((r: any) => {
        setState(r.data);
        setAccountId(r.data.pendingRequest?.account?.id || '');
      })
      .catch(() => setState(null));
  }, [contactId]);

  useEffect(load, [load]);

  if (!state) return null;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      load();
      onChanged?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const req = state.pendingRequest;
  const allow = () =>
    act(() =>
      req
        ? apiService.client.post(`/portal-access/requests/${req.id}/decide`, {
            decision: 'approve',
            companyId: accountId || null,
          })
        : apiService.client.post(`/portal-access/contacts/${contactId}/allow`, {})
    );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Portal access</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {state.scope === 'company'
          ? "Can see all of their company's tickets on your customer portal."
          : 'Can see only the tickets they opened.'}
      </p>
      {req && (
        <p className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Asked on {new Date(req.createdAt).toLocaleDateString()} to see{' '}
          {req.account?.name || req.companyName || 'their company'}'s tickets.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {isAdmin ? (
        <div className="mt-4 space-y-3">
          {state.scope === 'own' && (
            <>
              {accounts.length > 0 && (
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Account
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Keep their current account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={allow}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Allow portal access
                </button>
                {req && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        apiService.client.post(`/portal-access/requests/${req.id}/decide`, {
                          decision: 'deny',
                        })
                      )
                    }
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Deny
                  </button>
                )}
              </div>
            </>
          )}
          {state.scope === 'company' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                confirm("They'll only see the tickets they opened. Continue?") &&
                act(() => apiService.client.post(`/portal-access/contacts/${contactId}/revoke`))
              }
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Limit to their own tickets
            </button>
          )}
        </div>
      ) : (
        req && <p className="mt-3 text-xs text-gray-500">An admin can approve this.</p>
      )}
    </div>
  );
};

export const PortalAccessRequests: React.FC = () => {
  const { user } = useAuth() as any;
  const isAdmin = user?.role === 'admin';
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiService.client
      .get('/portal-access/requests')
      .then((r: any) => setRequests(r.data.requests || []))
      .catch(() => setRequests([]));
  }, []);
  useEffect(load, [load]);

  if (!requests.length) return null;

  const decide = async (id: string, decision: 'approve' | 'deny') => {
    setBusy(id);
    setError('');
    try {
      await apiService.client.post(`/portal-access/requests/${id}/decide`, { decision });
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-900">
        {requests.length} {requests.length === 1 ? 'person is' : 'people are'} asking for portal
        access
      </h2>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <ul className="mt-3 divide-y divide-amber-200">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <Link
                to={`/agent/customers/${r.contact.id}`}
                className="font-medium text-gray-900 hover:underline"
              >
                {r.contact.name || r.contact.email}
              </Link>
              <span className="text-gray-600"> · {r.contact.email}</span>
              <div className="text-xs text-gray-600">
                Wants to see {r.account?.name || r.companyName || 'their company'}'s tickets ·{' '}
                {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, 'approve')}
                  className="px-3 py-1 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, 'deny')}
                  className="px-3 py-1 rounded-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
