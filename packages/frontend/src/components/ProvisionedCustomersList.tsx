import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../services/api';
import type { PlanInfo } from '../utils/plans';

// A subscriber: a company that signed up at bomizzel.com or was provisioned
// here. Sign-ups have no subscription row yet, so subscriptionId is null and
// the Update / Disable / Delete actions (which work on a subscription) are hidden.
// "Give free plan" and "Limits" work on any subscriber.
type CompPlan = 'standard' | 'professional';
type Limits = PlanInfo['limits'];
type CountKey = 'agents' | 'ticketsPerMonth' | 'departments' | 'macros' | 'ticketFields';
type FeatureKey = 'assignmentRules' | 'roundRobin' | 'recordFields' | 'customModules';

const COUNT_LIMITS: [CountKey, string][] = [
  ['agents', 'Agents'],
  ['ticketsPerMonth', 'Tickets a month'],
  ['departments', 'Departments'],
  ['macros', 'Macros'],
  ['ticketFields', 'Custom ticket fields'],
];
const FEATURE_LIMITS: [FeatureKey, string][] = [
  ['assignmentRules', 'Assignment rules'],
  ['roundRobin', 'Round-robin'],
  ['recordFields', 'Account/contact fields'],
  ['customModules', 'Custom modules'],
];

// In the Limits editor: follow the plan, or set a number / no limit / on / off
type CountChoice = { mode: 'plan' | 'set' | 'none'; value: string };
type FeatureChoice = 'plan' | 'on' | 'off';

const showCount = (v: number | null) => (v === null ? 'No limit' : String(v));

interface Customer {
  subscriptionId: string | null;
  plan: { key: string; name: string; source: 'comped' | 'paid' | 'grace' | 'trial' | 'free' };
  compedPlan: CompPlan | null;
  // Their sign-up trial, while it's still running
  trialEndsAt: string | null;
  // Your own company (Bomizzel Services Inc.): labelled, no actions
  isOwnAccount: boolean;
  billingStatus: string | null;
  source: 'signup' | 'provisioned';
  status: string;
  // Enforced limits (plan's plus overrides), the plan's own, and the overrides
  limits: Limits;
  planLimits: Limits;
  limitOverrides: Partial<Limits>;
  currentPeriod: {
    start: string;
    end: string | null;
  };
  company: {
    id: string;
    name: string;
    domain?: string;
  };
  admin: {
    id: string;
    email: string;
    name: string;
  } | null;
  staffCount: number;
  createdAt: string;
}

const PLAN_SOURCE_LABEL: Record<Customer['plan']['source'], string> = {
  comped: 'Free (given)',
  paid: 'Paying',
  grace: 'Payment failed',
  trial: 'Trial',
  free: 'Free tier',
};

