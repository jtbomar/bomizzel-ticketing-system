import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { errorText } from '../components/ui';
import { planFeatures, priceExample, type PlanInfo } from '../utils/plans';

/**
 * Settings > Billing: the company's plan (and why: paid, trial, given free),
 * what it's using against the plan's limits, and choosing a plan - paid
 * through Stripe Checkout, managed on Stripe's billing page.
 */

interface Summary {
  plan: PlanInfo['key'];
  source: 'comped' | 'paid' | 'grace' | 'trial' | 'free';
  paidPlan: string;
  interval: 'month' | 'year' | null;
  status: string | null;
  seats: number | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  graceEndsAt: string | null;
  hasStripeCustomer: boolean;
  usage: {
    agents: number;
    ticketsThisMonth: number;
    departments: number;
    macros: number;
    ticketFields: number;
  };
  plans: PlanInfo[];
  billingEnabled: boolean;
}

const date = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState<Summary | null>(null);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(
    params.get('checkout') === 'success'
      ? 'Thanks! Your payment went through - your plan updates in a moment.'
      : params.get('checkout') === 'cancelled'
        ? 'Checkout was cancelled. Nothing was charged.'
        : ''
  );

  const load = () =>
    apiService
      .getBilling()
      .then((d) => {
        setData(d);
        if (d.interval) setInterval(d.interval);
      })
      .catch((e) => alert(`Couldn't load billing: ${errorText(e)}`));

  useEffect(() => {
    load();
    // After Checkout, Stripe's webhook may land a moment later
    if (params.get('checkout') === 'success') {
      const t = window.setTimeout(load, 3000);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (plan: PlanInfo) => {
    if (!data) return;
    setBusy(plan.key);
    try {
      const r = await apiService.startCheckout(plan.key, interval);
      if (r.url) window.location.href = r.url;
      else {
        setNotice(`You're now on ${plan.name}.`);
        await load();
      }
    } catch (e) {
      alert(`Couldn't start checkout: ${errorText(e)}`);
    } finally {
      setBusy('');
    }
  };

  const portal = async () => {
    setBusy('portal');
    try {
      window.location.href = (await apiService.openBillingPortal()).url;
    } catch (e) {
      alert(`Couldn't open billing: ${errorText(e)}`);
      setBusy('');
    }
  };

  if (!data) return <div className="p-8 text-gray-500">Loading billing…</div>;
  const current = data.plans.find((p) => p.key === data.plan)!;
  const paying = data.source === 'paid' || data.source === 'grace';
  const limit = (used: number, max: number | null) =>
    max === null ? `${used}` : `${used} of ${max}`;

  const status = (() => {
    switch (data.source) {
      case 'trial':
        return `Free trial of Professional: ${data.trialDaysLeft} day${data.trialDaysLeft === 1 ? '' : 's'} left (ends ${date(data.trialEndsAt)}). Choose a plan to keep everything; otherwise you move to Free.`;
      case 'comped':
        return `${current.name}, free of charge.`;
      case 'paid':
        return `${current.name}, ${data.seats} agent${data.seats === 1 ? '' : 's'}, billed ${data.interval === 'year' ? 'yearly' : 'monthly'}. Renews ${date(data.currentPeriodEnd)}.`;
      case 'grace':
        return `Your last payment didn't go through. Update your card by ${date(data.graceEndsAt)} to keep ${current.name}.`;
      default:
        return 'Free plan. Upgrade any time for more agents, tickets and features.';
    }
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/admin/settings')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-3"
      >
        ← Settings
      </button>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing</h1>

      {notice && (
        <div
          role="status"
          className="mt-4 rounded-md bg-green-50 border border-green-200 text-green-800 px-4 py-2 text-sm"
        >
          {notice}
        </div>
      )}

      <section
        className={`mt-4 rounded-lg border p-5 ${
          data.source === 'grace'
            ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Current plan
            </p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white mt-0.5">
              {current.name}
              {data.source === 'trial' && (
                <span className="ml-2 text-sm font-normal text-blue-700">trial</span>
              )}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">{status}</p>
          </div>
          {data.hasStripeCustomer && data.billingEnabled && (
            <button
              type="button"
              onClick={portal}
              disabled={busy === 'portal'}
              className="px-3.5 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {busy === 'portal' ? 'Opening…' : 'Card, invoices and cancelling'}
            </button>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          {[
            ['Agents', limit(data.usage.agents, current.limits.agents)],
            [
              'Tickets this month',
              limit(data.usage.ticketsThisMonth, current.limits.ticketsPerMonth),
            ],
            ['Departments', limit(data.usage.departments, current.limits.departments)],
            ['Macros', limit(data.usage.macros, current.limits.macros)],
            ['Ticket fields', limit(data.usage.ticketFields, current.limits.ticketFields)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Plans</h2>
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="inline-flex rounded-md bg-gray-100 dark:bg-gray-700 p-0.5 text-sm"
        >
          {(
            [
              ['month', 'Monthly'],
              ['year', 'Yearly (save about 17%)'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setInterval(value)}
              className={`px-3 py-1 rounded ${
                interval === value
                  ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {!data.billingEnabled && (
        <p className="mt-3 text-sm text-amber-700">
          Payments aren't switched on yet - plans can't be bought right now.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.plans.map((p) => {
          const isCurrent = paying ? data.paidPlan === p.key && data.interval === interval : false;
          const price = interval === 'year' ? p.yearly : p.monthly;
          return (
            <div
              key={p.key}
              className={`rounded-lg border bg-white dark:bg-gray-800 p-5 flex flex-col ${
                p.key === 'professional'
                  ? 'border-blue-400 ring-1 ring-blue-200'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
              <p className="mt-1">
                <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                  ${price}
                </span>
                <span className="text-sm text-gray-500">
                  {price > 0 ? ' / agent / month' : ` for up to ${p.limits.agents} agents`}
                </span>
              </p>
              <p className="text-xs text-gray-500 min-h-[2rem]">
                {price > 0 && (
                  <>
                    For each agent on your team.
                    <br />
                    You have {priceExample(price, Math.max(1, data.usage.agents))}
                    {interval === 'year' ? ', billed yearly' : ''}.
                  </>
                )}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-gray-700 dark:text-gray-300 flex-1">
                {planFeatures(p).map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckIcon
                      className="h-4 w-4 mt-0.5 text-green-600 shrink-0"
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {p.key === 'free' ? (
                  <p className="text-xs text-gray-500">
                    {paying
                      ? 'To move to Free, cancel on the billing page.'
                      : 'Where you land if you don’t pick a paid plan.'}
                  </p>
                ) : isCurrent ? (
                  <p className="text-sm font-medium text-green-700">Your plan</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => choose(p)}
                    disabled={!!busy || !data.billingEnabled || data.source === 'comped'}
                    className="w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy === p.key
                      ? 'One moment…'
                      : paying
                        ? `Switch to ${p.name}`
                        : `Choose ${p.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Paid plans are priced per agent - each person on your team who answers tickets. Your
        customers are free. Adding or removing an agent changes the bill automatically, prorated.
        Payments are handled by Stripe; Bomizzel never sees your card.
      </p>
    </div>
  );
};

export default Billing;
