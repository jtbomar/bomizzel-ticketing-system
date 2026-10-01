/** Fields and layouts, as the API returns them (GET /fields/:module). */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'date'
  | 'checkbox'
  | 'email'
  | 'phone'
  | 'url'
  | 'picklist'
  | 'multiselect'
  | 'lookup';

export interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  isRequired: boolean;
  helpText: string | null;
  system: false;
  // A lookup's target module: accounts, contacts or a custom module (cm_...)
  lookupModule?: string | null;
}

export interface SystemFieldDef {
  key: string;
  label: string;
  type: string;
  isRequired: boolean;
  system: true;
}

export interface LayoutSection {
  id: string;
  title: string;
  fields: string[];
}

export interface ModuleLayout {
  sections: LayoutSection[];
  systemFields: SystemFieldDef[];
  customFields: CustomFieldDef[];
  // For a custom module
  module?: { key: string; id: string; name: string; singular: string };
}

/** Where a record of a module lives in the app. */
export const recordPath = (module: string, id: string): string =>
  module === 'accounts'
    ? `/agent/accounts/${id}`
    : module === 'contacts'
      ? `/agent/customers/${id}`
      : module === 'tickets'
        ? `/agent/tickets/${id}`
        : `/agent/modules/${module}/${id}`;

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Single line',
  textarea: 'Multi-line',
  number: 'Whole number',
  decimal: 'Decimal',
  date: 'Date',
  checkbox: 'Checkbox',
  email: 'Email',
  phone: 'Phone',
  url: 'Web address',
  picklist: 'Pick list',
  multiselect: 'Multi-select',
  lookup: 'Lookup (link to a record)',
};

/** A stored value as text, for read-only display. */
export const displayValue = (field: CustomFieldDef, value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (field.type === 'lookup') return 'a linked record';
  if (Array.isArray(value)) return value.join(', ');
  if (field.type === 'date') {
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  return String(value);
};
