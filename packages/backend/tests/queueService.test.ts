import { QueueService } from '@/services/QueueService';
import { Queue } from '@/models/Queue';
import { Team } from '@/models/Team';
import { User } from '@/models/User';
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors';

// Mock the models
jest.mock('@/models/Queue');
jest.mock('@/models/Team');
jest.mock('@/models/User');

const MockedQueue = Queue as jest.Mocked<typeof Queue>;
const MockedTeam = Team as jest.Mocked<typeof Team>;
const MockedUser = User as jest.Mocked<typeof User>;

describe('QueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createQueue', () => {
    const mockQueueData = {
      name: 'Test Queue',
      description: 'Test Description',
      type: 'unassigned' as const,
      teamId: 'team-123',
    };

    const mockTeam = {
      id: 'team-123',
      name: 'Test Team',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockCreatedQueue = {
      id: 'queue-123',
      name: 'Test Queue',
      description: 'Test Description',
      type: 'unassigned',
      team_id: 'team-123',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should create queue successfully for admin', async () => {
      MockedTeam.findById.mockResolvedValue(mockTeam);
      MockedQueue.findByTeam.mockResolvedValue([]);
      MockedQueue.createQueue.mockResolvedValue(mockCreatedQueue);
      MockedQueue.toModel.mockReturnValue({
        id: 'queue-123',
        name: 'Test Queue',
        description: 'Test Description',
        type: 'unassigned',
        teamId: 'team-123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await QueueService.createQueue(mockQueueData, 'user-123', 'admin');

      expect(result.name).toBe('Test Queue');
      expect(MockedQueue.createQueue).toHaveBeenCalledWith(mockQueueData);
    });

    it('should throw ForbiddenError for customers', async () => {
      await expect(QueueService.createQueue(mockQueueData, 'user-123', 'customer')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw NotFoundError for invalid team', async () => {
      MockedTeam.findById.mockResolvedValue(null);

      await expect(QueueService.createQueue(mockQueueData, 'user-123', 'admin')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ValidationError for duplicate queue name', async () => {
      MockedTeam.findById.mockResolvedValue(mockTeam);
      MockedQueue.findByTeam.mockResolvedValue([
        { ...mockCreatedQueue, name: 'test queue' }, // Case insensitive match
      ]);

      await expect(QueueService.createQueue(mockQueueData, 'user-123', 'admin')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getQueueMetrics', () => {
    const mockQueue = {
      id: 'queue-123',
      name: 'Test Queue',
      team_id: 'team-123',
      type: 'unassigned',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should return queue metrics for authorized user', async () => {
      MockedQueue.findById.mockResolvedValue(mockQueue);
      MockedUser.getUserTeams.mockResolvedValue([
        { userId: 'user-123', teamId: 'team-123', role: 'member', createdAt: new Date() },
      ]);

      // Mock the database query for metrics
      const mockDb = {
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          total_tickets: '10',
          open_tickets: '5',
          assigned_tickets: '3',
          resolved_tickets: '2',
        }),
        count: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'open', count: '5' },
          { status: 'in_progress', count: '3' },
          { status: 'resolved', count: '2' },
        ]),
        whereNotNull: jest.fn().mockReturnThis(),
      };

      MockedQueue.db = jest.fn().mockReturnValue(mockDb);

      const result = await QueueService.getQueueMetrics('queue-123', 'user-123', 'employee');

      expect(result.queueId).toBe('queue-123');
      expect(result.queueName).toBe('Test Queue');
      expect(result.totalTickets).toBe(10);
      expect(result.openTickets).toBe(5);
    });

    it('should throw NotFoundError for invalid queue', async () => {
      MockedQueue.findById.mockResolvedValue(null);

      await expect(
        QueueService.getQueueMetrics('invalid-queue', 'user-123', 'employee')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('assignQueue', () => {
    const mockQueue = {
      id: 'queue-123',
      name: 'Test Queue',
      team_id: 'team-123',
      type: 'unassigned',
      assigned_to_id: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockAssignee = {
      id: 'assignee-123',
      role: 'employee',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should assign queue to employee successfully', async () => {
      MockedQueue.findById.mockResolvedValue(mockQueue);
      MockedUser.getUserTeams.mockResolvedValueOnce([
        { userId: 'user-123', teamId: 'team-123', role: 'lead', createdAt: new Date() },
      ]);
      MockedUser.findById.mockResolvedValue(mockAssignee);
      MockedUser.getUserTeams.mockResolvedValueOnce([
        { userId: 'assignee-123', teamId: 'team-123', role: 'member', createdAt: new Date() },
      ]);
      MockedQueue.assignToEmployee.mockResolvedValue({
        ...mockQueue,
        assigned_to_id: 'assignee-123',
        type: 'employee',
      });
      MockedQueue.toModel.mockReturnValue({
        id: 'queue-123',
        name: 'Test Queue',
        type: 'employee',
        assignedToId: 'assignee-123',
        teamId: 'team-123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await QueueService.assignQueue(
        'queue-123',
        'assignee-123',
        'user-123',
        'employee'
      );

      expect(result.assignedToId).toBe('assignee-123');
      expect(MockedQueue.assignToEmployee).toHaveBeenCalledWith('queue-123', 'assignee-123');
    });

    it('should throw ValidationError for customer assignee', async () => {
      MockedQueue.findById.mockResolvedValue(mockQueue);
      MockedUser.getUserTeams.mockResolvedValue([
        { userId: 'user-123', teamId: 'team-123', role: 'lead', createdAt: new Date() },
      ]);
      MockedUser.findById.mockResolvedValue({
        ...mockAssignee,
        role: 'customer',
      });

      await expect(
        QueueService.assignQueue('queue-123', 'assignee-123', 'user-123', 'employee')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getFilteredQueues', () => {
    it('should return filtered queues with sorting', async () => {
      const mockQueues = [
        {
          id: 'queue-1',
          name: 'Alpha Queue',
          team_id: 'team-123',
          type: 'unassigned',
          is_active: true,
          created_at: new Date('2023-01-01'),
          updated_at: new Date(),
        },
        {
          id: 'queue-2',
          name: 'Beta Queue',
          team_id: 'team-123',
          type: 'employee',
          is_active: true,
          created_at: new Date('2023-01-02'),
          updated_at: new Date(),
        },
      ];

      MockedUser.getUserTeams.mockResolvedValue([
        { userId: 'user-123', teamId: 'team-123', role: 'member', createdAt: new Date() },
      ]);
      MockedQueue.findByTeam.mockResolvedValue(mockQueues);

      // Mock ticket count queries
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest
          .fn()
          .mockResolvedValueOnce({ count: '5' }) // First queue
          .mockResolvedValueOnce({ count: '3' }), // Second queue
      };
      MockedQueue.db = jest.fn().mockReturnValue(mockDb);
      MockedQueue.toModel.mockImplementation((queue) => ({
        id: queue.id,
        name: queue.name,
        type: queue.type,
        teamId: queue.team_id,
        isActive: queue.is_active,
        createdAt: queue.created_at,
        updatedAt: queue.updated_at,
      }));

      const result = await QueueService.getFilteredQueues('user-123', 'employee', {
        teamId: 'team-123',
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alpha Queue');
      expect(result[1].name).toBe('Beta Queue');
    });
  });
});