const ProvisionedCustomersList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitsFor, setLimitsFor] = useState<Customer | null>(null);
  const [counts, setCounts] = useState<Record<CountKey, CountChoice>>(
    {} as Record<CountKey, CountChoice>
  );
  const [features, setFeatures] = useState<Record<FeatureKey, FeatureChoice>>(
    {} as Record<FeatureKey, FeatureChoice>
  );
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [compFor, setCompFor] = useState<Customer | null>(null);
  const [compPlan, setCompPlan] = useState<CompPlan>('professional');
  const [compSaving, setCompSaving] = useState(false);
  // Removing a free plan: also end the trial, straight to Free
  const [endTrial, setEndTrial] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      const response = await axios.get(`${apiUrl}/admin/provisioning/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCustomers(response.data.data.customers);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableCustomer = async (subscriptionId: string) => {
    const reason = prompt('Reason for disabling this customer?');
    if (!reason) return;

    if (
      !confirm(
        'Are you sure you want to disable this customer? All their users will be blocked from accessing the system.'
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      await axios.post(
        `${apiUrl}/admin/provisioning/subscriptions/${subscriptionId}/disable`,
        { reason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchCustomers(); // Refresh list
      alert('Customer disabled successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disable customer');
    }
  };

  const handleEnableCustomer = async (subscriptionId: string) => {
    const reason = prompt('Reason for enabling this customer?');
    if (!reason) return;

    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      await axios.post(
        `${apiUrl}/admin/provisioning/subscriptions/${subscriptionId}/enable`,
        { reason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchCustomers(); // Refresh list
      alert('Customer enabled successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to enable customer');
    }
  };

  const handleDeleteCustomer = async (subscriptionId: string) => {
    const reason = prompt('Reason for deleting this customer?');
    if (!reason) return;

    if (
      !confirm(
        '⚠️ WARNING: This will PERMANENTLY delete the customer, all their users, and all their data. This cannot be undone. Are you absolutely sure?'
      )
    ) {
      return;
    }

    if (!confirm('Final confirmation: Type DELETE to confirm')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      await axios.delete(`${apiUrl}/admin/provisioning/subscriptions/${subscriptionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: { reason },
      });
      fetchCustomers(); // Refresh list
      alert('Customer deleted successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const openCompModal = (customer: Customer) => {
    setCompFor(customer);
    setCompPlan(customer.compedPlan || 'professional');
    setEndTrial(false);
  };

  const saveCompedPlan = async (plan: CompPlan | null) => {
    if (!compFor) return;
    const trialLeft = compFor.trialEndsAt && !endTrial;
    if (
      plan === null &&
      !confirm(
        trialLeft
          ? `Take away ${compFor.company.name}'s free plan? They go back to their trial until ${new Date(compFor.trialEndsAt!).toLocaleDateString()}, then to Free unless they pay.`
          : `Take away ${compFor.company.name}'s free plan? They move to Free now (or their paid plan, if they have one).`
      )
    ) {
      return;
    }
    setCompSaving(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      await axios.put(
        `${apiUrl}/admin/provisioning/companies/${compFor.company.id}/comped-plan`,
        plan === null ? { plan, endTrial } : { plan },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompFor(null);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to change the free plan');
    } finally {
      setCompSaving(false);
    }
  };

  const openLimitsModal = (customer: Customer) => {
    const o = customer.limitOverrides || {};
    const c = {} as Record<CountKey, CountChoice>;
    for (const [key] of COUNT_LIMITS) {
      if (!(key in o)) c[key] = { mode: 'plan', value: '' };
      else if (o[key] === null) c[key] = { mode: 'none', value: '' };
      else c[key] = { mode: 'set', value: String(o[key]) };
    }
    const f = {} as Record<FeatureKey, FeatureChoice>;
    for (const [key] of FEATURE_LIMITS) {
      f[key] = !(key in o) ? 'plan' : o[key] ? 'on' : 'off';
    }
    setCounts(c);
    setFeatures(f);
    setLimitsFor(customer);
  };

  const saveLimits = async (clearAll = false) => {
    if (!limitsFor) return;
    const overrides: Record<string, number | boolean | null> = {};
    if (!clearAll) {
      for (const [key, label] of COUNT_LIMITS) {
        const c = counts[key];
        if (c.mode === 'none') overrides[key] = null;
        else if (c.mode === 'set') {
          const n = Number(c.value);
          if (c.value.trim() === '' || !Number.isInteger(n) || n < 0) {
            alert(`${label}: enter a whole number, 0 or more`);
            return;
          }
          overrides[key] = n;
        }
      }
      for (const [key] of FEATURE_LIMITS) {
        if (features[key] !== 'plan') overrides[key] = features[key] === 'on';
      }
    }
    setLimitsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiBaseUrl();
      await axios.put(
        `${apiUrl}/admin/provisioning/companies/${limitsFor.company.id}/limits`,
        { overrides },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLimitsFor(null);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to change the limits');
    } finally {
      setLimitsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">
          {customers.length} Subscriber{customers.length !== 1 ? 's' : ''}
        </h2>
        <button
          onClick={fetchCustomers}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No subscribers yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Companies that sign up or that you provision will show here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                  Company
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Admin</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Plan</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Limits
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Period
                </th>
                <th className="relative py-3.5 pl-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {customers.map((customer) => (
                <tr key={customer.company.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="font-medium text-gray-900">
                      {customer.company.name}
                      {customer.isOwnAccount && (
                        <span className="ml-2 inline-flex rounded-full bg-indigo-100 px-2 text-xs font-semibold leading-5 text-indigo-800">
                          Your account
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500">{customer.company.domain}</div>
                    <div className="text-gray-400 text-xs">
                      {customer.source === 'signup' ? 'Signed up' : 'Provisioned'}{' '}
                      {new Date(customer.createdAt).toLocaleDateString()} · {customer.staffCount}{' '}
                      staff
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div>{customer.admin?.name || '—'}</div>
                    <div className="text-gray-400">{customer.admin?.email}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        customer.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : customer.status === 'trial'
                            ? 'bg-blue-100 text-blue-800'
                            : customer.status === 'suspended'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <div className="font-medium text-gray-900">{customer.plan.name}</div>
                    <div
                      className={
                        customer.plan.source === 'comped'
                          ? 'text-green-700 text-xs font-semibold'
                          : 'text-gray-400 text-xs'
                      }
                    >
                      {PLAN_SOURCE_LABEL[customer.plan.source]}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">
                    {COUNT_LIMITS.map(([key, label]) => {
                      const custom = key in (customer.limitOverrides || {});
                      return (
                        <div key={key} className={custom ? 'text-purple-700 font-semibold' : ''}>
                          {label}: {showCount(customer.limits[key])}
                        </div>
                      );
                    })}
                    {Object.keys(customer.limitOverrides || {}).length > 0 && (
                      <div className="text-purple-700">Custom limits set</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div>{new Date(customer.currentPeriod.start).toLocaleDateString()}</div>
                    <div className="text-gray-400">
                      {customer.currentPeriod.end
                        ? `to ${new Date(customer.currentPeriod.end).toLocaleDateString()}`
                        : ''}
                    </div>
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium space-x-2">
                    {customer.isOwnAccount ? (
                      <span className="text-gray-400 font-normal">—</span>
                    ) : (
                      <>
                        <button
                          onClick={() => openCompModal(customer)}
                          className="text-green-700 hover:text-green-900"
                        >
                          {customer.compedPlan ? 'Free plan…' : 'Give free plan'}
                        </button>
                        <button
                          onClick={() => openLimitsModal(customer)}
                          className="text-purple-700 hover:text-purple-900"
                        >
                          Limits…
                        </button>
                        {customer.subscriptionId ? (
                          <>
                            {customer.status === 'suspended' ? (
                              <button
                                onClick={() => handleEnableCustomer(customer.subscriptionId!)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Enable
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDisableCustomer(customer.subscriptionId!)}
                                className="text-yellow-600 hover:text-yellow-900"
                              >
                                Disable
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteCustomer(customer.subscriptionId!)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-400 font-normal">No subscription yet</span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Give free plan */}
      {compFor && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => !compSaving && setCompFor(null)}
            ></div>
            <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 text-left shadow-xl sm:max-w-md w-full sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">
                Free plan for {compFor.company.name}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                They get this plan at no charge with no end date. It takes the place of their trial
                and they won't be asked to pay.
              </p>

              <div className="mt-4 space-y-2">
                {(['professional', 'standard'] as CompPlan[]).map((key) => (
                  <label
                    key={key}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer ${
                      compPlan === key ? 'border-green-600 bg-green-50' : 'border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="comp-plan"
                      checked={compPlan === key}
                      onChange={() => setCompPlan(key)}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {key === 'professional' ? 'Professional' : 'Standard'}
                    </span>
                  </label>
                ))}
              </div>

              {['active', 'trialing', 'past_due'].includes(compFor.billingStatus || '') && (
                <p className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                  This company also has a paid Stripe subscription. A free plan doesn't cancel it -
                  cancel it in Stripe so they stop being charged.
                </p>
              )}

              {compFor.compedPlan && compFor.trialEndsAt && (
                <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={endTrial}
                    onChange={(e) => setEndTrial(e.target.checked)}
                  />
                  <span>
                    If I remove it, end their trial too and put them straight on Free. Otherwise
                    they get their trial back until{' '}
                    {new Date(compFor.trialEndsAt).toLocaleDateString()}.
                  </span>
                </label>
              )}

              <div className="mt-5 flex items-center justify-between gap-3">
                {compFor.compedPlan ? (
                  <button
                    type="button"
                    disabled={compSaving}
                    onClick={() => saveCompedPlan(null)}
                    className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Remove free plan
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={compSaving}
                    onClick={() => setCompFor(null)}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={compSaving || compPlan === compFor.compedPlan}
                    onClick={() => saveCompedPlan(compPlan)}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {compSaving ? 'Saving…' : compFor.compedPlan ? 'Change plan' : 'Give free plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Limits for one company */}
      {limitsFor && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => !limitsSaving && setLimitsFor(null)}
            ></div>
            <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 text-left shadow-xl sm:max-w-xl w-full sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">
                Limits for {limitsFor.company.name}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                They're on {limitsFor.plan.name}. Anything left on "{limitsFor.plan.name}'s" follows
                their plan, even if the plan changes. Anything you set stays until you change it
                here.
              </p>

              <table className="mt-4 w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {COUNT_LIMITS.map(([key, label]) => {
                    const c = counts[key];
                    return (
                      <tr key={key}>
                        <td className="py-2 pr-3 font-medium text-gray-900">{label}</td>
                        <td className="py-2 pr-3">
                          <select
                            value={c.mode}
                            onChange={(e) =>
                              setCounts({
                                ...counts,
                                [key]: { ...c, mode: e.target.value as CountChoice['mode'] },
                              })
                            }
                            className="rounded-md border-gray-300 text-sm"
                          >
                            <option value="plan">
                              {limitsFor.plan.name}'s ({showCount(limitsFor.planLimits[key])})
                            </option>
                            <option value="set">Set a number</option>
                            <option value="none">No limit</option>
                          </select>
                        </td>
                        <td className="py-2 w-24">
                          {c.mode === 'set' && (
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={c.value}
                              onChange={(e) =>
                                setCounts({ ...counts, [key]: { ...c, value: e.target.value } })
                              }
                              className="w-24 rounded-md border-gray-300 text-sm"
                              aria-label={label}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {FEATURE_LIMITS.map(([key, label]) => (
                    <tr key={key}>
                      <td className="py-2 pr-3 font-medium text-gray-900">{label}</td>
                      <td className="py-2 pr-3" colSpan={2}>
                        <select
                          value={features[key]}
                          onChange={(e) =>
                            setFeatures({ ...features, [key]: e.target.value as FeatureChoice })
                          }
                          className="rounded-md border-gray-300 text-sm"
                        >
                          <option value="plan">
                            {limitsFor.plan.name}'s ({limitsFor.planLimits[key] ? 'Yes' : 'No'})
                          </option>
                          <option value="on">Yes</option>
                          <option value="off">No</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-3 text-xs text-gray-500">
                Agent limits here don't change billing: a paying company is still charged per agent.
                Lowering a limit doesn't remove anything they already have; it only stops new ones.
              </p>

              <div className="mt-5 flex items-center justify-between gap-3">
                {Object.keys(limitsFor.limitOverrides || {}).length > 0 ? (
                  <button
                    type="button"
                    disabled={limitsSaving}
                    onClick={() =>
                      confirm(`Put ${limitsFor.company.name} back on their plan's limits?`) &&
                      saveLimits(true)
                    }
                    className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Back to plan's limits
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={limitsSaving}
                    onClick={() => setLimitsFor(null)}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={limitsSaving}
                    onClick={() => saveLimits()}
                    className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                  >
                    {limitsSaving ? 'Saving…' : 'Save limits'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvisionedCustomersList;
