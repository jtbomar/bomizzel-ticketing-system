import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Bars3BottomLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EnvelopeIcon,
  HashtagIcon,
  LinkIcon,
  ListBulletIcon,
  ArrowsRightLeftIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PhoneIcon,
  PlusIcon,
  QueueListIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import {
  FIELD_TYPE_LABELS,
  type CustomFieldDef,
  type FieldType,
  type LayoutSection,
  type ModuleLayout,
} from '../utils/fields';

/**
 * Settings > Layouts (tickets, accounts, contacts). Field types on the left (click one to add a
 * field); the ticket's sections on the right, two columns like the form.
 * Drag a field to reorder it or move it to another section. Standard fields
 * (locked) can be moved but not removed. Every change is saved as it's made.
 */

const BUILT_IN_MODULES = [
  { key: 'tickets', label: 'Tickets', path: '/admin/layouts', what: 'the ticket form' },
  { key: 'accounts', label: 'Accounts', path: '/admin/layouts/accounts', what: 'an account' },
  { key: 'contacts', label: 'Contacts', path: '/admin/layouts/contacts', what: 'a contact' },
];

const TYPE_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Bars3BottomLeftIcon,
  textarea: QueueListIcon,
  number: HashtagIcon,
  decimal: HashtagIcon,
  date: CalendarDaysIcon,
  checkbox: CheckCircleIcon,
  email: EnvelopeIcon,
  phone: PhoneIcon,
  url: LinkIcon,
  picklist: ListBulletIcon,
  multiselect: Squares2X2Icon,
  lookup: ArrowsRightLeftIcon,
};

interface FieldDraft {
  id?: string;
  label: string;
  type: FieldType;
  options: string;
  isRequired: boolean;
  helpText: string;
  sectionId: string;
  lookupModule: string;
}

interface FieldInfo {
  key: string;
  label: string;
  caption: string;
  system: boolean;
  field?: CustomFieldDef;
}

const hasChoices = (type: FieldType) => type === 'picklist' || type === 'multiselect';
const errorText = (error: any): string =>
  error.response?.data?.error?.message ||
  error.response?.data?.error ||
  error.response?.data?.message ||
  error.message;
const SECTION = 'section:';
const newSectionId = () => `section-${Date.now().toString(36)}`;

