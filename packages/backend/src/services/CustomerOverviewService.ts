import { db } from '@/config/database';
import { RecordService } from './RecordService';
import { tenantStaffIds } from '@/utils/tenant';

/**
 * The account and contact pages (like Zoho Desk's): ticket counts, the
 * tickets themselves, where they came from, how quickly they were handled,
 * and the account's contacts / the contact's accounts, history and files.
 * Everything is within the caller's subscriber; the record must be one of its
 * accounts or contacts (RecordService.get throws 404 otherwise).
 */

export type CustomerModule = 'accounts' | 'contacts';

const FINISHED = ['resolved', 'closed'];
const HANDLING_MONTHS = 6;

/** Tickets of this account (company_id) or contact (submitter), in the tenant. */
const scope = (tenantId: string, module: CustomerModule, id: string) => (q: any) =>
  q
    .where('t.org_id', tenantId)
    .where(module === 'accounts' ? 't.company_id' : 't.submitter_id', id)
    .whereNull('t.archived_at');

const minutes = (seconds: unknown): number | null =>
  seconds === null || seconds === undefined ? null : Math.round(Number(seconds) / 60);

export class CustomerOverviewService {
  static async overview(tenantId: string, module: CustomerModule, id: string) {
    await RecordService.get(tenantId, module, id);
    const inScope = scope(tenantId, module, id);

    const [counts, channels, happiness, handling] = await Promise.all([
      db('tickets as t')
        .modify(inScope)
        .first(
          db.raw('count(*)::int as all'),
          db.raw('count(*) filter (where t.status <> all(?))::int as open', [FINISHED]),
          db.raw("count(*) filter (where t.status = 'waiting')::int as on_hold"),
          db.raw('count(*) filter (where t.status = any(?))::int as finished', [FINISHED])
        ),
      db('tickets as t')
        .modify(inScope)
        .groupByRaw("coalesce(t.source, 'web')")
        .select(db.raw("coalesce(t.source, 'web') as channel"), db.raw('count(*)::int as count'))
        .orderBy('count', 'desc'),
      db('customer_feedback as f')
        .join('tickets as t', 't.id', 'f.ticket_id')
        .modify(inScope)
        .whereNotNull('f.overall_rating')
        .first(
          db.raw('count(*)::int as responses'),
          db.raw('count(*) filter (where f.overall_rating >= 4)::int as good')
        ),
      this.handling(tenantId, inScope),
    ]);

    return {
      counts: {
        all: counts?.all ?? 0,
        open: counts?.open ?? 0,
        onHold: counts?.on_hold ?? 0,
        finished: counts?.finished ?? 0,
      },
      channels,
      happiness: happiness?.responses
        ? {
            responses: happiness.responses,
            percent: Math.round((happiness.good / happiness.responses) * 100),
          }
        : null,
      handling,
    };
  }

  /**
   * Averages over tickets opened in the last six months, in minutes:
   * first response (opened -> first staff reply), response (each customer
   * message -> the staff reply after it) and resolution (opened -> resolved).
   */
  private static async handling(tenantId: string, inScope: (q: any) => any) {
    const since = db.raw(`now() - interval '${HANDLING_MONTHS} months'`);
    const recent = db('tickets as t').modify(inScope).where('t.created_at', '>=', since);
    const staff = tenantStaffIds(tenantId);

    // The conversation: the ticket opening (the customer) and public notes
    const messages = db
      .select('t.id as ticket_id', 't.created_at as at', db.raw('false as by_staff'))
      .from(recent.clone().as('t'))
      .unionAll((u: any) =>
        u
          .select(
            'n.ticket_id',
            'n.created_at as at',
            db.raw('n.author_id in (?) as by_staff', [staff])
          )
          .from('ticket_notes as n')
          .join(recent.clone().select('t.id').as('rt'), 'rt.id', 'n.ticket_id')
          .where((w: any) => w.where('n.is_internal', false).orWhereNull('n.is_internal'))
      );

    const row = await db
      .with('m', messages)
      .with(
        'o',
        db.raw(
          `select ticket_id, at, by_staff,
             lag(by_staff) over (partition by ticket_id order by at) as prev_staff,
             lag(at) over (partition by ticket_id order by at) as prev_at,
             first_value(at) over (partition by ticket_id order by at) as opened_at
           from m`
        )
      )
      .with(
        'firsts',
        db.raw(
          `select ticket_id, min(at) - min(opened_at) as wait from o where by_staff group by ticket_id`
        )
      )
      .first(
        db.raw(
          `(select avg(extract(epoch from wait)) from firsts) as first_response,
           (select avg(extract(epoch from at - prev_at)) from o where by_staff and prev_staff = false) as response`
        )
      );

    const resolution = await recent
      .clone()
      .whereNotNull('t.resolved_at')
      .first(db.raw('avg(extract(epoch from t.resolved_at - t.created_at)) as seconds'));

    return {
      months: HANDLING_MONTHS,
      firstResponseMinutes: minutes(row?.first_response),
      responseMinutes: minutes(row?.response),
      resolutionMinutes: minutes(resolution?.seconds),
    };
  }

