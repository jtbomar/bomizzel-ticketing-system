import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import RichTextContent from '../components/RichTextContent';
import { CustomProperty, Row, ghost } from '../components/PropertyList';
import AuthImage from '../components/AuthImage';
import { droppedFiles, openAttachment } from '../utils/attachments';
import { priorityBadgeClass, priorityLabel } from '../utils/priority';
import { ticketRef } from '../utils/ticketRef';
import type { ModuleLayout } from '../utils/fields';

/**
 * A ticket, full page (/agent/tickets/:ticketId), laid out like Zoho Desk:
 * its properties down the left - every field of the ticket layout, edited in
 * place - and the conversation in the middle, with the reply box under it.
 *
 * It replaces the dashboard's ticket pop-up, which squeezed all of this into
 * a scrolling window. Everything here is loaded from and saved to the server.
 */

const STATUSES = [
  { value: 'open', label: 'Open', badge: 'bg-red-100 text-red-800' },
  { value: 'in_progress', label: 'In Progress', badge: 'bg-yellow-100 text-yellow-800' },
  { value: 'waiting', label: 'Waiting', badge: 'bg-blue-100 text-blue-800' },
  { value: 'resolved', label: 'Resolved', badge: 'bg-green-100 text-green-800' },
  { value: 'closed', label: 'Closed', badge: 'bg-gray-200 text-gray-800' },
];
const RESOLUTIONS: Record<string, string> = {
  fixed: 'Fixed',
  wont_do: "Won't do",
  duplicate: 'Duplicate',
  no_response: 'No response',
};

interface Person {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}
interface TicketData {
  id: string;
  ticketNumber?: number | null;
  title: string;
  description: string;
  status: string;
  priority: number;
  resolution?: string | null;
  departmentId?: number | null;
  productId?: number | null;
  phone?: string | null;
  source?: string;
  customFieldValues?: Record<string, unknown>;
  submitter?: Person;
  assignedTo?: Person | null;
  company?: { id?: string; name?: string };
  companyId?: string;
  createdAt: string;
}
interface Note {
  id: string;
  authorId: string;
  author?: Person;
  content: string;
  contentHtml?: string | null;
  isInternal: boolean;
  isEmailGenerated?: boolean;
  createdAt: string;
}
interface Attachment {
  id: string;
  noteId?: string | null;
  originalName?: string;
  fileName?: string;
  fileSize: number;
  mimeType?: string;
  isImage?: boolean;
}

const fullName = (p?: Person | null) =>
  p ? [p.firstName, p.lastName].filter((x) => x && x !== '-').join(' ') || p.email || '' : '';
