import crypto from 'crypto';
import { db } from '@/config/database';
import { ValidationError, NotFoundError } from '@/utils/errors';

/**
 * Fields and layouts (Settings > Ticket Layout).
 *
 * Every module has standard fields, defined here, that a layout can move
 * but never remove - for tickets: subject, description, contact, account,
 * phone, product, department, status, priority, assignee. A subscriber adds
 * its own custom fields on top (module_fields), and arranges all of them in
 * sections (module_layouts).
 *
 * Custom field values are stored on the record (tickets.custom_field_values)
 * under the field's key, and checked here against the field's type.
 */

export const MODULES = ['tickets', 'accounts', 'contacts'] as const;
export type ModuleName = (typeof MODULES)[number];

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'decimal',
  'date',
  'checkbox',
  'email',
  'phone',
  'url',
  'picklist',
  'multiselect',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface SystemField {
  key: string;
  label: string;
  type: string;
  isRequired: boolean;
  system: true;
  // The record's column it's stored in (accounts and contacts). None: it's
  // shown but not edited through the layout (e.g. a contact's account).
  column?: string;
}

const std = (
  key: string,
  label: string,
  type: string,
  column?: string,
  isRequired = false
): SystemField => ({ key, label, type, isRequired, system: true, column });

const ADDRESS = (prefix: 'address' | 'billing', columns: string[]): SystemField[] =>
  ['Street', 'Street 2', 'City', 'State', 'County', 'ZIP / Postal code', 'Country'].map(
    (label, i) =>
      std(
        `${prefix}_${['street', 'street2', 'city', 'state', 'county', 'postal_code', 'country'][i]}`,
        prefix === 'billing'
          ? `Billing ${label === 'ZIP / Postal code' ? 'ZIP / postal code' : label.toLowerCase()}`
          : label,
        'text',
        columns[i]
      )
  );

export const SYSTEM_FIELDS: Record<ModuleName, SystemField[]> = {
  tickets: [
    { key: 'contact', label: 'Contact', type: 'lookup', isRequired: true, system: true },
    { key: 'account', label: 'Account', type: 'lookup', isRequired: true, system: true },
    { key: 'phone', label: 'Phone', type: 'phone', isRequired: false, system: true },
    { key: 'product', label: 'Product', type: 'lookup', isRequired: false, system: true },
    { key: 'subject', label: 'Subject', type: 'text', isRequired: true, system: true },
    { key: 'description', label: 'Description', type: 'textarea', isRequired: true, system: true },
    { key: 'department', label: 'Department', type: 'lookup', isRequired: true, system: true },
    { key: 'status', label: 'Status', type: 'picklist', isRequired: true, system: true },
    { key: 'priority', label: 'Priority', type: 'picklist', isRequired: true, system: true },
    { key: 'assignee', label: 'Assigned to', type: 'lookup', isRequired: false, system: true },
  ],
  accounts: [
    std('name', 'Account name', 'text', 'name', true),
    std('phone', 'Phone', 'phone', 'primary_contact_phone'),
    std('website', 'Website', 'url', 'website_url'),
    std('domain', 'Email domain', 'text', 'domain'),
    std('description', 'Description', 'textarea', 'description'),
    ...ADDRESS('address', [
      'address_line_1',
      'address_line_2',
      'city',
      'state_province',
      'county',
      'postal_code',
      'country',
    ]),
    ...ADDRESS('billing', [
      'billing_street',
      'billing_street2',
      'billing_city',
      'billing_state',
      'billing_county',
      'billing_postal_code',
      'billing_country',
    ]),
  ],
  contacts: [
    std('first_name', 'First name', 'text', 'first_name', true),
    std('last_name', 'Last name', 'text', 'last_name', true),
    std('email', 'Email', 'email', 'email', true),
    std('phone', 'Phone', 'phone', 'phone'),
    std('mobile', 'Mobile', 'phone', 'mobile_phone'),
    std('title', 'Title', 'text', 'job_title'),
    std('account', 'Account', 'lookup'),
  ],
};

