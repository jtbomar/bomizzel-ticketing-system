/**
 * Saved views of the ticket board (GET /views): which tickets a view shows.
 * A ticket must match every condition; within a condition, any of its values.
 */

export interface ViewCondition {
  field: string; // status | priority | assignee | department | account | channel | product | created | keywords | cf:<key>
  values: string[];
}

export interface SavedView {
  id: string;
  name: string;
  shared: boolean;
  conditions: ViewCondition[];
}

/** The parts of a board ticket that views look at. */
export interface ViewableTicket {
  status: string;
  priorityLevel?: number;
  assignedToId?: string | null;
  departmentId?: number | null;
  productId?: number | null;
  source?: string;
  createdAt?: string;
  title?: string;
  description?: string;
  customerInfo?: { companyId?: string };
  customFieldValues?: Record<string, unknown>;
}

const DAY = 86400000;

export const ticketMatchesView = (
  ticket: ViewableTicket,
  conditions: ViewCondition[],
  ctx: { userId?: string; textFields?: Set<string>; now?: Date }
): boolean => {
  const now = (ctx.now || new Date()).getTime();
  return conditions.every(({ field, values }) => {
    switch (field) {
      case 'status':
        return values.includes(ticket.status);
      case 'priority':
        return values.includes(String(ticket.priorityLevel ?? 0));
      case 'assignee':
        return values.some((v) =>
          v === 'unassigned'
            ? !ticket.assignedToId
            : v === 'me'
              ? !!ctx.userId && ticket.assignedToId === ctx.userId
              : ticket.assignedToId === v
        );
      case 'department':
        return values.includes(String(ticket.departmentId ?? ''));
      case 'product':
        return values.includes(String(ticket.productId ?? ''));
      case 'account':
        return values.includes(ticket.customerInfo?.companyId || '');
      case 'channel':
        return values.includes(ticket.source || 'web');
      case 'created': {
        const at = ticket.createdAt ? new Date(ticket.createdAt).getTime() : NaN;
        if (Number.isNaN(at)) return false;
        if (values[0] === 'today')
          return new Date(at).toDateString() === new Date(now).toDateString();
        const days = values[0] === '7d' ? 7 : 30;
        return now - at <= days * DAY;
      }
      case 'keywords': {
        const text = `${ticket.title || ''} ${ticket.description || ''}`.toLowerCase();
        return values.some((w) => text.includes(w.toLowerCase()));
      }
      default: {
        if (!field.startsWith('cf:')) return true;
        const key = field.slice(3);
        const value = ticket.customFieldValues?.[key];
        if (value === undefined || value === null || value === '') return false;
        const have = (Array.isArray(value) ? value : [value]).map((v) => String(v).toLowerCase());
        const want = values.map((v) => v.toLowerCase());
        return ctx.textFields?.has(key)
          ? have.some((h) => want.some((w) => h.includes(w)))
          : have.some((h) => want.includes(h));
      }
    }
  });
};