const initials = (p?: Person | null) =>
  (fullName(p) || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const sizeText = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
const errorText = (error: any): string =>
  error.response?.data?.error?.message ||
  error.response?.data?.error ||
  error.response?.data?.message ||
  error.message;

const AttachmentChip: React.FC<{ a: Attachment }> = ({ a }) => {
  const name = a.originalName || a.fileName || 'file';
  const open = () => openAttachment(a.id, name, a.mimeType);
  return a.isImage ? (
    <button
      type="button"
      onClick={open}
      className="block rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-500"
      title={name}
    >
      <AuthImage fileId={a.id} alt={name} className="h-24 w-32 object-cover" />
    </button>
  ) : (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      <span aria-hidden="true">📎</span>
      <span className="max-w-[12rem] truncate">{name}</span>
      <span className="text-gray-400">{sizeText(a.fileSize)}</span>
    </button>
  );
};

const TicketDetailPage: React.FC = () => {
  const { ticketId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [layout, setLayout] = useState<ModuleLayout | null>(null);
  const [agents, setAgents] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<
    { id: number; name: string; product_code: string; department_id: number }[]
  >([]);
  const [macros, setMacros] = useState<{ id: string; name: string; shared: boolean }[]>([]);

  // Composer
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [draftHtml, setDraftHtml] = useState('');
  const [draftText, setDraftText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteHtml, setEditingNoteHtml] = useState('');
  const [pendingResolve, setPendingResolve] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadNotes = useCallback(async () => {
    const [n, a] = await Promise.all([
      apiService.getTicketNotes(ticketId, { includeInternal: true, limit: 200 }),
      apiService.getTicketAttachments(ticketId),
    ]);
    setNotes(
      ((n.data || []) as Note[])
        .slice()
        .sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime())
    );
    setAttachments(Array.isArray(a) ? a : a.data || []);
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    setTicket(null);
    setLoadError('');
    apiService
      .getTicket(ticketId)
      .then((r: any) => !cancelled && setTicket(r.data || r.ticket || r))
      .catch((e: any) =>
        setLoadError(e.response?.status === 404 ? 'This ticket doesn’t exist.' : errorText(e))
      );
    loadNotes().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ticketId, loadNotes]);

  useEffect(() => {
    apiService
      .getFields('tickets')
      .then(setLayout)
      .catch(() => setLayout(null));
    apiService
      .getAgents({ status: 'active' })
      .then((r: any) => setAgents(r.data || []))
      .catch(() => setAgents([]));
    apiService
      .getDepartments()
      .then((r: any) => setDepartments(Array.isArray(r) ? r : r.data || []))
      .catch(() => setDepartments([]));
    apiService
      .getProducts()
      .then((r: any) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => setProducts([]));
    apiService
      .getMacros()
      .then((r: any) => setMacros(r.macros || []))
      .catch(() => setMacros([]));
  }, []);

  /** Save changes to the ticket; the screen shows them at once, and is put back if refused. */
  const save = async (patch: Record<string, unknown>, local: Partial<TicketData>) => {
    if (!ticket) return;
    const before = ticket;
    setTicket({ ...ticket, ...local });
    try {
      const r = await apiService.updateTicket(ticket.id, patch);
      const t = r.data || r;
      if (t?.id) setTicket(t);
    } catch (error: any) {
      setTicket(before);
      alert(`Couldn't save: ${errorText(error)}`);
    }
  };

  const setStatus = (status: string) => {
    if (!ticket || status === ticket.status) return;
    if (status === 'resolved') {
      setPendingResolve(true);
      return;
    }
    save({ status }, { status });
  };

  const resolveAs = (resolution: string | null) => {
    setPendingResolve(false);
    if (resolution) save({ status: 'resolved', resolution }, { status: 'resolved', resolution });
  };

  const send = async () => {
    if (!ticket || (!draftText.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    try {
      let noteId: string | undefined;
      if (draftText.trim()) {
        const r = await apiService.createTicketNote(ticket.id, {
          content: draftText.trim(),
          contentHtml: draftHtml || undefined,
          isInternal: mode === 'note',
        });
        noteId = (r.data || r).id;
      }
      for (const file of pendingFiles) {
        try {
          await apiService.uploadFile(ticket.id, file, noteId);
        } catch (error: any) {
          alert(`Couldn't attach ${file.name}: ${errorText(error)}`);
        }
      }
      setDraftHtml('');
      setDraftText('');
      setPendingFiles([]);
      setNotice('');
      await loadNotes();
    } catch (error: any) {
      alert(`Couldn't send: ${errorText(error)}`);
    } finally {
      setSending(false);
    }
  };

  const applyMacro = async (macroId: string) => {
    if (!ticket) return;
    const macro = macros.find((m) => m.id === macroId);
    if (!macro) return;
    if (draftText.trim() && !confirm("Replace what you've typed with the macro's reply?")) return;
    try {
      const r = await apiService.applyMacro(macroId, ticket.id);
      if (r.ticket) setTicket(r.ticket);
      if (r.reply) {
        setDraftHtml(r.reply.html);
        setDraftText(r.reply.text);
        setMode(r.reply.isInternal ? 'note' : 'reply');
      }
      const names: Record<string, string> = {
        status: 'status',
        priority: 'priority',
        assignedToId: 'assignee',
        departmentId: 'department',
        productId: 'product',
        customFieldValues: 'fields',
      };
      const changed = (r.changed || []).map((c: string) => names[c]).filter(Boolean);
      setNotice(
        `"${macro.name}" applied${changed.length ? ` — changed the ${changed.join(', ')}` : ''}.` +
          (r.reply ? ' Check the reply, then send it.' : '')
      );
    } catch (error: any) {
      alert(`Couldn't apply the macro: ${errorText(error)}`);
    }
  };

  const saveNoteEdit = async (note: Note) => {
    try {
      await apiService.updateNote(note.id, {
        content: editingNoteHtml.replace(/<[^>]*>/g, ' ').trim() || note.content,
        contentHtml: editingNoteHtml,
      });
      setEditingNoteId(null);
      await loadNotes();
    } catch (error: any) {
      alert(`Couldn't save the note: ${errorText(error)}`);
    }
  };

  const deleteNote = async (note: Note) => {
    if (!confirm('Delete this note?')) return;
    try {
      await apiService.deleteNote(note.id);
      await loadNotes();
    } catch (error: any) {
      alert(`Couldn't delete the note: ${errorText(error)}`);
    }
  };

  const deleteTicket = async () => {
    if (!ticket || !confirm(`Delete ticket ${ticketRef(ticket)}? This can't be undone.`)) return;
    try {
      await apiService.deleteTicket(ticket.id);
      navigate('/agent');
    } catch (error: any) {
      alert(`Couldn't delete the ticket: ${errorText(error)}`);
    }
  };

  const customByKey = useMemo(
    () => new Map((layout?.customFields || []).map((f) => [f.key, f])),
    [layout]
  );
  const ticketAttachments = attachments.filter((a) => !a.noteId);
  const attachmentsFor = (noteId: string) => attachments.filter((a) => a.noteId === noteId);

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <p className="text-gray-700 dark:text-gray-300">{loadError}</p>
        <Link to="/agent" className="mt-4 inline-block text-blue-600 hover:underline">
          ← Back to tickets
        </Link>
      </div>
    );
  }
  if (!ticket) {
    return <div className="p-8 text-gray-500 dark:text-gray-400">Loading ticket…</div>;
  }

  const status = STATUSES.find((s) => s.value === ticket.status);
  const productChoices = (() => {
    const forDept = products.filter((p) => p.department_id === ticket.departmentId);
    return forDept.length ? forDept : products;
  })();

  /** One property, by its layout key. Subject and description are in the middle. */
  const property = (key: string) => {
    const id = `prop-${key}`;
    switch (key) {
      case 'status':
        return (
          <Row key={key} label="Status" htmlFor={id}>
            <select
              id={id}
              value={ticket.status}
              onChange={(e) => setStatus(e.target.value)}
              className={ghost}
            >
              {STATUSES.filter((s) => s.value !== 'closed' || ticket.status === 'closed').map(
                (s) => (
                  <option key={s.value} value={s.value} disabled={s.value === 'closed'}>
                    {s.label}
                  </option>
                )
              )}
            </select>
          </Row>
        );
      case 'priority':
        return (
          <Row key={key} label="Priority" htmlFor={id}>
            <select
              id={id}
              value={ticket.priority}
              onChange={(e) => {
                const priority = Number(e.target.value);
                save({ priority }, { priority });
              }}
              className={ghost}
            >
              {[0, 1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p)}
                </option>
              ))}
            </select>
          </Row>
        );
      case 'assignee':
        return (
          <Row key={key} label="Assigned to" htmlFor={id}>
            <select
              id={id}
              value={ticket.assignedTo?.id || ''}
              onChange={(e) => {
                const assignedToId = e.target.value || null;
                const assignedTo = agents.find((a) => a.id === assignedToId) || null;
                save({ assignedToId }, { assignedTo });
              }}
              className={ghost}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {fullName(a)}
                  {a.id === user?.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </Row>
        );
      case 'department':
        return (
          <Row key={key} label="Department" htmlFor={id}>
            <select
              id={id}
              value={ticket.departmentId ?? ''}
              onChange={(e) => {
                const departmentId = Number(e.target.value);
                if (departmentId) save({ departmentId }, { departmentId });
              }}
              className={ghost}
            >
              {ticket.departmentId == null && <option value="">—</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Row>
        );
      case 'product':
        return (
          <Row key={key} label="Product" htmlFor={id}>
            <select
              id={id}
              value={ticket.productId ?? ''}
              onChange={(e) => {
                const productId = e.target.value ? Number(e.target.value) : null;
                save({ productId }, { productId });
              }}
              className={ghost}
            >
              <option value="">—</option>
              {productChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Row>
        );
      case 'phone':
        return (
          <Row key={key} label="Phone" htmlFor={id}>
            <input
              id={id}
              type="tel"
              maxLength={40}
              defaultValue={ticket.phone || ''}
              key={`phone-${ticket.phone || ''}`}
              placeholder="—"
              onBlur={(e) => {
                const phone = e.target.value.trim() || null;
                if (phone !== (ticket.phone || null)) save({ phone }, { phone });
              }}
              className={ghost}
            />
          </Row>
        );
      case 'contact':
        return (
          <Row key={key} label="Contact">
            {ticket.submitter ? (
              <Link
                to={`/agent/customers/${ticket.submitter.id}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
              >
                {fullName(ticket.submitter)}
              </Link>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </Row>
        );
      case 'account':
        return (
          <Row key={key} label="Account">
            {ticket.companyId ? (
              <Link
                to={`/agent/accounts/${ticket.companyId}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
              >
                {ticket.company?.name || 'Account'}
              </Link>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </Row>
        );
      case 'subject':
      case 'description':
        return null;
      default: {
        const field = customByKey.get(key);
        if (!field) return null;
        return (
          <CustomProperty
            key={key}
            field={field}
            saved={ticket.customFieldValues?.[key]}
            onSave={(v) =>
              save(
                { customFieldValues: { [key]: v } },
                { customFieldValues: { ...(ticket.customFieldValues || {}), [key]: v } }
              )
            }
          />
        );
      }
    }
  };

  const sections = layout?.sections || [
    {
      id: 'default',
      title: 'Properties',
      fields: [
        'status',
        'priority',
        'assignee',
        'department',
        'contact',
        'account',
        'phone',
        'product',
      ],
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/agent" className="text-blue-600 dark:text-blue-400 hover:underline">
              ← Tickets
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="font-mono text-gray-600 dark:text-gray-300">{ticketRef(ticket)}</span>
            <div className="ml-auto relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="More actions"
                aria-expanded={menuOpen}
                className="px-2 py-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ⋯
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 z-20 w-44 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        deleteTicket();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Delete ticket
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {editingTitle ? (
              <input
                autoFocus
                defaultValue={ticket.title}
                maxLength={255}
                aria-label="Subject"
                onBlur={(e) => {
                  setEditingTitle(false);
                  const title = e.target.value.trim();
                  if (title && title !== ticket.title) save({ title }, { title });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="flex-1 min-w-[16rem] text-xl font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-blue-500 rounded-md px-2 py-0.5 focus:outline-none"
              />
            ) : (
              <h1
                className="text-xl font-semibold text-gray-900 dark:text-white cursor-text hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-1 -mx-1"
                title="Click to edit the subject"
                onClick={() => setEditingTitle(true)}
              >
                {ticket.title}
              </h1>
            )}
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${status?.badge || 'bg-gray-100 text-gray-800'}`}
            >
              {status?.label || ticket.status}
              {ticket.resolution && ['resolved', 'closed'].includes(ticket.status)
                ? ` · ${RESOLUTIONS[ticket.resolution] || ticket.resolution}`
                : ''}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${priorityBadgeClass(ticket.priority)}`}
            >
              {priorityLabel(ticket.priority)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {fullName(ticket.submitter) || 'Unknown'}
            {ticket.company?.name ? ` · ${ticket.company.name}` : ''} · opened{' '}
            {when(ticket.createdAt)}
            {ticket.source === 'email' ? ' by email' : ''}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-5">
        {/* Properties */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {sections.map((section) => {
            const rows = section.fields.map(property).filter(Boolean);
            if (rows.length === 0) return null;
            return (
              <section
                key={section.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <h2 className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {section.title}
                </h2>
                <div className="px-4 pb-3 divide-y divide-gray-100 dark:divide-gray-700/60 [&>*]:py-1">
                  {rows}
                </div>
              </section>
            );
          })}
        </aside>

        {/* Conversation */}
        <main className="min-w-0 space-y-4">
          <article className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center justify-center">
                {initials(ticket.submitter)}
              </span>
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">
                  {fullName(ticket.submitter) || 'Customer'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {' '}
                  · {when(ticket.createdAt)}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {ticket.description}
            </div>
            {ticketAttachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ticketAttachments.map((a) => (
                  <AttachmentChip key={a.id} a={a} />
                ))}
              </div>
            )}
          </article>

          {notes.map((note) => {
            const mine = note.authorId === user?.id;
            const files = attachmentsFor(note.id);
            return (
              <article
                key={note.id}
                className={`rounded-lg border p-4 ${
                  note.isInternal
                    ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50'
                    : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-semibold flex items-center justify-center">
                    {initials(note.author)}
                  </span>
                  <div className="text-sm min-w-0 flex-1">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {fullName(note.author) || 'Unknown'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {' '}
                      · {when(note.createdAt)}
                    </span>
                    {note.isInternal && (
                      <span className="ml-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                        Internal note
                      </span>
                    )}
                    {note.isEmailGenerated && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        by email
                      </span>
                    )}
                  </div>
                  {mine && editingNoteId !== note.id && (
                    <div className="flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingNoteHtml(note.contentHtml || `<p>${note.content}</p>`);
                        }}
                        className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(note)}
                        className="text-gray-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <RichTextEditor
                      value={editingNoteHtml}
                      onChange={({ html }) => setEditingNoteHtml(html)}
                      minHeight={80}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveNoteEdit(note)}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-800 dark:text-gray-200">
                    <RichTextContent html={note.contentHtml} text={note.content} />
                  </div>
                )}
                {files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {files.map((a) => (
                      <AttachmentChip key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </article>
            );
          })}

          {/* Composer */}
          <div
            className={`rounded-lg border bg-white dark:bg-gray-800 ${
              mode === 'note'
                ? 'border-amber-300 dark:border-amber-700'
                : 'border-gray-200 dark:border-gray-700'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const files = droppedFiles(e);
              if (files.length) {
                e.preventDefault();
                setPendingFiles((prev) => [...prev, ...files]);
              }
            }}
          >
            <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
              <div
                role="tablist"
                className="inline-flex rounded-md bg-gray-100 dark:bg-gray-700 p-0.5 text-sm"
              >
                {(
                  [
                    ['reply', 'Reply to customer'],
                    ['note', 'Internal note'],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={value}
                    role="tab"
                    type="button"
                    aria-selected={mode === value}
                    onClick={() => setMode(value)}
                    className={`px-3 py-1 rounded ${
                      mode === value
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <select
                value=""
                disabled={macros.length === 0}
                onChange={(e) => e.target.value && applyMacro(e.target.value)}
                aria-label="Apply a macro"
                className="ml-auto text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md px-2 py-1"
              >
                <option value="">{macros.length ? '⚡ Macro…' : 'No macros'}</option>
                {macros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.shared ? '' : ' (yours)'}
                  </option>
                ))}
              </select>
              <Link
                to="/macros"
                className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Manage
              </Link>
            </div>
            {notice && (
              <p role="status" className="px-3 pt-2 text-xs text-green-700 dark:text-green-400">
                {notice}
              </p>
            )}
            <div className="p-3">
              <RichTextEditor
                value={draftHtml}
                onChange={({ html, text, isEmpty }) => {
                  setDraftHtml(isEmpty ? '' : html);
                  setDraftText(isEmpty ? '' : text);
                }}
                onFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
                placeholder={
                  mode === 'reply'
                    ? 'Write a reply — it’s emailed to the customer…'
                    : 'Write a note only your team can see…'
                }
                minHeight={110}
              />
              {pendingFiles.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {pendingFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
                    >
                      📎 {f.name}
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="text-gray-500 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setPendingFiles((prev) => [...prev, ...files]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  📎 Attach
                </button>
                <span className="text-xs text-gray-400 hidden sm:inline">
                  or paste / drop files
                </span>
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || (!draftText.trim() && pendingFiles.length === 0)}
                  className={`ml-auto px-4 py-1.5 text-sm font-medium rounded-md text-white disabled:opacity-50 ${
                    mode === 'note'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {sending ? 'Sending…' : mode === 'note' ? 'Add note' : 'Send reply'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {pendingResolve && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => resolveAs(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolve-title"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && resolveAs(null)}
          >
            <h3
              id="resolve-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              How was it resolved?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
              It closes automatically after 7 days unless the customer replies.
            </p>
            <div className="grid gap-2">
              {['fixed', 'wont_do', 'duplicate'].map((r, i) => (
                <button
                  key={r}
                  type="button"
                  autoFocus={i === 0}
                  onClick={() => resolveAs(r)}
                  className="w-full text-left px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {RESOLUTIONS[r]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => resolveAs(null)}
              className="mt-3 w-full text-sm text-gray-600 dark:text-gray-300 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetailPage;
