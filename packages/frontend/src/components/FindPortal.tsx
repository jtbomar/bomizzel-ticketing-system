import React, { useState } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../services/api';
import { customerPortalBase } from '../portal/portalApi';

/**
 * "Looking for your customer portal?": a company's customers type its portal
 * name and go to help.bomizzel.com/<name>. On the staff login page (shared
 * by every company) and the bare help.bomizzel.com page.
 */

const FindPortal: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const wanted = name.trim().toLowerCase();
    if (!wanted) return;
    setBusy(true);
    setError('');
    try {
      const r = await axios.get(`${getApiBaseUrl()}/portal/${encodeURIComponent(wanted)}`);
      window.location.href = `${customerPortalBase()}/${r.data.portalName || wanted}`;
    } catch {
      setError("There's no support portal with that name. Check the link your provider gave you.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={go} className={className}>
      <label htmlFor="findPortal" className="block text-sm font-medium text-gray-900">
        Looking for your customer support portal?
      </label>
      <p className="text-xs text-gray-500 mt-0.5">
        Enter the portal name of the company that supports you.
      </p>
      <div className="mt-2 flex rounded-md shadow-sm">
        <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 whitespace-nowrap">
          help.bomizzel.com/
        </span>
        <input
          id="findPortal"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          placeholder="company-name"
          className="block w-full min-w-0 flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-r-md border border-l-0 border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? '…' : 'Go'}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </form>
  );
};

export default FindPortal;
