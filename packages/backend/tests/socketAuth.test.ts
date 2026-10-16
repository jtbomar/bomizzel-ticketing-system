import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as connect, Socket as ClientSocket } from 'socket.io-client';
import { db } from '../src/config/database';
import { JWTUtils } from '../src/utils/jwt';
import { notificationService } from '../src/services/NotificationService';
import { resetDatabase } from './helpers/db';

/**
 * Real-time notifications (off in production today: nothing starts the
 * socket server). Whoever switches them on gets this: a socket signs in with
 * an API token, not a user id it names itself, and only a company's staff can
 * watch its teams and queues.
 */
describe('notification sockets', () => {
  const SUB = '00000000-0000-4000-8000-0000000dd001';
  const OTHER = '00000000-0000-4000-8000-0000000dd002';
  const ACCT = '00000000-0000-4000-8000-0000000dd003';
  const AGENT = '00000000-0000-4000-8000-0000000dd004';
  const CUSTOMER = '00000000-0000-4000-8000-0000000dd005';
  const OUTSIDER = '00000000-0000-4000-8000-0000000dd006';
  const TEAM = '00000000-0000-4000-8000-0000000dd007';
  const QUEUE = '00000000-0000-4000-8000-0000000dd008';
  let http: HttpServer;
  let url: string;
  const open: ClientSocket[] = [];

  const token = (userId: string, role: string, tid: string) =>
    JWTUtils.generateAccessToken({ userId, email: `${userId}@x.example.com`, role, tid });

  const client = () => {
    const s = connect(url, { transports: ['websocket'], forceNew: true });
    open.push(s);
    return s;
  };
  const signIn = (s: ClientSocket, body: object) =>
    new Promise<any>((resolve) => {
      s.once('authenticated', resolve);
      s.emit('authenticate', body);
    });
  // A notification arrives within a moment, or not at all
  const receives = (s: ClientSocket) =>
    new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 300);
      s.once('notification', () => {
        clearTimeout(t);
        resolve(true);
      });
    });
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const ping = (room: 'user' | 'team' | 'queue', id: string) => {
    const n: any = { type: 'user:mention', data: {}, timestamp: new Date() };
    if (room === 'user') notificationService.notifyUser(id, n);
    if (room === 'team') notificationService.notifyTeam(id, n);
    if (room === 'queue') notificationService.notifyQueue(id, n);
  };

  beforeAll(async () => {
    await resetDatabase();
    await db('companies').insert([
      { id: SUB, name: 'Sub' },
      { id: OTHER, name: 'Other' },
      { id: ACCT, name: 'Acct', subscriber_id: SUB },
    ]);
    const user = (id: string, role: string) => ({
      id,
      email: `${id}@x.example.com`,
      password_hash: 'x',
      first_name: 'T',
      last_name: 'T',
      role,
      is_active: true,
      email_verified: true,
    });
    await db('users').insert([
      user(AGENT, 'employee'),
      user(CUSTOMER, 'customer'),
      user(OUTSIDER, 'admin'),
    ]);
    await db('user_company_associations').insert([
      { user_id: AGENT, company_id: SUB, role: 'member' },
      { user_id: CUSTOMER, company_id: ACCT, role: 'member' },
      { user_id: OUTSIDER, company_id: OTHER, role: 'owner' },
    ]);
    await db('teams').insert({ id: TEAM, name: 'Support', org_id: SUB });
    await db('queues').insert({
      id: QUEUE,
      name: 'Inbox',
      type: 'unassigned',
      team_id: TEAM,
      org_id: SUB,
    });

    http = createServer();
    notificationService.initialize(new Server(http));
    await new Promise<void>((r) => http.listen(0, r));
    url = `http://localhost:${(http.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    open.splice(0).forEach((s) => s.disconnect());
  });

  afterAll(async () => {
    await new Promise((r) => http.close(r));
  });

  it("can't sign in as someone by naming their id", async () => {
    const s = client();
    expect((await signIn(s, { userId: AGENT })).success).toBe(false);
    expect((await signIn(s, { userId: AGENT, token: 'forged' })).success).toBe(false);
    await settle();
    const got = receives(s);
    ping('user', AGENT);
    expect(await got).toBe(false);
  });

  it('gets their own notifications from their token, whatever id they claim', async () => {
    const s = client();
    const res = await signIn(s, { userId: OUTSIDER, token: token(AGENT, 'employee', SUB) });
    expect(res.success).toBe(true);
    await settle();

    const mine = receives(s);
    ping('user', AGENT);
    expect(await mine).toBe(true);

    const theirs = receives(s);
    ping('user', OUTSIDER);
    expect(await theirs).toBe(false);
  });

  it("staff can watch their own company's team and queue", async () => {
    const s = client();
    await signIn(s, { token: token(AGENT, 'employee', SUB) });
    s.emit('join_team', TEAM);
    s.emit('join_queue', QUEUE);
    await settle();

    const team = receives(s);
    ping('team', TEAM);
    expect(await team).toBe(true);
    const queue = receives(s);
    ping('queue', QUEUE);
    expect(await queue).toBe(true);
  });

  it("a ticket change reaches its company's staff and its customer, and nobody else", async () => {
    const [q] = await db('queues').where('id', QUEUE).select('id');
    const [t] = await db('tickets')
      .insert({
        title: 'Generator',
        description: 'd',
        submitter_id: CUSTOMER,
        company_id: ACCT,
        org_id: SUB,
        team_id: TEAM,
        queue_id: q.id,
        status: 'open',
        priority: 0,
      })
      .returning('id');
    const ticketId = t.id ?? t;

    const agent = client();
    const customer = client();
    const outsider = client();
    const anon = client();
    await signIn(agent, { token: token(AGENT, 'employee', SUB) });
    await signIn(customer, { token: token(CUSTOMER, 'customer', SUB) });
    await signIn(outsider, { token: token(OUTSIDER, 'admin', OTHER) });
    await settle();

    const changed = (s: ClientSocket) =>
      new Promise<any>((resolve) => {
        const timer = setTimeout(() => resolve(null), 400);
        s.once('ticket:changed', (e: any) => {
          clearTimeout(timer);
          resolve(e);
        });
      });
    const heard = [agent, customer, outsider, anon].map(changed);
    await notificationService.ticketChanged(ticketId, AGENT);
    const [a, c, o, n] = await Promise.all(heard);
    expect(a).toMatchObject({ ticketId, by: AGENT });
    expect(c).toMatchObject({ ticketId });
    // Only the id: no ticket data travels on the socket
    expect(Object.keys(a).sort()).toEqual(['at', 'by', 'ticketId']);
    expect(o).toBeNull();
    expect(n).toBeNull();
  });

  it("nobody else can: not signed in, another company's admin, or a customer", async () => {
    const anon = client();
    const outsider = client();
    const customer = client();
    await signIn(outsider, { token: token(OUTSIDER, 'admin', OTHER) });
    await signIn(customer, { token: token(CUSTOMER, 'customer', SUB) });
    for (const s of [anon, outsider, customer]) {
      s.emit('join_team', TEAM);
      s.emit('join_queue', QUEUE);
    }
    await settle();

    const heard = [anon, outsider, customer].map(receives);
    ping('team', TEAM);
    ping('queue', QUEUE);
    expect(await Promise.all(heard)).toEqual([false, false, false]);
  });
});