function SYSTEM_FIELDS_KEYS(prefix: string): string[] {
  return ['street', 'street2', 'city', 'state', 'county', 'postal_code', 'country'].map(
    (k) => `${prefix}_${k}`
  );
}

const DEFAULT_SECTIONS: Record<ModuleName, Section[]> = {
  tickets: [
    {
      id: 'ticket-information',
      title: 'Ticket Information',
      fields: ['contact', 'account', 'phone', 'product', 'subject', 'description'],
    },
    {
      id: 'additional-information',
      title: 'Additional Information',
      fields: ['department', 'status', 'priority', 'assignee'],
    },
  ],
  accounts: [
    {
      id: 'account-information',
      title: 'Account Information',
      fields: ['name', 'phone', 'website', 'domain', 'description'],
    },
    {
      id: 'address',
      title: 'Address',
      fields: SYSTEM_FIELDS_KEYS('address'),
    },
    {
      id: 'billing-address',
      title: 'Billing Address',
      fields: SYSTEM_FIELDS_KEYS('billing'),
    },
  ],
  contacts: [
    {
      id: 'contact-information',
      title: 'Contact Information',
      fields: ['first_name', 'last_name', 'email', 'phone', 'mobile', 'title', 'account'],
    },
  ],
};

export interface Section {
  id: string;
  title: string;
  fields: string[];
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  isRequired: boolean;
  helpText: string | null;
  system: false;
}

export interface FieldInput {
  label: string;
  type?: string;
  options?: string[];
  isRequired?: boolean;
  helpText?: string | null;
}

const MAX_FIELDS = 200;
const MAX_OPTIONS = 200;
const parse = <T>(value: unknown, fallback: T): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : ((value as T) ?? fallback);

const toField = (row: any): CustomField => ({
  id: row.id,
  key: row.key,
  label: row.label,
  type: row.type,
  options: parse<string[]>(row.options, []),
  isRequired: row.is_required,
  helpText: row.help_text,
  system: false,
});

const assertModule = (module: string): ModuleName => {
  if (!(MODULES as readonly string[]).includes(module)) throw new NotFoundError('Unknown module');
  return module as ModuleName;
};

const cleanOptions = (type: string, options: unknown): string[] => {
  if (type !== 'picklist' && type !== 'multiselect') return [];
  const list = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
  const unique = [...new Set(list)];
  if (unique.length === 0) throw new ValidationError('A pick list needs at least one option');
  if (unique.length > MAX_OPTIONS || unique.some((o) => o.length > 100)) {
    throw new ValidationError(`Up to ${MAX_OPTIONS} options of 100 characters each`);
  }
  return unique;
};

const slug = (label: string): string =>
  label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'field';

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** One value, checked and converted for its field's type. */
export const coerce = (field: CustomField, value: unknown): unknown => {
  const bad = (why: string) => new ValidationError(`${field.label}: ${why}`);
  switch (field.type) {
    case 'text':
    case 'phone': {
      const s = String(value).trim();
      if (s.length > (field.type === 'phone' ? 40 : 255)) throw bad('too long');
      return s;
    }
    case 'textarea': {
      const s = String(value);
      if (s.length > 10000) throw bad('too long');
      return s;
    }
    case 'number': {
      const n = Number(value);
      if (!Number.isInteger(n)) throw bad('must be a whole number');
      return n;
    }
    case 'decimal': {
      const n = Number(value);
      if (!Number.isFinite(n)) throw bad('must be a number');
      return n;
    }
    case 'date': {
      const s = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
        throw bad('must be a date');
      }
      return s;
    }
    case 'checkbox':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 'false') return value === 'true';
      throw bad('must be ticked or not');
    case 'email': {
      const s = String(value).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 320)
        throw bad('not an email address');
      return s;
    }
    case 'url': {
      const s = String(value).trim();
      if (!/^https?:\/\/\S+$/i.test(s) || s.length > 2000) {
        throw bad('must be a web address starting with http:// or https://');
      }
      return s;
    }
    case 'picklist': {
      const s = String(value);
      if (!field.options.includes(s)) throw bad(`"${s}" isn't one of the choices`);
      return s;
    }
    case 'multiselect': {
      const list = Array.isArray(value) ? value.map(String) : [String(value)];
      const unknown = list.find((v) => !field.options.includes(v));
      if (unknown !== undefined) throw bad(`"${unknown}" isn't one of the choices`);
      return [...new Set(list)];
    }
    default:
      throw bad('unknown field type');
  }
};

