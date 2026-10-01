import { db } from '@/config/database';
import { ValidationError, NotFoundError, ConflictError } from '@/utils/errors';
import { FieldService, SYSTEM_FIELDS, coerce, type CustomField } from './FieldService';

/**
 * Accounts and contacts edited through their layouts (the account and
 * contact pages): standard fields - stored in their own columns - and custom
 * fields, stored in custom_field_values. Only records of the caller's
 * subscriber, and only staff.
 */

type RecordModule = 'accounts' | 'contacts';

const parse = <T>(value: unknown, fallback: T): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : ((value as T) ?? fallback);

const findRow = async (tenantId: string, module: RecordModule, id: string) => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(id)) throw new NotFoundError('Not found');
  if (module === 'accounts') {
    const row = await db('companies').where({ id, subscriber_id: tenantId }).first();
    if (!row) throw new NotFoundError('Account not found');
    return row;
  }
  // A contact: a customer at one of the subscriber's accounts
  const row = await db('users as u')
    .join('user_company_associations as a', 'a.user_id', 'u.id')
    .join('companies as c', 'c.id', 'a.company_id')
    .where('u.id', id)
    .where('u.role', 'customer')
    .where('c.subscriber_id', tenantId)
    .first('u.*', 'c.id as account_id', 'c.name as account_name');
  if (!row) throw new NotFoundError('Contact not found');
  return row;
};

const toRecord = (module: RecordModule, row: any) => {
  const values: Record<string, unknown> = {};
  for (const f of SYSTEM_FIELDS[module]) if (f.column) values[f.key] = row[f.column] ?? null;
  return {
    id: row.id,
    values,
    customFieldValues: parse<Record<string, unknown>>(row.custom_field_values, {}),
    ...(module === 'contacts'
      ? { account: row.account_id ? { id: row.account_id, name: row.account_name } : null }
      : {}),
  };
};

export class RecordService {
  static async get(tenantId: string, module: RecordModule, id: string) {
    return toRecord(module, await findRow(tenantId, module, id));
  }

  /** Change some standard and custom fields; the ones not sent are kept. */
  static async update(
    tenantId: string,
    module: RecordModule,
    id: string,
    input: { values?: Record<string, unknown>; customFieldValues?: Record<string, unknown> }
  ) {
    const row = await findRow(tenantId, module, id);
    const updates: Record<string, unknown> = {};

    const fields = new Map(SYSTEM_FIELDS[module].map((f) => [f.key, f]));
    for (const [key, raw] of Object.entries(input.values || {})) {
      const field = fields.get(key);
      if (!field) throw new ValidationError(`Unknown field "${key}"`);
      if (!field.column) throw new ValidationError(`${field.label} can't be changed here`);
      let value: unknown = typeof raw === 'string' ? raw.trim() : raw;
      if (value === '' || value === null || value === undefined) {
        if (field.isRequired) throw new ValidationError(`${field.label} is required`);
        updates[field.column] = null;
        continue;
      }
      // "acme.com" is fine for a website
      if (field.type === 'url' && !/^https?:\/\//i.test(String(value))) value = `https://${value}`;
      value = coerce(
        {
          id: key,
          key,
          label: field.label,
          type: field.type as CustomField['type'],
          options: [],
          isRequired: field.isRequired,
          helpText: null,
          system: false,
        },
        value
      );
      if (field.type === 'email') value = String(value).toLowerCase();
      updates[field.column] = value;
    }

    if (
      module === 'contacts' &&
      typeof updates['email'] === 'string' &&
      updates['email'] !== row.email
    ) {
      const taken = await db('users')
        .whereRaw('lower(email) = ?', [updates['email']])
        .whereNot('id', id)
        .first('id');
      if (taken) throw new ConflictError('Another person already uses that email address');
    }

    if (input.customFieldValues !== undefined) {
      updates['custom_field_values'] = JSON.stringify(
        await FieldService.validateValues(tenantId, module, input.customFieldValues, {
          current: parse<Record<string, unknown>>(row.custom_field_values, {}),
        })
      );
    }

    if (Object.keys(updates).length) {
      try {
        await db(module === 'accounts' ? 'companies' : 'users')
          .where('id', id)
          .update({ ...updates, updated_at: db.fn.now() });
      } catch (error: any) {
        if (error?.code === '23505')
          throw new ConflictError('That value is already used by another record');
        throw error;
      }
    }
    return this.get(tenantId, module, id);
  }
}
