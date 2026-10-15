import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import RichTextEditor from './RichTextEditor';
import EmailPreview from './EmailPreview';
import { errorText } from './ui';

/**
 * An agent's own email signature, on the replies and welcome emails they
 * send customers. Left empty, their company's signature is used.
 */
const MyEmailSignature: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [initial, setInitial] = useState('');
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiService
      .getMySignature()
      .then((r) => {
        setInitial(r.html || '');
        setHtml(r.html || '');
      })
      .catch((e) => setNotice({ ok: false, text: errorText(e) }))
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const r = await apiService.saveMySignature(html);
      setInitial(r.html || '');
      setNotice({ ok: true, text: 'Signature saved.' });
    } catch (e) {
      setNotice({ ok: false, text: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">Email signature</h4>
        <p className="mt-1 text-sm text-gray-500">
          Added to the ticket replies and welcome emails you send customers. Leave it empty to use
          your company's signature.
        </p>
      </div>
      <RichTextEditor
        value={initial}
        onChange={(v) => setHtml(v.isEmpty ? '' : v.html)}
        placeholder="e.g. Jordan Lee · Service Manager · (555) 123-4567"
        minHeight={100}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || html === initial}
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save signature'}
        </button>
        {notice && (
          <span className={`text-sm ${notice.ok ? 'text-green-700' : 'text-red-600'}`}>
            {notice.text}
          </span>
        )}
      </div>
      <EmailPreview kinds={['reply', 'welcome']} signature={html} mine />
    </div>
  );
};

export default MyEmailSignature;
