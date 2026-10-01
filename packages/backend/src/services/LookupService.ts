import { db } from '@/config/database';
import { resolveModule } from './FieldService';

/**
 * Lookup fields: finding records to link to (search), showing linked
 * records by name, and listing what links to a record (related lists).
 * Always within one subscriber.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 50;

type Named = { id: string; name: string };

/** A query of the records of a module, as { id, name }, within the subscriber. */
const recordsOf = async (orgId: string, module: string) => {
  if (module === 'accounts') {
    return {
      query: () => db('companies as r').where('r.subscriber_id', orgId),
      name: 'r.name',
      valuesColumn: 'r.custom_field_values',
    };
  }
  if (module === 'contacts') {
    return {
      query: () =>
        db('users as r')
          .where('r.role', 'customer')
          .whereExists(
            db('user_company_associations as a')
              .join('companies as c', 'c.id', 'a.company_id')
              .whereRaw('a.user_id = r.id')
              .where('c.subscriber_id', orgId)
              .select(db.raw('1'))
          ),
      name: db.raw("trim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, ''))"),
      valuesColumn: 'r.custom_field_values',
    };
  }
  if (module === 'tickets') {
    return {
      query: () => db('tickets as r').where('r.org_id', orgId),
      name: db.raw("'#' || coalesce(r.ticket_number::text, '') || ' ' || r.title"),
      valuesColumn: 'r.custom_field_values',
    };
  }
  const resolved = await resolveModule(orgId, module);
  return {
    query: () =>
      db('custom_records as r').where({ 'r.org_id': orgId, 'r.module_id': resolved.custom!.id }),
    name: 'r.name',
    valuesColumn: 'r.values',
  };
};

export class LookupService {
  /** Records to pick from, matching the typed text. */
  static async search(orgId: string, module: string, q: string): Promise<Named[]> {
    const r = await recordsOf(orgId, module);
    let query = r.query().select('r.id', { name: r.name } as any);
    const text = q.trim();
    if (text) {
      query = query.whereRaw(`${typeof r.name === 'string' ? r.name : r.name.toString()} ILIKE ?`, [
        `%${text.replace(/[%_\\]/g, '\\$&')}%`,
      ]);
    }
    return query.orderBy('name').limit(20);
  }

  /** Names of linked records, for showing a lookup's value. */
  static async names(orgId: string, module: string, ids: string[]): Promise<Named[]> {
    const wanted = [...new Set(ids)].filter((id) => UUID.test(id)).slice(0, 200);
    if (!wanted.length) return [];
    const r = await recordsOf(orgId, module);
    return r
      .query()
      .whereIn('r.id', wanted)
      .select('r.id', { name: r.name } as any);
  }

  /**
   * What links to this record: for each lookup field (in any module) that
   * points at this module, the records whose value is this record.
   */
  static async related(orgId: string, module: string, id: string) {
    if (!UUID.test(id)) return [];
    const fields = await db('module_fields').where({
      org_id: orgId,
      type: 'lookup',
      lookup_module: module,
    });
    const modules = new Map(
      (await db('custom_modules').where('org_id', orgId)).map((m: any) => [m.key, m.name])
    );
    const builtIn: Record<string, string> = {
      tickets: 'Tickets',
      accounts: 'Accounts',
      contacts: 'Contacts',
    };
    const groups = [];
    for (const field of fields) {
      const label = builtIn[field.module] || modules.get(field.module);
      if (!label) continue; // module since deleted
      const r = await recordsOf(orgId, field.module);
      const records: Named[] = await r
        .query()
        .whereRaw(`${r.valuesColumn}->>? = ?`, [field.key, id])
        .select('r.id', { name: r.name } as any)
        .orderBy('name')
        .limit(LIMIT);
      groups.push({ module: field.module, moduleName: label, field: field.label, records });
    }
    return groups;
  }
}
