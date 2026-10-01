import { db } from '@/config/database';
import { ValidationError, NotFoundError, ConflictError } from '@/utils/errors';
import { FieldService, coerce, resolveModule, type CustomField } from './FieldService';

/**
 * Accounts and contacts edited through their layouts (the account and
 * contact pages): standard fields - stored in their own columns - and custom
 * fields, stored in custom_field_values. Only records of the caller's
 * subscriber, and only staff.
 */

// accounts, contacts, or a custom module's key (cm_...)
type RecordModule = string;

const parse = <T>(value: unknown, fallback: T): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : ((value as T) ?? fallback);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const findRow = async (tenantId: string, module: RecordModule, id: string) => {
  if (!UUID.test(id)) throw new NotFoundError('Not found');
  if (module.startsWith('cm_')) {
    const resolved = await resolveModule(tenantId, module);
    const row = await db('custom_records')
      .where({ id, org_id: tenantId, module_id: resolved.custom!.id })
      .first();
    if (!row) throw new NotFoundError(`${resolved.custom!.singular} not found`);
    // Stored like the others: name in a column, custom fields in a JSON column
    return { ...row, custom_field_values: row.values };
  }
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

const toRecord = async (tenantId: string, module: RecordModule, row: any) => {
  const values: Record<string, unknown> = {};
  for (const f of (await resolveModule(tenantId, module)).system)
    if (f.column) values[f.key] = row[f.column] ?? null;
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
    if (module !== 'accounts' && module !== 'contacts' && !module.startsWith('cm_')) {
      throw new NotFoundError('Unknown module');
    }
    return toRecord(tenantId, module, await findRow(tenantId, module, id));
  }

  /** A custom module's records, newest first, optionally matching a search. */
  static async list(tenantId: string, module: RecordModule, q = '', page = 1) {
    const resolved = await resolveModule(tenantId, module);
    if (!resolved.custom) throw new NotFoundError('Unknown module');
    const limit = 50;
    let query = db('custom_records').where({ org_id: tenantId, module_id: resolved.custom.id });
    if (q.trim()) query = query.whereILike('name', `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`);
    const [rows, count] = await Promise.all([
      query
        .clone()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset((Math.max(1, page) - 1) * limit),
      query.clone().count('* as n').first(),
    ]);
    return {
      records: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        customFieldValues: parse<Record<string, unknown>>(r.values, {}),
        createdAt: r.created_at,
      })),
      total: Number(count?.n) || 0,
    };
  }

  /** A new record of a custom module. */
  static async create(
    tenantId: string,
    module: RecordModule,
    userId: string,
    input: { values?: Record<string, unknown>; customFieldValues?: Record<string, unknown> }
  ) {
    const resolved = await resolveModule(tenantId, module);
    if (!resolved.custom)
      throw new ValidationError('Accounts and contacts are added from their own pages');
    const name = typeof input.values?.['name'] === 'string' ? input.values['name'].trim() : '';
    if (!name || name.length > 255)
      throw new ValidationError(`${resolved.system[0]!.label} is required`);
    const values = await FieldService.validateValues(
      tenantId,
      module,
      input.customFieldValues || {},
      {
        enforceRequired: true,
      }
    );
    const [row] = await db('custom_records')
      .insert({
        org_id: tenantId,
        module_id: resolved.custom.id,
        name,
        values: JSON.stringify(values),
        created_by: userId,
      })
      .returning('*');
    return this.get(tenantId, module, row.id);
  }

  /** Delete a custom module's record. (Accounts and contacts aren't deleted here.) */
  static async remove(tenantId: string, module: RecordModule, id: string) {
    if (!module.startsWith('cm_'))
      throw new ValidationError("Accounts and contacts can't be deleted here");
    await findRow(tenantId, module, id);
    await db('custom_records').where({ id, org_id: tenantId }).del();
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

    const fields = new Map((await resolveModule(tenantId, module)).system.map((f) => [f.key, f]));
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
        const table =
          module === 'accounts' ? 'companies' : module === 'contacts' ? 'users' : 'custom_records';
        if (table === 'custom_records' && 'custom_field_values' in updates) {
          updates['values'] = updates['custom_field_values'];
          delete updates['custom_field_values'];
        }
        await db(table)
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
