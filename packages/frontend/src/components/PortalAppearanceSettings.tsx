import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { errorText } from './ui';

/**
 * Settings > Rebranding: how your customer portal looks - a background
 * picture (full page on sign-in, a banner once signed in) and a welcome
 * title and message on the sign-in page. Logo, colour and tab icon come from
 * the branding above.
 */

const MAX_WIDTH = 1920;

/** Shrink a picture to at most MAX_WIDTH wide as a JPEG, so the portal loads fast. */
const shrink = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file couldn't be read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a picture we can use"));
      img.onload = () => {
        const scale = Math.min(1, MAX_WIDTH / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Your browser couldn't resize the picture"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

const PortalAppearanceSettings: React.FC<{ color?: string; logo?: string; name?: string }> = ({
  color = '#2563eb',
  logo,
  name = 'Your company',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  // undefined: unchanged; '': remove; data: URI: new picture
  const [newBackground, setNewBackground] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [initial, setInitial] = useState({ title: '', text: '' });
  const [portalUrl, setPortalUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      apiService.getBranding(),
      apiService.client.get('/email/support-address').catch(() => null),
    ])
      .then(([b, addr]: any[]) => {
        const d = b?.data || {};
        setSavedUrl(d.portalBackgroundUrl || null);
        setTitle(d.portalWelcomeTitle || '');
        setText(d.portalWelcomeText || '');
        setInitial({ title: d.portalWelcomeTitle || '', text: d.portalWelcomeText || '' });
        setPortalUrl(addr?.data?.data?.portalUrl || '');
      })
      .catch(() => setNotice({ ok: false, text: "Couldn't load your portal settings." }))
      .finally(() => setLoaded(true));
  }, []);

  const background = newBackground === undefined ? savedUrl : newBackground || null;
  const dirty = newBackground !== undefined || title !== initial.title || text !== initial.text;

  const pick = async (file?: File) => {
    if (!file) return;
    setNotice(null);
    try {
      const data = await shrink(file);
      if (data.length > 4 * 1024 * 1024)
        throw new Error('That picture is too large even after resizing');
      setNewBackground(data);
    } catch (e: any) {
      setNotice({ ok: false, text: e.message });
    }
  };

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await apiService.updateBranding({
        ...(newBackground !== undefined ? { portalBackground: newBackground } : {}),
        portalWelcomeTitle: title,
        portalWelcomeText: text,
      } as any);
      const fresh = (await apiService.getBranding())?.data || {};
      setSavedUrl(fresh.portalBackgroundUrl || null);
      setNewBackground(undefined);
      setInitial({ title, text });
      setNotice({ ok: true, text: 'Saved. Your portal shows this now.' });
    } catch (e) {
      setNotice({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <section className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Customer portal</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 max-w-3xl">
            Make the page your customers sign in to look like you. It uses your logo, primary colour
            and favicon from above, plus a background picture and welcome below.
          </p>
        </div>
        {portalUrl && (
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blue-700 hover:underline whitespace-nowrap"
          >
            Open your portal ↗
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Background picture
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Fills the sign-in page and shows as a banner once customers are signed in. A wide
              photo works best; it's resized for you.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              >
                {background ? 'Change picture' : 'Upload picture'}
              </button>
              {background && (
                <button
                  type="button"
                  onClick={() => setNewBackground('')}
                  className="px-3 py-1.5 text-sm rounded-md text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="portalWelcomeTitle"
              className="text-sm font-semibold text-gray-900 dark:text-white"
            >
              Welcome title
            </label>
            <input
              id="portalWelcomeTitle"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Welcome to ${name} support`}
              className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label
              htmlFor="portalWelcomeText"
              className="text-sm font-semibold text-gray-900 dark:text-white"
            >
              Welcome message
            </label>
            <textarea
              id="portalWelcomeText"
              value={text}
              maxLength={500}
              rows={3}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Sign in to open a ticket or check on one. For emergencies call (555) 201-4400."
              className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save portal look'}
            </button>
            {notice && (
              <span className={`text-sm ${notice.ok ? 'text-green-700' : 'text-red-600'}`}>
                {notice.text}
              </span>
            )}
          </div>
        </div>

        {/* A small picture of the sign-in page with these settings */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
            Preview: sign-in page
          </div>
          <div
            className="relative h-80 bg-gray-50"
            style={
              background
                ? {
                    backgroundImage: `linear-gradient(rgba(17,24,39,0.45), rgba(17,24,39,0.55)), url("${background}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            <div
              className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2"
              style={{ borderTop: `3px solid ${color}` }}
            >
              {logo ? (
                <img src={logo} alt="" className="h-6 max-w-[100px] object-contain" />
              ) : (
                <span className="text-xs font-bold" style={{ color }}>
                  {name}
                </span>
              )}
              <span className="text-[10px] text-gray-500">Support</span>
            </div>
            <div className={`px-4 pt-4 text-center ${background ? 'text-white' : 'text-gray-900'}`}>
              {title && <p className="text-base font-bold drop-shadow">{title}</p>}
              {text && (
                <p
                  className={`mt-1 text-[11px] line-clamp-2 ${background ? 'text-white/90' : 'text-gray-600'}`}
                >
                  {text}
                </p>
              )}
            </div>
            <div className="mx-auto mt-3 w-56 rounded-md bg-white shadow p-3 space-y-2">
              <div className="h-2 w-24 rounded bg-gray-300" />
              <div className="h-5 rounded border border-gray-200" />
              <div className="h-5 rounded border border-gray-200" />
              <div className="h-5 rounded" style={{ background: color }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PortalAppearanceSettings;
