import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getApiBaseUrl } from '../services/api';

/**
 * Where an admin's Approve / Deny buttons in the portal access email land.
 * Opening the link only shows the request (mail apps open links to scan
 * them); the admin confirms with a click. The link itself is the admin's, so
 * no sign-in is needed.
 */
const PortalAccessDecision: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const wanted = params.get('decision') === 'deny' ? 'deny' : 'approve';
  const [request, setRequest] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const api = getApiBaseUrl();

  useEffect(() => {
    axios
      .get(`${api}/portal-access/decision`, { params: { token } })
      .then((r) => setRequest(r.data))
      .catch((e) =>
        setError(e.response?.data?.error?.message || 'This link has expired or is not valid.')
      );
  }, [api, token]);

  const decide = async (decision: 'approve' | 'deny') => {
    setBusy(true);
    try {
      const r = await axios.post(`${api}/portal-access/decision`, { token, decision });
      setResult(r.data);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || "That didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const company = request?.account?.name || request?.companyName || 'their company';
  const done = result || (request && request.status !== 'pending' ? request : null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Portal access request</h1>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!error && !request && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
        {request && (
          <>
            <p className="mt-4 text-sm text-gray-700">
              <strong>{request.contact.name || request.contact.email}</strong> (
              {request.contact.email}) is asking to see <strong>{company}</strong>'s tickets on{' '}
              {request.subscriberName}'s customer portal.
            </p>
            {done ? (
              <p
                className={`mt-5 rounded-md px-3 py-2 text-sm ${
                  done.status === 'approved'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {result?.alreadyDecided || (!result && done)
                  ? `This request was already ${done.status}.`
                  : done.status === 'approved'
                    ? `Approved. They can now see ${company}'s tickets.`
                    : 'Denied. They still see only the tickets they opened.'}
              </p>
            ) : (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide('approve')}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                    wanted === 'approve'
                      ? 'bg-green-700 hover:bg-green-800'
                      : 'bg-green-600/80 hover:bg-green-700'
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide('deny')}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                    wanted === 'deny'
                      ? 'bg-red-700 text-white hover:bg-red-800'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Deny
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PortalAccessDecision;
