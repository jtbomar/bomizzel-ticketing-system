import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { priorityLabel } from '../utils/priority';

/**
 * Settings > Assignment Rules: who gets a new ticket.
 *
 * Rules are tried top to bottom and the first that matches assigns the
 * ticket - to one agent, or round-robin through several. A ticket that
 * already has an agent is never changed.
 */

interface Conditions {
  departmentIds?: number[];
  companyIds?: string[];
  priorities?: number[];
  channels?: string[];
  keywords?: string[];
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

interface Draft {
  id?: string;
  name: string;
  isActive: boolean;
  method: 'specific' | 'round_robin';
  agentIds: string[];
  departmentIds: number[];
  companyIds: string[];
  priorities: number[];
  channels: string[];
  keywords: string;
}

const PRIORITIES = [0, 1, 2, 3];
const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'web', label: 'Web / portal' },
];

const emptyDraft = (): Draft => ({
  name: '',
  isActive: true,
  method: 'specific',
  agentIds: [],
  departmentIds: [],
  companyIds: [],
  priorities: [],
  channels: [],
  keywords: '',
});

const toDraft = (rule: Rule): Draft => ({
  id: rule.id,
  name: rule.name,
  isActive: rule.isActive,
  method: rule.method,
  agentIds: rule.agentIds,
  departmentIds: rule.conditions.departmentIds || [],
  companyIds: rule.conditions.companyIds || [],
  priorities: rule.conditions.priorities || [],
  channels: rule.conditions.channels || [],
  keywords: (rule.conditions.keywords || []).join(', '),
});

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const errorText = (error: any): string =>
  error.response?.data?.error?.message ||
  error.response?.data?.error ||
  error.response?.data?.message ||
  error.message;