const FieldCard: React.FC<{
  info: FieldInfo;
  onEdit?: () => void;
  onDelete?: () => void;
  overlay?: boolean;
}> = ({ info, onEdit, onDelete, overlay }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: info.key,
    disabled: overlay,
  });
  const Icon = info.field ? TYPE_ICONS[info.field.type] : LockClosedIcon;
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : { transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-2 rounded-md border bg-white dark:bg-gray-800 px-3 py-2 ${
        overlay
          ? 'shadow-lg border-blue-400 ring-2 ring-blue-200'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      } ${isDragging && !overlay ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${info.label}`}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 touch-none"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="7" cy="5" r="1.5" />
          <circle cx="13" cy="5" r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="15" r="1.5" />
          <circle cx="13" cy="15" r="1.5" />
        </svg>
      </button>
      <Icon
        className={`h-4 w-4 shrink-0 ${info.system ? 'text-gray-400' : 'text-blue-500'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 dark:text-white truncate">
          {info.label}
          {info.field?.isRequired && <span className="text-red-500 ml-0.5">*</span>}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{info.caption}</div>
      </div>
      {info.system ? (
        <span className="sr-only">Standard field, can't be removed</span>
      ) : (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${info.label}`}
            className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${info.label}`}
            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

/** A section's field grid; also a drop target, so empty sections can take fields. */
const SectionGrid: React.FC<{ id: string; empty: boolean; children: React.ReactNode }> = ({
  id,
  empty,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: SECTION + id });
  return (
    <div
      ref={setNodeRef}
      className={`grid grid-cols-1 md:grid-cols-2 gap-2 p-3 min-h-[4rem] rounded-b-lg ${
        isOver ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
      }`}
    >
      {children}
      {empty && (
        <div className="md:col-span-2 flex items-center justify-center rounded-md border-2 border-dashed border-gray-200 dark:border-gray-700 py-4 text-sm text-gray-400">
          Drag fields here
        </div>
      )}
    </div>
  );
};

const FieldLayout: React.FC = () => {
  const navigate = useNavigate();
  const { module: moduleParam } = useParams();
  // Custom modules (Settings > Modules) get a tab each too
  const [customModules, setCustomModules] = useState<
    { key: string; name: string; singular: string }[]
  >([]);
  useEffect(() => {
    apiService
      .getModules()
      .then(setCustomModules)
      .catch(() => setCustomModules([]));
  }, []);
  const MODULES = [
    ...BUILT_IN_MODULES,
    ...customModules.map((m) => ({
      key: m.key,
      label: m.name,
      path: `/admin/layouts/${m.key}`,
      what: `a record of ${m.name}`,
    })),
  ];
  const current =
    MODULES.find((m) => m.key === moduleParam) ||
    (moduleParam?.startsWith('cm_')
      ? {
          key: moduleParam,
          label: moduleParam,
          path: `/admin/layouts/${moduleParam}`,
          what: 'a record',
        }
      : BUILT_IN_MODULES[0]!);
  const MODULE = current.key;
  // What a lookup can link to
  const lookupTargets = [
    { key: 'accounts', label: 'Accounts' },
    { key: 'contacts', label: 'Contacts' },
    ...customModules.map((m) => ({ key: m.key, label: m.name })),
  ];
  const [layout, setLayout] = useState<ModuleLayout | null>(null);
  // The sections while dragging (fields move between them live)
  const [dragSections, setDragSections] = useState<LayoutSection[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<FieldDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    try {
      const next: ModuleLayout = await apiService.getFields(MODULE);
      setLayout(next);
      return next;
    } catch (error: any) {
      alert(`Couldn't load the layout: ${errorText(error)}`);
      return null;
    }
  };

  useEffect(() => {
    setLayout(null);
    setDraft(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [MODULE]);

  const lookupName = (key?: string | null) =>
    lookupTargets.find((t) => t.key === key)?.label || 'a deleted module';
  const infoByKey = useMemo(() => {
    const map = new Map<string, FieldInfo>();
    layout?.systemFields.forEach((f) =>
      map.set(f.key, { key: f.key, label: f.label, caption: 'Standard', system: true })
    );
    layout?.customFields.forEach((f) =>
      map.set(f.key, {
        key: f.key,
        label: f.label,
        caption: hasChoices(f.type)
          ? `${FIELD_TYPE_LABELS[f.type]} · ${f.options.length} choices`
          : f.type === 'lookup'
            ? `Links to ${lookupName(f.lookupModule)}`
            : FIELD_TYPE_LABELS[f.type],
        system: false,
        field: f,
      })
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, customModules]);

  const flash = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus(''), 1500);
  };

  const saveSections = async (sections: LayoutSection[]) => {
    if (!layout) return;
    setLayout({ ...layout, sections });
    try {
      setLayout(await apiService.saveFieldLayout(MODULE, sections));
      flash('Saved');
    } catch (error: any) {
      alert(`Couldn't save the layout: ${errorText(error)}`);
      load();
    }
  };

  const sections = dragSections || layout?.sections || [];
  const copy = (list = sections) => list.map((s) => ({ ...s, fields: [...s.fields] }));
  const sectionOf = (id: string, list = sections) =>
    id.startsWith(SECTION)
      ? list.findIndex((s) => SECTION + s.id === id)
      : list.findIndex((s) => s.fields.includes(id));

  const onDragStart = (e: DragStartEvent) => {
    setActiveKey(String(e.active.id));
    setDragSections(copy(layout?.sections || []));
  };

  // Moving into another section happens as you drag over it
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || !dragSections) return;
    const from = sectionOf(String(active.id), dragSections);
    const to = sectionOf(String(over.id), dragSections);
    if (from < 0 || to < 0 || from === to) return;
    const next = copy(dragSections);
    next[from]!.fields = next[from]!.fields.filter((k) => k !== active.id);
    const overIndex = next[to]!.fields.indexOf(String(over.id));
    next[to]!.fields.splice(
      overIndex < 0 ? next[to]!.fields.length : overIndex,
      0,
      String(active.id)
    );
    setDragSections(next);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    const working = dragSections;
    setActiveKey(null);
    setDragSections(null);
    if (!working || !layout) return;
    let next = working;
    if (over) {
      const s = sectionOf(String(over.id), working);
      const list = working[s]?.fields || [];
      const from = list.indexOf(String(active.id));
      const to = list.indexOf(String(over.id));
      if (from >= 0 && to >= 0 && from !== to) {
        next = copy(working);
        next[s]!.fields = arrayMove(list, from, to);
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(layout.sections)) saveSections(next);
  };

  const moveSection = (index: number, by: -1 | 1) => {
    const next = copy();
    const [section] = next.splice(index, 1);
    next.splice(index + by, 0, section!);
    saveSections(next);
  };

  const renameSection = (index: number, title: string) => {
    const next = copy();
    if (!title.trim() || next[index]!.title === title.trim()) return;
    next[index]!.title = title.trim();
    saveSections(next);
  };

  const addSection = () => {
    const title = prompt('Name the new section', 'More details');
    if (title?.trim())
      saveSections([...copy(), { id: newSectionId(), title: title.trim(), fields: [] }]);
  };

  const removeSection = (index: number) => {
    const next = copy();
    if (next[index]!.fields.length > 0) return alert('Move its fields to another section first.');
    next.splice(index, 1);
    saveSections(next);
  };

  const startNewField = (type: FieldType) =>
    setDraft({
      label: '',
      type,
      options: '',
      isRequired: false,
      helpText: '',
      sectionId: sections[sections.length - 1]?.id || '',
      lookupModule: type === 'lookup' ? 'accounts' : '',
    });

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
      ...(draft.type === 'lookup' ? { lookupModule: draft.lookupModule } : {}),
    };
    try {
      setSaving(true);
      if (draft.id) {
        await apiService.updateField(MODULE, draft.id, body);
        await load();
      } else {
        const { field } = await apiService.createField(MODULE, body);
        // New fields land at the end of the last section; put it where asked
        const fresh = await load();
        if (fresh && field) {
          const target = fresh.sections.findIndex((s) => s.id === draft.sectionId);
          const current = fresh.sections.findIndex((s) => s.fields.includes(field.key));
          if (target >= 0 && current >= 0 && target !== current) {
            const next = fresh.sections.map((s) => ({
              ...s,
              fields: s.fields.filter((k) => k !== field.key),
            }));
            next[target]!.fields.push(field.key);
            await saveSections(next);
          }
        }
      }
      setDraft(null);
      flash('Saved');
    } catch (error: any) {
      alert(`Couldn't save the field: ${errorText(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (field: CustomFieldDef) => {
    if (
      !confirm(
        `Delete "${field.label}"? It comes off the layout. Values already saved on tickets are kept but no longer shown.`
      )
    )
      return;
    try {
      await apiService.deleteField(MODULE, field.id);
      await load();
      flash('Deleted');
    } catch (error: any) {
      alert(`Couldn't delete the field: ${errorText(error)}`);
    }
  };

  if (!layout) {
    return <div className="p-8 text-gray-500">Loading the layout…</div>;
  }

  const input =
    'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  const iconButton =
    'p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent';
  const active = activeKey ? infoByKey.get(activeKey) : undefined;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/admin/settings')}
        className="text-sm text-blue-600 hover:text-blue-800 mb-3"
      >
        ← Settings
      </button>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Layouts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Drag fields to arrange {current.what}. Locked fields are standard and can't be removed.
          </p>
        </div>
        <span role="status" className="text-sm text-green-700 h-5">
          {status}
        </span>
      </div>

      <nav
        aria-label="Modules"
        className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-5"
      >
        {MODULES.map((m) => (
          <NavLink
            key={m.key}
            to={m.path}
            end
            className={() =>
              `px-3 py-2 text-sm -mb-px border-b-2 ${
                m.key === MODULE
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400 font-medium'
                  : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`
            }
          >
            {m.label}
          </NavLink>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-6">
        {/* Palette */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Add a field
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => {
              const Icon = TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => startNewField(type)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700 text-left"
                >
                  <Icon className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  {type === 'lookup' ? 'Lookup' : FIELD_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addSection}
            className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:border-gray-400 hover:text-gray-900"
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add section
          </button>
        </aside>

        {/* Canvas */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveKey(null);
            setDragSections(null);
          }}
        >
          <div className="space-y-4 min-w-0">
            {sections.map((section, si) => (
              <section
                key={section.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50"
              >
                <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    defaultValue={section.title}
                    key={`${section.id}-${section.title}`}
                    aria-label="Section name"
                    maxLength={80}
                    onBlur={(e) => renameSection(si, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 dark:text-white px-1.5 py-1 rounded border border-transparent hover:border-gray-300 focus:bg-white dark:focus:bg-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400 mr-1">
                    {section.fields.length} field{section.fields.length === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={si === 0}
                    onClick={() => moveSection(si, -1)}
                    aria-label={`Move section ${section.title} up`}
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={si === sections.length - 1}
                    onClick={() => moveSection(si, 1)}
                    aria-label={`Move section ${section.title} down`}
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      className={`${iconButton} hover:text-red-600`}
                      disabled={section.fields.length > 0}
                      title={section.fields.length ? 'Move its fields out first' : 'Remove section'}
                      onClick={() => removeSection(si)}
                      aria-label={`Remove section ${section.title}`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <SortableContext items={section.fields} strategy={rectSortingStrategy}>
                  <SectionGrid id={section.id} empty={section.fields.length === 0}>
                    {section.fields.map((key) => {
                      const info = infoByKey.get(key);
                      if (!info) return null;
                      return (
                        <FieldCard
                          key={key}
                          info={info}
                          onEdit={() =>
                            info.field &&
                            setDraft({
                              id: info.field.id,
                              label: info.field.label,
                              type: info.field.type,
                              options: info.field.options.join('\n'),
                              isRequired: info.field.isRequired,
                              helpText: info.field.helpText || '',
                              sectionId: section.id,
                              lookupModule: info.field.lookupModule || '',
                            })
                          }
                          onDelete={() => info.field && deleteField(info.field)}
                        />
                      );
                    })}
                  </SectionGrid>
                </SortableContext>
              </section>
            ))}
          </div>
          <DragOverlay>{active ? <FieldCard info={active} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>

      {/* Add / edit a field */}
      {draft && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setDraft(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-dialog-title"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2
                id="field-dialog-title"
                className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"
              >
                {React.createElement(TYPE_ICONS[draft.type], {
                  className: 'h-5 w-5 text-blue-500',
                })}
                {draft.id
                  ? 'Edit field'
                  : `New ${draft.type === 'lookup' ? 'lookup' : FIELD_TYPE_LABELS[draft.type].toLowerCase()} field`}
              </h2>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label="Close"
                className="p-1 rounded text-gray-400 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label
                  htmlFor="field-label"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Name
                </label>
                <input
                  id="field-label"
                  autoFocus
                  type="text"
                  maxLength={120}
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && !hasChoices(draft.type) && saveField()}
                  placeholder="e.g. Product Type"
                  className={input}
                />
              </div>
              {draft.id ? (
                <p className="text-xs text-gray-500">
                  Type: {FIELD_TYPE_LABELS[draft.type]} (can't change once values may be saved)
                </p>
              ) : (
                <div>
                  <label
                    htmlFor="field-section"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Section
                  </label>
                  <select
                    id="field-section"
                    value={draft.sectionId}
                    onChange={(e) => setDraft({ ...draft, sectionId: e.target.value })}
                    className={input}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {draft.type === 'lookup' &&
                (draft.id ? (
                  <p className="text-xs text-gray-500">Links to {lookupName(draft.lookupModule)}</p>
                ) : (
                  <div>
                    <label
                      htmlFor="field-lookup"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Links to
                    </label>
                    <select
                      id="field-lookup"
                      value={draft.lookupModule}
                      onChange={(e) => setDraft({ ...draft, lookupModule: e.target.value })}
                      className={input}
                    >
                      {lookupTargets.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Records linked this way show up in a related list on the other record.
                    </p>
                  </div>
                ))}
              {hasChoices(draft.type) && (
                <div>
                  <label
                    htmlFor="field-options"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Choices <span className="font-normal text-gray-500">(one per line)</span>
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
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
              {MODULE === 'tickets' && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={draft.isRequired}
                    onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })}
                  />
                  Required when an agent creates a ticket
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 rounded-b-xl">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:underline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveField}
                disabled={saving}
                className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : draft.id ? 'Save' : 'Add field'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldLayout;
