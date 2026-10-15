import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { db } from '@/config/database';
import { JWTUtils } from '@/utils/jwt';
import { isTokenRevoked } from '@/utils/tokenBlocklist';
import { resolveSession, Session } from '@/utils/session';
import { isStaff } from '@/utils/tenant';
import { Ticket, User, Queue, QueueMetrics } from '../types/models';

export interface NotificationPayload {
  type: string;
  data: any;
  userId?: string;
  teamId?: string;
  queueId?: string;
  timestamp: Date;
}

export interface TicketNotification extends NotificationPayload {
  type:
    | 'ticket:created'
    | 'ticket:updated'
    | 'ticket:assigned'
    | 'ticket:status_changed'
    | 'ticket:priority_changed';
  data: {
    ticket: Ticket;
    changes?: Record<string, { old: any; new: any }>;
    actor?: User | undefined;
  };
}

export interface QueueNotification extends NotificationPayload {
  type: 'queue:metrics_updated' | 'queue:ticket_added' | 'queue:ticket_removed';
  data: {
    queue: Queue;
    metrics?: QueueMetrics;
    ticket?: Ticket;
  };
}

export interface UserNotification extends NotificationPayload {
  type: 'user:ticket_assigned' | 'user:mention' | 'user:queue_updated' | 'user:usage_warning';
  data: {
    user: User;
    ticket?: Ticket;
    queue?: Queue;
    message?: string;
    warning?: any; // Usage warning data
  };
}

export type RealTimeNotification = TicketNotification | QueueNotification | UserNotification;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The session for an API access token, as `authenticate` works it out, or null. */
export const sessionForToken = async (token: unknown): Promise<Session | null> => {
  if (typeof token !== 'string' || !token) return null;
  const payload = JWTUtils.verifyAccessToken(token);
  if (!payload || (await isTokenRevoked(token))) return null;
  const user = await db('users')
    .where('id', payload.userId)
    .first('id', 'role', 'is_active', 'current_org_id', 'portal_scope');
  if (!user || !user.is_active) return null;
  return resolveSession(user, payload.tid, payload.aud);
};

/** May this session watch this team or queue: staff of the company that owns it. */
export const mayWatch = async (
  session: Session | undefined,
  table: 'teams' | 'queues',
  id: unknown
): Promise<boolean> => {
  if (!session?.tenantId || !isStaff(session) || typeof id !== 'string' || !UUID.test(id)) {
    return false;
  }
  return !!(await db(table).where({ id, org_id: session.tenantId }).first('id'));
};

