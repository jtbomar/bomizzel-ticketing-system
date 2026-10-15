import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import RichTextContent from '../components/RichTextContent';
import { portalApi, portalError } from './portalApi';
import { usePortal } from './PortalApp';
import { BrandButton, inputClass } from './PortalAuthPages';

/** A customer's tickets on the portal: the list, a new one, and one ticket. */

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
};
const statusLabel = (s: string) =>
  STATUS_LABEL[s] || s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const isFinished = (s: string) => s === 'resolved' || s === 'closed';

const ref = (t: any) => (t.ticketNumber ? `#${t.ticketNumber}` : '');
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const size = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      isFinished(status) ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'
    }`}
  >
    {statusLabel(status)}
  </span>
);

/** Waiting for approval to see the company's tickets, or ask for it. */
const AccessBanner: React.FC = () => {
  const { session, slug, loadSession, brand } = usePortal();
  const [busy, setBusy] = useState(false);
  if (!session || session.scope === 'company') return null;
  const pending = session.accessRequest?.status === 'pending';
  const ask = async () => {
    setBusy(true);
    try {
      await portalApi.post(`/portal/${encodeURIComponent(slug)}/access-request`);
      await loadSession();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {pending ? (
        <>
          You're seeing the tickets you opened. {brand.name} has been asked to let you see all of{' '}
          {session.account.name}'s tickets too.
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>You're seeing the tickets you opened.</span>
          <button type="button" onClick={ask} disabled={busy} className="font-medium underline">
            {busy ? 'Asking…' : `Ask to see all of ${session.account.name}'s tickets`}
          </button>
        </div>
      )}
    </div>
  );
};

