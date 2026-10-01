import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { displayValue, type ModuleLayout } from '../utils/fields';
import { errorText } from '../components/ui';

/** A custom module's records (/agent/modules/:key): searchable, newest first. */
const ModuleRecords: React.FC = () => {
  const { moduleKey = '' } = useParams();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<ModuleLayout | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiService
      .getFields(moduleKey)
      .then(setLayout)
      .catch((e) => setError(errorText(e)));
  }, [moduleKey]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      apiService
        .listRecords(moduleKey, q)
        .then((r) => {
          setRecords(r.records);
          setTotal(r.total);
        })
        .catch((e) => setError(errorText(e)));
    }, 200);
    return () => window.clearTimeout(t);
  }, [moduleKey, q]);

  const create = async () => {
    const name = prompt(`Name of the new ${layout?.module?.singular || 'record'}`);
    if (!name?.trim()) return;
    try {
      const record = await apiService.createRecord(moduleKey, { values: { name: name.trim() } });
      navigate(`/agent/modules/${moduleKey}/${record.id}`);
    } catch (e) {
      alert(`Couldn't add it: ${errorText(e)}`);
    }
  };

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!layout) return <div className="p-8 text-gray-500">Loading…</div>;

  // Up to four non-lookup custom fields as columns
  const columns = layout.customFields
    .filter((f) => f.type !== 'lookup' && f.type !== 'textarea')
    .slice(0, 4);
  const mod = layout.module!;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/agent')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-3"
      >
        ← Tickets
      </button>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{mod.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search {mod.name}</span>
            <MagnifyingGlassIcon
              className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${mod.name.toLowerCase()}`}
              className="pl-8 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={create}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3.5 py-2 rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            New {mod.singular}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">
                {layout.systemFields[0]?.label || 'Name'}
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                >
                  {q ? 'Nothing matches.' : `No ${mod.name.toLowerCase()} yet.`}
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-2">
                    <Link
                      to={`/agent/modules/${moduleKey}/${r.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {displayValue(c, r.customFieldValues?.[c.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModuleRecords;
