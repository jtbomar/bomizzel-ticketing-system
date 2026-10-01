import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { priorityLabel } from '../utils/priority';
import RichTextEditor from '../components/RichTextEditor';
import CustomFieldInput from '../components/CustomFieldInput';
import { displayValue, type CustomFieldDef } from '../utils/fields';
import { Chips, Drawer, Switch, errorText, fieldClass } from '../components/ui';

/**
 * Macros: a saved reply plus ticket changes, applied from a ticket in one
 * click. The changes are made straight away; the reply goes in the reply box
 * to check before sending. Admins make shared macros for the team; anyone
 * can make personal ones only they see.
 */

interface Actions {
  status?: string;
  resolution?: string;
  priority?: number;
  assignTo?: string;
  departmentId?: number;
  productId?: number | null;
  fields?: Record<string, unknown>;
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
interface Product {
  id: number;
  name: string;
  product_code: string;
}

/** One change the macro makes. kind: status | priority | assignTo | department | product | field:<key> */
interface Change {
  kind: string;
  value: unknown;
  resolution?: string;
}
interface Draft {
  id?: string;
  name: string;
  shared: boolean;
  replyHtml: string;
  replyInternal: boolean;
  changes: Change[];
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
const BUILT_IN = [
  { kind: 'status', label: 'Status' },
  { kind: 'priority', label: 'Priority' },
  { kind: 'assignTo', label: 'Assign to' },
  { kind: 'department', label: 'Department' },
  { kind: 'product', label: 'Product' },
];
const plain = (html: string | null) =>
  (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const isEmptyValue = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const toChanges = (a: Actions): Change[] => {
  const changes: Change[] = [];
  if (a.status)
    changes.push({ kind: 'status', value: a.status, resolution: a.resolution || 'fixed' });
  if (a.priority !== undefined) changes.push({ kind: 'priority', value: String(a.priority) });
  if (a.assignTo) changes.push({ kind: 'assignTo', value: a.assignTo });
  if (a.departmentId) changes.push({ kind: 'department', value: String(a.departmentId) });
  if (a.productId !== undefined)
    changes.push({ kind: 'product', value: a.productId === null ? 'clear' : String(a.productId) });
  for (const [key, value] of Object.entries(a.fields || {}))
    changes.push({ kind: `field:${key}`, value: value ?? '' });
  return changes;
};

const MacroEditor: React.FC<{
  initial: Draft;
  options: Options;
  canShare: boolean;
  ticketFields: CustomFieldDef[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ initial, options, canShare, ticketFields, products, onClose, onSaved }) => {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const replyEditor = useRef<Editor | null>(null);

  const fieldByKey = new Map(ticketFields.map((f) => [f.key, f]));
  const kindLabel = (kind: string) =>
    kind.startsWith('field:')
      ? fieldByKey.get(kind.slice(6))?.label || 'Deleted field'
      : BUILT_IN.find((b) => b.kind === kind)?.label || kind;
  const available = [
    ...BUILT_IN,
    ...ticketFields.map((f) => ({ kind: `field:${f.key}`, label: f.label })),
  ].filter((k) => !draft.changes.some((c) => c.kind === k.kind));

  const setChange = (i: number, next: Partial<Change>) =>
    setDraft((d) => ({
      ...d,
      changes: d.changes.map((c, j) => (j === i ? { ...c, ...next } : c)),
    }));

  const insertPlaceholder = (key: string) => {
    const editor = replyEditor.current;
    if (!editor) return;
    (editor.isFocused ? editor.chain().focus() : editor.chain().focus('end'))
      .insertContent(`{{${key}}}`)
      .run();
  };

  const control = (c: Change, i: number) => {
    const select = (choices: { value: string; label: string }[], placeholder: string) => (
      <select
        aria-label={kindLabel(c.kind)}
        value={String(c.value ?? '')}
        onChange={(e) => setChange(i, { value: e.target.value })}
        className={fieldClass}
      >
        <option value="">{placeholder}</option>
        {choices.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
    switch (c.kind) {
      case 'status':
        return (
          <div className="grid grid-cols-2 gap-2">
            {select(
              Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              'Choose…'
            )}
            {['resolved', 'closed'].includes(String(c.value)) && (
              <select
                aria-label="How it was resolved"
                value={c.resolution || 'fixed'}
                onChange={(e) => setChange(i, { resolution: e.target.value })}
                className={fieldClass}
              >
                {Object.entries(RESOLUTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    as {label}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      case 'priority':
        return (
          <Chips
            label="Priority"
            single
            options={[0, 1, 2, 3].map((p) => ({ value: String(p), label: priorityLabel(p) }))}
            selected={c.value === '' || c.value === undefined ? [] : [String(c.value)]}
            onChange={([v]) => setChange(i, { value: v })}
          />
        );
      case 'assignTo':
        return select(
          [
            { value: 'me', label: 'Whoever applies it' },
            { value: 'unassigned', label: 'Nobody (unassign)' },
            ...options.agents.map((a) => ({ value: a.id, label: a.name })),
          ],
          'Choose…'
        );
      case 'department':
        return select(
          options.departments.map((d) => ({ value: String(d.id), label: d.name })),
          'Choose…'
        );
      case 'product':
        return select(
          [
            { value: 'clear', label: 'Clear it' },
            ...products.map((p) => ({
              value: String(p.id),
              label: `${p.name} (${p.product_code})`,
            })),
          ],
          'Choose…'
        );
      default: {
        const field = fieldByKey.get(c.kind.slice(6));
        if (!field) return <p className="text-sm text-gray-500">This field was deleted.</p>;
        return (
          <div className="space-y-1">
            <CustomFieldInput
              field={field}
              value={c.value}
              onChange={(value) => setChange(i, { value })}
              className={fieldClass}
            />
            {isEmptyValue(c.value) && field.type !== 'checkbox' && (
              <p className="text-xs text-gray-500">Left empty, the macro clears this field.</p>
            )}
          </div>
        );
      }
    }
  };

  const save = async () => {
    if (!draft.name.trim()) return alert('Give the macro a name.');
    const actions: Actions = {};
    for (const c of draft.changes) {
      if (c.kind === 'status') {
        if (!c.value) return alert('Status: choose one, or remove the row.');
        actions.status = String(c.value);
        if (['resolved', 'closed'].includes(actions.status))
          actions.resolution = c.resolution || 'fixed';
      } else if (c.kind === 'priority') {
        if (c.value === '' || c.value === undefined)
          return alert('Priority: choose one, or remove the row.');
        actions.priority = Number(c.value);
      } else if (c.kind === 'assignTo') {
        if (!c.value) return alert('Assign to: choose someone, or remove the row.');
        actions.assignTo = String(c.value);
      } else if (c.kind === 'department') {
        if (!c.value) return alert('Department: choose one, or remove the row.');
        actions.departmentId = Number(c.value);
      } else if (c.kind === 'product') {
        if (!c.value) return alert('Product: choose one, or remove the row.');
        actions.productId = c.value === 'clear' ? null : Number(c.value);
      } else {
        actions.fields = {
          ...(actions.fields || {}),
          [c.kind.slice(6)]: isEmptyValue(c.value) ? null : c.value,
        };
      }
    }
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
      onSaved();
    } catch (error: any) {
      alert(`Couldn't save the macro: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const heading = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';

  return (
    <Drawer
      title={draft.id ? 'Edit macro' : 'New macro'}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:underline"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save macro'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label
            htmlFor="macro-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Name
          </label>
          <input
            id="macro-name"
            autoFocus
            type="text"
            maxLength={120}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Resolved – password reset"
            className={fieldClass}
          />
        </div>
        {canShare && !draft.id && (
          <div
            role="radiogroup"
            aria-label="Who can use it"
            className="inline-flex rounded-md bg-gray-100 dark:bg-gray-700 p-0.5 text-sm"
          >
            {(
              [
                [true, 'Whole team'],
                [false, 'Only me'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={draft.shared === value}
                onClick={() => setDraft({ ...draft, shared: value })}
                className={`px-3 py-1.5 rounded ${
                  draft.shared === value
                    ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={heading}>Reply</h3>
          <Switch
            checked={draft.replyInternal}
            onChange={(replyInternal) => setDraft({ ...draft, replyInternal })}
            label="Internal note"
            showLabel
          />
        </div>
        <RichTextEditor
          value={draft.replyHtml}
          onChange={({ html, isEmpty }) =>
            setDraft((d) => ({ ...d, replyHtml: isEmpty ? '' : html }))
          }
          placeholder="Hi {{customer.firstName}}, … (optional)"
          minHeight={100}
          editorRef={replyEditor}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Insert:</span>
          {options.placeholders.map((p) => (
            <button
              key={p.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertPlaceholder(p.key)}
              className="text-xs px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className={heading}>Changes to the ticket</h3>
        {draft.changes.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            None yet. Add the changes it should make, like status, priority or a custom field.
          </p>
        )}
        {draft.changes.map((c, i) => (
          <div
            key={c.kind}
            className="grid grid-cols-[8rem_1fr_auto] items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
          >
            <span className="text-sm font-medium text-gray-900 dark:text-white pt-2 truncate">
              {kindLabel(c.kind)}
            </span>
            <div className="min-w-0">{control(c, i)}</div>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, changes: d.changes.filter((_, j) => j !== i) }))
              }
              aria-label={`Remove the ${kindLabel(c.kind)} change`}
              className="p-1 mt-1 rounded text-gray-400 hover:text-red-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        {available.length > 0 && (
          <select
            value=""
            aria-label="Add a change"
            onChange={(e) =>
              e.target.value &&
              setDraft((d) => ({
                ...d,
                changes: [...d.changes, { kind: e.target.value, value: '', resolution: 'fixed' }],
              }))
            }
            className="text-sm text-blue-600 dark:text-blue-400 bg-transparent border border-dashed border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 hover:border-blue-400 cursor-pointer"
          >
            <option value="">+ Add change</option>
            {available.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        )}
      </section>
    </Drawer>
  );
};

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
  const [ticketFields, setTicketFields] = useState<CustomFieldDef[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);

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
    apiService
      .getFields('tickets')
      .then((layout) => setTicketFields(layout.customFields || []))
      .catch(() => setTicketFields([]));
    apiService
      .getProducts()
      .then((list) => setProducts(Array.isArray(list) ? list : []))
      .catch(() => setProducts([]));
  }, []);

  const names = useMemo(
    () => ({
      agent: new Map(options.agents.map((a) => [a.id, a.name])),
      department: new Map(options.departments.map((d) => [d.id, d.name])),
      field: new Map(ticketFields.map((f) => [f.key, f])),
      product: new Map(products.map((p) => [p.id, p.name])),
    }),
    [options, ticketFields, products]
  );

  const changesSummary = (a: Actions): string[] => {
    const parts: string[] = [];
    if (a.status)
      parts.push(
        `${STATUS_LABELS[a.status] || a.status}${a.resolution ? ` (${RESOLUTION_LABELS[a.resolution] || a.resolution})` : ''}`
      );
    if (a.priority !== undefined) parts.push(`${priorityLabel(a.priority)} priority`);
    if (a.assignTo)
      parts.push(
        a.assignTo === 'me'
          ? 'assign to whoever applies it'
          : a.assignTo === 'unassigned'
            ? 'unassign'
            : `assign to ${names.agent.get(a.assignTo) || 'removed agent'}`
      );
    if (a.departmentId) parts.push(`move to ${names.department.get(a.departmentId) || '?'}`);
    if (a.productId !== undefined)
      parts.push(
        a.productId === null ? 'clear product' : `product ${names.product.get(a.productId) || '?'}`
      );
    for (const [key, value] of Object.entries(a.fields || {})) {
      const def = names.field.get(key);
      if (!def) continue;
      const shown = displayValue(def, value);
      parts.push(shown ? `${def.label}: ${shown}` : `clear ${def.label}`);
    }
    return parts;
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
  const openNew = () =>
    setEditing({ name: '', shared: canShare, replyHtml: '', replyInternal: false, changes: [] });
  const openMacro = (m: Macro) =>
    canEdit(m) &&
    setEditing({
      id: m.id,
      name: m.name,
      shared: m.shared,
      replyHtml: m.replyHtml || '',
      replyInternal: m.replyInternal,
      changes: toChanges(m.actions),
    });

  if (loading) return <div className="p-8 text-gray-500">Loading macros…</div>;

  const iconButton =
    'p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700';
  const groups = [
    { title: 'Shared with the team', items: macros.filter((m) => m.shared) },
    { title: 'Only you', items: macros.filter((m) => !m.shared) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate(user?.role === 'admin' ? '/admin/settings' : '/agent')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-3"
      >
        ← {user?.role === 'admin' ? 'Settings' : 'Tickets'}
      </button>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Macros</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            A saved reply and ticket changes, applied from a ticket in one click.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3.5 py-2 rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          New macro
        </button>
      </div>

      {macros.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
          <h2 className="font-medium text-gray-900 dark:text-white">No macros yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Save the replies you type over and over, like “We've reset your password”.
          </p>
          <button type="button" onClick={openNew} className="text-sm text-blue-600 hover:underline">
            Add your first macro
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {group.title}
              </h2>
              <ul className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {group.items.map((m) => {
                  const changes = changesSummary(m.actions);
                  const reply = plain(m.replyHtml);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => openMacro(m)}
                        disabled={!canEdit(m)}
                        className="flex-1 min-w-0 text-left disabled:cursor-default"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {m.name}
                          </span>
                          {m.replyInternal && reply && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Internal
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {reply && <span className="italic">“{reply}”</span>}
                          {reply && changes.length > 0 && ' · '}
                          {changes.join(' · ')}
                        </div>
                      </button>
                      {canEdit(m) && (
                        <>
                          <button
                            type="button"
                            onClick={() => openMacro(m)}
                            className={iconButton}
                            aria-label={`Edit ${m.name}`}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(m)}
                            className={`${iconButton} hover:text-red-600`}
                            aria-label={`Delete ${m.name}`}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <MacroEditor
          key={editing.id || 'new'}
          initial={editing}
          options={options}
          canShare={canShare}
          ticketFields={ticketFields}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default Macros;
