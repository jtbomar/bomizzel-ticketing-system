import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { priorityLabel } from '../utils/priority';
import RichTextEditor from '../components/RichTextEditor';
import RichTextContent from '../components/RichTextContent';

/**
 * Macros: a saved reply plus ticket changes, applied from a ticket in one
 * click. Admins make shared ones for the whole team; anyone can make
 * personal ones only they see.
 */

interface Actions {
  status?: string;
  resolution?: string;
  priority?: number;
  assignTo?: string;
  departmentId?: number;
}

interface Macro {
  id: string;
  name: string;
  shared: boolean;
  replyHtml: string | null;
  replyInternal: boolean;
  actions: Actions;
}

interface Options {
  agents: { id: string; name: string }[];
  departments: { id: number; name: string }[];
  placeholders: { key: string; label: string }[];
}

interface Draft {
  id?: string;
  name: string;
  shared: boolean;
  replyHtml: string;
  replyInternal: boolean;
  status: string;
  resolution: string;
  priority: string;
  assignTo: string;
  departmentId: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
};
const RESOLUTION_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  wont_do: "Won't do",
  duplicate: 'Duplicate',
};

const emptyDraft = (shared: boolean): Draft => ({
  name: '',
  shared,
  replyHtml: '',
  replyInternal: false,
  status: '',
  resolution: 'fixed',
  priority: '',
  assignTo: '',
  departmentId: '',
});

const toDraft = (m: Macro): Draft => ({
  id: m.id,
  name: m.name,
  shared: m.shared,
  replyHtml: m.replyHtml || '',
  replyInternal: m.replyInternal,
  status: m.actions.status || '',
  resolution: m.actions.resolution || 'fixed',
  priority: m.actions.priority === undefined ? '' : String(m.actions.priority),
  assignTo: m.actions.assignTo || '',
  departmentId: m.actions.departmentId ? String(m.actions.departmentId) : '',
});

const errorText = (error: any): string =>
  error.response?.data?.error?.message ||
  error.response?.data?.error ||
  error.response?.data?.message ||
  error.message;

