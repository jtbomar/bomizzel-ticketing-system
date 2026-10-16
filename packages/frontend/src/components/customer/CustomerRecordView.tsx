import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ChatBubbleLeftIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  PaperClipIcon,
  PhoneIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../../services/api';
import { openAttachment } from '../../utils/attachments';
import RecordFields from '../RecordFields';
import RelatedLists from '../RelatedLists';

/**
 * An account's or contact's page, laid out like Zoho Desk's: their properties
 * down the left (edited in place), and a header, tabs and an overview - ticket
 * counts, the tickets, where they came from and how quickly they were handled.
 */

type Module = 'accounts' | 'contacts';
type Tab = 'overview' | 'tickets' | 'people' | 'history' | 'attachments';
type Filter = 'all' | 'open' | 'on_hold';

interface Overview {
  counts: { all: number; open: number; onHold: number; finished: number };
  channels: Array<{ channel: string; count: number }>;
  happiness: { responses: number; percent: number } | null;
  handling: {
    months: number;
    firstResponseMinutes: number | null;
    responseMinutes: number | null;
    resolutionMinutes: number | null;
  };
}

interface TicketRow {
  id: string;
  number: number | null;
  title: string;
  status: string;
  statusLabel: string;
  statusColor: string | null;
  channel: string;
  createdAt: string;
  contact: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  replies: number;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** 95 -> "1h 35m", 3000 -> "2d 2h", null -> "--" */
const duration = (min: number | null) => {
  if (min === null) return '--';
  if (min < 60) return `${min}m`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;
};

// Each channel keeps its colour whatever the counts (validated categorical
// slots: blue, orange, aqua - light and dark steps)
const CHANNELS: Record<
  string,
  { label: string; icon: React.ElementType; stroke: string; dot: string }
> = {
  web: {
    label: 'Web',
    icon: GlobeAltIcon,
    stroke: 'stroke-[#2a78d6] dark:stroke-[#3987e5]',
    dot: 'bg-[#2a78d6] dark:bg-[#3987e5]',
  },
  email: {
    label: 'Email',
    icon: EnvelopeIcon,
    stroke: 'stroke-[#eb6834] dark:stroke-[#d95926]',
    dot: 'bg-[#eb6834] dark:bg-[#d95926]',
  },
  phone: {
    label: 'Phone',
    icon: PhoneIcon,
    stroke: 'stroke-[#1baf7a] dark:stroke-[#199e70]',
    dot: 'bg-[#1baf7a] dark:bg-[#199e70]',
  },
};
const channelOf = (c: string) => CHANNELS[c] || CHANNELS['web']!;

const card = 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700';

const Avatar: React.FC<{ name: string; size?: 'sm' | 'lg' }> = ({ name, size = 'sm' }) => (
  <span
    title={name}
    className={`inline-flex shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 font-medium text-gray-600 dark:text-gray-200 ${
      size === 'lg' ? 'h-12 w-12 text-base' : 'h-8 w-8 text-xs'
    }`}
  >
    {initials(name)}
  </span>
);

const StatCard: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={`${card} px-5 py-4`}>
    <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
    <div className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{children}</div>
  </div>
);

/** One ticket, as a row: channel, subject, number · contact/account · date, status, replies, agent. */
const TicketItem: React.FC<{ t: TicketRow; module: Module }> = ({ t, module }) => {
  const navigate = useNavigate();
  const ch = channelOf(t.channel);
  const Icon = ch.icon;
  // On an account the contact matters; on a contact, the account
  const who = module === 'accounts' ? t.contact?.name : t.account?.name;
  return (
    <button
      type="button"
      onClick={() => navigate(`/agent/tickets/${encodeURIComponent(t.id)}`)}
      className="flex w-full items-center gap-4 border-b border-gray-100 dark:border-gray-700 px-4 py-3 text-left last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
    >
      <span
        title={ch.label}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300"
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-900 dark:text-white">{t.title}</span>
        <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
          {t.number ? `#${t.number}` : ''}
          {who ? ` · ${who}` : ''} · {shortDate(t.createdAt)}
        </span>
      </span>
      <span
        className="shrink-0 rounded border px-2 py-0.5 text-xs font-medium"
        style={{
          color: t.statusColor || '#4b5563',
          borderColor: `${t.statusColor || '#9ca3af'}66`,
          background: `${t.statusColor || '#9ca3af'}14`,
        }}
      >
        {t.statusLabel}
      </span>
      <span
        title={`${t.replies} ${t.replies === 1 ? 'reply' : 'replies'}`}
        className="flex w-10 shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
      >
        <ChatBubbleLeftIcon className="h-4 w-4" />
        {t.replies || ''}
      </span>
      {t.assignee ? (
        <Avatar name={t.assignee.name} />
      ) : (
        <span
          title="Unassigned"
          className="h-8 w-8 shrink-0 rounded-full border border-dashed border-gray-300 dark:border-gray-600"
        />
      )}
    </button>
  );
};

