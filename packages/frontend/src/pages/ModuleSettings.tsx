import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { Drawer, errorText, fieldClass } from '../components/ui';

/**
 * Settings > Modules: your own record types, like Assets, Contracts or
 * Locations. Each gets a list of records, a page per record, and a layout;
 * lookup fields link them to accounts, contacts and each other.
 */

interface Module {
  key: string;
  name: string;
  singular: string;
}

const ModuleSettings: React.FC = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Module & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setModules(await apiService.getModules());
    } catch (error) {
      alert(`Couldn't load modules: ${errorText(error)}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    const body = {
      name: editing.name.trim(),
      singular: editing.singular.trim() || editing.name.trim(),
    };
    if (!body.name) return alert('Give the module a name.');
    try {
      setSaving(true);
      if (editing.isNew) {
        const created = await apiService.createModule(body);
        setEditing(null);
        // Straight on to its fields
        navigate(`/admin/layouts/${created.key}`);
        return;
      }
      await apiService.updateModule(editing.key, body);
      setEditing(null);
      load();
    } catch (error) {
      alert(`Couldn't save the module: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Module) => {
    if (
      !confirm(
        `Delete "${m.name}"? All its records, its fields, and lookup fields elsewhere that link to it are deleted. This can't be undone.`
      )
    )
      return;
    try {
      await apiService.deleteModule(m.key);
      load();
    } catch (error) {
      alert(`Couldn't delete the module: ${errorText(error)}`);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading modules…</div>;
  const iconButton =
    'p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/admin/settings')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-3"
      >
        ← Settings
      </button>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Modules</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your own record types, like Assets or Contracts. Link them to accounts, contacts and
            each other with lookup fields.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ key: '', name: '', singular: '', isNew: true })}
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3.5 py-2 rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          New module
        </button>
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-16 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
          <h2 className="font-medium text-gray-900 dark:text-white">No modules yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            For example "Assets", to track each customer's equipment and link tickets to it.
          </p>
        </div>
      ) : (
        <ul className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {modules.map((m) => (
            <li key={m.key} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{m.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  One record is a “{m.singular}”
                </div>
              </div>
              <Link
                to={`/agent/modules/${m.key}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Records
              </Link>
              <Link
                to={`/admin/layouts/${m.key}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Fields
              </Link>
              <button
                type="button"
                onClick={() => setEditing(m)}
                className={iconButton}
                aria-label={`Rename ${m.name}`}
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
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Drawer
          title={editing.isNew ? 'New module' : `Rename ${editing.name}`}
          onClose={() => setEditing(null)}
          width="max-w-md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditing(null)}
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
                {saving ? 'Saving…' : editing.isNew ? 'Create and add fields' : 'Save'}
              </button>
            </>
          }
        >
          <div>
            <label
              htmlFor="module-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name
            </label>
            <input
              id="module-name"
              autoFocus
              maxLength={80}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Assets"
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="module-singular"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              One record is called
            </label>
            <input
              id="module-singular"
              maxLength={80}
              value={editing.singular}
              onChange={(e) => setEditing({ ...editing, singular: e.target.value })}
              placeholder="e.g. Asset"
              className={fieldClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used in “New Asset”, “Asset name” and so on.
            </p>
          </div>
        </Drawer>
      )}
    </div>
  );
};

export default ModuleSettings;