export class FieldService {
  static async customFields(orgId: string, module: string): Promise<CustomField[]> {
    const rows = await db('module_fields')
      .where({ org_id: orgId, module: assertModule(module) })
      .orderBy('created_at');
    return rows.map(toField);
  }

  /**
   * The layout as stored, kept consistent: every standard field and every
   * custom field appears exactly once (missing ones are added to the end).
   */
  static async layout(orgId: string, module: string) {
    const m = assertModule(module);
    const [custom, row] = await Promise.all([
      this.customFields(orgId, m),
      db('module_layouts').where({ org_id: orgId, module: m }).first(),
    ]);
    const known = new Set([...SYSTEM_FIELDS[m].map((f) => f.key), ...custom.map((f) => f.key)]);
    const sections: Section[] = (
      row ? parse<Section[]>(row.sections, []) : DEFAULT_SECTIONS[m]
    ).map((s) => ({ ...s, fields: [...s.fields] }));
    const seen = new Set<string>();
    for (const s of sections) {
      s.fields = s.fields.filter((k) => known.has(k) && !seen.has(k) && seen.add(k));
    }
    if (sections.length === 0) sections.push({ id: 'section-1', title: 'Details', fields: [] });
    const missing = [...known].filter((k) => !seen.has(k));
    sections[sections.length - 1]!.fields.push(...missing);
    return { sections, systemFields: SYSTEM_FIELDS[m], customFields: custom };
  }

  static async saveLayout(orgId: string, module: string, input: unknown) {
    const m = assertModule(module);
    const custom = await this.customFields(orgId, m);
    const known = new Set([...SYSTEM_FIELDS[m].map((f) => f.key), ...custom.map((f) => f.key)]);
    if (!Array.isArray(input) || input.length === 0 || input.length > 50) {
      throw new ValidationError('A layout needs at least one section');
    }
    const seen = new Set<string>();
    const sections: Section[] = input.map((s: any, i: number) => {
      const title = typeof s?.title === 'string' ? s.title.trim() : '';
      if (!title || title.length > 80) throw new ValidationError('Every section needs a title');
      const fields = Array.isArray(s.fields) ? s.fields.map(String) : [];
      for (const key of fields) {
        if (!known.has(key)) throw new ValidationError(`Unknown field "${key}"`);
        if (seen.has(key)) throw new ValidationError(`"${key}" is in the layout twice`);
        seen.add(key);
      }
      const id = typeof s.id === 'string' && /^[\w-]{1,64}$/.test(s.id) ? s.id : `section-${i + 1}`;
      return { id, title, fields };
    });
    const removed = SYSTEM_FIELDS[m].filter((f) => !seen.has(f.key));
    if (removed.length) {
      throw new ValidationError(
        `Standard fields can't be removed: ${removed.map((f) => f.label).join(', ')}`
      );
    }
    // Custom fields left out stay on the layout (at the end): delete a field
    // to take it off.
    await db('module_layouts')
      .insert({
        org_id: orgId,
        module: m,
        sections: JSON.stringify(sections),
        updated_at: db.fn.now(),
      })
      .onConflict(['org_id', 'module'])
      .merge();
    return this.layout(orgId, m);
  }

