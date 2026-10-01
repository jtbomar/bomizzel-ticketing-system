import { db } from '@/config/database';
import { ValidationError, NotFoundError } from '@/utils/errors';
import { PlanService } from './PlanService';

/**
 * Custom modules (Settings > Modules): a subscriber's own record types, like
 * Assets or Contracts. Each gets a records list, a record page, and a layout
 * of its own; lookup fields link them to accounts, contacts and each other.
 */

const MAX_MODULES = 30;

const toModel = (row: any) => ({
  id: row.id,
  key: row.key,
  name: row.name,
  singular: row.singular,
});

const cleanName = (value: unknown, what: string) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 80) throw new ValidationError(`Give the module ${what}`);
  return name;
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'module';

const RESERVED = ['tickets', 'accounts', 'contacts'];

export class ModuleService {
  static async list(orgId: string) {
    const rows = await db('custom_modules').where('org_id', orgId).orderBy('name');
    return rows.map(toModel);
  }

  static async create(orgId: string, input: { name?: unknown; singular?: unknown }) {
    await PlanService.assertCan(orgId, 'customModule');
    const name = cleanName(input.name, 'a name');
    const singular = cleanName(input.singular ?? name, 'a name for one record');
    if (RESERVED.includes(name.toLowerCase())) {
      throw new ValidationError(`"${name}" is already a module`);
    }
    const count = await db('custom_modules').where('org_id', orgId).count('* as n').first();
    if (Number(count?.n) >= MAX_MODULES) throw new ValidationError(`Up to ${MAX_MODULES} modules`);
    if (
      await db('custom_modules')
        .where('org_id', orgId)
        .whereRaw('lower(name) = ?', [name.toLowerCase()])
        .first('id')
    ) {
      throw new ValidationError(`There's already a module called "${name}"`);
    }
    let key = `cm_${slug(name)}`;
    for (let n = 2; await db('custom_modules').where({ org_id: orgId, key }).first('id'); n++) {
      key = `cm_${slug(name)}_${n}`;
    }
    const [row] = await db('custom_modules')
      .insert({ org_id: orgId, key, name, singular })
      .returning('*');
    return toModel(row);
  }

  /** Renaming keeps the key, so fields and links keep working. */
  static async rename(orgId: string, key: string, input: { name?: unknown; singular?: unknown }) {
    const name = cleanName(input.name, 'a name');
    const singular = cleanName(input.singular ?? name, 'a name for one record');
    const [row] = await db('custom_modules')
      .where({ org_id: orgId, key })
      .update({ name, singular, updated_at: db.fn.now() })
      .returning('*');
    if (!row) throw new NotFoundError('Module not found');
    return toModel(row);
  }

  /**
   * Deletes the module with its records, fields and layout, and the lookup
   * fields elsewhere that linked to it.
   */
  static async remove(orgId: string, key: string) {
    await db.transaction(async (trx) => {
      const row = await trx('custom_modules').where({ org_id: orgId, key }).first('id');
      if (!row) throw new NotFoundError('Module not found');
      await trx('module_fields')
        .where({ org_id: orgId })
        .where((q) => q.where('module', key).orWhere('lookup_module', key))
        .del();
      await trx('module_layouts').where({ org_id: orgId, module: key }).del();
      await trx('custom_modules').where('id', row.id).del(); // records cascade
    });
  }
}
