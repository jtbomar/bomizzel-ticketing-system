import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { CustomProperty, Row } from './PropertyList';
import type { CustomFieldDef, FieldType, ModuleLayout } from '../utils/fields';

/**
 * An account's or contact's fields, in the sections of its layout
 * (Settings > Layouts), edited in place: standard fields and custom fields
 * alike save as they're changed. Used on the account and contact pages.
 */

interface RecordData {
  id: string;
  values: Record<string, unknown>;
  customFieldValues: Record<string, unknown>;
  account?: { id: string; name: string } | null;
}

const errorText = (error: any): string =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message;

const RecordFields: React.FC<{
  module: string; // accounts, contacts or a custom module (cm_...)
  recordId: string;
  /** After a save, with the record as stored (e.g. to refresh a page title). */
  onSaved?: (record: RecordData) => void;
}> = ({ module, recordId, onSaved }) => {
  const [layout, setLayout] = useState<ModuleLayout | null>(null);
  const [record, setRecord] = useState<RecordData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiService.getFields(module), apiService.getRecord(module, recordId)])
      .then(([l, r]) => {
        if (cancelled) return;
        setLayout(l);
        setRecord(r);
      })
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [module, recordId]);

  // Standard fields drawn with the same inputs as custom ones
  const fields = useMemo(() => {
    const map = new Map<string, CustomFieldDef & { standard: boolean; editable: boolean }>();
    layout?.systemFields.forEach((f: any) =>
      map.set(f.key, {
        id: f.key,
        key: f.key,
        label: f.label,
        type: (f.type === 'lookup' ? 'text' : f.type) as FieldType,
        options: [],
        isRequired: f.isRequired,
        helpText: null,
        system: false,
        standard: true,
        editable: f.type !== 'lookup',
      })
    );
    layout?.customFields.forEach((f) => map.set(f.key, { ...f, standard: false, editable: true }));
    return map;
  }, [layout]);

  const save = async (
    changes: { values?: Record<string, unknown>; customFieldValues?: Record<string, unknown> },
    local: Partial<RecordData>
  ) => {
    if (!record) return;
    const before = record;
    setRecord({ ...record, ...local });
    try {
      const saved = await apiService.updateRecord(module, recordId, changes);
      setRecord(saved);
      onSaved?.(saved);
    } catch (e: any) {
      setRecord(before);
      alert(`Couldn't save: ${errorText(e)}`);
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!layout || !record) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      {layout.sections.map((section) => (
        <section
          key={section.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <h2 className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {section.title}
          </h2>
          <div className="px-4 pb-3 divide-y divide-gray-100 dark:divide-gray-700/60 [&>*]:py-1">
            {section.fields.map((key) => {
              const field = fields.get(key);
              if (!field) return null;
              if (!field.editable) {
                // A contact's account: a link to it
                return (
                  <Row key={key} label={field.label}>
                    {record.account ? (
                      <Link
                        to={`/agent/accounts/${record.account.id}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                      >
                        {record.account.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </Row>
                );
              }
              return field.standard ? (
                <CustomProperty
                  key={key}
                  field={field}
                  saved={record.values[key] ?? ''}
                  onSave={(v) =>
                    save({ values: { [key]: v } }, { values: { ...record.values, [key]: v } })
                  }
                />
              ) : (
                <CustomProperty
                  key={key}
                  field={field}
                  saved={record.customFieldValues[key]}
                  onSave={(v) =>
                    save(
                      { customFieldValues: { [key]: v } },
                      { customFieldValues: { ...record.customFieldValues, [key]: v } }
                    )
                  }
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default RecordFields;
