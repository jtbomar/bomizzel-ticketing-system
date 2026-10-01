import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { recordPath } from '../utils/fields';

/**
 * What links to a record: one list per lookup field elsewhere that points at
 * it ("Assets - Owner account"). Shows nothing when nothing links here.
 */
interface Group {
  module: string;
  moduleName: string;
  field: string;
  records: { id: string; name: string }[];
}

const RelatedLists: React.FC<{ module: string; recordId: string }> = ({ module, recordId }) => {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getRelated(module, recordId)
      .then((g) => !cancelled && setGroups(g))
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, [module, recordId]);

  if (groups.length === 0) return null;
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section
          key={`${g.module}-${g.field}`}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <header className="flex items-baseline justify-between px-4 pt-3 pb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {g.moduleName}
              <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">
                · {g.field}
              </span>
            </h2>
            <span className="text-xs text-gray-500">{g.records.length}</span>
          </header>
          {g.records.length === 0 ? (
            <p className="px-4 pb-3 text-sm text-gray-500 dark:text-gray-400">None yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/60 pb-1">
              {g.records.map((r) => (
                <li key={r.id}>
                  <Link
                    to={recordPath(g.module, r.id)}
                    className="block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 truncate"
                  >
                    {r.name || 'Untitled'}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};

export default RelatedLists;
