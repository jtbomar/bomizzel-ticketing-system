import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import {
  FIELD_TYPE_LABELS,
  type CustomFieldDef,
  type FieldType,
  type LayoutSection,
  type ModuleLayout,
} from '../utils/fields';

/**
 * Settings > Ticket Layout: the ticket's fields, in sections.
 *
 * Standard fields (contact, account, product, phone, subject, ...) can be
 * moved but not removed. Custom fields can be added, edited and deleted.
 * Every change is saved straight away.
 */

const MODULE = 'tickets';

interface FieldDraft {
  id?: string;
  label: string;
  type: FieldType;
  options: string;
  isRequired: boolean;
  helpText: string;
}

const emptyField = (): FieldDraft => ({
  label: '',
  type: 'text',
  options: '',
  isRequired: false,
  helpText: '',
});

const hasChoices = (type: FieldType) => type === 'picklist' || type === 'multiselect';

const errorText = (error: any): string =>
  error.response?.data?.error?.message ||
  error.response?.data?.error ||
  error.response?.data?.message ||
  error.message;

const newSectionId = () => `section-${Date.now().toString(36)}`;

const FieldLayout: React.FC = () => {
  const navigate = useNavigate();
  const [layout, setLayout] = useState<ModuleLayout | null>(null);
  const [draft, setDraft] = useState<FieldDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      setLayout(await apiService.getFields(MODULE));
    } catch (error: any) {
      alert(`Couldn't load the layout: ${errorText(error)}`);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fieldsByKey = useMemo(() => {
    const map = new Map<
      string,
      { label: string; type: string; system: boolean; field?: CustomFieldDef }
    >();
    layout?.systemFields.forEach((f) =>
      map.set(f.key, { label: f.label, type: 'Standard', system: true })
    );
    layout?.customFields.forEach((f) =>
      map.set(f.key, { label: f.label, type: FIELD_TYPE_LABELS[f.type], system: false, field: f })
    );
    return map;
  }, [layout]);

  /** Show the change at once, save it, and keep what the server returns. */
  const saveSections = async (sections: LayoutSection[]) => {
    if (!layout) return;
    setLayout({ ...layout, sections });
    try {
      setLayout(await apiService.saveFieldLayout(MODULE, sections));
      setStatus('Saved');
      window.setTimeout(() => setStatus(''), 1500);
    } catch (error: any) {
      alert(`Couldn't save the layout: ${errorText(error)}`);
      load();
    }
  };

  const copy = () => layout!.sections.map((s) => ({ ...s, fields: [...s.fields] }));

  const moveField = (sectionIndex: number, fieldIndex: number, by: -1 | 1) => {
    const sections = copy();
    const list = sections[sectionIndex]!.fields;
    const [key] = list.splice(fieldIndex, 1);
    list.splice(fieldIndex + by, 0, key!);
    saveSections(sections);
  };

  const moveFieldToSection = (sectionIndex: number, fieldIndex: number, target: number) => {
    const sections = copy();
    const [key] = sections[sectionIndex]!.fields.splice(fieldIndex, 1);
    sections[target]!.fields.push(key!);
    saveSections(sections);
  };

  const moveSection = (index: number, by: -1 | 1) => {
    const sections = copy();
    const [section] = sections.splice(index, 1);
    sections.splice(index + by, 0, section!);
    saveSections(sections);
  };

  const renameSection = (index: number, title: string) => {
    const sections = copy();
    if (!title.trim() || sections[index]!.title === title.trim()) return;
    sections[index]!.title = title.trim();
    saveSections(sections);
  };

  const addSection = () => {
    const title = prompt('Name the new section', 'More details');
    if (!title?.trim()) return;
    saveSections([...copy(), { id: newSectionId(), title: title.trim(), fields: [] }]);
  };

  const removeSection = (index: number) => {
    const sections = copy();
    if (sections[index]!.fields.length > 0) {
      alert('Move its fields to another section first.');
      return;
    }
    if (sections.length === 1) return;
    sections.splice(index, 1);
    saveSections(sections);
  };

  const saveField = async () => {
    if (!draft) return;
    if (!draft.label.trim()) return alert('Give the field a name.');
    const options = draft.options
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
    if (hasChoices(draft.type) && options.length === 0) {
      return alert('Add at least one choice, one per line.');
    }
    const body = {
      label: draft.label.trim(),
      type: draft.type,
      options,
      isRequired: draft.isRequired,
      helpText: draft.helpText.trim() || null,
    };
    try {
      setSaving(true);
      if (draft.id) await apiService.updateField(MODULE, draft.id, body);
      else await apiService.createField(MODULE, body);
      setDraft(null);
      await load();
    } catch (error: any) {
      alert(`Couldn't save the field: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (field: CustomFieldDef) => {
    if (
      !confirm(
        `Delete the field "${field.label}"? It comes off the layout. Values already saved on tickets are kept but no longer shown.`
      )
    )
      return;
    try {
      await apiService.deleteField(MODULE, field.id);
      await load();
    } catch (error: any) {
      alert(`Couldn't delete the field: ${errorText(error)}`);
    }
  };

  if (!layout) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading the layout...</div>
      </div>
    );
  }

  const input =
    'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  const iconButton = 'px-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => navigate('/admin/settings')}
            className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
          >
            ← Back to Settings
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ticket Layout</h2>
              <p className="text-sm text-gray-600 mt-1">
                The fields on a ticket, in the order agents see them. Standard fields (🔒) can be
                moved but not removed. Changes are saved as you make them.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span role="status" className="text-sm text-green-700">
                {status}
              </span>
              <button
                onClick={() => setDraft(emptyField())}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {draft && (
            <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-5 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {draft.id ? 'Edit field' : 'New field'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="field-label"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="field-label"
                    type="text"
                    maxLength={120}
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="e.g. Product Type"
                    className={input}
                  />
                </div>
                <div>
                  <label
                    htmlFor="field-type"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Type
                  </label>
                  <select
                    id="field-type"
                    value={draft.type}
                    disabled={!!draft.id}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value as FieldType })}
                    className={input}
                  >
                    {Object.entries(FIELD_TYPE_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                  {draft.id && (
                    <p className="text-xs text-gray-500 mt-1">
                      The type can't change once there may be values saved.
                    </p>
                  )}
                </div>
              </div>
              {hasChoices(draft.type) && (
                <div>
                  <label
                    htmlFor="field-options"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Choices, one per line
                  </label>
                  <textarea
                    id="field-options"
                    rows={5}
                    value={draft.options}
                    onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                    placeholder={'Hardware\nSoftware\nService'}
                    className={input}
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="field-help"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Help text <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input
                  id="field-help"
                  type="text"
                  maxLength={255}
                  value={draft.helpText}
                  onChange={(e) => setDraft({ ...draft, helpText: e.target.value })}
                  placeholder="Shown under the field"
                  className={input}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  checked={draft.isRequired}
                  onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })}
                />
                Required when an agent creates a ticket
              </label>
              <div className="flex gap-2">
                <button
                  onClick={saveField}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save field'}
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

          {layout.sections.map((section, si) => (
            <section key={section.id} className="border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <input
                  type="text"
                  defaultValue={section.title}
                  key={`${section.id}-${section.title}`}
                  aria-label="Section name"
                  maxLength={80}
                  onBlur={(e) => renameSection(si, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="flex-1 bg-transparent font-semibold text-gray-900 px-1 py-0.5 rounded focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  className={iconButton}
                  disabled={si === 0}
                  onClick={() => moveSection(si, -1)}
                  aria-label={`Move section ${section.title} up`}
                >
                  ▲
                </button>
                <button
                  className={iconButton}
                  disabled={si === layout.sections.length - 1}
                  onClick={() => moveSection(si, 1)}
                  aria-label={`Move section ${section.title} down`}
                >
                  ▼
                </button>
                {layout.sections.length > 1 && (
                  <button
                    onClick={() => removeSection(si)}
                    className="text-sm text-red-600 hover:text-red-800 ml-2"
                    title={section.fields.length ? 'Move its fields out first' : 'Remove section'}
                  >
                    Remove
                  </button>
                )}
              </div>
              <ul className="divide-y divide-gray-100">
                {section.fields.length === 0 && (
                  <li className="px-4 py-3 text-sm text-gray-500">
                    Empty. Move fields here with the "Section" menu.
                  </li>
                )}
                {section.fields.map((key, fi) => {
                  const f = fieldsByKey.get(key);
                  if (!f) return null;
                  return (
                    <li key={key} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex flex-col">
                        <button
                          className={iconButton}
                          disabled={fi === 0}
                          onClick={() => moveField(si, fi, -1)}
                          aria-label={`Move ${f.label} up`}
                        >
                          ▲
                        </button>
                        <button
                          className={iconButton}
                          disabled={fi === section.fields.length - 1}
                          onClick={() => moveField(si, fi, 1)}
                          aria-label={`Move ${f.label} down`}
                        >
                          ▼
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {f.system && (
                            <span
                              aria-label="Standard field"
                              title="Standard field - can't be removed"
                            >
                              🔒
                            </span>
                          )}
                          <span className="font-medium text-gray-900">{f.label}</span>
                          {f.field?.isRequired && (
                            <span className="text-xs text-red-600">Required</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {f.type}
                          {f.field && hasChoices(f.field.type) && `: ${f.field.options.join(', ')}`}
                        </div>
                      </div>
                      {layout.sections.length > 1 && (
                        <select
                          value={si}
                          onChange={(e) => moveFieldToSection(si, fi, Number(e.target.value))}
                          aria-label={`Section for ${f.label}`}
                          className="text-sm border border-gray-200 rounded-md px-2 py-1"
                        >
                          {layout.sections.map((s, i) => (
                            <option key={s.id} value={i}>
                              {i === si ? 'Section…' : `→ ${s.title}`}
                            </option>
                          ))}
                        </select>
                      )}
                      {f.field && (
                        <>
                          <button
                            onClick={() =>
                              setDraft({
                                id: f.field!.id,
                                label: f.field!.label,
                                type: f.field!.type,
                                options: f.field!.options.join('\n'),
                                isRequired: f.field!.isRequired,
                                helpText: f.field!.helpText || '',
                              })
                            }
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteField(f.field!)}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <button
            onClick={addSection}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800"
          >
            + Add section
          </button>
        </div>
      </div>
    </div>
  );
};

export default FieldLayout;
