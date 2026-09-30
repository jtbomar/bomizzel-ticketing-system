import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { TicketStatus } from '../src/models/TicketStatus';
import { TicketAutoCloseJob } from '../src/services/TicketAutoCloseJob';
import { resetDatabase } from './helpers/db';

/**
 * Finishing tickets: resolving records why (fixed, won't do, duplicate),
 * reopening clears it, and resolved tickets close by themselves after 7 days.
 */
describe('ticket resolution and auto-close', () => {
  const SUB = '00000000-0000-4000-8000-00000000d001';
  const ACCOUNT = '00000000-0000-4000-8000-00000000d002';
  const AGENT = '00000000-0000-4000-8000-00000000d003';
  const CONTACT = '00000000-0000-4000-8000-00000000d004';
  const TEAM = '00000000-0000-4000-8000-00000000d005';
  const QUEUE = '00000000-0000-4000-8000-00000000d006';
  let token: string;

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
      { id: SUB, name: 'Sub', domain: 'sub-r.example.com' },
      { id: ACCOUNT, name: 'Account', domain: 'acct-r.example.com', subscriber_id: SUB },
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
      user(AGENT, 'agent@sub-r.example.com', 'employee'),
      user(CONTACT, 'c@acct-r.example.com', 'customer'),
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
      email: 'agent@sub-r.example.com',
      role: 'employee',
    });
  });

  it('records the reason when resolving, and clears it on reopening', async () => {
    const t = await newTicket('wont do this');
    const res = await setStatus(t.id, { status: 'resolved', resolution: 'wont_do' });
    expect(res.status).toBe(200);
    let row = await db('tickets').where('id', t.id).first();
    expect(row).toMatchObject({ status: 'resolved', resolution: 'wont_do' });
    expect(row.resolved_at).not.toBeNull();
    expect(res.body.data.resolution).toBe('wont_do');

    await setStatus(t.id, { status: 'open' });
    row = await db('tickets').where('id', t.id).first();
    expect(row).toMatchObject({ status: 'open', resolution: null });
  });

  it('resolving without a reason counts as fixed', async () => {
    const t = await newTicket('just fixed');
    await setStatus(t.id, { status: 'resolved' });
    expect((await db('tickets').where('id', t.id).first()).resolution).toBe('fixed');
  });

  it('refuses a reason that is not one of the options', async () => {
    const t = await newTicket('bad reason');
    const res = await setStatus(t.id, { status: 'resolved', resolution: 'because' });
    expect(res.status).toBe(400);
  });

  it('closes tickets resolved more than 7 days ago, keeping the reason', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const old = await newTicket('old dup', {
      status: 'resolved',
      resolution: 'duplicate',
      resolved_at: eightDaysAgo,
    });
    const recent = await newTicket('recent', {
      status: 'resolved',
      resolution: 'fixed',
      resolved_at: twoDaysAgo,
    });

    const closed = await TicketAutoCloseJob.run(7);
    expect(closed).toBeGreaterThanOrEqual(1);

    const oldRow = await db('tickets').where('id', old.id).first();
    expect(oldRow).toMatchObject({ status: 'closed', resolution: 'duplicate' });
    expect(oldRow.closed_at).not.toBeNull();
    expect((await db('tickets').where('id', recent.id).first()).status).toBe('resolved');

    const history = await db('ticket_history').where({ ticket_id: old.id, action: 'closed' });
    expect(history).toHaveLength(1);
    expect(history[0].metadata).toMatchObject({ automatic: true });
  });
});