const AssignmentRules: React.FC = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<Rule[]>([]);
  const [options, setOptions] = useState<Options>({ agents: [], accounts: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

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
  }, []);

  const names = useMemo(
    () => ({
      agent: new Map(options.agents.map((a) => [a.id, a.name])),
      account: new Map(options.accounts.map((a) => [a.id, a.name])),
      department: new Map(options.departments.map((d) => [d.id, d.name])),
    }),
    [options]
  );

  const describeConditions = (c: Conditions): string[] => {
    const parts: string[] = [];
    if (c.departmentIds?.length)
      parts.push(
        `Department: ${c.departmentIds.map((id) => names.department.get(id) || '?').join(' or ')}`
      );
    if (c.companyIds?.length)
      parts.push(`Account: ${c.companyIds.map((id) => names.account.get(id) || '?').join(' or ')}`);
    if (c.priorities?.length)
      parts.push(`Priority: ${c.priorities.map(priorityLabel).join(' or ')}`);
    if (c.channels?.length)
      parts.push(
        `Came in by: ${c.channels
          .map((ch) => CHANNELS.find((x) => x.value === ch)?.label || ch)
          .join(' or ')}`
      );
    if (c.keywords?.length) parts.push(`Mentions: ${c.keywords.map((k) => `"${k}"`).join(' or ')}`);
    return parts.length ? parts : ['Every ticket'];
  };

  const describeAgents = (rule: Rule): string => {
    const list = rule.agentIds.map((id) => names.agent.get(id) || 'Removed agent');
    return rule.method === 'round_robin' ? `Round-robin: ${list.join(', ')}` : list[0] || '';
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return alert('Give the rule a name.');
    if (draft.agentIds.length === 0) return alert('Choose who gets the tickets.');
    const body = {
      name: draft.name.trim(),
      isActive: draft.isActive,
      method: draft.method,
      agentIds: draft.method === 'specific' ? draft.agentIds.slice(0, 1) : draft.agentIds,
      conditions: {
        departmentIds: draft.departmentIds,
        companyIds: draft.companyIds,
        priorities: draft.priorities,
        channels: draft.channels,
        keywords: draft.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      },
    };
    try {
      setSaving(true);
      if (draft.id) await apiService.updateAssignmentRule(draft.id, body);
      else await apiService.createAssignmentRule(body);
      setDraft(null);
      await load();
    } catch (error: any) {
      alert(`Couldn't save the rule: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (rule: Rule, isActive: boolean) => {
    try {
      await apiService.updateAssignmentRule(rule.id, { ...rule, isActive });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive } : r)));
    } catch (error: any) {
      alert(`Couldn't update the rule: ${errorText(error)}`);
    }
  };

  const move = async (index: number, by: -1 | 1) => {
    const next = rules.slice();
    const [rule] = next.splice(index, 1);
    next.splice(index + by, 0, rule!);
    setRules(next);
    try {
      const data = await apiService.reorderAssignmentRules(next.map((r) => r.id));
      setRules(data.rules);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading assignment rules...</div>
      </div>
    );
  }

  const shownAccounts = options.accounts.filter(
    (a) =>
      !accountSearch.trim() ||
      a.name.toLowerCase().includes(accountSearch.trim().toLowerCase()) ||
      draft?.companyIds.includes(a.id)
  );
  const checkbox = 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
  const sectionLabel = 'block text-sm font-medium text-gray-700 mb-2';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <button
                onClick={() => navigate('/admin/settings')}
                className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
              >
                ← Back to Settings
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Assignment Rules</h2>
              <p className="text-sm text-gray-600 mt-1">
                New tickets go to the first rule that matches, top to bottom. Rules run again if an
                unassigned ticket's priority or department changes. A ticket that already has an
                agent is never changed.
              </p>
            </div>
            {!draft && (
              <button
                onClick={() => setDraft(emptyDraft())}
                className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Rule
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {draft && (
            <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {draft.id ? 'Edit rule' : 'New rule'}
                </h3>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className={checkbox}
                    checked={draft.isActive}
                    onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                  />
                  On
                </label>
              </div>

              <div>
                <label className={sectionLabel} htmlFor="rule-name">
                  Name
                </label>
                <input
                  id="rule-name"
                  type="text"
                  value={draft.name}
                  maxLength={120}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Billing questions"
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">When a ticket matches</p>
                  <p className="text-xs text-gray-500">
                    Leave a section empty to ignore it. With every section empty, the rule matches
                    every ticket - useful as the last rule.
                  </p>
                </div>

                <div>
                  <label className={sectionLabel} htmlFor="rule-keywords">
                    Subject or description mentions any of
                  </label>
                  <input
                    id="rule-keywords"
                    type="text"
                    value={draft.keywords}
                    onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                    placeholder="invoice, refund, billing"
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate with commas.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <fieldset>
                    <legend className={sectionLabel}>Department</legend>
                    <div className="space-y-1">
                      {options.departments.map((d) => (
                        <label key={d.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className={checkbox}
                            checked={draft.departmentIds.includes(d.id)}
                            onChange={() =>
                              setDraft({
                                ...draft,
                                departmentIds: toggle(draft.departmentIds, d.id),
                              })
                            }
                          />
                          {d.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className={sectionLabel}>Priority</legend>
                    <div className="space-y-1">
                      {PRIORITIES.map((p) => (
                        <label key={p} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className={checkbox}
                            checked={draft.priorities.includes(p)}
                            onChange={() =>
                              setDraft({ ...draft, priorities: toggle(draft.priorities, p) })
                            }
                          />
                          {priorityLabel(p)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className={sectionLabel}>Came in by</legend>
                    <div className="space-y-1">
                      {CHANNELS.map((ch) => (
                        <label key={ch.value} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className={checkbox}
                            checked={draft.channels.includes(ch.value)}
                            onChange={() =>
                              setDraft({ ...draft, channels: toggle(draft.channels, ch.value) })
                            }
                          />
                          {ch.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <fieldset>
                  <legend className={sectionLabel}>Account</legend>
                  {options.accounts.length > 8 && (
                    <input
                      type="search"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      placeholder="Find an account"
                      aria-label="Find an account"
                      className="w-full max-w-xs mb-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                    {shownAccounts.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className={checkbox}
                          checked={draft.companyIds.includes(a.id)}
                          onChange={() =>
                            setDraft({ ...draft, companyIds: toggle(draft.companyIds, a.id) })
                          }
                        />
                        {a.name}
                      </label>
                    ))}
                    {options.accounts.length === 0 && (
                      <p className="text-sm text-gray-500">No accounts yet.</p>
                    )}
                  </div>
                </fieldset>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Assign it to</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="method"
                      checked={draft.method === 'specific'}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          method: 'specific',
                          agentIds: draft.agentIds.slice(0, 1),
                        })
                      }
                    />
                    One agent
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="method"
                      checked={draft.method === 'round_robin'}
                      onChange={() => setDraft({ ...draft, method: 'round_robin' })}
                    />
                    Round-robin (take turns)
                  </label>
                </div>

                {draft.method === 'specific' ? (
                  <select
                    value={draft.agentIds[0] || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, agentIds: e.target.value ? [e.target.value] : [] })
                    }
                    aria-label="Agent"
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose an agent...</option>
                    {options.agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.isActive ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {options.agents.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className={checkbox}
                            checked={draft.agentIds.includes(a.id)}
                            onChange={() =>
                              setDraft({ ...draft, agentIds: toggle(draft.agentIds, a.id) })
                            }
                          />
                          {a.name}
                          {!a.isActive && <span className="text-gray-400">(inactive)</span>}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Tickets go to each in turn, in the order ticked. Inactive agents are skipped.
                    </p>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  If no one here is available, the next rule is tried.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save rule'}
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

          {rules.length === 0 && !draft ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2" aria-hidden="true">
                🎯
              </div>
              <h3 className="text-lg font-medium text-gray-900">No rules yet</h3>
              <p className="text-gray-600 mt-1 mb-4">
                Without rules, new tickets wait unassigned until someone picks them up.
              </p>
              <button
                onClick={() => setDraft(emptyDraft())}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add your first rule
              </button>
            </div>
          ) : (
            <ol className="space-y-3">
              {rules.map((rule, index) => (
                <li
                  key={rule.id}
                  className={`border rounded-lg p-4 flex gap-4 items-start ${
                    rule.isActive ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-70'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${rule.name} up`}
                      className="text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <span className="text-sm font-semibold text-gray-700">{index + 1}</span>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === rules.length - 1}
                      aria-label={`Move ${rule.name} down`}
                      className="text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                      {!rule.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                          Off
                        </span>
                      )}
                    </div>
                    <ul className="text-sm text-gray-600 mt-1">
                      {describeConditions(rule.conditions).map((part) => (
                        <li key={part}>{part}</li>
                      ))}
                    </ul>
                    <p className="text-sm text-gray-900 mt-1">→ {describeAgents(rule)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-1 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className={checkbox}
                        checked={rule.isActive}
                        onChange={(e) => setActive(rule, e.target.checked)}
                      />
                      On
                    </label>
                    <button
                      onClick={() => setDraft(toDraft(rule))}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(rule)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentRules;
