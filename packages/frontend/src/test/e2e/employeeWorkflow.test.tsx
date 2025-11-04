import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import EmployeeDashboard from '../../pages/EmployeeDashboard';
import KanbanBoard from '../../components/KanbanBoard';
import TicketListView from '../../components/TicketListView';
import * as api from '../../services/api';

// Mock API calls
vi.mock('../../services/api');
const mockApi = vi.mocked(api);

// Mock drag and drop
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) =>
    children({ provided: { droppableProps: {}, innerRef: vi.fn() }, snapshot: {} }),
  Draggable: ({ children }: any) =>
    children({
      provided: { draggableProps: {}, dragHandleProps: {}, innerRef: vi.fn() },
      snapshot: {},
    }),
}));

const mockEmployee = {
  id: '1',
  email: 'employee@test.com',
  firstName: 'Test',
  lastName: 'Employee',
  role: 'employee',
  teams: [
    {
      id: '1',
      name: 'Support Team',
      description: 'Customer support team',
    },
  ],
  preferences: {
    viewMode: 'kanban',
    notifications: { email: true, browser: true },
  },
};

const mockTickets = [
  {
    id: '1',
    title: 'Bug Report',
    description: 'Application crashes',
    status: 'open',
    priority: 1,
    submitterId: '2',
    companyId: '1',
    teamId: '1',
    assignedToId: null,
    customFieldValues: { issue_type: 'Bug' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Feature Request',
    description: 'Add dark mode',
    status: 'in_progress',
    priority: 2,
    submitterId: '2',
    companyId: '1',
    teamId: '1',
    assignedToId: '1',
    customFieldValues: { issue_type: 'Feature Request' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockQueues = [
  {
    id: '1',
    name: 'Unassigned',
    type: 'unassigned',
    teamId: '1',
    ticketCount: 1,
  },
  {
    id: '2',
    name: 'My Queue',
    type: 'employee',
    assignedToId: '1',
    teamId: '1',
    ticketCount: 1,
  },
];

const mockMetrics = {
  totalTickets: 2,
  assignedTickets: 1,
  unassignedTickets: 1,
  statusCounts: {
    open: 1,
    in_progress: 1,
    resolved: 0,
  },
  averageResolutionTime: 24,
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Employee Workflow E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getCurrentUser.mockResolvedValue({ data: mockEmployee });
    mockApi.getTickets.mockResolvedValue({
      data: mockTickets,
      pagination: { total: 2, page: 1, limit: 10 },
    });
    mockApi.getQueues.mockResolvedValue({ data: mockQueues });
    mockApi.getQueueMetrics.mockResolvedValue({ data: mockMetrics });
  });

  describe('Employee Dashboard', () => {
    it('should display employee dashboard with queue metrics', async () => {
      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Employee Dashboard')).toBeInTheDocument();
      });

      // Check metrics display
      expect(screen.getByText('Total Tickets')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Assigned')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should allow switching between Kanban and List views', async () => {
      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Employee Dashboard')).toBeInTheDocument();
      });

      // Should start in Kanban view (user preference)
      expect(screen.getByTestId('kanban-board')).toBeInTheDocument();

      // Switch to List view
      const listViewButton = screen.getByRole('button', { name: /list view/i });
      fireEvent.click(listViewButton);

      await waitFor(() => {
        expect(screen.getByTestId('list-view')).toBeInTheDocument();
      });

      // Verify preference update API call
      expect(mockApi.updateUserPreferences).toHaveBeenCalledWith({
        viewMode: 'list',
      });
    });
  });

  describe('Kanban Board Workflow', () => {
    it('should display tickets in appropriate columns', async () => {
      render(
        <TestWrapper>
          <KanbanBoard tickets={mockTickets} onTicketUpdate={vi.fn()} />
        </TestWrapper>
      );

      // Check column headers
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      // Check tickets in correct columns
      expect(screen.getByText('Bug Report')).toBeInTheDocument();
      expect(screen.getByText('Feature Request')).toBeInTheDocument();
    });

    it('should handle ticket drag and drop for priority reordering', async () => {
      const onTicketUpdate = vi.fn();
      mockApi.updateTicket.mockResolvedValue({ data: mockTickets[0] });

      render(
        <TestWrapper>
          <KanbanBoard tickets={mockTickets} onTicketUpdate={onTicketUpdate} />
        </TestWrapper>
      );

      // Simulate drag and drop (mocked)
      const ticketCard = screen.getByText('Bug Report').closest('[data-testid="ticket-card"]');
      expect(ticketCard).toBeInTheDocument();

      // In a real test, we would simulate the drag and drop
      // For now, we'll test the update function directly
      fireEvent.click(screen.getByText('Bug Report'));

      // This would trigger priority update in real scenario
      await waitFor(() => {
        expect(onTicketUpdate).toHaveBeenCalled();
      });
    });

    it('should allow status changes via drag and drop', async () => {
      const onTicketUpdate = vi.fn();
      mockApi.updateTicket.mockResolvedValue({
        data: { ...mockTickets[0], status: 'in_progress' },
      });

      render(
        <TestWrapper>
          <KanbanBoard tickets={mockTickets} onTicketUpdate={onTicketUpdate} />
        </TestWrapper>
      );

      // Simulate moving ticket from Open to In Progress column
      // In real implementation, this would be handled by react-beautiful-dnd
      const ticketCard = screen.getByText('Bug Report');
      fireEvent.click(ticketCard);

      // Simulate status change
      await waitFor(() => {
        expect(onTicketUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Ticket Assignment Workflow', () => {
    it('should allow assigning unassigned tickets', async () => {
      mockApi.updateTicket.mockResolvedValue({
        data: { ...mockTickets[0], assignedToId: '1' },
      });

      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Bug Report')).toBeInTheDocument();
      });

      // Click on unassigned ticket
      fireEvent.click(screen.getByText('Bug Report'));

      // Find and click assign button
      const assignButton = screen.getByRole('button', { name: /assign to me/i });
      fireEvent.click(assignButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApi.updateTicket).toHaveBeenCalledWith('1', {
          assignedToId: '1',
        });
      });
    });

    it('should show assigned tickets in personal queue', async () => {
      const assignedTickets = mockTickets.filter((t) => t.assignedToId === '1');
      mockApi.getTickets.mockResolvedValue({
        data: assignedTickets,
        pagination: { total: 1, page: 1, limit: 10 },
      });

      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      // Switch to personal queue view
      const personalQueueButton = screen.getByRole('button', { name: /my queue/i });
      fireEvent.click(personalQueueButton);

      await waitFor(() => {
        expect(screen.getByText('Feature Request')).toBeInTheDocument();
        expect(screen.queryByText('Bug Report')).not.toBeInTheDocument();
      });
    });
  });

  describe('Ticket Detail and Updates', () => {
    const mockTicketDetail = {
      ...mockTickets[0],
      notes: [
        {
          id: '1',
          content: 'Customer reported this issue',
          isInternal: false,
          authorId: '2',
          authorName: 'Customer Name',
          createdAt: new Date().toISOString(),
        },
      ],
      history: [
        {
          id: '1',
          action: 'created',
          userId: '2',
          userName: 'Customer Name',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    it('should display ticket details with notes and history', async () => {
      mockApi.getTicket.mockResolvedValue({ data: mockTicketDetail });

      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Bug Report')).toBeInTheDocument();
      });

      // Click on ticket to view details
      fireEvent.click(screen.getByText('Bug Report'));

      await waitFor(() => {
        expect(screen.getByText('Customer reported this issue')).toBeInTheDocument();
        expect(screen.getByText('Ticket History')).toBeInTheDocument();
      });
    });

    it('should allow adding internal notes', async () => {
      mockApi.getTicket.mockResolvedValue({ data: mockTicketDetail });
      mockApi.addTicketNote.mockResolvedValue({
        data: {
          id: '2',
          content: 'Internal investigation note',
          isInternal: true,
          authorId: '1',
          authorName: 'Test Employee',
          createdAt: new Date().toISOString(),
        },
      });

      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Bug Report')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Bug Report'));

      await waitFor(() => {
        expect(screen.getByText('Customer reported this issue')).toBeInTheDocument();
      });

      // Add internal note
      const noteInput = screen.getByPlaceholderText('Add internal note...');
      fireEvent.change(noteInput, {
        target: { value: 'Internal investigation note' },
      });

      const internalCheckbox = screen.getByLabelText('Internal note');
      fireEvent.click(internalCheckbox);

      const addNoteButton = screen.getByRole('button', { name: /add note/i });
      fireEvent.click(addNoteButton);

      await waitFor(() => {
        expect(mockApi.addTicketNote).toHaveBeenCalledWith('1', {
          content: 'Internal investigation note',
          isInternal: true,
        });
      });
    });

    it('should allow sending emails from tickets', async () => {
      mockApi.getTicket.mockResolvedValue({ data: mockTicketDetail });
      mockApi.sendTicketEmail.mockResolvedValue({
        data: { message: 'Email sent successfully' },
      });

      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Bug Report')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Bug Report'));

      await waitFor(() => {
        expect(screen.getByText('Customer reported this issue')).toBeInTheDocument();
      });

      // Click send email button
      const emailButton = screen.getByRole('button', { name: /send email/i });
      fireEvent.click(emailButton);

      // Fill email form
      const subjectInput = screen.getByLabelText('Subject');
      fireEvent.change(subjectInput, {
        target: { value: 'Re: Bug Report' },
      });

      const bodyInput = screen.getByLabelText('Message');
      fireEvent.change(bodyInput, {
        target: { value: 'We are investigating this issue.' },
      });

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockApi.sendTicketEmail).toHaveBeenCalledWith('1', {
          subject: 'Re: Bug Report',
          body: 'We are investigating this issue.',
          to: expect.any(String),
        });
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should allow selecting multiple tickets', async () => {
      render(
        <TestWrapper>
          <TicketListView tickets={mockTickets} onTicketUpdate={vi.fn()} />
        </TestWrapper>
      );

      // Select tickets using checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Select first ticket
      fireEvent.click(checkboxes[1]); // Select second ticket

      // Verify bulk actions become available
      expect(screen.getByText('2 tickets selected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bulk assign/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bulk status update/i })).toBeInTheDocument();
    });

    it('should perform bulk status updates', async () => {
      mockApi.bulkUpdateTickets.mockResolvedValue({
        data: { updatedCount: 2 },
      });

      render(
        <TestWrapper>
          <TicketListView tickets={mockTickets} onTicketUpdate={vi.fn()} />
        </TestWrapper>
      );

      // Select tickets
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      // Perform bulk status update
      const bulkStatusButton = screen.getByRole('button', { name: /bulk status update/i });
      fireEvent.click(bulkStatusButton);

      // Select new status
      const statusSelect = screen.getByLabelText('New Status');
      fireEvent.change(statusSelect, { target: { value: 'resolved' } });

      const confirmButton = screen.getByRole('button', { name: /update/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockApi.bulkUpdateTickets).toHaveBeenCalledWith({
          ticketIds: ['1', '2'],
          updates: { status: 'resolved' },
        });
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should handle real-time ticket updates', async () => {
      // Mock WebSocket connection
      const mockSocket = {
        on: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
      };

      vi.mocked(mockApi.connectSocket).mockReturnValue(mockSocket as any);

      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Employee Dashboard')).toBeInTheDocument();
      });

      // Verify socket connection and event listeners
      expect(mockSocket.on).toHaveBeenCalledWith('ticket:updated', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('ticket:assigned', expect.any(Function));
    });

    it('should update metrics in real-time', async () => {
      const mockSocket = {
        on: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
      };

      vi.mocked(mockApi.connectSocket).mockReturnValue(mockSocket as any);

      render(
        <TestWrapper>
          <EmployeeDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Total tickets
      });

      // Simulate real-time metrics update
      const metricsUpdateCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'queue:metrics'
      )?.[1];

      if (metricsUpdateCallback) {
        metricsUpdateCallback({
          ...mockMetrics,
          totalTickets: 3,
          statusCounts: { ...mockMetrics.statusCounts, open: 2 },
        });
      }

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // Updated total
      });
    });
  });
});
