import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import RichTextEditor from './RichTextEditor';
import EmailPreview from './EmailPreview';
import { Switch, errorText } from './ui';

/**
 * Settings > Rebranding: the email your customers get. It carries the logo,
 * colour, name and tagline above; here are the company signature (for
 * automatic emails and agents without their own) and whether a contact an
 * agent adds is sent the welcome email straight away.
 */
const CustomerEmailSettings: React.FC<{ brandKey?: string; hasLogo?: boolean }> = ({
  brandKey,
  hasLogo,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [signature, setSignature] = useState('');
  const [initialSignature, setInitialSignature] = useState('');
  const [autoInvite, setAutoInvite] = useState(false);
  const [savedAutoInvite, setSavedAutoInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    apiService
      .getBranding()
      .then((res: any) => {
        const d = res?.data || {};
        setSignature(d.emailSignature || '');
        setInitialSignature(d.emailSignature || '');
        setAutoInvite(!!d.autoInviteContacts);
        setSavedAutoInvite(!!d.autoInviteContacts);
      })
      .catch(() => setNotice({ ok: false, text: "Couldn't load your email settings." }))
      .finally(() => setLoaded(true));
  }, []);

  const dirty = signature !== initialSignature || autoInvite !== savedAutoInvite;

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await apiService.updateBranding({
        emailSignature: signature,
        autoInviteContacts: autoInvite,
      });
      setInitialSignature(signature);
      setSavedAutoInvite(autoInvite);
      setSavedAt(Date.now());
      setNotice({ ok: true, text: 'Saved. Your customers get this from now on.' });
    } catch (e) {
      setNotice({ ok: false, text: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <section className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Customer emails</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 max-w-3xl">
        Every email your customers get (the welcome, ticket replies, and password resets) carries
        your logo, primary colour, company name, tagline and website from above, and comes from your
        company's name.
        {hasLogo === false && ' Add a logo above so it shows at the top of each email.'}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Company signature
            </h3>
            <p className="mt-1 mb-2 text-xs text-gray-500">
              Goes on automatic emails, and on replies from agents who haven't set their own in
              their profile.
            </p>
            <RichTextEditor
              value={initialSignature}
              onChange={(v) => setSignature(v.isEmpty ? '' : v.html)}
              placeholder="e.g. The Support Team · Your Company · (555) 123-4567"
              minHeight={110}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Welcome new contacts automatically
              </p>
              <p className="mt-1 text-xs text-gray-500">
                When an agent adds a contact, the welcome email (with a link to choose a password)
                is ticked to go out. Agents can still untick it for one contact.
              </p>
            </div>
            <Switch
              checked={autoInvite}
              onChange={setAutoInvite}
              label="Welcome new contacts automatically"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save email settings'}
            </button>
            {notice && (
              <span className={`text-sm ${notice.ok ? 'text-green-700' : 'text-red-600'}`}>
                {notice.text}
              </span>
            )}
          </div>
        </div>

        <EmailPreview signature={signature} refreshKey={`${brandKey}-${savedAt}`} />
      </div>
    </section>
  );
};

export default CustomerEmailSettings;
