import React, { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { priorityLabel } from '../utils/priority';
import type { CustomFieldDef } from '../utils/fields';
import type { SavedView, ViewCondition } from '../utils/views';
import { Chips, Drawer, errorText, fieldClass } from './ui';

/**
 * New / edit a saved view of the ticket board: a name, who sees it, and the
 * conditions a ticket must all match - one row each, like assignment rules.
 */

const STATUS_CHOICES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];
const BUILT_IN = [
  { field: 'status', label: 'Status' },
  { field: 'priority', label: 'Priority' },
  { field: 'assignee', label: 'Assigned to' },
  { field: 'department', label: 'Department' },
  { field: 'account', label: 'Account' },
  { field: 'channel', label: 'Came in by' },
  { field: 'product', label: 'Product' },
  { field: 'created', label: 'Created' },
  { field: 'keywords', label: 'Subject or description' },
];
const TEXT_TYPES = ['text', 'textarea', 'email', 'phone', 'url', 'number', 'decimal', 'date'];

interface Row extends ViewCondition {
  text: string;
}

const ViewEditor: React.FC<{
  view: SavedView | null; // null = new
  canShare: boolean;
  agents: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (view: SavedView) => void;
}> = ({ view, canShare, agents, onClose, onSaved }) => {
  const [name, setName] = useState(view?.name || '');
  const [shared, setShared] = useState(view ? view.shared : false);
  const [rows, setRows] = useState<Row[]>(
    (view?.conditions || []).map((c) => ({ ...c, text: c.values.join(', ') }))
  );
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountQuery, setAccountQuery] = useState('');
  const [fields, setFields] = useState<CustomFieldDef[]>([]);

  useEffect(() => {
    apiService
      .getDepartments()
      .then((d: any) => setDepartments(Array.isArray(d) ? d : d?.data || []))
      .catch(() => undefined);
    apiService
      .getProducts()
      .then((p: any) => setProducts(Array.isArray(p) ? p : []))
      .catch(() => undefined);
    apiService
      .getFields('tickets')
      .then((l) =>
        setFields((l.customFields || []).filter((f: CustomFieldDef) => f.type !== 'lookup'))
      )
      .catch(() => undefined);
  }, []);

  // Accounts to choose from: the ones picked, plus matches for what's typed
  useEffect(() => {
    const t = window.setTimeout(() => {
      apiService
        .lookup('accounts', { q: accountQuery })
        .then((found) =>
          setAccounts((prev) => {
            const picked = prev.filter((a) =>
              rows.some((r) => r.field === 'account' && r.values.includes(a.id))
            );
            const merged = [...picked, ...found.filter((f) => !picked.some((p) => p.id === f.id))];
            return merged;
          })
        )
        .catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountQuery]);

  // Names for accounts already in the view
  useEffect(() => {
    const ids = rows.find((r) => r.field === 'account')?.values || [];
    if (ids.length)
      apiService
        .lookup('accounts', { ids })
        .then((named) =>
          setAccounts((prev) => [
            ...named,
            ...prev.filter((p) => !named.some((n) => n.id === p.id)),
          ])
        )
        .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldDef = (f: string) => fields.find((d) => `cf:${d.key}` === f);
  const label = (f: string) =>
    f.startsWith('cf:')
      ? fieldDef(f)?.label || 'Deleted field'
      : BUILT_IN.find((b) => b.field === f)?.label || f;
  const isText = (f: string) =>
    f === 'keywords' || (f.startsWith('cf:') && TEXT_TYPES.includes(fieldDef(f)?.type || ''));
  const available = [
    ...BUILT_IN,
    ...fields.map((d) => ({ field: `cf:${d.key}`, label: d.label })),
  ].filter((b) => !rows.some((r) => r.field === b.field));
  const setRow = (i: number, next: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...next } : r)));

  const control = (row: Row, i: number) => {
    const chips = (options: { value: string; label: string }[], single = false) => (
      <Chips
        label={label(row.field)}
        options={options}
        selected={row.values}
        single={single}
        onChange={(values) => setRow(i, { values })}
      />
    );
    if (isText(row.field)) {
      return (
        <input
          type="text"
          aria-label={`${label(row.field)} words`}
          value={row.text}
          onChange={(e) => setRow(i, { text: e.target.value })}
          placeholder="e.g. invoice, refund"
          className={fieldClass}
        />
      );
    }
    switch (row.field) {
      case 'status':
        return chips(STATUS_CHOICES);
      case 'priority':
        return chips([0, 1, 2, 3].map((p) => ({ value: String(p), label: priorityLabel(p) })));
      case 'assignee':
        return chips([
          { value: 'me', label: 'Me' },
          { value: 'unassigned', label: 'Nobody' },
          ...agents.map((a) => ({ value: a.id, label: a.name })),
        ]);
      case 'department':
        return chips(departments.map((d) => ({ value: String(d.id), label: d.name })));
      case 'product':
        return products.length ? (
          chips(products.map((p) => ({ value: String(p.id), label: p.name })))
        ) : (
          <p className="text-sm text-gray-500">No products yet.</p>
        );
      case 'channel':
        return chips([
          { value: 'email', label: 'Email' },
          { value: 'web', label: 'Web / portal' },
        ]);
      case 'created':
        return chips(
          [
            { value: 'today', label: 'Today' },
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
          ],
          true
        );
      case 'account':
        return (
          <div className="space-y-2">
            <input
              type="search"
              value={accountQuery}
              onChange={(e) => setAccountQuery(e.target.value)}
              placeholder="Find an account"
              aria-label="Find an account"
              className={fieldClass}
            />
            {chips(accounts.map((a) => ({ value: a.id, label: a.name })))}
          </div>
        );
      default: {
        const def = fieldDef(row.field);
        if (!def) return <p className="text-sm text-gray-500">This field was deleted.</p>;
        if (def.type === 'checkbox')
          return chips(
            [
              { value: 'true', label: 'Ticked' },
              { value: 'false', label: 'Not ticked' },
            ],
            true
          );
        return chips(def.options.map((o) => ({ value: o, label: o })));
      }
    }
  };

  const save = async () => {
    if (!name.trim()) return alert('Give the view a name.');
    const conditions: ViewCondition[] = [];
    for (const r of rows) {
      const values = isText(r.field)
        ? r.text
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean)
        : r.values;
      if (!values.length)
        return alert(`${label(r.field)}: choose what it should match, or remove the row.`);
      conditions.push({ field: r.field, values });
    }
    try {
      setSaving(true);
      const body = { name: name.trim(), shared, conditions };
      const saved = view
        ? await apiService.updateView(view.id, body)
        : await apiService.createView(body);
      onSaved(saved);
    } catch (e) {
      alert(`Couldn't save the view: ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={view ? 'Edit view' : 'New view'}
      onClose={onClose}
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
            {saving ? 'Saving…' : 'Save view'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label
            htmlFor="view-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Name
          </label>
          <input
            id="view-name"
            autoFocus
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My urgent tickets"
            className={fieldClass}
          />
        </div>
        {canShare && !view && (
          <div
            role="radiogroup"
            aria-label="Who sees it"
            className="inline-flex rounded-md bg-gray-100 dark:bg-gray-700 p-0.5 text-sm"
          >
            {(
              [
                [false, 'Only me'],
                [true, 'Whole team'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={shared === value}
                onClick={() => setShared(value)}
                className={`px-3 py-1.5 rounded ${
                  shared === value
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

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Show tickets that match all of these
        </h3>
        {rows.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No conditions yet: the view shows every ticket.
          </p>
        )}
        {rows.map((row, i) => (
          <div
            key={row.field}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">{label(row.field)}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {isText(row.field)
                  ? 'contains any of'
                  : row.field === 'created'
                    ? 'in'
                    : 'is any of'}
              </span>
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                aria-label={`Remove the ${label(row.field)} condition`}
                className="ml-auto p-1 rounded text-gray-400 hover:text-red-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            {control(row, i)}
          </div>
        ))}
        {available.length > 0 && (
          <select
            value=""
            aria-label="Add a condition"
            onChange={(e) =>
              e.target.value &&
              setRows((rs) => [...rs, { field: e.target.value, values: [], text: '' }])
            }
            className="text-sm text-blue-600 dark:text-blue-400 bg-transparent border border-dashed border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 hover:border-blue-400 cursor-pointer"
          >
            <option value="">+ Add condition</option>
            {available.map((b) => (
              <option key={b.field} value={b.field}>
                {b.label}
              </option>
            ))}
          </select>
        )}
      </section>
    </Drawer>
  );
};

export default ViewEditor;