const Macros: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [macros, setMacros] = useState<Macro[]>([]);
  const [options, setOptions] = useState<Options>({
    agents: [],
    departments: [],
    placeholders: [],
  });
  const [canShare, setCanShare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.getMacros();
      setMacros(data.macros);
      setOptions(data.options);
      setCanShare(!!data.canShare);
    } catch (error: any) {
      alert(`Couldn't load macros: ${errorText(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const agentName = useMemo(() => new Map(options.agents.map((a) => [a.id, a.name])), [options]);
  const departmentName = useMemo(
    () => new Map(options.departments.map((d) => [d.id, d.name])),
    [options]
  );

  const describe = (m: Macro): string[] => {
    const a = m.actions;
    const parts: string[] = [];
    if (a.status)
      parts.push(
        `Status → ${STATUS_LABELS[a.status] || a.status}${
          a.resolution ? ` (${RESOLUTION_LABELS[a.resolution] || a.resolution})` : ''
        }`
      );
    if (a.priority !== undefined) parts.push(`Priority → ${priorityLabel(a.priority)}`);
    if (a.assignTo)
      parts.push(
        `Assign → ${
          a.assignTo === 'me'
            ? 'whoever applies it'
            : a.assignTo === 'unassigned'
              ? 'nobody (unassign)'
              : agentName.get(a.assignTo) || 'removed agent'
        }`
      );
    if (a.departmentId)
      parts.push(`Department → ${departmentName.get(a.departmentId) || 'removed department'}`);
    return parts;
  };

  // Placeholders go in where the cursor is (the buttons keep the editor's
  // cursor: see onMouseDown below); with no cursor yet, at the end.
  const replyEditor = useRef<Editor | null>(null);
  const insertPlaceholder = (key: string) => {
    const editor = replyEditor.current;
    if (!editor) return;
    const chain = editor.isFocused ? editor.chain().focus() : editor.chain().focus('end');
    chain.insertContent(`{{${key}}}`).run();
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return alert('Give the macro a name.');
    const actions: Actions = {};
    if (draft.status) actions.status = draft.status;
    if (['resolved', 'closed'].includes(draft.status)) actions.resolution = draft.resolution;
    if (draft.priority !== '') actions.priority = Number(draft.priority);
    if (draft.assignTo) actions.assignTo = draft.assignTo;
    if (draft.departmentId) actions.departmentId = Number(draft.departmentId);
    const body = {
      name: draft.name.trim(),
      shared: draft.shared,
      replyHtml: draft.replyHtml,
      replyInternal: draft.replyInternal,
      actions,
    };
    try {
      setSaving(true);
      if (draft.id) await apiService.updateMacro(draft.id, body);
      else await apiService.createMacro(body);
      setDraft(null);
      await load();
    } catch (error: any) {
      alert(`Couldn't save the macro: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Macro) => {
    if (!confirm(`Delete the macro "${m.name}"?`)) return;
    try {
      await apiService.deleteMacro(m.id);
      setMacros((prev) => prev.filter((x) => x.id !== m.id));
    } catch (error: any) {
      alert(`Couldn't delete the macro: ${errorText(error)}`);
    }
  };

  const canEdit = (m: Macro) => !m.shared || canShare;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading macros...</div>
      </div>
    );
  }

  const field =
    'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  const label = 'block text-sm font-medium text-gray-700 mb-1';
  const groups = [
    { title: 'Shared with the team', items: macros.filter((m) => m.shared) },
    { title: 'Only you', items: macros.filter((m) => !m.shared) },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <button
                onClick={() => navigate(user?.role === 'admin' ? '/admin/settings' : '/agent')}
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Macros</h2>
              <p className="text-sm text-gray-600 mt-1">
                A saved reply and ticket changes, applied from a ticket's Notes tab in one click.
                The changes are made straight away; the reply goes in the note box for you to check
                and send.
              </p>
            </div>
            {!draft && (
              <button
                onClick={() => setDraft(emptyDraft(canShare))}
                className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Macro
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {draft && (
            <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-5 space-y-5">
              <h3 className="text-lg font-semibold text-gray-900">
                {draft.id ? 'Edit macro' : 'New macro'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={label} htmlFor="macro-name">
                    Name
                  </label>
                  <input
                    id="macro-name"
                    type="text"
                    maxLength={120}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Resolved - password reset"
                    className={field}
                  />
                </div>
                {canShare && !draft.id && (
                  <fieldset>
                    <legend className={label}>Who can use it</legend>
                    <div className="flex gap-4 text-sm pt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={draft.shared}
                          onChange={() => setDraft({ ...draft, shared: true })}
                        />
                        Whole team
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={!draft.shared}
                          onChange={() => setDraft({ ...draft, shared: false })}
                        />
                        Only me
                      </label>
                    </div>
                  </fieldset>
                )}
              </div>

              <div>
                <p className={label}>Reply</p>
                <RichTextEditor
                  value={draft.replyHtml}
                  onChange={({ html, isEmpty }) =>
                    setDraft((d) => (d ? { ...d, replyHtml: isEmpty ? '' : html } : d))
                  }
                  placeholder="Hi {{customer.firstName}}, ..."
                  editorRef={replyEditor}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">Insert at the cursor:</span>
                  {options.placeholders.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      // Keep the editor's cursor where it is
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertPlaceholder(p.key)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={draft.replyInternal}
                    onChange={(e) => setDraft({ ...draft, replyInternal: e.target.checked })}
                  />
                  Internal note (not emailed to the customer)
                </label>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Change the ticket{' '}
                  <span className="font-normal text-gray-500">(leave as "No change" to skip)</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={label} htmlFor="macro-status">
                      Status
                    </label>
                    <select
                      id="macro-status"
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                      className={field}
                    >
                      <option value="">No change</option>
                      {Object.entries(STATUS_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                    {['resolved', 'closed'].includes(draft.status) && (
                      <select
                        aria-label="How it was resolved"
                        value={draft.resolution}
                        onChange={(e) => setDraft({ ...draft, resolution: e.target.value })}
                        className={`${field} mt-2`}
                      >
                        {Object.entries(RESOLUTION_LABELS).map(([value, text]) => (
                          <option key={value} value={value}>
                            Resolved as: {text}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={label} htmlFor="macro-priority">
                      Priority
                    </label>
                    <select
                      id="macro-priority"
                      value={draft.priority}
                      onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                      className={field}
                    >
                      <option value="">No change</option>
                      {[0, 1, 2, 3].map((p) => (
                        <option key={p} value={p}>
                          {priorityLabel(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="macro-assign">
                      Assign to
                    </label>
                    <select
                      id="macro-assign"
                      value={draft.assignTo}
                      onChange={(e) => setDraft({ ...draft, assignTo: e.target.value })}
                      className={field}
                    >
                      <option value="">No change</option>
                      <option value="me">Whoever applies it</option>
                      <option value="unassigned">Nobody (unassign)</option>
                      {options.agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="macro-department">
                      Department
                    </label>
                    <select
                      id="macro-department"
                      value={draft.departmentId}
                      onChange={(e) => setDraft({ ...draft, departmentId: e.target.value })}
                      className={field}
                    >
                      <option value="">No change</option>
                      {options.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save macro'}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {macros.length === 0 && !draft ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2" aria-hidden="true">
                ⚡
              </div>
              <h3 className="text-lg font-medium text-gray-900">No macros yet</h3>
              <p className="text-gray-600 mt-1 mb-4">
                Save the replies you type over and over, like "We've reset your password".
              </p>
              <button
                onClick={() => setDraft(emptyDraft(canShare))}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add your first macro
              </button>
            </div>
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((group) => (
                <section key={group.title}>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {group.title}
                  </h3>
                  <ul className="space-y-3">
                    {group.items.map((m) => (
                      <li key={m.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-gray-900">{m.name}</h4>
                            {m.replyHtml && (
                              <div className="mt-1 text-sm text-gray-600 line-clamp-3">
                                {m.replyInternal && (
                                  <span className="text-xs mr-1 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
                                    Internal
                                  </span>
                                )}
                                <RichTextContent html={m.replyHtml} text="" />
                              </div>
                            )}
                            {describe(m).length > 0 && (
                              <ul className="mt-2 text-sm text-gray-700">
                                {describe(m).map((part) => (
                                  <li key={part}>{part}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {canEdit(m) && (
                            <div className="flex gap-3 shrink-0">
                              <button
                                onClick={() => setDraft(toDraft(m))}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => remove(m)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Macros;
