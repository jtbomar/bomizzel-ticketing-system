import { describe, it, expect } from 'vitest';
import { ticketMatchesView } from '../../utils/views';

const now = new Date('2026-10-02T12:00:00Z');
const ticket = {
  status: 'open',
  priorityLevel: 3,
  assignedToId: 'me-id',
  departmentId: 2,
  productId: 7,
  source: 'email',
  createdAt: '2026-09-28T09:00:00Z',
  title: 'Refund for invoice 42',
  description: 'Please refund',
  customerInfo: { companyId: 'acme' },
  customFieldValues: { cf_kind: 'Hardware', cf_tags: ['vip', 'urgent'], cf_serial: 'SN-123' },
};
const match = (conditions: any[]) =>
  ticketMatchesView(ticket, conditions, {
    userId: 'me-id',
    textFields: new Set(['cf_serial']),
    now,
  });

describe('saved views', () => {
  it('matches every condition, and any value within one', () => {
    expect(match([])).toBe(true);
    expect(match([{ field: 'status', values: ['open', 'waiting'] }])).toBe(true);
    expect(match([{ field: 'status', values: ['resolved'] }])).toBe(false);
    expect(
      match([
        { field: 'status', values: ['open'] },
        { field: 'priority', values: ['0'] },
      ])
    ).toBe(false);
  });

  it('knows me and unassigned', () => {
    expect(match([{ field: 'assignee', values: ['me'] }])).toBe(true);
    expect(match([{ field: 'assignee', values: ['unassigned'] }])).toBe(false);
    expect(
      ticketMatchesView(
        { ...ticket, assignedToId: null },
        [{ field: 'assignee', values: ['unassigned'] }],
        { userId: 'me-id' }
      )
    ).toBe(true);
  });

  it('matches department, product, account, channel and words', () => {
    expect(match([{ field: 'department', values: ['2'] }])).toBe(true);
    expect(match([{ field: 'product', values: ['8'] }])).toBe(false);
    expect(match([{ field: 'account', values: ['acme'] }])).toBe(true);
    expect(match([{ field: 'channel', values: ['web'] }])).toBe(false);
    expect(match([{ field: 'keywords', values: ['INVOICE'] }])).toBe(true);
  });

  it('matches how long ago it came in', () => {
    expect(match([{ field: 'created', values: ['7d'] }])).toBe(true);
    expect(match([{ field: 'created', values: ['today'] }])).toBe(false);
    expect(match([{ field: 'created', values: ['30d'] }])).toBe(true);
  });

  it('matches custom fields: choices exactly, text by words', () => {
    expect(match([{ field: 'cf:cf_kind', values: ['hardware'] }])).toBe(true);
    expect(match([{ field: 'cf:cf_tags', values: ['vip'] }])).toBe(true);
    expect(match([{ field: 'cf:cf_tags', values: ['billing'] }])).toBe(false);
    expect(match([{ field: 'cf:cf_serial', values: ['sn-'] }])).toBe(true);
    expect(match([{ field: 'cf:cf_missing', values: ['x'] }])).toBe(false);
  });
});
