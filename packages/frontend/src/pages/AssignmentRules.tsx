import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { priorityLabel } from '../utils/priority';
import type { CustomFieldDef } from '../utils/fields';
import { Chips, Drawer, Switch, errorText, fieldClass } from '../components/ui';

/**
 * Settings > Assignment Rules: who gets a new ticket.
 *
 * Rules are tried top to bottom; the first that matches assigns the ticket,
 * to one agent or round-robin through several. A rule's conditions are rows
 * ("Department is any of Support, Sales"); all of them must match, and a
 * rule with none matches every ticket. A ticket that already has an agent is
 * never changed.
 */

interface FieldCondition {
  key: string;
  match?: 'is' | 'contains';
  values: string[];
}
interface Conditions {
  departmentIds?: number[];
  companyIds?: string[];
  priorities?: number[];
  channels?: string[];
  keywords?: string[];
  fields?: FieldCondition[];
}
interface Rule {
  id: string;
  name: string;
  isActive: boolean;
  conditions: Conditions;
  method: 'specific' | 'round_robin';
  agentIds: string[];
}
interface Options {
  agents: { id: string; name: string; email: string; isActive: boolean }[];
  accounts: { id: string; name: string }[];
  departments: { id: number; name: string }[];
}

/** One condition row: what it looks at, and the chosen values (or typed words). */
interface Row {
  kind: string; // keywords | departments | priorities | channels | accounts | field:<key>
  values: string[];
  text: string;
}
interface Draft {
  id?: string;
  name: string;
  isActive: boolean;
  method: 'specific' | 'round_robin';
  agentIds: string[];
  rows: Row[];
}

const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'web', label: 'Web / portal' },
];
const PRIORITY_CHOICES = [0, 1, 2, 3].map((p) => ({ value: String(p), label: priorityLabel(p) }));
const BUILT_IN_KINDS = [
  { kind: 'keywords', label: 'Subject or description' },
  { kind: 'departments', label: 'Department' },
  { kind: 'priorities', label: 'Priority' },
  { kind: 'channels', label: 'Came in by' },
  { kind: 'accounts', label: 'Account' },
];
const TEXT_TYPES = ['text', 'textarea', 'email', 'phone', 'url', 'number', 'decimal', 'date'];
const splitWords = (text: string) =>
  text
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

const toRows = (c: Conditions): Row[] => {
  const rows: Row[] = [];
  const add = (kind: string, values: string[]) =>
    rows.push({ kind, values, text: values.join(', ') });
  if (c.keywords?.length) add('keywords', c.keywords);
  if (c.departmentIds?.length) add('departments', c.departmentIds.map(String));
  if (c.priorities?.length) add('priorities', c.priorities.map(String));
  if (c.channels?.length) add('channels', c.channels);
  if (c.companyIds?.length) add('accounts', c.companyIds);
  for (const f of c.fields || []) add(`field:${f.key}`, f.values);
  return rows;
};

