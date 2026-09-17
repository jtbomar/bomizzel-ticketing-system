import { TicketService } from '../src/services/TicketService';
import { Ticket } from '../src/models/Ticket';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { Queue } from '../src/models/Queue';
import { Team } from '../src/models/Team';

// Listing tickets used to issue five queries per row - submitter, company,
// assignee, queue, team - run through Promise.all behind a ten-connection pool,
// plus a "count" that fetched every matching row and took .length of it. A
// fifty-row page took 24 seconds. These tests are about how many queries a page
// costs, so they count calls rather than touching a database.
const ticketRow = (i: number) => ({
  id: `ticket-${i}`,
  title: `Ticket ${i}`,
  description: 'x',
  status: 'open',
  priority: 'medium',
  // Deliberately few distinct related rows, as in real data: one company, a
  // couple of assignees. Enrichment must not re-fetch them per ticket.
  submitter_id: `user-${i % 3}`,
  assigned_to_id: `user-${i % 2}`,
  company_id: 'company-1',
  queue_id: 'queue-1',
  team_id: 'team-1',
  created_at: new Date(),
  updated_at: new Date(),
});

const row = (id: string) => ({ id, name: id, email: `${id}@test.com` });

describe('listing tickets', () => {
  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(User, 'findByIds').mockImplementation(async (ids: string[]) => ids.map(row));
    jest.spyOn(Company, 'findByIds').mockImplementation(async (ids: string[]) => ids.map(row));
    jest.spyOn(Queue, 'findByIds').mockImplementation(async (ids: string[]) => ids.map(row));
    jest.spyOn(Team, 'findByIds').mockImplementation(async (ids: string[]) => ids.map(row));

    for (const model of [User, Company, Queue, Team]) {
      jest.spyOn(model as any, 'toModel').mockImplementation((r: any) => r);
    }
    jest.spyOn(Ticket, 'toModel').mockImplementation((t: any) => t);
  });

  const listPageOf = async (size: number) => {
    const tickets = Array.from({ length: size }, (_, i) => ticketRow(i));
    jest.spyOn(Ticket, 'searchTickets').mockResolvedValue(tickets as any);
    const countTickets = jest.spyOn(Ticket, 'countTickets').mockResolvedValue(size);

    const result = await TicketService.getTickets('admin-1', 'admin', { limit: size });

    return { result, countTickets };
  };

  it('costs the same number of queries whether the page holds 1 ticket or 100', async () => {
    await listPageOf(1);
    const forOneRow = [User, Company, Queue, Team].reduce(
      (total, model) => total + (model.findByIds as jest.Mock).mock.calls.length,
      0
    );

    jest.clearAllMocks();

    await listPageOf(100);
    const forOneHundredRows = [User, Company, Queue, Team].reduce(
      (total, model) => total + (model.findByIds as jest.Mock).mock.calls.length,
      0
    );

    expect(forOneRow).toBe(4);
    expect(forOneHundredRows).toBe(4);
  });

  it('asks for each distinct related row once, not once per ticket', async () => {
    await listPageOf(100);

    // 100 tickets referencing user-0, user-1 and user-2 between them.
    expect((User.findByIds as jest.Mock).mock.calls[0][0].sort()).toEqual([
      'user-0',
      'user-1',
      'user-2',
    ]);
    expect((Company.findByIds as jest.Mock).mock.calls[0][0]).toEqual(['company-1']);
    expect((Queue.findByIds as jest.Mock).mock.calls[0][0]).toEqual(['queue-1']);
    expect((Team.findByIds as jest.Mock).mock.calls[0][0]).toEqual(['team-1']);
  });

  it('counts in the database instead of fetching every row to measure it', async () => {
    const { result, countTickets } = await listPageOf(10);

    expect(countTickets).toHaveBeenCalledTimes(1);
    // searchTickets is called once, for the page itself - not a second time
    // unbounded just to produce a total.
    expect((Ticket.searchTickets as jest.Mock).mock.calls).toHaveLength(1);
    expect(result.pagination.total).toBe(10);
  });

  it('still attaches the related records to each ticket', async () => {
    const { result } = await listPageOf(3);

    expect(result.data).toHaveLength(3);
    result.data.forEach((ticket: any, i: number) => {
      expect(ticket.submitter.id).toBe(`user-${i % 3}`);
      expect(ticket.assignedTo.id).toBe(`user-${i % 2}`);
      expect(ticket.company.id).toBe('company-1');
      expect(ticket.queue.id).toBe('queue-1');
      expect(ticket.team.id).toBe('team-1');
    });
  });

  it('returns an empty page without asking for any related rows', async () => {
    const { result } = await listPageOf(0);

    expect(result.data).toEqual([]);
    expect(User.findByIds).not.toHaveBeenCalled();
  });
});
