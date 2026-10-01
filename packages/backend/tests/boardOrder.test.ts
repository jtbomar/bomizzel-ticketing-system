import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { resetDatabase } from './helpers/db';

/**
 * Board order: dragging a ticket above another is saved, for the user's own
 * subscriber only, and comes back on the ticket list.
 */
describe('board order', () => {
  const SUB = '00000000-0000-4000-8000-00000000f001';
  const ACCOUNT = '00000000-0000-4000-8000-00000000f002';
  const AGENT = '00000000-0000-4000-8000-00000000f003';
  const CONTACT = '00000000-0000-4000-8000-00000000f004';
  const TEAM = '00000000-0000-4000-8000-00000000f005';
  const QUEUE = '00000000-0000-4000-8000-00000000f006';
  let token: string;
  let contactToken: string;

  const newTicket = async (title: string, extra: Record<string, unknown> = {}) => {
    const [row] = await db('tickets')
      .insert({
        title,
        description: 'd',
        submitter_id: CONTACT,
        company_id: ACCOUNT,
        org_id: SUB,
        team_id: TEAM,
        queue_id: QUEUE,
        status: 'open',
        priority: 0,
        ...extra,
      })
      .returning('*');
    return row;
  };
  const setStatus = (id: string, body: Record<string, unknown>) =>
    request(app)
      .put(`/api/tickets/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub', domain: 'sub-o.example.com' },
      { id: ACCOUNT, name: 'Account', domain: 'acct-o.example.com', subscriber_id: SUB },
    ]);
    const user = (id: string, email: string, role: string) => ({
      id,
      email,
      password_hash: 'x',
      first_name: role,
      last_name: 'T',
      role,
      is_active: true,
      email_verified: true,
      current_org_id: SUB,
    });
    await db('users').insert([
      user(AGENT, 'agent@sub-o.example.com', 'employee'),
      user(CONTACT, 'c@acct-o.example.com', 'customer'),
    ]);
    await db('user_company_associations').insert([
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: CONTACT, company_id: ACCOUNT, role: 'member' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await db('team_memberships').insert({ user_id: AGENT, team_id: TEAM, role: 'member' });
    await TicketStatus.seedDefaultStatuses(TEAM);
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });
    token = JWTUtils.generateAccessToken({
      userId: AGENT,
      email: 'agent@sub-o.example.com',
      role: 'employee',
    });
    contactToken = JWTUtils.generateAccessToken({
      userId: CONTACT,
      email: 'c@acct-o.example.com',
      role: 'customer',
    });
  });

  const saveOrder = (ids: string[], as = token) =>
    request(app)
      .put('/api/tickets/board-order')
      .set('Authorization', `Bearer ${as}`)
      .send({ ticketIds: ids });

  it('saves the order and returns it with the tickets', async () => {
    const a = await newTicket('A');
    const b = await newTicket('B');
    const c = await newTicket('C');
    const res = await saveOrder([c.id, a.id, b.id]);
    expect(res.status).toBe(200);
    const rows = await db('tickets').whereIn('id', [a.id, b.id, c.id]);
    const pos = Object.fromEntries(rows.map((r: any) => [r.title, r.board_position]));
    expect(pos).toEqual({ C: 1, A: 2, B: 3 });

    const list = await request(app).get('/api/tickets').set('Authorization', `Bearer ${token}`);
    const listed = (list.body.data || list.body.tickets || list.body).find(
      (t: any) => t.id === c.id
    );
    expect(listed.boardPosition).toBe(1);
  });

  it("ignores another subscriber's tickets", async () => {
    const OTHER = '00000000-0000-4000-8000-00000000f0aa';
    await db('companies').insert({ id: OTHER, name: 'Other', domain: 'other-o.example.com' });
    const theirs = await newTicket('theirs', {
      company_id: OTHER,
      org_id: OTHER,
      board_position: 7,
    });
    const res = await saveOrder([theirs.id]);
    expect(res.status).toBe(200);
    expect((await db('tickets').where('id', theirs.id).first()).board_position).toBe(7);
  });

  it('is for staff only and checks the ids', async () => {
    const t = await newTicket('D');
    expect((await saveOrder([t.id], contactToken)).status).toBe(403);
    expect((await saveOrder(['not-an-id'])).status).toBe(400);
  });
});