  /** The tickets, newest first: all, open (not resolved/closed) or on hold (waiting). */
  static async tickets(
    tenantId: string,
    module: CustomerModule,
    id: string,
    filter: 'all' | 'open' | 'on_hold' = 'all',
    page = 1,
    limit = 25
  ) {
    await RecordService.get(tenantId, module, id);
    const base = db('tickets as t')
      .modify(scope(tenantId, module, id))
      .modify((q: any) => {
        if (filter === 'open') q.whereNotIn('t.status', FINISHED);
        if (filter === 'on_hold') q.where('t.status', 'waiting');
      });
    const total = await base.clone().count('* as n').first();
    const rows = await base
      .clone()
      .leftJoin('users as s', 's.id', 't.submitter_id')
      .leftJoin('users as a', 'a.id', 't.assigned_to_id')
      .leftJoin('companies as c', 'c.id', 't.company_id')
      .leftJoin('ticket_statuses as ts', (j: any) =>
        j.on('ts.team_id', 't.team_id').andOn('ts.name', 't.status')
      )
      .orderBy('t.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .select(
        't.id',
        't.ticket_number',
        't.title',
        't.status',
        'ts.label as status_label',
        'ts.color as status_color',
        't.source',
        't.created_at',
        't.submitter_id',
        's.first_name as submitter_first',
        's.last_name as submitter_last',
        'c.id as company_id',
        'c.name as company_name',
        'a.id as assignee_id',
        'a.first_name as assignee_first',
        'a.last_name as assignee_last',
        db.raw(
          '(select count(*)::int from ticket_notes n where n.ticket_id = t.id and not coalesce(n.is_internal, false)) as replies'
        )
      );
    return {
      total: Number(total?.n || 0),
      page,
      limit,
      tickets: rows.map((r: any) => ({
        id: r.id,
        number: r.ticket_number,
        title: r.title,
        status: r.status,
        statusLabel: r.status_label || r.status,
        statusColor: r.status_color || null,
        channel: r.source || 'web',
        createdAt: r.created_at,
        contact: r.submitter_id
          ? {
              id: r.submitter_id,
              name: [r.submitter_first, r.submitter_last].filter(Boolean).join(' '),
            }
          : null,
        account: r.company_id ? { id: r.company_id, name: r.company_name } : null,
        assignee: r.assignee_id
          ? {
              id: r.assignee_id,
              name: [r.assignee_first, r.assignee_last].filter(Boolean).join(' '),
            }
          : null,
        replies: r.replies,
      })),
    };
  }

  /** An account's contacts, or a contact's accounts (within the tenant). */
  static async people(tenantId: string, module: CustomerModule, id: string) {
    await RecordService.get(tenantId, module, id);
    if (module === 'accounts') {
      const contacts = await db('user_company_associations as uca')
        .join('users as u', 'u.id', 'uca.user_id')
        .where('uca.company_id', id)
        .orderBy(['u.first_name', 'u.last_name'])
        .select(
          'u.id',
          'u.first_name',
          'u.last_name',
          'u.email',
          'u.phone',
          'u.is_active',
          db.raw(
            '(select count(*)::int from tickets t where t.submitter_id = u.id and t.company_id = ? and t.org_id = ?) as tickets',
            [id, tenantId]
          )
        );
      return {
        contacts: contacts.map((c: any) => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' '),
          email: c.email,
          phone: c.phone || null,
          active: c.is_active !== false,
          tickets: c.tickets,
        })),
      };
    }
    const accounts = await db('user_company_associations as uca')
      .join('companies as c', 'c.id', 'uca.company_id')
      .where('uca.user_id', id)
      .where('c.subscriber_id', tenantId)
      .orderBy('c.name')
      .select('c.id', 'c.name', 'c.domain');
    return { accounts };
  }

  /** What happened on the tickets, newest first. */
  static async history(tenantId: string, module: CustomerModule, id: string, limit = 50) {
    await RecordService.get(tenantId, module, id);
    const rows = await db('ticket_history as h')
      .join('tickets as t', 't.id', 'h.ticket_id')
      .modify(scope(tenantId, module, id))
      .leftJoin('users as u', 'u.id', 'h.user_id')
      .orderBy('h.created_at', 'desc')
      .limit(limit)
      .select(
        'h.id',
        'h.action',
        'h.field_name',
        'h.old_value',
        'h.new_value',
        'h.created_at',
        't.id as ticket_id',
        't.ticket_number',
        't.title',
        'u.first_name',
        'u.last_name'
      );
    return {
      history: rows.map((r: any) => ({
        id: r.id,
        action: r.action,
        field: r.field_name,
        from: r.old_value,
        to: r.new_value,
        at: r.created_at,
        ticket: { id: r.ticket_id, number: r.ticket_number, title: r.title },
        by: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
      })),
    };
  }

  /** Files on the tickets. */
  static async attachments(tenantId: string, module: CustomerModule, id: string) {
    await RecordService.get(tenantId, module, id);
    const rows = await db('file_attachments as f')
      .join('tickets as t', 't.id', 'f.ticket_id')
      .modify(scope(tenantId, module, id))
      .leftJoin('users as u', 'u.id', 'f.uploaded_by_id')
      .orderBy('f.created_at', 'desc')
      .limit(200)
      .select(
        'f.id',
        'f.original_name',
        'f.file_size',
        'f.mime_type',
        'f.created_at',
        't.id as ticket_id',
        't.ticket_number',
        't.title',
        'u.first_name',
        'u.last_name'
      );
    return {
      attachments: rows.map((r: any) => ({
        id: r.id,
        name: r.original_name,
        size: Number(r.file_size) || 0,
        type: r.mime_type,
        at: r.created_at,
        ticket: { id: r.ticket_id, number: r.ticket_number, title: r.title },
        by: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
      })),
    };
  }
}