const RuleEditor: React.FC<{
  initial: Draft;
  options: Options;
  ticketFields: CustomFieldDef[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ initial, options, ticketFields, onClose, onSaved }) => {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  const fieldByKey = new Map(ticketFields.map((f) => [f.key, f]));
  const kindLabel = (kind: string) =>
    kind.startsWith('field:')
      ? fieldByKey.get(kind.slice(6))?.label || 'Deleted field'
      : BUILT_IN_KINDS.find((k) => k.kind === kind)?.label || kind;
  const isTextRow = (kind: string) =>
    kind === 'keywords' ||
    (kind.startsWith('field:') && TEXT_TYPES.includes(fieldByKey.get(kind.slice(6))?.type || ''));
  const available = [
    ...BUILT_IN_KINDS,
    ...ticketFields.map((f) => ({ kind: `field:${f.key}`, label: f.label })),
  ].filter((k) => !draft.rows.some((r) => r.kind === k.kind));

  const setRow = (i: number, next: Partial<Row>) =>
    setDraft((d) => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...next } : r)) }));

  const valueControl = (row: Row, i: number) => {
    const chips = (opts: { value: string; label: string }[], single = false) => (
      <Chips
        label={kindLabel(row.kind)}
        options={opts}
        selected={row.values}
        single={single}
        onChange={(values) => setRow(i, { values })}
      />
    );
    if (isTextRow(row.kind)) {
      const field = fieldByKey.get(row.kind.slice(6));
      const exact = field && ['number', 'decimal', 'date'].includes(field.type);
      return (
        <input
          type="text"
          aria-label={`${kindLabel(row.kind)} values`}
          value={row.text}
          onChange={(e) => setRow(i, { text: e.target.value })}
          placeholder={exact ? 'e.g. 5, 10' : 'e.g. invoice, refund'}
          className={fieldClass}
        />
      );
    }
    switch (row.kind) {
      case 'departments':
        return chips(options.departments.map((d) => ({ value: String(d.id), label: d.name })));
      case 'priorities':
        return chips(PRIORITY_CHOICES);
      case 'channels':
        return chips(CHANNELS);
      case 'accounts': {
        const shown = options.accounts.filter(
          (a) =>
            row.values.includes(a.id) ||
            !accountSearch.trim() ||
            a.name.toLowerCase().includes(accountSearch.trim().toLowerCase())
        );
        return (
          <div className="space-y-2">
            {options.accounts.length > 12 && (
              <input
                type="search"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Find an account"
                aria-label="Find an account"
                className={fieldClass}
              />
            )}
            {options.accounts.length === 0 ? (
              <p className="text-sm text-gray-500">No accounts yet.</p>
            ) : (
              chips(shown.slice(0, 60).map((a) => ({ value: a.id, label: a.name })))
            )}
          </div>
        );
      }
      default: {
        const field = fieldByKey.get(row.kind.slice(6));
        if (!field) return <p className="text-sm text-gray-500">This field was deleted.</p>;
        if (field.type === 'checkbox')
          return chips(
            [
              { value: 'true', label: 'Ticked' },
              { value: 'false', label: 'Not ticked' },
            ],
            true
          );
        return chips(field.options.map((o) => ({ value: o, label: o })));
      }
    }
  };

  const save = async () => {
    if (!draft.name.trim()) return alert('Give the rule a name.');
    if (draft.agentIds.length === 0) return alert('Choose who gets the tickets.');
    const conditions: Conditions = { fields: [] };
    for (const row of draft.rows) {
      const values = isTextRow(row.kind) ? splitWords(row.text) : row.values;
      if (values.length === 0)
        return alert(`${kindLabel(row.kind)}: choose what it should match, or remove the row.`);
      if (row.kind === 'keywords') conditions.keywords = values;
      else if (row.kind === 'departments') conditions.departmentIds = values.map(Number);
      else if (row.kind === 'priorities') conditions.priorities = values.map(Number);
      else if (row.kind === 'channels') conditions.channels = values;
      else if (row.kind === 'accounts') conditions.companyIds = values;
      else conditions.fields!.push({ key: row.kind.slice(6), values });
    }
    const body = {
      name: draft.name.trim(),
      isActive: draft.isActive,
      method: draft.method,
      agentIds: draft.method === 'specific' ? draft.agentIds.slice(0, 1) : draft.agentIds,
      conditions,
    };
    try {
      setSaving(true);
      if (draft.id) await apiService.updateAssignmentRule(draft.id, body);
      else await apiService.createAssignmentRule(body);
      onSaved();
    } catch (error: any) {
      alert(`Couldn't save the rule: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const heading = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';

  return (
    <Drawer
      title={draft.id ? 'Edit rule' : 'New rule'}
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
            {saving ? 'Saving…' : 'Save rule'}
          </button>
        </>
      }
    >
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label
            htmlFor="rule-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Name
          </label>
          <input
            id="rule-name"
            autoFocus
            type="text"
            maxLength={120}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Billing questions"
            className={fieldClass}
          />
        </div>
        <div className="pb-2">
          <Switch
            checked={draft.isActive}
            onChange={(isActive) => setDraft({ ...draft, isActive })}
            label="On"
            showLabel
          />
        </div>
      </div>

      <section className="space-y-3">
        <h3 className={heading}>When a ticket matches all of these</h3>
        {draft.rows.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No conditions: this rule matches every ticket. That's useful as the last rule.
          </p>
        )}
        {draft.rows.map((row, i) => (
          <div
            key={row.kind}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white">
                {kindLabel(row.kind)}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {isTextRow(row.kind) ? 'contains any of' : 'is any of'}
              </span>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }))}
                aria-label={`Remove the ${kindLabel(row.kind)} condition`}
                className="ml-auto p-1 rounded text-gray-400 hover:text-red-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            {valueControl(row, i)}
          </div>
        ))}
        {available.length > 0 && (
          <select
            value=""
            aria-label="Add a condition"
            onChange={(e) =>
              e.target.value &&
              setDraft((d) => ({
                ...d,
                rows: [...d.rows, { kind: e.target.value, values: [], text: '' }],
              }))
            }
            className="text-sm text-blue-600 dark:text-blue-400 bg-transparent border border-dashed border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 hover:border-blue-400 cursor-pointer"
          >
            <option value="">+ Add condition</option>
            {available.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="space-y-3">
        <h3 className={heading}>Then assign it to</h3>
        <div
          role="radiogroup"
          aria-label="How to choose the agent"
          className="inline-flex rounded-md bg-gray-100 dark:bg-gray-700 p-0.5 text-sm"
        >
          {(
            [
              ['specific', 'One agent'],
              ['round_robin', 'Round-robin'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.method === value}
              onClick={() =>
                setDraft({
                  ...draft,
                  method: value,
                  agentIds: value === 'specific' ? draft.agentIds.slice(0, 1) : draft.agentIds,
                })
              }
              className={`px-3 py-1 rounded ${
                draft.method === value
                  ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        {draft.method === 'specific' ? (
          <select
            value={draft.agentIds[0] || ''}
            onChange={(e) =>
              setDraft({ ...draft, agentIds: e.target.value ? [e.target.value] : [] })
            }
            aria-label="Agent"
            className={fieldClass}
          >
            <option value="">Choose an agent…</option>
            {options.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-1.5">
            <Chips
              label="Agents taking turns"
              options={options.agents.map((a) => ({
                value: a.id,
                label: a.isActive ? a.name : `${a.name} (inactive)`,
              }))}
              selected={draft.agentIds}
              onChange={(agentIds) => setDraft({ ...draft, agentIds })}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              They take turns in the order picked. Inactive agents are skipped.
            </p>
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          If no one here is available, the next rule is tried.
        </p>
      </section>
    </Drawer>
  );
};

const AssignmentRules: React.FC = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<Rule[]>([]);
  const [options, setOptions] = useState<Options>({ agents: [], accounts: [], departments: [] });
  const [ticketFields, setTicketFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = async () => {
    try {
      const data = await apiService.getAssignmentRules();
      setRules(data.rules);
      setOptions(data.options);
    } catch (error: any) {
      alert(`Couldn't load assignment rules: ${errorText(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    apiService
      .getFields('tickets')
      // Lookups link to particular records, which rules don't match on
      .then((layout) =>
        setTicketFields(
          (layout.customFields || []).filter((f: CustomFieldDef) => f.type !== 'lookup')
        )
      )
      .catch(() => setTicketFields([]));
  }, []);

  const names = useMemo(
    () => ({
      agent: new Map(options.agents.map((a) => [a.id, a.name])),
      account: new Map(options.accounts.map((a) => [a.id, a.name])),
      department: new Map(options.departments.map((d) => [d.id, d.name])),
      field: new Map(ticketFields.map((f) => [f.key, f])),
    }),
    [options, ticketFields]
  );

  const summary = (c: Conditions): string => {
    const parts: string[] = [];
    if (c.keywords?.length) parts.push(`mentions ${c.keywords.map((k) => `"${k}"`).join(' or ')}`);
    if (c.departmentIds?.length)
      parts.push(c.departmentIds.map((id) => names.department.get(id) || '?').join(' or '));
    if (c.priorities?.length)
      parts.push(`${c.priorities.map(priorityLabel).join(' or ')} priority`);
    if (c.channels?.length)
      parts.push(
        `by ${c.channels.map((ch) => CHANNELS.find((x) => x.value === ch)?.label || ch).join(' or ')}`
      );
    if (c.companyIds?.length)
      parts.push(c.companyIds.map((id) => names.account.get(id) || '?').join(' or '));
    for (const f of c.fields || []) {
      const def = names.field.get(f.key);
      const values =
        def?.type === 'checkbox'
          ? f.values.map((v) => (v === 'true' ? 'ticked' : 'not ticked'))
          : f.values;
      parts.push(
        `${def?.label || 'Deleted field'} ${f.match === 'contains' ? 'contains' : 'is'} ${values.join(' or ')}`
      );
    }
    return parts.length ? parts.join(' · ') : 'Every ticket';
  };

  const assignee = (rule: Rule) => {
    const list = rule.agentIds.map((id) => names.agent.get(id) || 'Removed agent');
    return rule.method === 'round_robin' ? `Round-robin: ${list.join(', ')}` : list[0] || '';
  };

  const setActive = async (rule: Rule, isActive: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive } : r)));
    try {
      await apiService.updateAssignmentRule(rule.id, { ...rule, isActive });
    } catch (error: any) {
      alert(`Couldn't update the rule: ${errorText(error)}`);
      load();
    }
  };

  const move = async (index: number, by: -1 | 1) => {
    const next = rules.slice();
    const [rule] = next.splice(index, 1);
    next.splice(index + by, 0, rule!);
    setRules(next);
    try {
      setRules((await apiService.reorderAssignmentRules(next.map((r) => r.id))).rules);
    } catch (error: any) {
      alert(`Couldn't save the order: ${errorText(error)}`);
      load();
    }
  };

  const remove = async (rule: Rule) => {
    if (!confirm(`Delete the rule "${rule.name}"? Tickets it already assigned keep their agent.`))
      return;
    try {
      await apiService.deleteAssignmentRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (error: any) {
      alert(`Couldn't delete the rule: ${errorText(error)}`);
    }
  };

  const openNew = () =>
    setEditing({ name: '', isActive: true, method: 'specific', agentIds: [], rows: [] });
  const openRule = (rule: Rule) =>
    setEditing({
      id: rule.id,
      name: rule.name,
      isActive: rule.isActive,
      method: rule.method,
      agentIds: rule.agentIds,
      rows: toRows(rule.conditions),
    });

  if (loading) return <div className="p-8 text-gray-500">Loading assignment rules…</div>;

  const iconButton =
    'p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/admin/settings')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-3"
      >
        ← Settings
      </button>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Assignment Rules</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            New tickets go to the first rule that matches, top to bottom.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3.5 py-2 rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          New rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
          <h2 className="font-medium text-gray-900 dark:text-white">No rules yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Without rules, new tickets wait unassigned until someone picks them up.
          </p>
          <button type="button" onClick={openNew} className="text-sm text-blue-600 hover:underline">
            Add your first rule
          </button>
        </div>
      ) : (
        <ol className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {rules.map((rule, index) => (
            <li
              key={rule.id}
              className={`flex items-center gap-3 px-3 py-2.5 ${rule.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${rule.name} up`}
                >
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === rules.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${rule.name} down`}
                >
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="w-5 text-xs font-medium text-gray-400 text-right">{index + 1}</span>
              <button
                type="button"
                onClick={() => openRule(rule)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {rule.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {summary(rule.conditions)} <span className="text-gray-400">→</span>{' '}
                  <span className="text-gray-700 dark:text-gray-300">{assignee(rule)}</span>
                </div>
              </button>
              <Switch
                checked={rule.isActive}
                onChange={(on) => setActive(rule, on)}
                label={`${rule.name} on`}
              />
              <button
                type="button"
                onClick={() => openRule(rule)}
                className={iconButton}
                aria-label={`Edit ${rule.name}`}
              >
                <PencilSquareIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(rule)}
                className={`${iconButton} hover:text-red-600`}
                aria-label={`Delete ${rule.name}`}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <RuleEditor
          key={editing.id || 'new'}
          initial={editing}
          options={options}
          ticketFields={ticketFields}
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

export default AssignmentRules;