/** Tickets with All / Open / On hold, paged. `compact`: the overview's scrolling box. */
const TicketList: React.FC<{
  module: Module;
  id: string;
  counts?: Overview['counts'];
  compact?: boolean;
}> = ({ module, id, counts, compact }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; limit: number; tickets: TicketRow[] } | null>(
    null
  );

  useEffect(() => {
    let live = true;
    apiService
      .getRecordPart(module, id, 'tickets', { filter, page })
      .then((d) => live && setData(d))
      .catch(() => live && setData({ total: 0, limit: 25, tickets: [] }));
    return () => {
      live = false;
    };
  }, [module, id, filter, page]);

  const tabs: Array<[Filter, string, number | undefined]> = [
    ['all', 'All', counts?.all],
    ['open', 'Open', counts?.open],
    ['on_hold', 'On hold', counts?.onHold],
  ];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className={card}>
      <div className="px-4 pt-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Tickets</h3>
        <div className="mt-3 flex gap-6 border-b border-gray-200 dark:border-gray-700 text-xs font-medium uppercase tracking-wide">
          {tabs.map(([f, label, n]) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`-mb-px border-b-2 pb-2 ${
                filter === f
                  ? 'border-blue-600 text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {label}
              {n !== undefined ? ` (${n})` : ''}
            </button>
          ))}
        </div>
      </div>
      <div className={compact ? 'max-h-96 overflow-y-auto' : ''}>
        {!data ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">Loading tickets…</p>
        ) : data.tickets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No tickets here.
          </p>
        ) : (
          data.tickets.map((t) => <TicketItem key={t.id} t={t} module={module} />)
        )}
      </div>
      {data && pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
          <span>
            Page {page} of {pages} · {data.total} tickets
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-2 py-1 disabled:opacity-40 dark:border-gray-600"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-2 py-1 disabled:opacity-40 dark:border-gray-600"
            >
              Next
            </button>
          </span>
        </div>
      )}
    </div>
  );
};

/** Where tickets came from: a donut with the total inside, and a labelled legend. */
const TrafficAnalysis: React.FC<{ channels: Overview['channels'] }> = ({ channels }) => {
  const [hover, setHover] = useState<string | null>(null);
  const total = channels.reduce((n, c) => n + c.count, 0);
  const r = 60;
  const circumference = 2 * Math.PI * r;
  // 2px of surface between segments (none for a single segment)
  const gap = channels.length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <div className={`${card} p-4`}>
      <h3 className="font-medium text-gray-900 dark:text-white">Traffic analysis</h3>
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          No tickets yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-8">
          <svg
            viewBox="0 0 160 160"
            className="h-44 w-44 -rotate-90"
            role="img"
            aria-label={`Tickets by channel: ${channels
              .map((c) => `${channelOf(c.channel).label} ${c.count}`)
              .join(', ')}`}
          >
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              strokeWidth="14"
              className="stroke-gray-100 dark:stroke-gray-700"
            />
            {channels.map((c) => {
              const len = (c.count / total) * circumference;
              const seg = (
                <circle
                  key={c.channel}
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  strokeWidth={hover === c.channel ? 18 : 14}
                  className={`${channelOf(c.channel).stroke} cursor-default transition-[stroke-width]`}
                  strokeDasharray={`${Math.max(len - gap, 0.1)} ${circumference}`}
                  strokeDashoffset={-offset}
                  onMouseEnter={() => setHover(c.channel)}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>
                    {channelOf(c.channel).label}: {c.count} ({Math.round((c.count / total) * 100)}%)
                  </title>
                </circle>
              );
              offset += len;
              return seg;
            })}
            <text
              x="80"
              y="72"
              textAnchor="middle"
              className="rotate-90 fill-gray-500 dark:fill-gray-400 text-[11px]"
              style={{ transformOrigin: '80px 80px' }}
            >
              {hover ? channelOf(hover).label : 'Tickets'}
            </text>
            <text
              x="80"
              y="96"
              textAnchor="middle"
              className="rotate-90 fill-gray-900 dark:fill-white text-[24px] font-semibold"
              style={{ transformOrigin: '80px 80px' }}
            >
              {hover ? channels.find((c) => c.channel === hover)?.count : total}
            </text>
          </svg>
          <ul className="space-y-2 text-sm">
            {channels.map((c) => (
              <li
                key={c.channel}
                onMouseEnter={() => setHover(c.channel)}
                onMouseLeave={() => setHover(null)}
                className="flex items-center gap-2 text-gray-700 dark:text-gray-300"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${channelOf(c.channel).dot}`} />
                {c.count} {channelOf(c.channel).label} ({Math.round((c.count / total) * 100)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/** Average first response, response and resolution times, as bars against the longest. */
const HandlingTimes: React.FC<{ handling: Overview['handling'] }> = ({ handling }) => {
  const rows: Array<[string, number | null]> = [
    ['First response time', handling.firstResponseMinutes],
    ['Response time', handling.responseMinutes],
    ['Resolution time', handling.resolutionMinutes],
  ];
  const max = Math.max(1, ...rows.map(([, v]) => v || 0));
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">Average handling time</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Last {handling.months} months
        </span>
      </div>
      <div className="mt-5 space-y-6">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">{label}</span>
              <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                {duration(value)}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                style={{ width: value ? `${Math.max(2, (value / max) * 100)}%` : 0 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ACTIONS: Record<string, string> = {
  created: 'opened the ticket',
  note_added: 'replied',
  assigned: 'assigned it',
  unassigned: 'unassigned it',
  status_changed: 'changed the status',
  priority_changed: 'changed the priority',
  reopened: 'reopened it',
  closed: 'closed it',
  resolved: 'resolved it',
  file_uploaded: 'attached a file',
};

const HistoryList: React.FC<{ module: Module; id: string }> = ({ module, id }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    apiService
      .getRecordPart(module, id, 'history')
      .then((d) => setRows(d.history))
      .catch(() => setRows([]));
  }, [module, id]);
  if (!rows) return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  if (!rows.length)
    return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Nothing yet.</p>;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {rows.map((h) => (
        <li key={h.id} className="flex gap-3 px-4 py-3 text-sm">
          <Avatar name={h.by || 'System'} />
          <div className="min-w-0">
            <p className="text-gray-900 dark:text-white">
              <strong>{h.by || 'System'}</strong> {ACTIONS[h.action] || h.action.replace(/_/g, ' ')}
              {h.from || h.to ? (
                <span className="text-gray-600 dark:text-gray-400">
                  {' '}
                  {h.from ? `from ${h.from} ` : ''}
                  {h.to ? `to ${h.to}` : ''}
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              <Link to={`/agent/tickets/${h.ticket.id}`} className="hover:underline">
                {h.ticket.number ? `#${h.ticket.number} ` : ''}
                {h.ticket.title}
              </Link>{' '}
              · {dateTime(h.at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

const AttachmentList: React.FC<{ module: Module; id: string }> = ({ module, id }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    apiService
      .getRecordPart(module, id, 'attachments')
      .then((d) => setRows(d.attachments))
      .catch(() => setRows([]));
  }, [module, id]);
  if (!rows) return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  if (!rows.length)
    return (
      <p className="p-6 text-sm text-gray-500 dark:text-gray-400">No files on their tickets.</p>
    );
  const size = (b: number) =>
    b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {rows.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <PaperClipIcon className="h-5 w-5 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => openAttachment(f.id, f.name, f.type || '')}
              className="block truncate font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              {f.name}
            </button>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {size(f.size)} · {f.ticket.number ? `#${f.ticket.number} ` : ''}
              {f.ticket.title}
              {f.by ? ` · ${f.by}` : ''} · {shortDate(f.at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

/** An account's contacts, or a contact's accounts. */
const PeopleList: React.FC<{ module: Module; id: string }> = ({ module, id }) => {
  const [data, setData] = useState<any | null>(null);
  useEffect(() => {
    apiService
      .getRecordPart(module, id, 'people')
      .then(setData)
      .catch(() => setData({ contacts: [], accounts: [] }));
  }, [module, id]);
  if (!data) return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  if (module === 'accounts') {
    const rows = data.contacts || [];
    if (!rows.length)
      return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">No contacts yet.</p>;
    return (
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((c: any) => (
          <li key={c.id}>
            <Link
              to={`/agent/customers/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <Avatar name={c.name} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-gray-900 dark:text-white">
                  {c.name}
                  {!c.active && <span className="ml-2 text-xs text-gray-500">(inactive)</span>}
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ''}
                </span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {c.tickets} {c.tickets === 1 ? 'ticket' : 'tickets'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  const rows = data.accounts || [];
  if (!rows.length)
    return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">No account.</p>;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {rows.map((a: any) => (
        <li key={a.id}>
          <Link
            to={`/agent/accounts/${a.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <Avatar name={a.name} />
            <span className="font-medium text-gray-900 dark:text-white">{a.name}</span>
            {a.domain && <span className="text-xs text-gray-500">{a.domain}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
};

const CustomerRecordView: React.FC<{
  module: Module;
  id: string;
  name: string;
  /** Under the name: a contact's account, badges */
  subtitle?: React.ReactNode;
  backTo: string;
  backLabel: string;
  addTicketHref: string;
  /** More cards under the properties (a contact's portal access) */
  sidebarExtra?: React.ReactNode;
  /** After the properties are saved */
  onSaved?: () => void;
}> = ({ module, id, name, subtitle, backTo, backLabel, addTicketHref, sidebarExtra, onSaved }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);

  const loadOverview = useCallback(() => {
    apiService
      .getRecordPart(module, id, 'overview')
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [module, id]);
  useEffect(loadOverview, [loadOverview]);

  const tabs = useMemo<Array<[Tab, string]>>(
    () => [
      ['overview', 'Overview'],
      ['tickets', 'Tickets'],
      ['people', module === 'accounts' ? 'Contacts' : 'Accounts'],
      ['history', 'History'],
      ['attachments', 'Attachments'],
    ],
    [module]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col lg:flex-row">
        {/* Properties */}
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:shrink-0 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <button
              type="button"
              onClick={() => navigate(backTo)}
              title={backLabel}
              aria-label={backLabel}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h2 className="font-medium text-gray-900 dark:text-white">
              {module === 'accounts' ? 'Account properties' : 'Contact properties'}
            </h2>
          </div>
          <div className="space-y-4 p-4">
            <RecordFields
              module={module}
              recordId={id}
              onSaved={() => {
                onSaved?.();
                loadOverview();
              }}
            />
            {sidebarExtra}
          </div>
        </aside>

        {/* Header, tabs and the tab */}
        <main className="min-w-0 flex-1">
          <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 sm:px-6 pt-5">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar name={name} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-semibold text-gray-900 dark:text-white">
                  {name}
                </h1>
                {subtitle && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {subtitle}
                  </div>
                )}
              </div>
              <Link
                to={addTicketHref}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4" />
                Add ticket
              </Link>
            </div>
            <nav className="mt-4 flex gap-6 overflow-x-auto text-xs font-medium uppercase tracking-wide">
              {tabs.map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`whitespace-nowrap border-b-2 pb-3 ${
                    tab === t
                      ? 'border-blue-600 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                  <StatCard label="All tickets">{overview?.counts.all ?? '–'}</StatCard>
                  <StatCard label="Open tickets">{overview?.counts.open ?? '–'}</StatCard>
                  <StatCard label="On hold">
                    <span
                      className={
                        overview?.counts.onHold ? 'text-amber-600 dark:text-amber-400' : ''
                      }
                    >
                      {overview?.counts.onHold ?? '–'}
                    </span>
                  </StatCard>
                  <StatCard label="Happiness rating">
                    {overview?.happiness ? (
                      <span>
                        {overview.happiness.percent}
                        <span className="text-base font-normal text-gray-500">%</span>
                      </span>
                    ) : (
                      <span className="text-base font-normal text-gray-500 dark:text-gray-400">
                        No ratings yet
                      </span>
                    )}
                  </StatCard>
                </div>
                <TicketList module={module} id={id} counts={overview?.counts} compact />
                {overview && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <TrafficAnalysis channels={overview.channels} />
                    <HandlingTimes handling={overview.handling} />
                  </div>
                )}
                {/* Records elsewhere that point at this one (hidden when none) */}
                <RelatedLists module={module} recordId={id} />
              </>
            )}
            {tab === 'tickets' && <TicketList module={module} id={id} counts={overview?.counts} />}
            {tab === 'people' && (
              <div className={card}>
                <PeopleList module={module} id={id} />
              </div>
            )}
            {tab === 'history' && (
              <div className={card}>
                <HistoryList module={module} id={id} />
              </div>
            )}
            {tab === 'attachments' && (
              <div className={card}>
                <AttachmentList module={module} id={id} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CustomerRecordView;