class NotificationService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId

  initialize(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
    logger.info('NotificationService initialized');
  }

  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // Sign in with the same token as the API. The user id the client sends
      // is ignored: who they are, and which company and role, come from the
      // token (anyone could claim any id before and get that user's
      // notifications).
      socket.on('authenticate', async (data: { userId?: string; token?: string }) => {
        try {
          const session = await sessionForToken(data?.token);
          if (!session) {
            socket.emit('authenticated', { success: false, error: 'Authentication failed' });
            return;
          }
          const userId = session.userId;
          socket.data.session = session;

          // Store user-socket mapping
          if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
          }
          this.userSockets.get(userId)!.add(socket.id);
          this.socketUsers.set(socket.id, userId);

          // Join user-specific room
          socket.join(`user:${userId}`);

          logger.info(`User ${userId} authenticated on socket ${socket.id}`);
          socket.emit('authenticated', { success: true });
        } catch (error) {
          logger.error('Socket authentication failed:', error);
          socket.emit('authenticated', { success: false, error: 'Authentication failed' });
        }
      });

      // Team and queue rooms carry every ticket in them: staff of the
      // company that owns the team or queue only.
      socket.on('join_team', async (teamId: string) => {
        if (await mayWatch(socket.data.session, 'teams', teamId)) {
          socket.join(`team:${teamId}`);
          logger.info(`Socket ${socket.id} joined team room: ${teamId}`);
        }
      });

      socket.on('join_queue', async (queueId: string) => {
        if (await mayWatch(socket.data.session, 'queues', queueId)) {
          socket.join(`queue:${queueId}`);
          logger.info(`Socket ${socket.id} joined queue room: ${queueId}`);
        }
      });

      // Handle leaving rooms
      socket.on('leave_team', (teamId: string) => {
        socket.leave(`team:${teamId}`);
        logger.info(`Socket ${socket.id} left team room: ${teamId}`);
      });

      socket.on('leave_queue', (queueId: string) => {
        socket.leave(`queue:${queueId}`);
        logger.info(`Socket ${socket.id} left queue room: ${queueId}`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        const userId = this.socketUsers.get(socket.id);
        if (userId) {
          const userSocketSet = this.userSockets.get(userId);
          if (userSocketSet) {
            userSocketSet.delete(socket.id);
            if (userSocketSet.size === 0) {
              this.userSockets.delete(userId);
            }
          }
          this.socketUsers.delete(socket.id);
        }
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  // Send notification to specific user
  notifyUser(userId: string, notification: RealTimeNotification) {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('notification', notification);
    logger.info(`Notification sent to user ${userId}:`, notification.type);
  }

  // Send notification to all users in a team
  notifyTeam(teamId: string, notification: RealTimeNotification) {
    if (!this.io) return;

    this.io.to(`team:${teamId}`).emit('notification', notification);
    logger.info(`Notification sent to team ${teamId}:`, notification.type);
  }

  // Send notification to all users watching a queue
  notifyQueue(queueId: string, notification: RealTimeNotification) {
    if (!this.io) return;

    this.io.to(`queue:${queueId}`).emit('notification', notification);
    logger.info(`Notification sent to queue ${queueId}:`, notification.type);
  }

  // Ticket-related notifications
  notifyTicketCreated(ticket: Ticket, actor?: User) {
    const notification: TicketNotification = {
      type: 'ticket:created',
      data: { ticket, actor },
      teamId: ticket.teamId,
      queueId: ticket.queueId,
      timestamp: new Date(),
    };

    // Notify team members
    this.notifyTeam(ticket.teamId, notification);

    // Notify queue watchers
    this.notifyQueue(ticket.queueId, notification);
  }

  notifyTicketAssigned(ticket: Ticket, assignedTo: User, actor?: User) {
    const notification: TicketNotification = {
      type: 'ticket:assigned',
      data: { ticket, actor },
      userId: assignedTo.id,
      teamId: ticket.teamId,
      queueId: ticket.queueId,
      timestamp: new Date(),
    };

    // Notify the assigned user
    this.notifyUser(assignedTo.id, notification);

    // Notify team members
    this.notifyTeam(ticket.teamId, notification);

    // Notify queue watchers
    this.notifyQueue(ticket.queueId, notification);
  }

  notifyTicketStatusChanged(ticket: Ticket, oldStatus: string, newStatus: string, actor?: User) {
    const notification: TicketNotification = {
      type: 'ticket:status_changed',
      data: {
        ticket,
        changes: { status: { old: oldStatus, new: newStatus } },
        actor,
      },
      teamId: ticket.teamId,
      queueId: ticket.queueId,
      timestamp: new Date(),
    };

    // Notify assigned user if exists
    if (ticket.assignedToId) {
      this.notifyUser(ticket.assignedToId, notification);
    }

    // Notify team members
    this.notifyTeam(ticket.teamId, notification);

    // Notify queue watchers
    this.notifyQueue(ticket.queueId, notification);
  }

  notifyTicketPriorityChanged(
    ticket: Ticket,
    oldPriority: number,
    newPriority: number,
    actor?: User
  ) {
    const notification: TicketNotification = {
      type: 'ticket:priority_changed',
      data: {
        ticket,
        changes: { priority: { old: oldPriority, new: newPriority } },
        actor,
      },
      teamId: ticket.teamId,
      queueId: ticket.queueId,
      timestamp: new Date(),
    };

    // Notify assigned user if exists
    if (ticket.assignedToId) {
      this.notifyUser(ticket.assignedToId, notification);
    }

    // Notify team members
    this.notifyTeam(ticket.teamId, notification);

    // Notify queue watchers
    this.notifyQueue(ticket.queueId, notification);
  }

  notifyTicketUpdated(
    ticket: Ticket,
    changes: Record<string, { old: any; new: any }>,
    actor?: User
  ) {
    const notification: TicketNotification = {
      type: 'ticket:updated',
      data: { ticket, changes, actor },
      teamId: ticket.teamId,
      queueId: ticket.queueId,
      timestamp: new Date(),
    };

    // Notify assigned user if exists
    if (ticket.assignedToId) {
      this.notifyUser(ticket.assignedToId, notification);
    }

    // Notify team members
    this.notifyTeam(ticket.teamId, notification);

    // Notify queue watchers
    this.notifyQueue(ticket.queueId, notification);
  }

  // Queue-related notifications
  notifyQueueMetricsUpdated(queue: Queue, metrics: QueueMetrics) {
    const notification: QueueNotification = {
      type: 'queue:metrics_updated',
      data: { queue, metrics },
      queueId: queue.id,
      teamId: queue.teamId,
      timestamp: new Date(),
    };

    // Notify queue watchers
    this.notifyQueue(queue.id, notification);

    // Notify team members
    this.notifyTeam(queue.teamId, notification);
  }

  // User-related notifications
  notifyUserTicketAssigned(user: User, ticket: Ticket) {
    const notification: UserNotification = {
      type: 'user:ticket_assigned',
      data: { user, ticket },
      userId: user.id,
      timestamp: new Date(),
    };

    this.notifyUser(user.id, notification);
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  // Get user's socket count
  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
