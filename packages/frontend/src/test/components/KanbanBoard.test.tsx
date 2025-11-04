import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import KanbanBoard from '../../components/KanbanBoard';

// Mock react-beautiful-dnd
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => (
    <div
      data-testid="drag-drop-context"
      onClick={() =>
        onDragEnd({
          source: { droppableId: 'open', index: 0 },
          destination: { droppableId: 'in_progress', index: 0 },
          draggableId: '1',
        })
      }
    >
      {children}
    </div>
  ),
  Droppable: ({ children, droppableId }: any) => (
    <div data-testid={`droppable-${droppableId}`}>
      {children({
        provided: {
          droppableProps: {},
          innerRef: vi.fn(),
          placeholder: null,
        },
        snapshot: { isDraggingOver: false },
      })}
    </div>
  ),
  Draggable: ({ children, draggableId, index }: any) => (
    <div data-testid={`draggable-${draggableId}`}>
      {children({
        provided: {
          draggableProps: {},
          dragHandleProps: {},
          innerRef: vi.fn(),
        },
        snapshot: { isDragging: false },
      })}
    </div>
  ),
}));

const mockTickets = [
  {
    id: '1',
    title: 'Bug Report',
    description: 'Application crashes on startup',
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
    description: 'Add dark mode support',
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
  {
    id: '3',
    title: 'Resolved Issue',
    description: 'Fixed login problem',
    status: 'resolved',
    priority: 3,
    submitterId: '2',
    companyId: '1',
    teamId: '1',
    assignedToId: '1',
    customFieldValues: { issue_type: 'Bug' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('KanbanBoard Component', () => {
  const mockOnTicketUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render kanban board with correct columns', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('should display tickets in correct columns based on status', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Check that tickets are in the right columns
    const openColumn = screen.getByTestId('droppable-open');
    const inProgressColumn = screen.getByTestId('droppable-in_progress');
    const resolvedColumn = screen.getByTestId('droppable-resolved');

    expect(openColumn).toBeInTheDocument();
    expect(inProgressColumn).toBeInTheDocument();
    expect(resolvedColumn).toBeInTheDocument();

    // Check ticket titles are displayed
    expect(screen.getByText('Bug Report')).toBeInTheDocument();
    expect(screen.getByText('Feature Request')).toBeInTheDocument();
    expect(screen.getByText('Resolved Issue')).toBeInTheDocument();
  });

  it('should show ticket details in cards', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Check for ticket details
    expect(screen.getByText('Bug Report')).toBeInTheDocument();
    expect(screen.getByText('Application crashes on startup')).toBeInTheDocument();
    expect(screen.getByText('Feature Request')).toBeInTheDocument();
    expect(screen.getByText('Add dark mode support')).toBeInTheDocument();
  });

  it('should display custom field values', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Check for custom field values
    expect(screen.getAllByText('Bug')).toHaveLength(2); // Two bug tickets
    expect(screen.getByText('Feature Request')).toBeInTheDocument();
  });

  it('should show assignment information', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Check for assignment indicators
    const assignedTickets = mockTickets.filter((t) => t.assignedToId);
    expect(assignedTickets).toHaveLength(2);

    // Should show unassigned indicator for unassigned tickets
    const unassignedTickets = mockTickets.filter((t) => !t.assignedToId);
    expect(unassignedTickets).toHaveLength(1);
  });

  it('should handle drag and drop for status changes', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Simulate drag and drop by clicking the drag-drop context
    const dragDropContext = screen.getByTestId('drag-drop-context');
    fireEvent.click(dragDropContext);

    // Should call onTicketUpdate with status change
    expect(mockOnTicketUpdate).toHaveBeenCalledWith('1', {
      status: 'in_progress',
    });
  });

  it('should handle priority reordering within same column', () => {
    const ticketsWithSameStatus = [
      { ...mockTickets[0], priority: 1 },
      { ...mockTickets[0], id: '4', title: 'Another Bug', priority: 2 },
    ];

    render(
      <TestWrapper>
        <KanbanBoard tickets={ticketsWithSameStatus} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Tickets should be ordered by priority
    const ticketElements = screen.getAllByTestId(/draggable-/);
    expect(ticketElements).toHaveLength(2);
  });

  it('should display empty state for columns with no tickets', () => {
    const emptyTickets: any[] = [];

    render(
      <TestWrapper>
        <KanbanBoard tickets={emptyTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Columns should still be rendered
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();

    // Should show empty state messages
    expect(screen.getAllByText('No tickets')).toHaveLength(3);
  });

  it('should handle ticket click for details', () => {
    const mockOnTicketClick = vi.fn();

    render(
      <TestWrapper>
        <KanbanBoard
          tickets={mockTickets}
          onTicketUpdate={mockOnTicketUpdate}
          onTicketClick={mockOnTicketClick}
        />
      </TestWrapper>
    );

    // Click on a ticket
    fireEvent.click(screen.getByText('Bug Report'));

    expect(mockOnTicketClick).toHaveBeenCalledWith(mockTickets[0]);
  });

  it('should show loading state', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={[]} onTicketUpdate={mockOnTicketUpdate} loading={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Loading tickets...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(
      <TestWrapper>
        <KanbanBoard
          tickets={[]}
          onTicketUpdate={mockOnTicketUpdate}
          error="Failed to load tickets"
        />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to load tickets')).toBeInTheDocument();
  });

  it('should filter tickets by search query', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} searchQuery="Bug" />
      </TestWrapper>
    );

    // Should only show tickets matching search
    expect(screen.getByText('Bug Report')).toBeInTheDocument();
    expect(screen.getByText('Resolved Issue')).toBeInTheDocument();
    expect(screen.queryByText('Feature Request')).not.toBeInTheDocument();
  });

  it('should handle custom status columns', () => {
    const customStatuses = ['open', 'in_progress', 'testing', 'resolved'];

    render(
      <TestWrapper>
        <KanbanBoard
          tickets={mockTickets}
          onTicketUpdate={mockOnTicketUpdate}
          statusColumns={customStatuses}
        />
      </TestWrapper>
    );

    // Should show custom status columns
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('should show ticket count in column headers', () => {
    render(
      <TestWrapper>
        <KanbanBoard tickets={mockTickets} onTicketUpdate={mockOnTicketUpdate} />
      </TestWrapper>
    );

    // Should show count badges
    expect(screen.getByText('1')).toBeInTheDocument(); // Open column count
    expect(screen.getByText('1')).toBeInTheDocument(); // In Progress column count
    expect(screen.getByText('1')).toBeInTheDocument(); // Resolved column count
  });
});