  static async createField(orgId: string, module: string, input: FieldInput) {
    const m = assertModule(module);
    const label = typeof input.label === 'string' ? input.label.trim() : '';
    if (!label || label.length > 120) throw new ValidationError('Give the field a name');
    if (!(FIELD_TYPES as readonly string[]).includes(String(input.type))) {
      throw new ValidationError('Unknown field type');
    }
    const type = input.type as FieldType;
    const count = await db('module_fields')
      .where({ org_id: orgId, module: m })
      .count('* as n')
      .first();
    if (Number(count?.n) >= MAX_FIELDS) throw new ValidationError(`Up to ${MAX_FIELDS} fields`);
    if (SYSTEM_FIELDS[m].some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      throw new ValidationError(`"${label}" is already a standard field`);
    }

    // A key that never changes, even if the label does: values are stored under it
    let key = `cf_${slug(label)}`;
    if (await db('module_fields').where({ org_id: orgId, module: m, key }).first('id')) {
      key = `${key}_${crypto.randomBytes(3).toString('hex')}`;
    }
    const [row] = await db('module_fields')
      .insert({
        org_id: orgId,
        module: m,
        key,
        label,
        type,
        options: JSON.stringify(cleanOptions(type, input.options)),
        is_required: !!input.isRequired,
        help_text: input.helpText ? String(input.helpText).trim().slice(0, 255) || null : null,
      })
      .returning('*');
    return toField(row);
  }

  /** Label, choices, required and help can change; the type can't (values depend on it). */
  static async updateField(orgId: string, module: string, fieldId: string, input: FieldInput) {
    const m = assertModule(module);
    const row = await db('module_fields').where({ id: fieldId, org_id: orgId, module: m }).first();
    if (!row) throw new NotFoundError('Field not found');
    const label = typeof input.label === 'string' ? input.label.trim() : '';
    if (!label || label.length > 120) throw new ValidationError('Give the field a name');
    if (input.type && input.type !== row.type) {
      throw new ValidationError("A field's type can't be changed - add a new field instead");
    }
    const [updated] = await db('module_fields')
      .where('id', fieldId)
      .update({
        label,
        options: JSON.stringify(cleanOptions(row.type, input.options ?? parse(row.options, []))),
        is_required: !!input.isRequired,
        help_text: input.helpText ? String(input.helpText).trim().slice(0, 255) || null : null,
        updated_at: db.fn.now(),
      })
      .returning('*');
    return toField(updated);
  }

  /** Values already saved under it stay on the records, just no longer shown. */
  static async deleteField(orgId: string, module: string, fieldId: string) {
    const m = assertModule(module);
    const deleted = await db('module_fields')
      .where({ id: fieldId, org_id: orgId, module: m })
      .del();
    if (!deleted) throw new NotFoundError('Field not found');
  }

  /**
   * Check custom field values for a record. Returns what to store: values
   * converted for their type, empty ones dropped. With `current`, these are
   * changes merged into what's stored (an empty value clears that field).
   * `enforceRequired`: staff filling in the form must fill in required
   * fields; customers and email (who never see them) are not held to it.
   */
  static async validateValues(
    orgId: string,
    module: string,
    values: unknown,
    options: { current?: Record<string, unknown>; enforceRequired?: boolean } = {}
  ): Promise<Record<string, unknown>> {
    const fields = await this.customFields(orgId, module);
    const byKey = new Map(fields.map((f) => [f.key, f]));
    if (
      values !== undefined &&
      (typeof values !== 'object' || values === null || Array.isArray(values))
    ) {
      throw new ValidationError('Custom field values must be an object');
    }
    const result: Record<string, unknown> = { ...(options.current || {}) };
    for (const [key, value] of Object.entries((values as Record<string, unknown>) || {})) {
      const field = byKey.get(key);
      if (!field) throw new ValidationError(`Unknown field "${key}"`);
      if (isEmpty(value)) {
        delete result[key];
        continue;
      }
      result[key] = coerce(field, value);
    }
    if (options.enforceRequired) {
      const missing = fields.filter(
        (f) => f.isRequired && (isEmpty(result[f.key]) || (f.type === 'checkbox' && !result[f.key]))
      );
      if (missing.length) {
        throw new ValidationError(`Required: ${missing.map((f) => f.label).join(', ')}`);
      }
    }
    return result;
  }
}
