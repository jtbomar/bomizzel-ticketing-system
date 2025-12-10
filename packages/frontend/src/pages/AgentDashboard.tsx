import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AgentProfile from '../components/AgentProfile';
import DepartmentSelector from '../components/DepartmentSelector';
import AgentGlobalSearch from '../components/AgentGlobalSearch';
import KanbanTemplates, { Template } from '../components/KanbanTemplates';
import { apiService } from '../services/api';

interface Ticket {
  id: number;
  title: string;
  status: string;
  priority: string;
  customer: string;
  assigned: string;
  created: string;
  description?: string;
  order: number;
  notes?: TicketNote[];
  attachments?: TicketAttachment[];
  customerInfo?: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    companyId?: string;
    website?: string;
  };
}

interface TicketAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface TicketNote {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  isInternal: boolean;
}

interface StatusOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
  isDefault: boolean;
}

interface PriorityOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
  isDefault: boolean;
}

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeView, setActiveView] = useState<'kanban' | 'list'>('kanban');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [showOnlyMyTickets, setShowOnlyMyTickets] = useState(true); // Default to showing only user's tickets

  // Load statuses and priorities from AdminStatusConfig or API
  const getStatuses = (): StatusOption[] => {
    const saved = localStorage.getItem('admin-statuses');
    if (saved) {
      try {
        return JSON.parse(saved).filter((s: StatusOption) => s.isActive);
      } catch (error) {
        console.error('Error loading statuses:', error);
      }
    }
    // Default statuses if none configured
    return [
      {
        id: '1',
        label: 'Open',
        value: 'open',
        color: 'red',
        order: 1,
        isActive: true,
        isDefault: true,
      },
      {
        id: '2',
        label: 'In Progress',
        value: 'in_progress',
        color: 'yellow',
        order: 2,
        isActive: true,
        isDefault: true,
      },
      {
        id: '3',
        label: 'Waiting',
        value: 'waiting',
        color: 'blue',
        order: 3,
        isActive: true,
        isDefault: true,
      },
      {
        id: '4',
        label: 'Resolved',
        value: 'resolved',
        color: 'green',
        order: 4,
        isActive: true,
        isDefault: true,
      },
    ];
  };

  const getPriorities = (): PriorityOption[] => {
    const saved = localStorage.getItem('admin-priorities');
    if (saved) {
      try {
        return JSON.parse(saved).filter((p: PriorityOption) => p.isActive);
      } catch (error) {
        console.error('Error loading priorities:', error);
      }
    }
    // Default priorities if none configured
    return [
      {
        id: '1',
        label: 'Low',
        value: 'low',
        color: 'green',
        order: 1,
        isActive: true,
        isDefault: true,
      },
      {
        id: '2',
        label: 'Medium',
        value: 'medium',
        color: 'yellow',
        order: 2,
        isActive: true,
        isDefault: true,
      },
      {
        id: '3',
        label: 'High',
        value: 'high',
        color: 'red',
        order: 3,
        isActive: true,
        isDefault: true,
      },
      {
        id: '4',
        label: 'Critical',
        value: 'critical',
        color: 'purple',
        order: 4,
        isActive: true,
        isDefault: true,
      },
    ];
  };

  const [statuses] = useState<StatusOption[]>(getStatuses());
  const [priorities] = useState<PriorityOption[]>(getPriorities());

  // Load tickets from localStorage or use defaults
  const getInitialTickets = (): Ticket[] => {
    if (!user) return [];
    
    const userKey = `agent-tickets-${user.id}`;
    const saved = localStorage.getItem(userKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // If parsing fails, use defaults
      }
    }
    return [
      {
        id: 1,
        title: 'Login Issue',
        status: 'open',
        priority: 'high',
        customer: 'John Doe',
        assigned: 'You',
        created: '2024-01-15',
        description: 'Cannot access account',
        order: 1,
        customerInfo: {
          name: 'John Doe',
          email: 'john.doe@acmecorp.com',
          phone: '(555) 123-4567',
          company: 'Acme Corporation',
          website: 'www.acmecorp.com',
        },
      },
      {
        id: 2,
        title: 'Feature Request',
        status: 'in_progress',
        priority: 'medium',
        customer: 'Jane Smith',
        assigned: 'Alice Johnson',
        created: '2024-01-10',
        description: 'Need dark mode',
        order: 1,
        customerInfo: {
          name: 'Jane Smith',
          email: 'jane.smith@techstart.io',
          phone: '(555) 234-5678',
          company: 'TechStart Inc.',
          website: 'www.techstart.io',
        },
      },
      {
        id: 3,
        title: 'Bug Report',
        status: 'waiting',
        priority: 'low',
        customer: 'Bob Wilson',
        assigned: 'You',
        created: '2024-01-05',
        description: 'Button not working',
        order: 1,
        customerInfo: {
          name: 'Bob Wilson',
          email: 'bob.wilson@globaltech.com',
          phone: '(555) 345-6789',
          company: 'Global Tech Solutions',
          website: 'www.globaltech.com',
        },
      },
      {
        id: 4,
        title: 'Account Setup',
        status: 'open',
        priority: 'medium',
        customer: 'Sarah Davis',
        assigned: 'Unassigned',
        created: '2024-01-12',
        description: 'Need help with setup',
        order: 2,
        customerInfo: {
          name: 'Sarah Davis',
          email: 'sarah.davis@innovate.co',
          phone: '(555) 456-7890',
          company: 'Innovate Co.',
          website: 'www.innovate.co',
        },
      },
      {
        id: 5,
        title: 'Payment Issue',
        status: 'resolved',
        priority: 'high',
        customer: 'Mike Brown',
        assigned: 'You',
        created: '2024-01-08',
        description: 'Payment not processing',
        order: 1,
        customerInfo: {
          name: 'Mike Brown',
          email: 'mike.brown@enterprise.net',
          phone: '(555) 567-8901',
          company: 'Enterprise Networks',
          website: 'www.enterprise.net',
        },
      },
    ];
  };

  // Migrate tickets to match current status configuration
  const migrateTickets = (tickets: Ticket[], statuses: StatusOption[]): Ticket[] => {
    const statusValueMap: { [key: string]: string } = {
      Open: 'open',
      'In Progress': 'in_progress',
      Waiting: 'waiting',
      Resolved: 'resolved',
    };

    return tickets.map((ticket) => {
      // Ensure notes array exists
      const ticketWithNotes = { ...ticket, notes: ticket.notes || [] };

      // Check if ticket status exists in current statuses
      const statusExists = statuses.some((s) => s.value === ticketWithNotes.status);
      if (statusExists) {
        return ticketWithNotes;
      }

      // Try to map old status to new status
      const mappedStatus = statusValueMap[ticketWithNotes.status];
      if (mappedStatus && statuses.some((s) => s.value === mappedStatus)) {
        return { ...ticketWithNotes, status: mappedStatus };
      }

      // If no mapping found, assign to first available status
      const firstStatus = statuses[0];
      if (firstStatus) {
        console.log(
          `Migrating ticket ${ticketWithNotes.id} from status "${ticketWithNotes.status}" to "${firstStatus.value}"`
        );
        return { ...ticketWithNotes, status: firstStatus.value };
      }

      return ticketWithNotes;
    });
  };

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketIdMap, setTicketIdMap] = useState<Map<number, string>>(new Map()); // Maps numeric ID to UUID
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
  const [dragOverTicket, setDragOverTicket] = useState<number | null>(null);

  // Load initial tickets when user is available
  useEffect(() => {
    if (user) {
      const initialTickets = migrateTickets(getInitialTickets(), statuses);
      setTickets(initialTickets);
    }
  }, [user]); // Only run when user becomes available

  // Fetch real tickets from API on mount
  useEffect(() => {
    const fetchTickets = async () => {
      // Only fetch if user is authenticated
      if (!user) {
        console.log('User not authenticated, skipping ticket fetch');
        return;
      }

      try {
        // Get tickets based on filter preference
        const ticketParams: any = { limit: 100 };
        if (showOnlyMyTickets && user) {
          ticketParams.assignedToId = user.id;
          console.log('[AgentDashboard] Fetching tickets assigned to user:', user.id, user.email);
        } else {
          console.log('[AgentDashboard] Fetching all tickets');
        }
        
        const response = await apiService.getTickets(ticketParams);
        const apiTickets = response.data || response.tickets || [];
        console.log('[AgentDashboard] Received', apiTickets.length, 'tickets from API');
        
        // Create ID mapping from numeric to UUID
        const idMapping = new Map<number, string>();
        
        // Transform API tickets to dashboard format
        const transformedTickets = apiTickets.map((t: any, index: number) => {
          const assignedName = t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'Unassigned';
          const isAssignedToCurrentUser = user && t.assignedTo?.id === user.id;
          
          // Create a unique numeric ID from the UUID
          const numericId = index + 1000; // Simple sequential IDs starting from 1000
          idMapping.set(numericId, t.id); // Store UUID mapping
          
          return {
            id: numericId,
            title: t.title,
            status: t.status,
            priority: t.priority === 0 ? 'low' : t.priority === 1 ? 'medium' : 'high',
            customer: t.submitter ? `${t.submitter.firstName} ${t.submitter.lastName}` : 'Unknown',
            assigned: isAssignedToCurrentUser ? 'You' : assignedName,
            created: new Date(t.createdAt).toLocaleDateString(),
            description: t.description || '',
            order: 0, // Will be set below
            customerInfo: t.submitter ? {
              name: `${t.submitter.firstName} ${t.submitter.lastName}`,
              email: t.submitter.email,
              company: t.company?.name || '',
              companyId: t.companyId,
            } : undefined,
          };
        });
        
        // Assign proper order within each status column
        const ticketsByStatus: { [key: string]: any[] } = {};
        transformedTickets.forEach(ticket => {
          if (!ticketsByStatus[ticket.status]) {
            ticketsByStatus[ticket.status] = [];
          }
          ticketsByStatus[ticket.status].push(ticket);
        });
        
        // Set order for each status group
        Object.keys(ticketsByStatus).forEach(status => {
          ticketsByStatus[status].forEach((ticket, index) => {
            ticket.order = index + 1;
          });
        });
        
        if (transformedTickets.length > 0) {
          setTickets(migrateTickets(transformedTickets, statuses));
          setTicketIdMap(idMapping);
          console.log('Loaded', transformedTickets.length, 'tickets from API');
        }
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
        // Keep using localStorage tickets on error
      }
    };
    
    fetchTickets();
  }, [user, showOnlyMyTickets]); // Re-fetch when user changes or filter changes

  // Fetch team statuses from API
  useEffect(() => {
    const fetchTeamStatuses = async () => {
      if (!user || !teamId) {
        setLoadingStatuses(false);
        return;
      }

      try {
        console.log('[AgentDashboard] Fetching statuses for team:', teamId);
        const response = await apiService.getTeamStatuses(teamId);
        const apiStatuses = response.statuses || [];
        
        if (apiStatuses.length > 0) {
          // Transform API statuses to StatusOption format
          const transformedStatuses = apiStatuses
            .filter((s: any) => s.is_active)
            .sort((a: any, b: any) => a.order - b.order)
            .map((s: any) => ({
              id: s.id,
              label: s.label,
              value: s.name,
              color: s.color,
              order: s.order,
              isActive: s.is_active,
              isDefault: s.is_default,
            }));
          
          // Save to localStorage and update state
          localStorage.setItem('admin-statuses', JSON.stringify(transformedStatuses));
          console.log('[AgentDashboard] Loaded', transformedStatuses.length, 'statuses from API');
        }
      } catch (error) {
        console.error('[AgentDashboard] Failed to fetch team statuses:', error);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchTeamStatuses();
  }, [user, teamId]);

  // Get user's team ID from their first ticket or team membership
  useEffect(() => {
    const getUserTeamId = async () => {
      if (!user) return;

      try {
        // Try to get team from user's tickets
        const response = await apiService.getTickets({ limit: 1 });
        const tickets = response.data || response.tickets || [];
        
        if (tickets.length > 0 && tickets[0].teamId) {
          setTeamId(tickets[0].teamId);
          return;
        }

        // Fallback: get from user profile or teams endpoint
        // For now, we'll use a default team if available
        console.log('[AgentDashboard] No team found, using default statuses');
      } catch (error) {
        console.error('[AgentDashboard] Failed to get user team:', error);
      }
    };

    getUserTeamId();
  }, [user]);

  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Modal state
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'notes' | 'attachments'>(
    'details'
  );
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteIsInternal, setNewNoteIsInternal] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteContent, setEditedNoteContent] = useState('');
  const [isEditingContactInfo, setIsEditingContactInfo] = useState(false);
  const [editedContactInfo, setEditedContactInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    companyId: '',
    website: '',
  });
  const [companySearchResults, setCompanySearchResults] = useState<any[]>([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showCreateCompanyPrompt, setShowCreateCompanyPrompt] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [isAgentQueueCollapsed, setIsAgentQueueCollapsed] = useState(false);

  // Views state
  const [activeViewFilter, setActiveViewFilter] = useState('all-tickets');
  const [showCreateView, setShowCreateView] = useState(false);
  const [customViews, setCustomViews] = useState<any[]>([]);

  // Load custom views from localStorage
  useEffect(() => {
    if (user) {
      const userKey = `agent-custom-views-${user.id}`;
      const saved = localStorage.getItem(userKey);
      if (saved) {
        try {
          setCustomViews(JSON.parse(saved));
        } catch (error) {
          console.error('Failed to load custom views:', error);
        }
      }
    }
  }, [user]);

  // Save custom views to localStorage
  useEffect(() => {
    if (user) {
      const userKey = `agent-custom-views-${user.id}`;
      localStorage.setItem(userKey, JSON.stringify(customViews));
    }
  }, [customViews, user]);

  // Default views for filtering
  const defaultViews = [
    {
      id: 'all-tickets',
      name: 'All Tickets',
      icon: '📋',
      filter: (ticket: Ticket) => true, // Show all tickets
      isDefault: true,
    },
    {
      id: 'my-queue',
      name: 'My Queue',
      icon: '👤',
      filter: (ticket: Ticket) => ticket.assigned === 'You',
      isDefault: true,
    },
    {
      id: 'unassigned',
      name: 'Unassigned',
      icon: '📥',
      filter: (ticket: Ticket) => ticket.assigned === 'Unassigned',
      isDefault: true,
    },
    {
      id: 'all-open',
      name: 'All Open',
      icon: '🔓',
      filter: (ticket: Ticket) => ticket.status === 'open',
      isDefault: true,
    },
    {
      id: 'closed-today',
      name: 'Closed Today',
      icon: '✅',
      filter: (ticket: Ticket) => {
        // Check if ticket is closed/resolved
        const isClosedStatus = ticket.status === 'closed' || ticket.status === 'resolved';
        if (!isClosedStatus) return false;
        
        // Check if created today (as a proxy for closed date since we don't have closedAt)
        // In a real system, you'd check ticket.closedAt or ticket.updatedAt
        const today = new Date();
        const ticketDate = new Date(ticket.created);
        return (
          ticketDate.getDate() === today.getDate() &&
          ticketDate.getMonth() === today.getMonth() &&
          ticketDate.getFullYear() === today.getFullYear()
        );
      },
      isDefault: true,
    },
  ];

  // Get filtered tickets
  const getFilteredTickets = () => {
    // Check default views first
    const defaultView = defaultViews.find((v) => v.id === activeViewFilter);
    if (defaultView) {
      return tickets.filter(defaultView.filter);
    }
    
    // Check if it's an agent queue view
    if (activeViewFilter.startsWith('agent-')) {
      const agentName = activeViewFilter.replace('agent-', '');
      return tickets.filter((ticket) => ticket.assigned === agentName);
    }
    
    // Check custom views
    const customView = customViews.find((v) => v.id === activeViewFilter);
    if (customView) {
      return tickets.filter((ticket) => {
        let matches = true;
        if (customView.filters.status && customView.filters.status !== 'all') {
          matches = matches && ticket.status === customView.filters.status;
        }
        if (customView.filters.priority && customView.filters.priority !== 'all') {
          matches = matches && ticket.priority === customView.filters.priority;
        }
        if (customView.filters.assigned && customView.filters.assigned !== 'all') {
          matches = matches && ticket.assigned === customView.filters.assigned;
        }
        return matches;
      });
    }
    
    return tickets;
  };

  const filteredTickets = getFilteredTickets();

  // Board settings state
  const [boardSettings, setBoardSettings] = useState({
    autoRefresh: true,
    dragAndDrop: true,
    showPriorityArrows: true,
    refreshInterval: 30,
    defaultView: 'kanban' as 'kanban' | 'list',
    ticketsPerColumn: 0,
    showTicketIds: true,
    showAssignee: true,
  });

  // Save to localStorage whenever tickets change
  useEffect(() => {
    if (user && tickets.length >= 0) { // Save even if 0 tickets (empty state)
      const userKey = `agent-tickets-${user.id}`;
      localStorage.setItem(userKey, JSON.stringify(tickets));
      console.log('Saved tickets to localStorage:', tickets.length, 'for user:', user.email);
    }
  }, [tickets, user]);

  // Open ticket modal if ticket data is in sessionStorage
  useEffect(() => {
    const openTicketData = sessionStorage.getItem('openTicket');
    if (openTicketData) {
      try {
        const ticket = JSON.parse(openTicketData);
        setSelectedTicket(ticket);
        // Clear the sessionStorage after opening
        sessionStorage.removeItem('openTicket');
      } catch (error) {
        console.error('Failed to parse ticket data:', error);
        sessionStorage.removeItem('openTicket');
      }
    }
  }, []);

  // Load agents from API
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await apiService.getAgents({ status: 'active' });
        const agentsList = response.data || [];
        setAgents(Array.isArray(agentsList) ? agentsList : []);
      } catch (error) {
        console.error('Failed to load agents:', error);
        // Fallback: extract unique agents from tickets
        const uniqueAgents = Array.from(new Set(tickets.map(t => t.assigned)))
          .filter(name => name !== 'Unassigned')
          .map((name, index) => ({
            id: `fallback-${index}`,
            firstName: name.split(' ')[0] || name,
            lastName: name.split(' ')[1] || '',
            email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
          }));
        setAgents(uniqueAgents);
      }
    };
    loadAgents();
  }, [tickets]);

  // Load board settings from localStorage
  useEffect(() => {
    if (user) {
      const userKey = `agent-board-settings-${user.id}`;
      const savedSettings = localStorage.getItem(userKey);
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setBoardSettings((prev) => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error('Failed to load board settings:', error);
        }
      }
    }
  }, [user]);

  // Handle board settings changes from AgentProfile
  const handleBoardSettingsChange = (newSettings: any) => {
    setBoardSettings(newSettings);
    if (user) {
      const userKey = `agent-board-settings-${user.id}`;
      localStorage.setItem(userKey, JSON.stringify(newSettings));
    }
  };

  // Handle template selection
  const handleSelectTemplate = (template: Template) => {
    // Convert template columns to status options
    const newStatuses = template.columns.map((col, index) => ({
      id: `${index + 1}`,
      label: col.name,
      value: col.name.toLowerCase().replace(/\s+/g, '_'),
      color: col.color,
      order: index + 1,
      isActive: true,
      isDefault: index === 0,
    }));

    // Save to localStorage
    localStorage.setItem('admin-statuses', JSON.stringify(newStatuses));

    // Migrate existing tickets to the first status of the new template
    const firstStatus = newStatuses[0];
    const migratedTickets = tickets.map((ticket) => ({
      ...ticket,
      status: firstStatus.value,
      order: ticket.order,
    }));
    
    setTickets(migratedTickets);
    if (user) {
      const userKey = `agent-tickets-${user.id}`;
      localStorage.setItem(userKey, JSON.stringify(migratedTickets));
    }

    // Close modal and reload page to apply new statuses
    setShowTemplates(false);
    window.location.reload();
  };

  // Add note to ticket
  const addNoteToTicket = (ticketId: number, content: string, isInternal: boolean) => {
    if (!content.trim()) return;

    const newNote: TicketNote = {
      id: Date.now().toString(),
      content: content.trim(),
      author: user?.firstName || 'You',
      timestamp: new Date().toLocaleString(),
      isInternal,
    };

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, notes: [...(ticket.notes || []), newNote] } : ticket
      )
    );

    // Update selected ticket if it's the same one
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              notes: [...(prev.notes || []), newNote],
            }
          : null
      );
    }

    setNewNoteContent('');
  };

  // Edit note
  const editNoteInTicket = (ticketId: number, noteId: string, newContent: string) => {
    if (!newContent.trim()) return;

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              notes: (ticket.notes || []).map((note) =>
                note.id === noteId ? { ...note, content: newContent.trim() } : note
              ),
            }
          : ticket
      )
    );

    // Update selected ticket if it's the same one
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              notes: (prev.notes || []).map((note) =>
                note.id === noteId ? { ...note, content: newContent.trim() } : note
              ),
            }
          : null
      );
    }

    setEditingNoteId(null);
    setEditedNoteContent('');
  };

  // Delete note
  const deleteNoteFromTicket = (ticketId: number, noteId: string) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              notes: (ticket.notes || []).filter((note) => note.id !== noteId),
            }
          : ticket
      )
    );

    // Update selected ticket if it's the same one
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              notes: (prev.notes || []).filter((note) => note.id !== noteId),
            }
          : null
      );
    }
  };

  // Add attachment to ticket
  const addAttachmentToTicket = (ticketId: number, file: File) => {
    const newAttachment: TicketAttachment = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      uploadedBy: user?.firstName || 'You',
      uploadedAt: new Date().toLocaleString(),
    };

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, attachments: [...(ticket.attachments || []), newAttachment] }
          : ticket
      )
    );

    // Update selected ticket if it's the same one
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: [...(prev.attachments || []), newAttachment],
            }
          : null
      );
    }
  };

  // Delete attachment
  const deleteAttachmentFromTicket = (ticketId: number, attachmentId: string) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              attachments: (ticket.attachments || []).filter((att) => att.id !== attachmentId),
            }
          : ticket
      )
    );

    // Update selected ticket if it's the same one
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              attachments: (prev.attachments || []).filter((att) => att.id !== attachmentId),
            }
          : null
      );
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Update contact info
  const updateContactInfo = (ticketId: number, newContactInfo: any) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, customerInfo: newContactInfo } : ticket
      )
    );
  };

  // Search for companies
  const searchCompanies = async (query: string) => {
    if (!query.trim()) {
      setCompanySearchResults([]);
      setShowCompanyDropdown(false);
      setShowCreateCompanyPrompt(false);
      return;
    }

    try {
      const response = await apiService.getCompanies({ search: query, limit: 10 });
      const companies = response.companies || response.data || [];
      setCompanySearchResults(companies);
      setShowCompanyDropdown(companies.length > 0);
      
      // Show create prompt if no exact match found
      const exactMatch = companies.some(
        (c: any) => c.name.toLowerCase() === query.toLowerCase()
      );
      setShowCreateCompanyPrompt(!exactMatch && query.length > 2);
    } catch (error) {
      console.error('Failed to search companies:', error);
      setCompanySearchResults([]);
      setShowCompanyDropdown(false);
      setShowCreateCompanyPrompt(query.length > 2);
    }
  };

  // Handle company field change with debounce
  const handleCompanyChange = (value: string) => {
    setEditedContactInfo({ ...editedContactInfo, company: value });
    
    // Debounce the search
    const timeoutId = setTimeout(() => {
      searchCompanies(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const getStatusTickets = (status: string) =>
    filteredTickets.filter((t) => t.status === status).sort((a, b) => a.order - b.order);

  const getStatusColor = (statusValue: string) => {
    const status = statuses.find((s) => s.value === statusValue);
    if (!status)
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';

    const color = status.color;
    if (color.startsWith('custom-')) {
      return `border-l-4 text-gray-800 dark:text-gray-200`;
    }

    // Map preset colors to Tailwind classes
    const colorMap: { [key: string]: string } = {
      red: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
      orange:
        'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
      yellow:
        'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
      green:
        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
      blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
      purple:
        'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
      pink: 'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-700',
      teal: 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700',
      indigo:
        'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
      cyan: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
      emerald:
        'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700',
      lime: 'bg-lime-100 dark:bg-lime-900 text-lime-800 dark:text-lime-200 border-lime-200 dark:border-lime-700',
      amber:
        'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700',
      rose: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700',
      violet:
        'bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-700',
      slate:
        'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
      gray: 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
      zinc: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700',
      stone:
        'bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700',
      neutral:
        'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700',
    };

    return (
      colorMap[color] ||
      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600'
    );
  };

  const getPriorityColor = (priorityValue: string) => {
    const priority = priorities.find((p) => p.value === priorityValue);
    if (!priority) return 'text-gray-600 dark:text-gray-400';

    const color = priority.color;
    if (color.startsWith('custom-')) {
      return 'text-gray-600 dark:text-gray-400'; // Fallback for custom colors
    }

    // Map preset colors to text colors
    const colorMap: { [key: string]: string } = {
      red: 'text-red-600 dark:text-red-400',
      orange: 'text-orange-600 dark:text-orange-400',
      yellow: 'text-yellow-600 dark:text-yellow-400',
      green: 'text-green-600 dark:text-green-400',
      blue: 'text-blue-600 dark:text-blue-400',
      purple: 'text-purple-600 dark:text-purple-400',
      pink: 'text-pink-600 dark:text-pink-400',
      teal: 'text-teal-600 dark:text-teal-400',
      indigo: 'text-indigo-600 dark:text-indigo-400',
      cyan: 'text-cyan-600 dark:text-cyan-400',
      emerald: 'text-emerald-600 dark:text-emerald-400',
      lime: 'text-lime-600 dark:text-lime-400',
      amber: 'text-amber-600 dark:text-amber-400',
      rose: 'text-rose-600 dark:text-rose-400',
      violet: 'text-violet-600 dark:text-violet-400',
      slate: 'text-slate-600 dark:text-slate-400',
      gray: 'text-gray-600 dark:text-gray-400',
      zinc: 'text-zinc-600 dark:text-zinc-400',
      stone: 'text-stone-600 dark:text-stone-400',
      neutral: 'text-neutral-600 dark:text-neutral-400',
    };

    return colorMap[color] || 'text-gray-600 dark:text-gray-400';
  };

  const moveTicket = async (ticketId: number, newStatus: string) => {
    console.log(`[moveTicket] Moving ticket ${ticketId} to status ${newStatus}`);
    
    // Update local state optimistically
    setTickets((prev) => {
      const targetStatusTickets = prev.filter((t) => t.status === newStatus);
      const maxOrder =
        targetStatusTickets.length > 0 ? Math.max(...targetStatusTickets.map((t) => t.order)) : 0;

      return prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: newStatus, order: maxOrder + 1 } : ticket
      );
    });

    // Persist to API
    try {
      const uuidTicketId = ticketIdMap.get(ticketId);
      console.log(`[moveTicket] UUID for ticket ${ticketId}:`, uuidTicketId);
      
      if (!uuidTicketId) {
        console.error(`[moveTicket] No UUID found for ticket ${ticketId}`);
        console.log('[moveTicket] Available ticket IDs:', Array.from(ticketIdMap.keys()));
        return;
      }
      
      console.log(`[moveTicket] Calling API to update ticket ${uuidTicketId}`);
      console.log(`[moveTicket] Request body:`, { status: newStatus });
      const response = await apiService.updateTicket(uuidTicketId, { status: newStatus });
      console.log(`[moveTicket] API response:`, response);
    } catch (error: any) {
      console.error('[moveTicket] Failed to update ticket status:', error);
      console.error('[moveTicket] Error details:', error.response?.data || error.message);
      
      // Revert the optimistic update
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, status: ticket.status } : ticket
        )
      );
      
      alert(`Failed to move ticket: ${error.response?.data?.message || error.message}`);
    }
  };

  const changePriority = async (ticketId: number, newPriority: string) => {
    // Update local state optimistically
    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, priority: newPriority } : ticket))
    );

    // Persist to API
    try {
      const uuidTicketId = ticketIdMap.get(ticketId);
      if (uuidTicketId) {
        // Convert priority string to number for API
        const priorityValue = newPriority === 'low' ? 0 : newPriority === 'medium' ? 1 : 2;
        await apiService.updateTicket(uuidTicketId, { priority: priorityValue });
        console.log(`Updated ticket ${ticketId} priority to ${newPriority}`);
      }
    } catch (error) {
      console.error('Failed to update ticket priority:', error);
    }
  };

  const changeAssignment = (ticketId: number, newAssigned: string) => {
    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, assigned: newAssigned } : ticket))
    );
  };

  const updateTicketTitle = (ticketId: number, newTitle: string) => {
    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, title: newTitle } : ticket))
    );
  };

  const updateTicketDescription = (ticketId: number, newDescription: string) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, description: newDescription } : ticket
      )
    );
  };

  const moveTicketInColumn = (ticketId: number, direction: 'up' | 'down') => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const statusTickets = getStatusTickets(ticket.status);
    const currentIndex = statusTickets.findIndex((t) => t.id === ticketId);

    if (direction === 'up' && currentIndex > 0) {
      const otherTicket = statusTickets[currentIndex - 1];
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketId) return { ...t, order: otherTicket.order };
          if (t.id === otherTicket.id) return { ...t, order: ticket.order };
          return t;
        })
      );
    } else if (direction === 'down' && currentIndex < statusTickets.length - 1) {
      const otherTicket = statusTickets[currentIndex + 1];
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketId) return { ...t, order: otherTicket.order };
          if (t.id === otherTicket.id) return { ...t, order: ticket.order };
          return t;
        })
      );
    }
  };

  // Enhanced drag and drop with within-column reordering
  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = 'move';

    // Create a custom drag image for better UX
    const dragElement = e.currentTarget.cloneNode(true) as HTMLElement;
    dragElement.style.transform = 'rotate(5deg)';
    dragElement.style.opacity = '0.8';
    dragElement.style.width = e.currentTarget.getBoundingClientRect().width + 'px';
    document.body.appendChild(dragElement);
    e.dataTransfer.setDragImage(dragElement, 0, 0);

    // Clean up the drag image after a short delay
    setTimeout(() => {
      if (document.body.contains(dragElement)) {
        document.body.removeChild(dragElement);
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTicketDragOver = (e: React.DragEvent, ticket: Ticket) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTicket || draggedTicket.id === ticket.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    setDragOverTicket(ticket.id);
    setDragOverPosition(position);
  };

  const handleTicketDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the ticket entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverTicket(null);
      setDragOverPosition(null);
    }
  };

  const handleTicketDrop = (e: React.DragEvent, targetTicket: Ticket) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTicket || draggedTicket.id === targetTicket.id) {
      setDraggedTicket(null);
      setDragOverTicket(null);
      setDragOverPosition(null);
      return;
    }

    const sourceStatus = draggedTicket.status;
    const targetStatus = targetTicket.status;

    if (sourceStatus === targetStatus) {
      // Reordering within the same column
      reorderTicketsInColumn(draggedTicket.id, targetTicket.id, dragOverPosition || 'below');
    } else {
      // Moving to different column
      moveTicketToPosition(
        draggedTicket.id,
        targetStatus,
        targetTicket.id,
        dragOverPosition || 'below'
      );
    }

    setDraggedTicket(null);
    setDragOverTicket(null);
    setDragOverPosition(null);
  };

  const handleColumnDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();

    if (draggedTicket && draggedTicket.status !== newStatus) {
      moveTicket(draggedTicket.id, newStatus);
    }

    setDraggedTicket(null);
    setDragOverTicket(null);
    setDragOverPosition(null);
  };

  const reorderTicketsInColumn = (
    draggedId: number,
    targetId: number,
    position: 'above' | 'below'
  ) => {
    const draggedTicket = tickets.find((t) => t.id === draggedId);
    const targetTicket = tickets.find((t) => t.id === targetId);

    if (!draggedTicket || !targetTicket || draggedTicket.status !== targetTicket.status) return;

    const statusTickets = getStatusTickets(draggedTicket.status);
    const targetIndex = statusTickets.findIndex((t) => t.id === targetId);

    let newOrder: number;

    if (position === 'above') {
      if (targetIndex === 0) {
        newOrder = Math.max(1, targetTicket.order - 1);
      } else {
        const prevTicket = statusTickets[targetIndex - 1];
        newOrder = (prevTicket.order + targetTicket.order) / 2;
      }
    } else {
      if (targetIndex === statusTickets.length - 1) {
        newOrder = targetTicket.order + 1;
      } else {
        const nextTicket = statusTickets[targetIndex + 1];
        newOrder = (targetTicket.order + nextTicket.order) / 2;
      }
    }

    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === draggedId ? { ...ticket, order: newOrder } : ticket))
    );
  };

  const moveTicketToPosition = (
    draggedId: number,
    newStatus: string,
    targetId: number,
    position: 'above' | 'below'
  ) => {
    const targetTicket = tickets.find((t) => t.id === targetId);
    if (!targetTicket) return;

    const statusTickets = getStatusTickets(newStatus);
    const targetIndex = statusTickets.findIndex((t) => t.id === targetId);

    let newOrder: number;

    if (position === 'above') {
      if (targetIndex === 0) {
        newOrder = Math.max(1, targetTicket.order - 1);
      } else {
        const prevTicket = statusTickets[targetIndex - 1];
        newOrder = (prevTicket.order + targetTicket.order) / 2;
      }
    } else {
      if (targetIndex === statusTickets.length - 1) {
        newOrder = targetTicket.order + 1;
      } else {
        const nextTicket = statusTickets[targetIndex + 1];
        newOrder = (targetTicket.order + nextTicket.order) / 2;
      }
    }

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === draggedId ? { ...ticket, status: newStatus, order: newOrder } : ticket
      )
    );
  };

  const renderKanbanBoard = () => {
    // Show empty state if no tickets and user is filtering to "My Tickets"
    if (tickets.length === 0 && showOnlyMyTickets) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🎫</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Tickets Assigned</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have any tickets assigned to you yet.
          </p>
          <button
            onClick={() => setShowOnlyMyTickets(false)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            View All Tickets
          </button>
        </div>
      );
    }

    return (
      <div
        className={`grid grid-cols-1 gap-6`}
        style={{ gridTemplateColumns: `repeat(${Math.min(statuses.length, 6)}, minmax(0, 1fr))` }}
      >
      {statuses.map((statusConfig) => (
        <div
          key={statusConfig.value}
          className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 min-h-96 transition-colors"
          onDragOver={handleDragOver}
          onDrop={(e) => handleColumnDrop(e, statusConfig.value)}
        >
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">
            {statusConfig.label} ({getStatusTickets(statusConfig.value).length})
          </h3>
          <div className="space-y-3">
            {getStatusTickets(statusConfig.value).map((ticket, index) => (
              <div key={ticket.id} className="relative">
                {/* Drop indicator above */}
                {dragOverTicket === ticket.id && dragOverPosition === 'above' && (
                  <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                )}

                <div
                  draggable={boardSettings.dragAndDrop}
                  onDragStart={
                    boardSettings.dragAndDrop ? (e) => handleDragStart(e, ticket) : undefined
                  }
                  onDragOver={
                    boardSettings.dragAndDrop ? (e) => handleTicketDragOver(e, ticket) : undefined
                  }
                  onDragLeave={boardSettings.dragAndDrop ? handleTicketDragLeave : undefined}
                  onDrop={
                    boardSettings.dragAndDrop ? (e) => handleTicketDrop(e, ticket) : undefined
                  }
                  className={`bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border-l-4 cursor-move hover:shadow-md transition-all duration-200 ${getStatusColor(
                    ticket.status
                  )} ${draggedTicket?.id === ticket.id ? 'opacity-50 rotate-2 scale-105' : ''} ${
                    dragOverTicket === ticket.id
                      ? 'ring-2 ring-blue-300 dark:ring-blue-500 ring-opacity-50'
                      : ''
                  }`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      {/* Drag handle */}
                      {boardSettings.dragAndDrop && (
                        <div className="flex flex-col space-y-0.5 mt-1 opacity-40 hover:opacity-70 transition-opacity">
                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                        </div>
                      )}

                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {boardSettings.showTicketIds && `#${ticket.id} • `}
                          {ticket.customer}
                        </p>
                        {boardSettings.showAssignee && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Assigned: {ticket.assigned}
                          </p>
                        )}
                        {ticket.notes && ticket.notes.length > 0 && (
                          <div className="flex items-center mt-1">
                            <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                              💬 {ticket.notes.length} note{ticket.notes.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <select
                        value={ticket.priority}
                        onChange={(e) =>
                          changePriority(ticket.id, e.target.value as 'High' | 'Medium' | 'Low')
                        }
                        className={`text-xs font-medium border-none bg-transparent ${getPriorityColor(ticket.priority)} cursor-pointer`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                      {boardSettings.showPriorityArrows && (
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTicketInColumn(ticket.id, 'up');
                            }}
                            disabled={index === 0}
                            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTicketInColumn(ticket.id, 'down');
                            }}
                            disabled={index === getStatusTickets(status).length - 1}
                            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {ticket.created}
                    </span>
                    <button
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTicket(ticket);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>

                {/* Drop indicator below */}
                {dragOverTicket === ticket.id && dragOverPosition === 'below' && (
                  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                )}
              </div>
            ))}

            {getStatusTickets(status).length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                Drop tickets here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
    );
  };

  const renderListView = () => (
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">All Tickets</h3>
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredTickets.map((ticket) => (
          <li key={ticket.id}>
            <div
              className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => setSelectedTicket(ticket)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    #{ticket.id}
                  </span>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {ticket.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {ticket.customer} • Assigned: {ticket.assigned}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                    {priorities.find((p) => p.value === ticket.priority)?.label || ticket.priority}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status).replace('border-', 'border ')}`}
                  >
                    {statuses.find((s) => s.value === ticket.status)?.label || ticket.status}
                  </span>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{ticket.created}</div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
  const renderCreateTicketModal = () => {
    if (!showCreateTicket) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Create New Ticket
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Fill out the form below to create a new support ticket
                </p>
              </div>
              <button
                onClick={() => setShowCreateTicket(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 overflow-y-auto max-h-[70vh]">
            <div className="space-y-8">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Basic Information
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Ticket Title *
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-lg"
                      placeholder="Brief description of the issue or request"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Description *
                    </label>
                    <textarea
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors"
                      placeholder="Provide detailed information about the issue, including steps to reproduce, expected behavior, and any error messages..."
                    />
                  </div>
                </div>
              </div>

              {/* Assignment & Priority */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Assignment & Priority
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Priority *
                    </label>
                    <select className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
                      {priorities.map((priority) => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Status
                    </label>
                    <select className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
                      {statuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Assigned To
                    </label>
                    <select className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors">
                      <option value="Unassigned">Unassigned</option>
                      {agents.map((agent) => {
                        const agentName = `${agent.firstName} ${agent.lastName}`;
                        const isCurrentUser = user?.id === agent.id;
                        return (
                          <option key={agent.id} value={agentName}>
                            {agentName}{isCurrentUser ? ' (You)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Enter customer's full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Customer Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Options */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Additional Options
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="urgent"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="urgent" className="text-sm text-gray-700 dark:text-gray-300">
                      Mark as urgent (requires immediate attention)
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="notify"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      defaultChecked
                    />
                    <label htmlFor="notify" className="text-sm text-gray-700 dark:text-gray-300">
                      Send email notification to customer
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="internal"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="internal" className="text-sm text-gray-700 dark:text-gray-300">
                      Internal ticket (not visible to customer)
                    </label>
                  </div>
                </div>
              </div>

              {/* File Attachments */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Attachments
                </h3>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  <svg
                    className="w-12 h-12 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Supports: Images, Documents, Archives (Max 10MB per file)
                  </p>
                  <button className="mt-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                    Choose Files
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">* Required fields</div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCreateTicket(false)}
                className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateTicket(false)}
                className="px-8 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTicketModal = () => {
    if (!selectedTicket) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    #{selectedTicket.id}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}
                  >
                    {statuses.find((s) => s.value === selectedTicket.status)?.label ||
                      selectedTicket.status}
                  </span>
                  <span
                    className={`text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}
                  >
                    {priorities.find((p) => p.value === selectedTicket.priority)?.label ||
                      selectedTicket.priority}
                  </span>
                </div>
                {isEditingTitle ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="flex-1 px-3 py-2 text-lg font-semibold border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        updateTicketTitle(selectedTicket.id, editedTitle);
                        setSelectedTicket({ ...selectedTicket, title: editedTitle });
                        setIsEditingTitle(false);
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingTitle(false);
                        setEditedTitle(selectedTicket.title);
                      }}
                      className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 group">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedTicket.title}
                    </h2>
                    <button
                      onClick={() => {
                        setEditedTitle(selectedTicket.title);
                        setIsEditingTitle(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit title"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedTicket.customer} • {selectedTicket.assigned} • {selectedTicket.created}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setActiveModalTab('details');
                  setNewNoteContent('');
                }}
                className="ml-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-8 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveModalTab('details')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeModalTab === 'details'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveModalTab('notes')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeModalTab === 'notes'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Notes
                {selectedTicket.notes && selectedTicket.notes.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {selectedTicket.notes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveModalTab('attachments')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeModalTab === 'attachments'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Attachments
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {selectedTicket.attachments.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex overflow-hidden max-h-[60vh]">
            {/* Main Content Area */}
            <div className="flex-1 px-8 py-6 overflow-y-auto">
              {activeModalTab === 'details' && (
                <div className="space-y-8">
                  {/* Description */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Description
                      </h3>
                      {!isEditingDescription && (
                        <button
                          onClick={() => {
                            setEditedDescription(selectedTicket.description || '');
                            setIsEditingDescription(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Edit description"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                    {isEditingDescription ? (
                      <div className="space-y-3">
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          rows={6}
                          className="w-full px-4 py-3 border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                          autoFocus
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setIsEditingDescription(false);
                              setEditedDescription(selectedTicket.description || '');
                            }}
                            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              updateTicketDescription(selectedTicket.id, editedDescription);
                              setSelectedTicket({
                                ...selectedTicket,
                                description: editedDescription,
                              });
                              setIsEditingDescription(false);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {selectedTicket.description || 'No description provided'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status, Priority & Assignment */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Status
                    </label>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => {
                        moveTicket(selectedTicket.id, e.target.value);
                        setSelectedTicket({ ...selectedTicket, status: e.target.value });
                      }}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      {statuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Priority
                    </label>
                    <select
                      value={selectedTicket.priority}
                      onChange={(e) => {
                        changePriority(selectedTicket.id, e.target.value);
                        setSelectedTicket({ ...selectedTicket, priority: e.target.value });
                      }}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      {priorities.map((priority) => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Assigned To
                    </label>
                    <select
                      value={selectedTicket.assigned}
                      onChange={(e) => {
                        changeAssignment(selectedTicket.id, e.target.value);
                        setSelectedTicket({ ...selectedTicket, assigned: e.target.value });
                      }}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="Unassigned">Unassigned</option>
                      {agents.map((agent) => {
                        const agentName = `${agent.firstName} ${agent.lastName}`;
                        const isCurrentUser = user?.id === agent.id;
                        return (
                          <option key={agent.id} value={agentName}>
                            {agentName}{isCurrentUser ? ' (You)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeModalTab === 'notes' && (
              <div className="space-y-6">
                {/* Add New Note */}
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-6 border border-blue-100 dark:border-blue-900/30">
                  <div className="space-y-4">
                    <textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Add a note to this ticket..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newNoteIsInternal}
                          onChange={(e) => setNewNoteIsInternal(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Internal note (visible to team only)
                        </span>
                      </label>
                      <button
                        onClick={() =>
                          addNoteToTicket(selectedTicket.id, newNoteContent, newNoteIsInternal)
                        }
                        disabled={!newNoteContent.trim()}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        Add Note
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes List */}
                <div className="space-y-4">
                  {selectedTicket.notes && selectedTicket.notes.length > 0 ? (
                    selectedTicket.notes.map((note) => (
                      <div
                        key={note.id}
                        className={`relative rounded-xl p-6 border transition-colors group ${
                          note.isInternal
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {note.isInternal && (
                          <div className="absolute top-4 right-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                              Internal
                            </span>
                          </div>
                        )}

                        {/* Edit/Delete buttons */}
                        {editingNoteId !== note.id && (
                          <div className="absolute top-4 right-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setEditedNoteContent(note.content);
                              }}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                              title="Edit note"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this note?')) {
                                  deleteNoteFromTicket(selectedTicket.id, note.id);
                                }
                              }}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Delete note"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        )}

                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              {note.author.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.author}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {note.timestamp}
                            </p>
                          </div>
                        </div>

                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editedNoteContent}
                              onChange={(e) => setEditedNoteContent(e.target.value)}
                              rows={4}
                              className="w-full px-4 py-3 border border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                              autoFocus
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditedNoteContent('');
                                }}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  editNoteInTicket(selectedTicket.id, note.id, editedNoteContent);
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none">
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {note.content}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        No notes yet
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Start the conversation by adding the first note
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeModalTab === 'attachments' && (
              <div className="space-y-6">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        Array.from(files).forEach((file) => {
                          addAttachmentToTicket(selectedTicket.id, file);
                        });
                      }
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <svg
                      className="w-12 h-12 text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Any file type supported (Max 10MB per file)
                    </p>
                  </label>
                </div>

                {/* Attachments List */}
                <div className="space-y-3">
                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 ? (
                    selectedTicket.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow group"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {/* File Icon */}
                          <div className="flex-shrink-0">
                            {attachment.type.startsWith('image/') ? (
                              <svg
                                className="w-10 h-10 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            ) : attachment.type.includes('pdf') ? (
                              <svg
                                className="w-10 h-10 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-10 h-10 text-gray-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            )}
                          </div>

                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {attachment.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(attachment.size)} • Uploaded by{' '}
                              {attachment.uploadedBy} • {attachment.uploadedAt}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
                          <a
                            href={attachment.url}
                            download={attachment.name}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Download"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                          </a>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${attachment.name}?`)) {
                                deleteAttachmentFromTicket(selectedTicket.id, attachment.id);
                              }
                            }}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                          />
                        </svg>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        No attachments yet
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Upload files to attach them to this ticket
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Sidebar - Customer Info */}
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Contact Info Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Contact Info
                    </h3>
                    {!isEditingContactInfo && (
                      <button
                        onClick={() => {
                          setEditedContactInfo({
                            name: selectedTicket.customerInfo?.name || selectedTicket.customer || '',
                            email: selectedTicket.customerInfo?.email || '',
                            phone: selectedTicket.customerInfo?.phone || '',
                            company: selectedTicket.customerInfo?.company || '',
                            companyId: selectedTicket.customerInfo?.companyId || '',
                            website: selectedTicket.customerInfo?.website || '',
                          });
                          setIsEditingContactInfo(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title={selectedTicket.customerInfo ? "Edit contact info" : "Add contact info"}
                      >
                        {selectedTicket.customerInfo ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {selectedTicket.customerInfo ? (
                    isEditingContactInfo ? (
                      <div className="space-y-3">
                        {/* Edit Form */}
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            Name
                          </label>
                          <input
                            type="text"
                            value={editedContactInfo.name}
                            onChange={(e) => setEditedContactInfo({ ...editedContactInfo, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div className="relative">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            Company
                          </label>
                          <input
                            type="text"
                            value={editedContactInfo.company}
                            onChange={(e) => handleCompanyChange(e.target.value)}
                            onFocus={() => {
                              if (editedContactInfo.company) {
                                searchCompanies(editedContactInfo.company);
                              }
                            }}
                            onBlur={() => {
                              // Delay to allow clicking on dropdown
                              setTimeout(() => {
                                setShowCompanyDropdown(false);
                              }, 200);
                            }}
                            placeholder="Start typing company name..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                          />
                          
                          {/* Dropdown with search results */}
                          {showCompanyDropdown && companySearchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {companySearchResults.map((company) => (
                                <button
                                  key={company.id}
                                  type="button"
                                  onClick={() => {
                                    setEditedContactInfo({
                                      ...editedContactInfo,
                                      company: company.name,
                                      companyId: company.id,
                                      website: company.domain || editedContactInfo.website,
                                    });
                                    setShowCompanyDropdown(false);
                                    setShowCreateCompanyPrompt(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                                >
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {company.name}
                                  </div>
                                  {company.domain && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {company.domain}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* Create company prompt */}
                          {showCreateCompanyPrompt && !showCompanyDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg p-3">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                                Company "{editedContactInfo.company}" does not exist.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCreatingCompany(true);
                                  setShowCreateCompanyPrompt(false);
                                }}
                                className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                              >
                                Create New Company
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editedContactInfo.email}
                            onChange={(e) => setEditedContactInfo({ ...editedContactInfo, email: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={editedContactInfo.phone}
                            onChange={(e) => setEditedContactInfo({ ...editedContactInfo, phone: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                            Website
                          </label>
                          <input
                            type="text"
                            value={editedContactInfo.website}
                            onChange={(e) => setEditedContactInfo({ ...editedContactInfo, website: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                        <div className="flex space-x-2 pt-2">
                          <button
                            onClick={() => {
                              setIsEditingContactInfo(false);
                            }}
                            className="flex-1 px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              updateContactInfo(selectedTicket.id, editedContactInfo);
                              setSelectedTicket({
                                ...selectedTicket,
                                customerInfo: editedContactInfo,
                              });
                              setIsEditingContactInfo(false);
                            }}
                            className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Customer Name */}
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                            Name
                          </div>
                          <div className="text-sm text-gray-900 dark:text-white font-medium">
                            {selectedTicket.customerInfo.name}
                          </div>
                        </div>

                        {/* Company */}
                        {selectedTicket.customerInfo.company && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                              Company
                            </div>
                            <button
                              onClick={async () => {
                                if (selectedTicket.customerInfo?.companyId) {
                                  // If we have the ID, navigate directly
                                  navigate(`/agent/accounts/${selectedTicket.customerInfo.companyId}`);
                                } else {
                                  // Otherwise, search for the company by name
                                  try {
                                    const response = await apiService.getCompanies({ 
                                      search: selectedTicket.customerInfo?.company,
                                      limit: 1 
                                    });
                                    const companies = response.companies || response.data || [];
                                    if (companies.length > 0) {
                                      navigate(`/agent/accounts/${companies[0].id}`);
                                    } else {
                                      alert('Company not found in the system.');
                                    }
                                  } catch (error) {
                                    console.error('Failed to find company:', error);
                                    alert('Failed to find company. Please try again.');
                                  }
                                }
                              }}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline text-left"
                            >
                              {selectedTicket.customerInfo.company}
                            </button>
                          </div>
                        )}

                        {/* Email */}
                        {selectedTicket.customerInfo.email && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                              Email
                            </div>
                            <a
                              href={`mailto:${selectedTicket.customerInfo.email}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {selectedTicket.customerInfo.email}
                            </a>
                          </div>
                        )}

                        {/* Phone */}
                        {selectedTicket.customerInfo.phone && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                              Phone
                            </div>
                            <a
                              href={`tel:${selectedTicket.customerInfo.phone}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {selectedTicket.customerInfo.phone}
                            </a>
                          </div>
                        )}

                        {/* Website */}
                        {selectedTicket.customerInfo.website && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                              Website
                            </div>
                            <a
                              href={`https://${selectedTicket.customerInfo.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {selectedTicket.customerInfo.website}
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  ) : isEditingContactInfo ? (
                    <div className="space-y-3">
                      {/* Edit Form for new contact info */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editedContactInfo.name}
                          onChange={(e) => setEditedContactInfo({ ...editedContactInfo, name: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div className="relative">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                          Company
                        </label>
                        <input
                          type="text"
                          value={editedContactInfo.company}
                          onChange={(e) => handleCompanyChange(e.target.value)}
                          onFocus={() => {
                            if (editedContactInfo.company) {
                              searchCompanies(editedContactInfo.company);
                            }
                          }}
                          onBlur={() => {
                            // Delay to allow clicking on dropdown
                            setTimeout(() => {
                              setShowCompanyDropdown(false);
                            }, 200);
                          }}
                          placeholder="Start typing company name..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        />
                        
                        {/* Dropdown with search results */}
                        {showCompanyDropdown && companySearchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {companySearchResults.map((company) => (
                              <button
                                key={company.id}
                                type="button"
                                onClick={() => {
                                  setEditedContactInfo({
                                    ...editedContactInfo,
                                    company: company.name,
                                    website: company.domain || editedContactInfo.website,
                                  });
                                  setShowCompanyDropdown(false);
                                  setShowCreateCompanyPrompt(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                              >
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {company.name}
                                </div>
                                {company.domain && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {company.domain}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Create company prompt */}
                        {showCreateCompanyPrompt && !showCompanyDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg shadow-lg p-3">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                              Company "{editedContactInfo.company}" does not exist.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingCompany(true);
                                setShowCreateCompanyPrompt(false);
                              }}
                              className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                            >
                              Create New Company
                            </button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                          Email
                        </label>
                        <input
                          type="email"
                          value={editedContactInfo.email}
                          onChange={(e) => setEditedContactInfo({ ...editedContactInfo, email: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={editedContactInfo.phone}
                          onChange={(e) => setEditedContactInfo({ ...editedContactInfo, phone: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                          Website
                        </label>
                        <input
                          type="text"
                          value={editedContactInfo.website}
                          onChange={(e) => setEditedContactInfo({ ...editedContactInfo, website: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <button
                          onClick={() => {
                            setIsEditingContactInfo(false);
                          }}
                          className="flex-1 px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            updateContactInfo(selectedTicket.id, editedContactInfo);
                            setSelectedTicket({
                              ...selectedTicket,
                              customerInfo: editedContactInfo,
                            });
                            setIsEditingContactInfo(false);
                          }}
                          className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      No customer information available
                    </div>
                  )}
                </div>

                {/* Key Information Section */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Key Information
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Ticket ID */}
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        Ticket ID
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white font-mono">
                        #{selectedTicket.id}
                      </div>
                    </div>

                    {/* Created Date */}
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        Created
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {selectedTicket.created}
                      </div>
                    </div>

                    {/* Assigned To */}
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        Assigned To
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {selectedTicket.assigned}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => navigate(`/agent/customers/${selectedTicket.id}`)}
                      className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Customer Profile
                    </button>
                    <button
                      onClick={() => {
                        if (selectedTicket.customerInfo?.email) {
                          window.location.href = `mailto:${selectedTicket.customerInfo.email}`;
                        }
                      }}
                      className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end space-x-3">
            <button
              onClick={() => {
                setSelectedTicket(null);
                setActiveModalTab('details');
                setNewNoteContent('');
              }}
              className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Top Navigation Bar */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left: Logo and Menu */}
            <div className="flex items-center space-x-6">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bomizzel</h1>
              
              {/* Menu Items */}
              <div className="hidden md:flex space-x-1">
                <button
                  onClick={() => navigate('/agent')}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Dashboard</span>
                </button>
                
                <button
                  onClick={() => navigate('/agent/customers')}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Customers</span>
                </button>
                
                <button
                  onClick={() => navigate('/agent/accounts')}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Accounts</span>
                </button>
              </div>
            </div>

            {/* Right: Search, Create, Profile */}
            <div className="flex items-center space-x-3">
              {/* Global Search */}
              <div className="hidden lg:block">
                <AgentGlobalSearch />
              </div>

              {/* Create New Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowCreateMenu(!showCreateMenu)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <span>Create New</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showCreateMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowCreateMenu(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            navigate('/agent/tickets/create?tab=ticket');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700"
                        >
                          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                          </svg>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">New Ticket</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Create ticket for customer</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            navigate('/agent/tickets/create?tab=account');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700"
                        >
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">New Account</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Create new company</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            navigate('/agent/tickets/create?tab=customer');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
                        >
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">New Customer</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Create customer user</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Profile */}
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.firstName}
                  </p>
                </div>
              </button>

              {/* Admin/Settings */}
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Admin Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Logout */}
              <button
                onClick={logout}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sub-header with filters and view toggle */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Tickets</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Drag tickets to reorder or move between columns</p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Templates Button */}
              <button
                onClick={() => setShowTemplates(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <span>Templates</span>
              </button>

              {/* Department Selector */}
              <div className="min-w-[200px]">
                <DepartmentSelector
                  selectedDepartmentId={selectedDepartmentId}
                  onDepartmentChange={setSelectedDepartmentId}
                  showAllOption={true}
                />
              </div>

              {/* Ticket Filter Toggle */}
              <button
                onClick={() => setShowOnlyMyTickets(!showOnlyMyTickets)}
                className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                  showOnlyMyTickets
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                title={showOnlyMyTickets ? 'Show all tickets' : 'Show only my tickets'}
              >
                {showOnlyMyTickets ? 'My Tickets' : 'All Tickets'}
              </button>

              {/* View Toggle */}
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setActiveView('kanban')}
                  className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                    activeView === 'kanban'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setActiveView('list')}
                  className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                    activeView === 'list'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  List
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout with Sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Views</h2>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowCreateView(true)}
                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                  title="Create new view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Debug/Reset Section */}
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="text-xs text-yellow-800 dark:text-yellow-200 space-y-2">
                <div className="font-medium">Debug Info:</div>
                <div>Total tickets: {tickets.length}</div>
                <div>Filtered: {filteredTickets.length}</div>
                <div className="text-xs break-all">
                  Statuses: {statuses.map((s) => s.value).join(', ')}
                </div>
                <div className="text-xs break-all">
                  Ticket statuses: {[...new Set(tickets.map((t) => t.status))].join(', ')}
                </div>
                <button
                  onClick={() => {
                    if (confirm('Reset to default tickets? This will clear all current tickets.')) {
                      if (user) {
                        const userKey = `agent-tickets-${user.id}`;
                        localStorage.removeItem(userKey);
                      }
                      window.location.reload();
                    }
                  }}
                  className="mt-2 w-full px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                >
                  Reset to Default Tickets
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Default Views */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Default Views
                </h3>
                <div className="space-y-1">
                  {defaultViews.map((view) => {
                    const count = tickets.filter(view.filter).length;
                    return (
                      <button
                        key={view.id}
                        onClick={() => setActiveViewFilter(view.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                          activeViewFilter === view.id
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="mr-2">{view.icon}</span>
                          <span>{view.name}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            activeViewFilter === view.id
                              ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agent Queue */}
              <div>
                <button
                  onClick={() => setIsAgentQueueCollapsed(!isAgentQueueCollapsed)}
                  className="w-full flex items-center justify-between mb-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
                >
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Agent Queue
                  </h3>
                  <svg
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
                      isAgentQueueCollapsed ? '-rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!isAgentQueueCollapsed && (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {agents.length > 0 ? (
                      agents
                        .sort((a, b) => {
                          const aName = `${a.firstName} ${a.lastName}`;
                          const bName = `${b.firstName} ${b.lastName}`;
                          return aName.localeCompare(bName);
                        })
                        .map((agent) => {
                          const agentName = `${agent.firstName} ${agent.lastName}`;
                          const agentTickets = tickets.filter(t => 
                            t.assigned === agentName || 
                            t.assigned === agent.firstName ||
                            (user?.id === agent.id && t.assigned === 'You')
                          );
                          const isActive = activeViewFilter === `agent-${agentName}`;
                          const isCurrentUser = user?.id === agent.id;
                          
                          return (
                            <button
                              key={agent.id}
                              onClick={() => {
                                setActiveViewFilter(`agent-${agentName}`);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  isCurrentUser
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-green-500 text-white'
                                }`}>
                                  {agent.firstName.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate">
                                  {agentName}
                                  {isCurrentUser && ' (You)'}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                  isActive
                                    ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200'
                                    : agentTickets.length > 0
                                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                {agentTickets.length}
                              </span>
                            </button>
                          );
                        })
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">
                        No agents found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Custom Views */}
              {customViews.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Custom Views
                  </h3>
                  <div className="space-y-1">
                    {customViews.map((view) => {
                      // Calculate count for this specific view
                      const viewTickets = tickets.filter((ticket) => {
                        let matches = true;
                        if (view.filters.status && view.filters.status !== 'all') {
                          matches = matches && ticket.status === view.filters.status;
                        }
                        if (view.filters.priority && view.filters.priority !== 'all') {
                          matches = matches && ticket.priority === view.filters.priority;
                        }
                        if (view.filters.assigned && view.filters.assigned !== 'all') {
                          matches = matches && ticket.assigned === view.filters.assigned;
                        }
                        return matches;
                      });
                      const count = viewTickets.length;
                      return (
                        <div key={view.id} className="group relative">
                          <button
                            onClick={() => setActiveViewFilter(view.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                              activeViewFilter === view.id
                                ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center">
                              <span className="mr-2">{view.icon}</span>
                              <span>{view.name}</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                activeViewFilter === view.id
                                  ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete view "${view.name}"?`)) {
                                setCustomViews(customViews.filter((v) => v.id !== view.id));
                                if (activeViewFilter === view.id) {
                                  setActiveViewFilter('all-tickets');
                                }
                              }
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete view"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Stats */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Total
                        </dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white">
                          {filteredTickets.length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {statuses.map((statusConfig) => (
                <div
                  key={statusConfig.value}
                  className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            {statusConfig.label}
                          </dt>
                          <dd className="text-lg font-medium text-gray-900 dark:text-white">
                            {getStatusTickets(statusConfig.value).length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Content */}
            {activeView === 'kanban' ? renderKanbanBoard() : renderListView()}
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <AgentProfile
          onClose={() => setShowProfile(false)}
          boardSettings={boardSettings}
          onBoardSettingsChange={handleBoardSettingsChange}
        />
      )}

      {/* Create Ticket Modal */}
      {renderCreateTicketModal()}

      {/* Ticket Modal */}
      {renderTicketModal()}

      {/* Templates Modal */}
      {showTemplates && (
        <KanbanTemplates
          onClose={() => setShowTemplates(false)}
          onSelectTemplate={handleSelectTemplate}
        />
      )}

      {/* Create View Modal */}
      {showCreateView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create Custom View
              </h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newView = {
                  id: `custom-${Date.now()}`,
                  name: formData.get('name') as string,
                  icon: '⭐',
                  filters: {
                    status: formData.get('status') as string,
                    priority: formData.get('priority') as string,
                    assigned: formData.get('assigned') as string,
                  },
                };
                setCustomViews([...customViews, newView]);
                setActiveViewFilter(newView.id);
                setShowCreateView(false);
              }}
              className="p-6 space-y-6"
            >
              {/* View Name */}
              <div>
                <label className="block text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  View Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Enter view name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Filter Criteria */}
              <div>
                <label className="block text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  Filter Criteria *
                </label>
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex items-center justify-center pt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-6">1</span>
                  </div>
                  <div className="flex-1">
                    <select
                      name="field"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                    >
                      <option value="">-- Click to select --</option>
                      <optgroup label="TICKETS">
                        <option value="subject">Subject</option>
                        <option value="description">Description</option>
                        <option value="contact_name">Contact Name</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                      </optgroup>
                      <optgroup label="PROPERTIES">
                        <option value="status">Status</option>
                        <option value="priority">Priority</option>
                        <option value="product">Product</option>
                        <option value="ticket_owner">Ticket Owner</option>
                        <option value="assigned_to">Assigned To</option>
                        <option value="created_by">Created By</option>
                        <option value="modified_by">Modified By</option>
                        <option value="created_time">Created Time</option>
                        <option value="modified_time">Modified Time</option>
                        <option value="due_date">Due Date</option>
                        <option value="category">Category</option>
                        <option value="tags">Tags</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="w-32">
                    <select
                      name="operator"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                    >
                      <option value="is">is</option>
                      <option value="isnt">isn't</option>
                      <option value="starts_with">starts with</option>
                      <option value="ends_with">ends with</option>
                      <option value="contains">contains</option>
                      <option value="doesnt_contain">doesn't contain</option>
                      <option value="is_empty">is empty</option>
                      <option value="is_not_empty">is not empty</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      name="value"
                      placeholder="Enter comma separated values"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex items-center pt-2">
                    <button
                      type="button"
                      className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-300 dark:border-blue-600"
                      title="Add filter"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Visible To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Visible To
                </label>
                <select
                  name="visibility"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="only_me">Only Me</option>
                  <option value="team">My Team</option>
                  <option value="everyone">Everyone</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowCreateView(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Company Modal */}
      {isCreatingCompany && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create New Company
              </h3>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const companyName = formData.get('name') as string;
                const companyDomain = formData.get('domain') as string;

                try {
                  // Create company via API
                  const response = await apiService.createCompany({
                    name: companyName,
                    domain: companyDomain,
                  });

                  const newCompany = response.company || response;

                  // Update the contact info with the new company
                  setEditedContactInfo({
                    ...editedContactInfo,
                    company: companyName,
                    companyId: newCompany.id,
                    website: companyDomain || editedContactInfo.website,
                  });

                  setIsCreatingCompany(false);
                  alert('Company created successfully!');
                } catch (error) {
                  console.error('Failed to create company:', error);
                  alert('Failed to create company. Please try again.');
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editedContactInfo.company}
                  placeholder="e.g., Acme Corporation"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  name="domain"
                  placeholder="e.g., acmecorp.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCompany(false);
                    setShowCreateCompanyPrompt(true);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
