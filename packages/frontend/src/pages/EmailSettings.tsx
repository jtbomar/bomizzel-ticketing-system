import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import PortalNameInput from '../components/PortalNameInput';

/**
 * Settings → Email: the subscriber's support address. Email sent there
 * becomes a ticket; public notes on a ticket are emailed to the customer, and
 * their replies come back onto the same ticket.
 */
const EmailSettings: React.FC = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  // Portal and email name (one name for both)
  const [portalName, setPortalName] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [nameOk, setNameOk] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

  useEffect(() => {
    apiService.client
      .get('/email/support-address')
      .then((res: any) => {
        setAddress(res.data.data.address);
        setEmailEnabled(res.data.data.emailEnabled);
        setPortalName(res.data.data.portalName || '');
        setPortalUrl(res.data.data.portalUrl || '');
        setNewName(res.data.data.portalName || '');
      })
      .catch((err: any) =>
        setError(err.response?.data?.error?.message || 'Could not load your support address.')
      )
      .finally(() => setLoading(false));
  }, []);

  const rename = async () => {
    if (
      !confirm(
        `Change your name to "${newName}"? Your portal moves to portal.bomizzel.com/${newName} and your support email to ${newName}@support.bomizzel.com. The old link and address keep working.`
      )
    ) {
      return;
    }
    setRenaming(true);
    setRenameError('');
    try {
      const res = await apiService.client.put('/email/portal-name', { name: newName });
      setPortalName(res.data.data.portalName);
      setPortalUrl(res.data.data.portalUrl);
      setAddress(res.data.data.address);
    } catch (err: any) {
      setRenameError(err.response?.data?.error?.message || 'Could not change the name.');
    } finally {
      setRenaming(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address is selectable on the page.
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Settings
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Email</h1>
            <p className="text-sm text-gray-600 mt-1">Turn customer emails into tickets.</p>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {loading && <p className="text-gray-600">Loading...</p>}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!loading && address && (
            <>
              <section>
                <h2 className="text-lg font-medium text-gray-900 mb-2">Your support address</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Anything emailed here becomes a ticket. The sender is added as a contact - in the
                  account with their email's domain, or a new one.
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 select-all bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-gray-900">
                    {address}
                  </code>
                  <button
                    onClick={copy}
                    className="px-4 py-3 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {!emailEnabled && (
                  <p className="mt-3 text-sm text-amber-700">
                    Sending email isn't set up on the platform yet, so customers won't get replies
                    by email until it is.
                  </p>
                )}
              </section>

              <section>
                <h2 className="text-lg font-medium text-gray-900 mb-2">
                  Customer portal and email name
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  Your customers sign in at{' '}
                  <a
                    href={portalUrl}
                    className="text-blue-700 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {portalUrl}
                  </a>
                  . The same name is used for your support address. If you change it, the old link
                  and address keep working.
                </p>
                <div className="max-w-lg">
                  <PortalNameInput
                    id="newPortalName"
                    value={newName}
                    onChange={setNewName}
                    check={async (name) =>
                      (await apiService.client.get('/email/portal-name', { params: { name } })).data
                        .data
                    }
                    onStatus={setNameOk}
                  />
                  <button
                    type="button"
                    onClick={rename}
                    disabled={renaming || !nameOk || newName === portalName}
                    className="mt-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {renaming ? 'Changing…' : 'Change name'}
                  </button>
                  {renameError && <p className="mt-2 text-sm text-red-600">{renameError}</p>}
                </div>
              </section>

              <section>
                <h2 className="text-lg font-medium text-gray-900 mb-2">How replies work</h2>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  <li>The customer gets an email confirming their ticket was received.</li>
                  <li>
                    Adding a note that isn't marked <strong>internal</strong> emails it to the
                    customer. Internal notes are never sent.
                  </li>
                  <li>
                    When the customer replies to that email, their reply is added to the same ticket
                    - and reopens it if it was resolved.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-medium text-gray-900 mb-2">
                  Use your own address (optional)
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  Keep giving customers your usual address, such as support@yourcompany.com, and
                  forward it to the address above.
                </p>
                <div className="grid gap-4 md:grid-cols-2 text-sm text-gray-700">
                  <div className="border border-gray-200 rounded-md p-4">
                    <h3 className="font-medium text-gray-900 mb-1">Google Workspace / Gmail</h3>
                    <p>
                      Gmail settings → <strong>Forwarding and POP/IMAP</strong> →{' '}
                      <strong>Add a forwarding address</strong>, then paste the address above.
                      Google sends a confirmation code, which arrives as a ticket here.
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-md p-4">
                    <h3 className="font-medium text-gray-900 mb-1">Microsoft 365 / Outlook</h3>
                    <p>
                      Outlook settings → <strong>Mail</strong> → <strong>Forwarding</strong> →{' '}
                      <strong>Enable forwarding</strong>, then paste the address above.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;
