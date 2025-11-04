import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import CreateTicketForm from '../../components/CreateTicketForm';
import * as api from '../../services/api';

// Mock API calls
vi.mock('../../services/api');
const mockApi = vi.mocked(api);

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
    {
      id: '2',
      name: 'Another Company',
      domain: 'another.com',
    },
  ],
};

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
      {
        id: '2',
        name: 'priority_level',
        label: 'Priority Level',
        type: 'picklist',
        isRequired: false,
        options: ['Low', 'Medium', 'High'],
        order: 2,
      },
      {
        id: '3',
        name: 'affected_users',
        label: 'Number of Affected Users',
        type: 'integer',
        isRequired: false,
        validation: { min: 1, max: 10000 },
        order: 3,
      },
    ],
  },
  {
    id: '2',
    name: 'Technical Team',
    description: 'Technical support team',
    customFields: [
      {
        id: '4',
        name: 'severity',
        label: 'Severity',
        type: 'picklist',
        isRequired: true,
        options: ['Critical', 'High', 'Medium', 'Low'],
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
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('CreateTicketForm Component', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getCurrentUser.mockResolvedValue({ data: mockUser });
    mockApi.getTeams.mockResolvedValue({ data: mockTeams });
    mockApi.createTicket.mockResolvedValue({
      data: {
        id: '1',
        title: 'Test Ticket',
        description: 'Test description',
        status: 'open',
        customFieldValues: {},
      },
    });
  });

  it('should render form with all required fields', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Company')).toBeInTheDocument();
    expect(screen.getByLabelText('Team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create ticket/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should populate company dropdown with user companies', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Company')).toBeInTheDocument();
    });

    const companySelect = screen.getByLabelText('Company');
    expect(companySelect).toBeInTheDocument();

    // Check that companies are available as options
    fireEvent.click(companySelect);
    expect(screen.getByText('Test Company')).toBeInTheDocument();
    expect(screen.getByText('Another Company')).toBeInTheDocument();
  });

  it('should populate team dropdown when available', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Team')).toBeInTheDocument();
    });

    const teamSelect = screen.getByLabelText('Team');
    fireEvent.click(teamSelect);

    expect(screen.getByText('Support Team')).toBeInTheDocument();
    expect(screen.getByText('Technical Team')).toBeInTheDocument();
  });

  it('should show custom fields when team is selected', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Team')).toBeInTheDocument();
    });

    // Select Support Team
    const teamSelect = screen.getByLabelText('Team');
    fireEvent.change(teamSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Issue Type')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Priority Level')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of Affected Users')).toBeInTheDocument();
  });

  it('should show different custom fields for different teams', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Team')).toBeInTheDocument();
    });

    // Select Technical Team
    const teamSelect = screen.getByLabelText('Team');
    fireEvent.change(teamSelect, { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
    });

    // Should not show Support Team fields
    expect(screen.queryByLabelText('Issue Type')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Priority Level')).not.toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create ticket/i })).toBeInTheDocument();
    });

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('Company is required')).toBeInTheDocument();
    expect(screen.getByText('Team is required')).toBeInTheDocument();
  });

  it('should validate required custom fields', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
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

    await waitFor(() => {
      expect(screen.getByLabelText('Issue Type')).toBeInTheDocument();
    });

    // Try to submit without required custom field
    const submitButton = screen.getByRole('button', { name: /create ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Issue Type is required')).toBeInTheDocument();
    });
  });

  it('should validate custom field types', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Team')).toBeInTheDocument();
    });

    // Select Support Team to show integer field
    fireEvent.change(screen.getByLabelText('Team'), {
      target: { value: '1' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Number of Affected Users')).toBeInTheDocument();
    });

    // Enter invalid integer value
    const affectedUsersInput = screen.getByLabelText('Number of Affected Users');
    fireEvent.change(affectedUsersInput, {
      target: { value: 'not a number' },
    });

    fireEvent.blur(affectedUsersInput);

    await waitFor(() => {
      expect(screen.getByText('Must be a valid number')).toBeInTheDocument();
    });
  });

  it('should validate custom field ranges', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Team')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Team'), {
      target: { value: '1' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Number of Affected Users')).toBeInTheDocument();
    });

    // Enter value outside valid range
    const affectedUsersInput = screen.getByLabelText('Number of Affected Users');
    fireEvent.change(affectedUsersInput, {
      target: { value: '20000' }, // Exceeds max of 10000
    });

    fireEvent.blur(affectedUsersInput);

    await waitFor(() => {
      expect(screen.getByText('Must be between 1 and 10000')).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    // Fill all required fields
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

    await waitFor(() => {
      expect(screen.getByLabelText('Issue Type')).toBeInTheDocument();
    });

    // Fill required custom field
    fireEvent.change(screen.getByLabelText('Issue Type'), {
      target: { value: 'Bug' },
    });

    // Fill optional custom fields
    fireEvent.change(screen.getByLabelText('Priority Level'), {
      target: { value: 'High' },
    });
    fireEvent.change(screen.getByLabelText('Number of Affected Users'), {
      target: { value: '100' },
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApi.createTicket).toHaveBeenCalledWith({
        title: 'Test Ticket',
        description: 'Test description',
        companyId: '1',
        teamId: '1',
        customFieldValues: {
          issue_type: 'Bug',
          priority_level: 'High',
          affected_users: 100,
        },
      });
    });

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('should handle form submission errors', async () => {
    mockApi.createTicket.mockRejectedValue(new Error('Server error'));

    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    // Fill form
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

    await waitFor(() => {
      expect(screen.getByLabelText('Issue Type')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Issue Type'), {
      target: { value: 'Bug' },
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to create ticket. Please try again.')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show loading state during submission', async () => {
    // Make API call hang
    mockApi.createTicket.mockImplementation(() => new Promise(() => {}));

    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    // Fill minimum required fields
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

    await waitFor(() => {
      expect(screen.getByLabelText('Issue Type')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Issue Type'), {
      target: { value: 'Bug' },
    });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    expect(submitButton).toBeDisabled();
  });

  it('should reset form after successful submission', async () => {
    render(
      <TestWrapper>
        <CreateTicketForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    // Fill and submit form
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Test Ticket' } });

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Test description' },
    });
    fireEvent.change(screen.getByLabelText('Company'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Team'), {
      target: { value: '1' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Issue Type')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Issue Type'), {
      target: { value: 'Bug' },
    });

    const submitButton = screen.getByRole('button', { name: /create ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    // Form should be reset
    expect(titleInput).toHaveValue('');
  });
});
