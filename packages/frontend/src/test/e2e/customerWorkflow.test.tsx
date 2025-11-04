import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import { ToastProvider } from '../../contexts/ToastContext';
import CustomerDashboard from '../../pages/CustomerDashboard';
import CreateTicketForm from '../../components/CreateTicketForm';
import CustomerTicketList from '../../components/CustomerTicketList';
import * as api from '../../services/api';

// Mock API calls
vi.mock('../../services/api');
const mockApi = vi.mocked(api);

// Mock data
const mockUser = {
  id: '1',
  email: 'customer@test.com',
  firstName: 'Test',
  lastName: 'Customer',
  role: 'customer',
  companies: [
    {
      id: '1',
      name: 'Test Company',
      domain: 'test.com',
    },
  ],
};

const mockTickets = [
  {
    id: '1',
    title: 'Test Ticket 1',
    description: 'First test ticket',
    status: 'open',
    priority: 1,
    submitterId: '1',
    companyId: '1',
    teamId: '1',
    customFieldValues: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Test Ticket 2',
    description: 'Second test ticket',
    status: 'in_progress',
    priority: 2,
    submitterId: '1',
    companyId: '1',
    teamId: '1',
    customFieldValues: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockTeams = [
  {
    id: '1',
    name: 'Support Team',
    description: 'Customer support team',
    customFields: [
      {
        id: '1',
        name: 'issue_type',
        label: 'Issue Type',
        type: 'picklist',
        isRequired: true,
        options: ['Bug', 'Feature Request', 'Support'],
        order: 1,
      },
    ],
  },
];

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

describe('Customer Workflow E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default API mocks
    mockApi.getCurrentUser.mockResolvedValue({ data: mockUser });
    mockApi.getTickets.mockResolvedValue({
      data: mockTickets,
      pagination: { total: 2, page: 1, limit: 10 },
    });
    mockApi.getTeams.mockResolvedValue({ data: mockTeams });
  });

  describe('Customer Dashboard', () => {
    it('should display customer dashboard with tickets', async () => {
      render(
        <TestWrapper>
          <CustomerDashboard />
        </TestWrapper>
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('My Tickets')).toBeInTheDocument();
      });

      // Check if tickets are displayed
      expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
      expect(screen.getByText('Test Ticket 2')).toBeInTheDocument();

      // Check status badges
      expect(screen.getByText('open')).toBeInTheDocument();
      expect(screen.getByText('in_progress')).toBeInTheDocument();
    });

    it('should allow filtering tickets by status', async () => {
      render(
        <TestWrapper>
          <CustomerTicketList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
      });

      // Find and click status filter
      const statusFilter = screen.getByLabelText('Filter by status');
      fireEvent.change(statusFilter, { target: { value: 'open' } });

      // Verify API call with filter
      await waitFor(() => {
        expect(mockApi.getTickets).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'open' })
        );
      });
    });

    it('should allow searching tickets', async () => {
      render(
        <TestWrapper>
          <CustomerTicketList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
      });

      // Find search input and enter query
      const searchInput = screen.getByPlaceholderText('Search tickets...');
      fireEvent.change(searchInput, { target: { value: 'Test Ticket 1' } });
      fireEvent.submit(searchInput.closest('form')!);

      // Verify API call with search query
      await waitFor(() => {
        expect(mockApi.getTickets).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'Test Ticket 1' })
        );
      });
    });
  });

  describe('Ticket Creation Workflow', () => {
    it('should create a new ticket with custom fields', async () => {
      mockApi.createTicket.mockResolvedValue({
        data: {
          id: '3',
          title: 'New Test Ticket',
          description: 'New ticket description',
          status: 'open',
          customFieldValues: { issue_type: 'Bug' },
        },
      });

      render(
        <TestWrapper>
          <CreateTicketForm />
        </TestWrapper>
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
      });

      // Fill out the form
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'New Test Ticket' },
      });

      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'New ticket description' },
      });

      // Select company
      const companySelect = screen.getByLabelText('Company');
      fireEvent.change(companySelect, { target: { value: '1' } });

      // Select team
      const teamSelect = screen.getByLabelText('Team');
      fireEvent.change(teamSelect, { target: { value: '1' } });

      // Fill custom field
      const issueTypeSelect = screen.getByLabelText('Issue Type');
      fireEvent.change(issueTypeSelect, { target: { value: 'Bug' } });

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApi.createTicket).toHaveBeenCalledWith({
          title: 'New Test Ticket',
          description: 'New ticket description',
          companyId: '1',
          teamId: '1',
          customFieldValues: {
            issue_type: 'Bug',
          },
        });
      });
    });

    it('should validate required fields', async () => {
      render(
        <TestWrapper>
          <CreateTicketForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
      });

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      // Check for validation errors
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
      });

      // Verify API was not called
      expect(mockApi.createTicket).not.toHaveBeenCalled();
    });

    it('should handle custom field validation', async () => {
      render(
        <TestWrapper>
          <CreateTicketForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
      });

      // Fill basic fields
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'Test Ticket' },
      });
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'Test description' },
      });
      fireEvent.change(screen.getByLabelText('Company'), {
        target: { value: '1' },
      });
      fireEvent.change(screen.getByLabelText('Team'), {
        target: { value: '1' },
      });

      // Try to submit without required custom field
      const submitButton = screen.getByRole('button', { name: /create ticket/i });
      fireEvent.click(submitButton);

      // Check for custom field validation error
      await waitFor(() => {
        expect(screen.getByText('Issue Type is required')).toBeInTheDocument();
      });
    });
  });

  describe('Ticket Detail Workflow', () => {
    const mockTicketDetail = {
      ...mockTickets[0],
      notes: [
        {
          id: '1',
          content: 'Customer note',
          isInternal: false,
          authorId: '1',
          authorName: 'Test Customer',
          createdAt: new Date().toISOString(),
        },
      ],
      attachments: [
        {
          id: '1',
          fileName: 'test.pdf',
          fileSize: 1024,
          uploadedById: '1',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    it('should display ticket details with notes and attachments', async () => {
      mockApi.getTicket.mockResolvedValue({ data: mockTicketDetail });

      render(
        <TestWrapper>
          <CustomerDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
      });

      // Click on ticket to view details
      fireEvent.click(screen.getByText('Test Ticket 1'));

      // Wait for ticket detail to load
      await waitFor(() => {
        expect(screen.getByText('Customer note')).toBeInTheDocument();
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });

    it('should allow adding notes to ticket', async () => {
      mockApi.getTicket.mockResolvedValue({ data: mockTicketDetail });
      mockApi.addTicketNote.mockResolvedValue({
        data: {
          id: '2',
          content: 'New customer note',
          isInternal: false,
          authorId: '1',
          authorName: 'Test Customer',
          createdAt: new Date().toISOString(),
        },
      });

      render(
        <TestWrapper>
          <CustomerDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
      });

      // Click on ticket to view details
      fireEvent.click(screen.getByText('Test Ticket 1'));

      await waitFor(() => {
        expect(screen.getByText('Customer note')).toBeInTheDocument();
      });

      // Add new note
      const noteInput = screen.getByPlaceholderText('Add a note...');
      fireEvent.change(noteInput, { target: { value: 'New customer note' } });

      const addNoteButton = screen.getByRole('button', { name: /add note/i });
      fireEvent.click(addNoteButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApi.addTicketNote).toHaveBeenCalledWith('1', {
          content: 'New customer note',
          isInternal: false,
        });
      });
    });

    it('should allow uploading file attachments', async () => {
      mockApi.getTicket.mockResolvedValue({ data: mockTicketDetail });
      mockApi.uploadTicketFile.mockResolvedValue({
        data: {
          id: '2',
          fileName: 'new-file.jpg',
          fileSize: 2048,
          uploadedById: '1',
          createdAt: new Date().toISOString(),
        },
      });

      render(
        <TestWrapper>
          <CustomerDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
      });

      // Click on ticket to view details
      fireEvent.click(screen.getByText('Test Ticket 1'));

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      // Upload new file
      const fileInput = screen.getByLabelText('Upload file');
      const file = new File(['test content'], 'new-file.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      // Verify API call
      await waitFor(() => {
        expect(mockApi.uploadTicketFile).toHaveBeenCalledWith('1', expect.any(FormData));
      });
    });
  });

  describe('Multi-Company Support', () => {
    const mockMultiCompanyUser = {
      ...mockUser,
      companies: [
        { id: '1', name: 'Company A', domain: 'companya.com' },
        { id: '2', name: 'Company B', domain: 'companyb.com' },
      ],
    };

    it('should allow switching between companies', async () => {
      mockApi.getCurrentUser.mockResolvedValue({ data: mockMultiCompanyUser });

      render(
        <TestWrapper>
          <CustomerDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Company A')).toBeInTheDocument();
      });

      // Find company selector
      const companySelector = screen.getByLabelText('Select company');
      fireEvent.change(companySelector, { target: { value: '2' } });

      // Verify tickets are filtered by new company
      await waitFor(() => {
        expect(mockApi.getTickets).toHaveBeenCalledWith(
          expect.objectContaining({ companyId: '2' })
        );
      });
    });

    it('should show company-specific tickets only', async () => {
      mockApi.getCurrentUser.mockResolvedValue({ data: mockMultiCompanyUser });

      const companyATickets = [{ ...mockTickets[0], companyId: '1' }];
      const companyBTickets = [{ ...mockTickets[1], companyId: '2' }];

      mockApi.getTickets
        .mockResolvedValueOnce({
          data: companyATickets,
          pagination: { total: 1, page: 1, limit: 10 },
        })
        .mockResolvedValueOnce({
          data: companyBTickets,
          pagination: { total: 1, page: 1, limit: 10 },
        });

      render(
        <TestWrapper>
          <CustomerDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Ticket 1')).toBeInTheDocument();
      });

      // Switch to Company B
      const companySelector = screen.getByLabelText('Select company');
      fireEvent.change(companySelector, { target: { value: '2' } });

      // Verify only Company B tickets are shown
      await waitFor(() => {
        expect(screen.getByText('Test Ticket 2')).toBeInTheDocument();
        expect(screen.queryByText('Test Ticket 1')).not.toBeInTheDocument();
      });
    });
  });
});