export const PortalTicketList: React.FC = () => {
  const { session, path } = usePortal();
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    portalApi
      .get('/tickets', { params: { limit: 100, page: 1 } })
      .then((r) => setTickets(r.data.data || []))
      .catch((e) => setError(portalError(e, "Couldn't load your tickets.")));
  }, []);

  const shown = (tickets || [])
    .filter((t) => show === 'all' || !isFinished(t.status))
    .filter((t) => !mineOnly || t.submitterId === session?.user.id)
    .sort((a, b) => +new Date(b.updatedAt || b.createdAt) - +new Date(a.updatedAt || a.createdAt));

  return (
    <div>
      <AccessBanner />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">
          {session?.scope === 'company' ? `${session.account.name} tickets` : 'Your tickets'}
        </h1>
        <Link to={path('tickets/new')}>
          <BrandButton type="button">New ticket</BrandButton>
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
        <div
          role="tablist"
          className="inline-flex rounded-md border border-gray-300 overflow-hidden"
        >
          {(['open', 'all'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={show === k}
              onClick={() => setShow(k)}
              className={`px-3 py-1.5 ${show === k ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
            >
              {k === 'open' ? 'Open' : 'All'}
            </button>
          ))}
        </div>
        {session?.scope === 'company' && (
          <label className="inline-flex items-center gap-2 text-gray-700">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            Only mine
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tickets && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {tickets && shown.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {show === 'open' ? 'No open tickets.' : 'No tickets yet.'}{' '}
          <Link to={path('tickets/new')} className="underline">
            Open a ticket
          </Link>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {shown.map((t) => (
            <li key={t.id}>
              <Link
                to={path(`tickets/${t.id}`)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ref(t)} · Opened {when(t.createdAt)}
                    {session?.scope === 'company' &&
                    t.submitter &&
                    t.submitterId !== session.user.id
                      ? ` by ${t.submitter.firstName} ${t.submitter.lastName}`
                      : ''}
                  </p>
                </div>
                <StatusPill status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Pick files to send with a ticket or reply. */
const FilePicker: React.FC<{ files: File[]; onChange: (files: File[]) => void }> = ({
  files,
  onChange,
}) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files || [])]);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="text-sm text-gray-700 underline"
      >
        Attach files
      </button>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2">
              <span className="truncate">{f.name}</span>
              <span className="text-gray-400 text-xs">{size(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-red-600 text-xs"
                aria-label={`Remove ${f.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Upload each file to the ticket (on a note, if given). Returns the names that failed. */
const uploadAll = async (ticketId: string, files: File[], noteId?: string): Promise<string[]> => {
  const failed: string[] = [];
  for (const file of files) {
    const body = new FormData();
    body.append('file', file);
    if (noteId) body.append('noteId', noteId);
    try {
      await portalApi.post(`/tickets/${ticketId}/attachments`, body);
    } catch {
      failed.push(file.name);
    }
  }
  return failed;
};

export const PortalNewTicket: React.FC = () => {
  const { slug, path } = usePortal();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<
    { id: number; name: string; isDefault: boolean }[]
  >([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    portalApi
      .get(`/portal/${encodeURIComponent(slug)}/departments`)
      .then((r) => {
        setDepartments(r.data.departments || []);
        const d =
          (r.data.departments || []).find((x: any) => x.isDefault) || r.data.departments?.[0];
        if (d) setDepartmentId(d.id);
      })
      .catch(() => undefined);
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await portalApi.post(`/portal/${encodeURIComponent(slug)}/tickets`, {
        title: title.trim(),
        description: description.trim(),
        departmentId: departmentId || null,
      });
      const id = res.data.ticket.id;
      const failed = await uploadAll(id, files);
      navigate(path(`tickets/${id}`), {
        state: failed.length
          ? { notice: `These files didn't upload: ${failed.join(', ')}` }
          : undefined,
      });
    } catch (err) {
      setError(portalError(err, "Your ticket couldn't be sent."));
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link to={path()} className="text-sm text-gray-600 hover:underline">
        ← Back to tickets
      </Link>
      <h1 className="mt-2 text-xl font-semibold">New ticket</h1>
      <form
        onSubmit={submit}
        className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-5"
      >
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {departments.length > 1 && (
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department
            </label>
            <select
              id="department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
              className={inputClass}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            id="title"
            required
            maxLength={255}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            How can we help?
          </label>
          <textarea
            id="description"
            required
            rows={7}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        <FilePicker files={files} onChange={setFiles} />
        <BrandButton type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send ticket'}
        </BrandButton>
      </form>
    </div>
  );
};

/** Download an attachment (the API needs the sign-in, so it's fetched, then saved). */
const download = async (id: string, name: string) => {
  const res = await portalApi.get(`/files/${id}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

const Attachment: React.FC<{ file: any }> = ({ file }) => (
  <button
    type="button"
    onClick={() =>
      download(file.id, file.originalName).catch(() => alert("That file couldn't be downloaded."))
    }
    className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
  >
    📎 <span className="max-w-[220px] truncate">{file.originalName}</span>
    {file.fileSize ? <span className="text-gray-400">{size(file.fileSize)}</span> : null}
  </button>
);

export const PortalTicketView: React.FC = () => {
  const { ticketId = '' } = useParams();
  const { slug, session, path, brand } = usePortal();
  const [ticket, setTicket] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const location = useLocation();
  const [notice, setNotice] = useState(((location.state as any)?.notice as string) || '');

  const load = useCallback(async () => {
    try {
      const [t, n, f] = await Promise.all([
        portalApi.get(`/tickets/${ticketId}`),
        portalApi.get(`/tickets/${ticketId}/notes`, { params: { limit: 200 } }),
        portalApi.get(`/tickets/${ticketId}/attachments`),
      ]);
      setTicket(t.data.data);
      setNotes(n.data.data || []);
      setFiles(f.data.data || []);
    } catch (e) {
      setError(portalError(e, "This ticket couldn't be found."));
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() && !replyFiles.length) return;
    setSending(true);
    setNotice('');
    try {
      const res = await portalApi.post(`/tickets/${ticketId}/notes`, {
        content: reply.trim() || '(attached files)',
      });
      const failed = await uploadAll(ticketId, replyFiles, res.data.data?.id);
      if (failed.length) setNotice(`These files didn't upload: ${failed.join(', ')}`);
      setReply('');
      setReplyFiles([]);
      await load();
    } catch (err) {
      setNotice(portalError(err, "Your reply couldn't be sent."));
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!confirm('Close this ticket? Let us know if you need anything else by opening a new one.'))
      return;
    try {
      await portalApi.post(`/portal/${encodeURIComponent(slug)}/tickets/${ticketId}/close`);
      await load();
    } catch (err) {
      setNotice(portalError(err, "The ticket couldn't be closed."));
    }
  };

  if (error) {
    return (
      <div>
        <Link to={path()} className="text-sm text-gray-600 hover:underline">
          ← Back to tickets
        </Link>
        <p className="mt-4 text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!ticket) return <p className="text-sm text-gray-500">Loading…</p>;

  const mine = ticket.submitterId === session?.user.id;
  const closed = ticket.status === 'closed';
  // Files sent with the ticket itself (not with a reply)
  const ticketFiles = files.filter((f) => !f.noteId);

  return (
    <div>
      <Link to={path()} className="text-sm text-gray-600 hover:underline">
        ← Back to tickets
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold break-words">{ticket.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ref(ticket)} · Opened {when(ticket.createdAt)}
            {!mine && ticket.submitter
              ? ` by ${ticket.submitter.firstName} ${ticket.submitter.lastName}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={ticket.status} />
          {mine && !closed && (
            <button
              type="button"
              onClick={close}
              className="text-sm rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50"
            >
              Close ticket
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="mt-3 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}

      <ol className="mt-5 space-y-4">
        <li className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-2">
            {mine
              ? 'You'
              : `${ticket.submitter?.firstName || ''} ${ticket.submitter?.lastName || ''}`}{' '}
            · {when(ticket.createdAt)}
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-900">{ticket.description}</p>
          {ticketFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ticketFiles.map((f) => (
                <Attachment key={f.id} file={f} />
              ))}
            </div>
          )}
        </li>
        {notes.map((n) => {
          const fromMe = n.authorId === session?.user.id;
          const fromCustomer = fromMe || n.authorId === ticket.submitterId;
          return (
            <li
              key={n.id}
              className={`rounded-lg border p-4 ${fromCustomer ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'}`}
              style={fromCustomer ? undefined : { borderLeft: `3px solid ${brand.color}` }}
            >
              <p className="text-xs text-gray-500 mb-2">
                {fromMe ? 'You' : `${n.author?.firstName || ''} ${n.author?.lastName || ''}`.trim()}
                {!fromCustomer && <span> · {brand.name}</span>} · {when(n.createdAt)}
              </p>
              <RichTextContent
                html={n.contentHtml}
                text={n.content}
                className="text-sm text-gray-900"
              />
              {n.attachments?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.attachments.map((f: any) => (
                    <Attachment key={f.id} file={f} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {closed ? (
        <p className="mt-6 text-sm text-gray-600">
          This ticket is closed.{' '}
          <Link to={path('tickets/new')} className="underline">
            Open a new ticket
          </Link>{' '}
          if you need more help.
        </p>
      ) : (
        <form
          onSubmit={send}
          className="mt-6 rounded-lg border border-gray-200 bg-white p-4 space-y-3"
        >
          <label htmlFor="reply" className="block text-sm font-medium text-gray-700">
            Reply
          </label>
          <textarea
            id="reply"
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className={inputClass}
          />
          <FilePicker files={replyFiles} onChange={setReplyFiles} />
          <BrandButton type="submit" disabled={sending || (!reply.trim() && !replyFiles.length)}>
            {sending ? 'Sending…' : 'Send reply'}
          </BrandButton>
        </form>
      )}
    </div>
  );
};
