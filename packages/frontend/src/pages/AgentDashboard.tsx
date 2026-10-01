import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AgentProfile from '../components/AgentProfile';
import DepartmentSelector from '../components/DepartmentSelector';
import AgentGlobalSearch from '../components/AgentGlobalSearch';
import ModulesNav from '../components/ModulesNav';
import KanbanTemplates, { Template } from '../components/KanbanTemplates';
import { apiService } from '../services/api';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTicketCard from '../components/SortableTicketCard';
import DroppableColumn from '../components/DroppableColumn';

// The board's Resolved and Closed lanes hold only recently finished tickets;
// with thousands of tickets they'd otherwise hold every one ever finished.
const DONE_LANE_DAYS = 7;
// Pages of 100 loaded for the board (unfinished + recently finished tickets).
const MAX_BOARD_PAGES = 10;

// Why a ticket was finished. Asked for when it's resolved; 'no_response' is
// only ever set by the server.
const RESOLUTION_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  wont_do: "Won't do",
  duplicate: 'Duplicate',
  no_response: 'No response',
};
const RESOLUTION_CHOICES = ['fixed', 'wont_do', 'duplicate'];

interface Ticket {
  id: number;
  // Permanent number (#1001...). `id` above is only this page's local key.
  ticketNumber?: number | null;
  title: string;
  status: string;
  priority: string;
  customer: string;
  assigned: string;
  created: string;
  // When it was resolved / closed (ISO), for "Resolved Today" and the done lanes
  resolvedAt?: string | null;
  closedAt?: string | null;
  // Why it was resolved or closed (see RESOLUTION_LABELS)
  resolution?: string | null;
  // Saved place in its lane (lower = higher up); null if never placed
  boardPosition?: number | null;
  // Standard fields from the ticket layout, and its custom field values
  productId?: number | null;
  phone?: string | null;
  customFieldValues?: Record<string, unknown>;
  description?: string;
  departmentId?: number | null;
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
  uploadedById?: string;
  isImage?: boolean;
}

/** An attachment as the API returns it, in the dashboard's shape. */

interface TicketNote {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  isInternal: boolean;
  // Came in as the customer's email reply
  viaEmail?: boolean;
  // Formatted version (bold, colours, highlight, lists); null for plain notes
  contentHtml?: string | null;
}

/** Plain text as editor HTML, for editing a note that has no formatting yet. */

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
  const [showOnlyMyTickets, setShowOnlyMyTickets] = useState(false); // Default to showing all tickets so Shane can see them

  // FORCE default statuses - bypass localStorage corruption
  const getStatuses = (): StatusOption[] => {
    // ALWAYS return default statuses to fix Shane's issue
    const defaultStatuses = [
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

    return defaultStatuses;
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

  const [statuses, setStatuses] = useState<StatusOption[]>(() => {
    const defaultStatuses = getStatuses();
    return defaultStatuses;
  });
  const [priorities] = useState<PriorityOption[]>(getPriorities());

  // Priority is a number on the server (0, 1, 2, ...) and a named option here,
  // matched by the options' order: low=0, medium=1, high=2, critical=3 by
  // default. Every view uses this one mapping - the Kanban card had its own
  // capitalised "High"/"Medium"/"Low" list, which matched nothing, so every
  // card showed High.
  const orderedPriorities = [...priorities]
    .filter((p) => p.isActive !== false)
    .sort((a, b) => a.order - b.order);
  const priorityFromNumber = (n: number): string => {
    if (!orderedPriorities.length) return 'low';
    const i = Math.min(Math.max(Number(n) || 0, 0), orderedPriorities.length - 1);
    return orderedPriorities[i].value;
  };

  // A ticket from the API in the shape this page uses. `id` is a local key;
  // the ticket's UUID goes in ticketIdMap.
  const toDashboardTicket = (t: any, numericId: number): Ticket => {
    const assignedName = t.assignedTo
      ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`
      : 'Unassigned';
    const isAssignedToCurrentUser = user && t.assignedTo?.id === user.id;
    return {
      id: numericId,
      title: t.title,
      status: t.status,
      priority: priorityFromNumber(t.priority),
      customer: t.submitter ? `${t.submitter.firstName} ${t.submitter.lastName}` : 'Unknown',
      assigned: isAssignedToCurrentUser ? 'You' : assignedName,
      created: new Date(t.createdAt).toLocaleDateString(),
      ticketNumber: t.ticketNumber ?? null,
      resolvedAt: t.resolvedAt || null,
      closedAt: t.closedAt || null,
      resolution: t.resolution || null,
      boardPosition: t.boardPosition ?? null,
      productId: t.productId ?? null,
      phone: t.phone ?? null,
      customFieldValues: t.customFieldValues || {},
      description: t.description || '',
      departmentId: t.departmentId ?? null,
      order: 0, // set when the lanes are ordered
      customerInfo: t.submitter
        ? {
            name: `${t.submitter.firstName} ${t.submitter.lastName}`,
            email: t.submitter.email,
            company: t.company?.name || '',
            companyId: t.companyId,
          }
        : undefined,
    };
  };
  const numberFromPriority = (value: string): number =>
    Math.max(
      0,
      orderedPriorities.findIndex((p) => p.value === value)
    );

  // Load tickets from localStorage or use defaults
  const getInitialTickets = (): Ticket[] => {
    if (!user) return [];

    const userKey = `agent-tickets-${user.id}`;
    const saved = localStorage.getItem(userKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // If parsing fails, start empty
      }
    }
    // Start empty; the real tickets load from the server. This used to fall
    // back to a list of made-up tickets, which stayed on screen whenever the
    // server returned none.
    return [];
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
        return { ...ticketWithNotes, status: firstStatus.value };
      }

      return ticketWithNotes;
    });
  };

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketIdMap, setTicketIdMap] = useState<Map<number, string>>(new Map()); // Maps numeric ID to UUID
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  // A move to Resolved waiting on "how was it resolved?". Cancel puts the
  // ticket back in previousStatus.
  const [pendingResolution, setPendingResolution] = useState<{
    ticketId: number;
    previousStatus: string;
  } | null>(null);

  // Load initial tickets when user is available
  useEffect(() => {
    if (user) {
      const initialTickets = migrateTickets(getInitialTickets(), statuses);
      setTickets(initialTickets);

      // Load ticket ID mapping from localStorage
      const idMapKey = `agent-ticket-ids-${user.id}`;
      const savedIdMap = localStorage.getItem(idMapKey);
      if (savedIdMap) {
        try {
          const idMapArray = JSON.parse(savedIdMap);
          const idMapping = new Map<number, string>(idMapArray);
          setTicketIdMap(idMapping);
        } catch (error) {
          console.error('Failed to load ticket ID mapping:', error);
        }
      }
    }
  }, [user]); // Only run when user becomes available

  // Fetch real tickets from API only on initial load or filter change
  useEffect(() => {
    const fetchTickets = async () => {
      // Only fetch if user is authenticated
      if (!user) {
        return;
      }

      // Always load from the server. This skipped the request whenever
      // tickets were cached in the browser, so the list went stale and the
      // department picker never changed what was shown.
      const filterKey = `agent-filter-${user.id}`;
      localStorage.setItem(filterKey, showOnlyMyTickets.toString());

      try {
        // Get tickets based on filter preference
        const ticketParams: any = { limit: 100 };
        if (showOnlyMyTickets && user) {
          ticketParams.assignedToId = user.id;
        }
        if (selectedDepartmentId) {
          ticketParams.departmentId = selectedDepartmentId;
        }

        // Every unfinished ticket, but resolved/closed ones only from the last
        // DONE_LANE_DAYS days - and page through them, rather than stopping at
        // the first 100 tickets (older open work used to just not appear).
        ticketParams.finishedWithinDays = DONE_LANE_DAYS;
        const apiTickets: any[] = [];
        for (let page = 1; page <= MAX_BOARD_PAGES; page++) {
          const response = await apiService.getTickets({ ...ticketParams, page });
          apiTickets.push(...(response.data || response.tickets || []));
          const totalPages = response.pagination?.totalPages || 1;
          if (page >= totalPages) break;
        }

        // Create ID mapping from numeric to UUID
        const idMapping = new Map<number, string>();

        // Transform API tickets to dashboard format
        const transformedTickets = apiTickets.map((t: any, index: number) => {
          // A numeric key for this page; the UUID is kept in idMapping
          const numericId = index + 1000;
          idMapping.set(numericId, t.id);
          return toDashboardTicket(t, numericId);
        });

        // Assign proper order within each status column
        const ticketsByStatus: { [key: string]: any[] } = {};
        transformedTickets.forEach((ticket: any) => {
          if (!ticketsByStatus[ticket.status]) {
            ticketsByStatus[ticket.status] = [];
          }
          ticketsByStatus[ticket.status].push(ticket);
        });

        // Set order for each status group: tickets someone placed on the
        // board first, in their saved order, then the rest as the server
        // listed them.
        Object.keys(ticketsByStatus).forEach((status) => {
          ticketsByStatus[status]
            .map((ticket, index) => ({ ticket, index }))
            .sort(
              (a, b) =>
                (a.ticket.boardPosition ?? Infinity) - (b.ticket.boardPosition ?? Infinity) ||
                a.index - b.index
            )
            .forEach(({ ticket }, index) => {
              ticket.order = index + 1;
            });
        });

        // Replace the list even when it's empty - a department with no
        // tickets must show none, not whatever was on screen before.
        {
          const migratedTickets = migrateTickets(transformedTickets, statuses);
          setTickets(migratedTickets);
          setTicketIdMap(idMapping);

          // Save ID mapping to localStorage
          const idMapKey = `agent-ticket-ids-${user.id}`;
          localStorage.setItem(idMapKey, JSON.stringify(Array.from(idMapping.entries())));
        }
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
        // Keep using localStorage tickets on error
      }
    };

    fetchTickets();
  }, [user, showOnlyMyTickets, selectedDepartmentId]); // Re-fetch when the user, filter or department changes

  // Fetch team statuses from API
  useEffect(() => {
    const fetchTeamStatuses = async () => {
      if (!user) {
        setLoadingStatuses(false);
        return;
      }

      // Always ensure we have default statuses first
      const defaultStatuses = getStatuses();

      setStatuses(defaultStatuses);

      // If we have a teamId, try to fetch team-specific statuses
      if (teamId) {
        try {
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
            setStatuses(transformedStatuses);
          }
        } catch (error) {
          console.error('[AgentDashboard] Failed to fetch team statuses:', error);
        }
      }

      setLoadingStatuses(false);
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
      } catch (error) {
        console.error('[AgentDashboard] Failed to get user team:', error);
      }
    };

    getUserTeamId();
  }, [user]);

  // dnd-kit sensor with activation constraint to avoid accidental drags
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [editedContactInfo, setEditedContactInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    companyId: '',
    website: '',
  });
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

  // Default views for filtering - use same logic as main filtering
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
      filter: (ticket: Ticket) => {
        // Use same logic as main filtering
        const currentUserName = user ? `${user.firstName} ${user.lastName}` : '';
        return (
          ticket.assigned === 'You' ||
          ticket.assigned === currentUserName ||
          (user && ticket.assigned === user.email)
        );
      },
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
      name: 'Resolved Today',
      icon: '✅',
      filter: (ticket: Ticket) => {
        // Resolved or closed today, by when that happened. This used to check
        // the date the ticket was created, as a stand-in.
        const when = ticket.resolvedAt || ticket.closedAt;
        if (!when || !['resolved', 'closed'].includes(ticket.status)) return false;
        return new Date(when).toDateString() === new Date().toDateString();
      },
      isDefault: true,
    },
  ];

  // Memoized filtered tickets to prevent excessive re-renders during drag operations
  const filteredTickets = useMemo(() => {
    const currentUserName = user ? `${user.firstName} ${user.lastName}` : '';
    const isMine = (ticket: Ticket) =>
      ticket.assigned === 'You' ||
      ticket.assigned === currentUserName ||
      (!!user && ticket.assigned === user.email);

    // One agent's tickets (the "Agent queues" list)
    if (activeViewFilter.startsWith('agent-')) {
      const name = activeViewFilter.slice('agent-'.length);
      return tickets.filter(
        (t) => t.assigned === name || (name === currentUserName && t.assigned === 'You')
      );
    }
    // The built-in views use their own filter. Only four of them were wired
    // up here, so "Resolved Today" (and the agent queues) showed every ticket.
    const view = defaultViews.find((v) => v.id === activeViewFilter);
    if (view) return tickets.filter(view.filter);

    return showOnlyMyTickets ? tickets.filter(isMine) : tickets;
    // defaultViews is rebuilt each render but only depends on user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, activeViewFilter, showOnlyMyTickets, user]);

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
    if (user && tickets.length >= 0) {
      // Save even if 0 tickets (empty state)
      const userKey = `agent-tickets-${user.id}`;
      localStorage.setItem(userKey, JSON.stringify(tickets));
    }
  }, [tickets, user]);

  // Tickets open on their own page (/agent/tickets/<id>). Old links to
  // /agent?ticket=<id> are sent there.
  const [searchParams] = useSearchParams();
  const ticketToOpen = searchParams.get('ticket');
  useEffect(() => {
    if (ticketToOpen)
      navigate(`/agent/tickets/${encodeURIComponent(ticketToOpen)}`, { replace: true });
  }, [ticketToOpen, navigate]);
  const openTicket = (ticket: Ticket) => {
    const uuid = ticketIdMap.get(ticket.id);
    if (uuid) navigate(`/agent/tickets/${uuid}`);
  };

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
        const uniqueAgents = Array.from(new Set(tickets.map((t) => t.assigned)))
          .filter((name) => name !== 'Unassigned')
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

  // Memoized function to get tickets by status to prevent excessive re-renders during drag
  const getStatusTickets = useCallback(
    (status: string) => {
      const statusTickets = filteredTickets
        .filter((t) => t.status === status)
        .sort((a, b) => a.order - b.order);

      return statusTickets;
    },
    [filteredTickets]
  );

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

  // Show a ticket in a new status (board and open ticket view).
  const applyStatus = (ticketId: number, newStatus: string, resolution?: string | null) => {
    const now = new Date().toISOString();
    const finished = ['resolved', 'closed'].includes(newStatus);
    const update = (ticket: Ticket): Ticket => ({
      ...ticket,
      status: newStatus,
      // Mirrors what the server records, so "Resolved Today" counts it now.
      ...(newStatus === 'resolved' && !ticket.resolvedAt ? { resolvedAt: now } : {}),
      ...(newStatus === 'closed' && !ticket.closedAt ? { closedAt: now } : {}),
      resolution: finished ? (resolution ?? ticket.resolution ?? null) : null,
    });
    setTickets((prev) => {
      const current = prev.find((t) => t.id === ticketId);
      if (!current) return prev;
      const moved = current.status !== newStatus;
      const maxOrder = Math.max(
        0,
        ...prev.filter((t) => t.status === newStatus).map((t) => t.order)
      );
      return prev.map((t) =>
        t.id === ticketId ? { ...update(t), ...(moved ? { order: maxOrder + 1 } : {}) } : t
      );
    });
  };

  // Save a status change; on failure the ticket goes back to previousStatus.
  const persistStatus = async (
    ticketId: number,
    newStatus: string,
    previousStatus: string,
    resolution?: string
  ) => {
    applyStatus(ticketId, newStatus, resolution);
    const uuidTicketId = ticketIdMap.get(ticketId);
    if (!uuidTicketId) {
      console.error(`[moveTicket] No UUID found for ticket ${ticketId}`);
      applyStatus(ticketId, previousStatus);
      return;
    }
    try {
      await apiService.updateTicket(uuidTicketId, {
        status: newStatus,
        ...(resolution ? { resolution } : {}),
      });
    } catch (error: any) {
      console.error('[moveTicket] Failed to update ticket status:', error);
      applyStatus(ticketId, previousStatus);
      alert(`Failed to move ticket: ${error.response?.data?.message || error.message}`);
    }
  };

  // Moving to Resolved asks why first; any other move saves straight away.
  const requestStatusChange = (ticketId: number, newStatus: string, previousStatus: string) => {
    if (newStatus === previousStatus) return;
    if (newStatus === 'resolved') {
      applyStatus(ticketId, newStatus);
      setPendingResolution({ ticketId, previousStatus });
      return;
    }
    persistStatus(ticketId, newStatus, previousStatus);
  };
  // The drag handlers are memoised once, so they reach the current one here.
  const requestStatusChangeRef = useRef(requestStatusChange);
  requestStatusChangeRef.current = requestStatusChange;

  const chooseResolution = (resolution: string | null) => {
    const pending = pendingResolution;
    setPendingResolution(null);
    if (!pending) return;
    if (resolution) {
      persistStatus(pending.ticketId, 'resolved', pending.previousStatus, resolution);
    } else {
      applyStatus(pending.ticketId, pending.previousStatus);
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
        // Convert priority to the server's number (same mapping as every view)
        const priorityValue = numberFromPriority(newPriority);
        await apiService.updateTicket(uuidTicketId, { priority: priorityValue });
        console.log(`Updated ticket ${ticketId} priority to ${newPriority}`);
      }
    } catch (error) {
      console.error('Failed to update ticket priority:', error);
    }
  };

  // Save a lane's order, top to bottom, so it's the same after a reload
  // and for everyone else. It used to live only in this page.
  const saveLaneOrder = async (lane: Ticket[]) => {
    const ids = lane
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((t) => ticketIdMap.get(t.id))
      .filter((id): id is string => !!id);
    if (ids.length === 0) return;
    try {
      await apiService.updateBoardOrder(ids);
    } catch (error: any) {
      console.error('[AgentDashboard] Failed to save board order:', error);
      alert(`Couldn't save the new order: ${error.response?.data?.error || error.message}`);
    }
  };
  const saveLaneOrderRef = useRef(saveLaneOrder);
  saveLaneOrderRef.current = saveLaneOrder;

  const moveTicketInColumn = (ticketId: number, direction: 'up' | 'down') => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    // The whole lane, not just what the current filter shows
    const lane = tickets
      .filter((t) => t.status === ticket.status)
      .sort((a, b) => a.order - b.order);
    const visible = getStatusTickets(ticket.status);
    const visibleIndex = visible.findIndex((t) => t.id === ticketId);
    const neighbour = visible[direction === 'up' ? visibleIndex - 1 : visibleIndex + 1];
    if (!neighbour) return;

    const from = lane.findIndex((t) => t.id === ticketId);
    const to = lane.findIndex((t) => t.id === neighbour.id);
    lane.splice(from, 1);
    lane.splice(to, 0, ticket);
    const order = new Map(lane.map((t, i) => [t.id, i + 1]));

    setTickets((prev) =>
      prev.map((t) => (order.has(t.id) ? { ...t, order: order.get(t.id)! } : t))
    );
    saveLaneOrder(lane.map((t) => ({ ...t, order: order.get(t.id)! })));
  };

  // dnd-kit drag handlers
  // Status when the drag began. Dragging over another lane moves the card
  // there as you go, so by the drop the card already shows the new status.
  const dragStartStatusRef = useRef<string | null>(null);
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;

  const handleDndDragStart = useCallback((event: DragStartEvent) => {
    const id = Number(event.active.id);
    setActiveDragId(id);
    dragStartStatusRef.current = ticketsRef.current.find((t) => t.id === id)?.status ?? null;
  }, []);

  const handleDndDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    const activeId = Number(active.id);
    const startStatus = dragStartStatusRef.current;
    dragStartStatusRef.current = null;
    const dragged = ticketsRef.current.find((t) => t.id === activeId);
    if (!dragged || !startStatus) return;

    if (!over) {
      // Dropped outside the board: back where it started.
      if (dragged.status !== startStatus) {
        setTickets((prev) =>
          prev.map((t) => (t.id === activeId ? { ...t, status: startStatus } : t))
        );
      }
      return;
    }

    const overId = String(over.id);
    let targetStatus = dragged.status;
    if (overId.startsWith('column-')) {
      targetStatus = overId.replace('column-', '');
    } else if (overId !== String(activeId)) {
      const overTicket = ticketsRef.current.find((t) => t.id === Number(overId));
      if (overTicket) targetStatus = overTicket.status;
    }

    const prev = ticketsRef.current;

    // The target lane in order. Dragging into a lane already put the card
    // there (at the end); otherwise add it at the end.
    let lane = prev.filter((t) => t.status === targetStatus).sort((a, b) => a.order - b.order);
    if (!lane.some((t) => t.id === activeId)) lane = [...lane, dragged];
    // Dropped on a card: take that card's place. On the lane itself, or on
    // its own spot: stay where it is.
    const from = lane.findIndex((t) => t.id === activeId);
    const overIndex = lane.findIndex((t) => String(t.id) === overId);
    const columnTickets = arrayMove(lane, from, overIndex === -1 ? from : overIndex).map((t) =>
      t.id === activeId ? { ...t, status: targetStatus } : t
    );

    const order = new Map(columnTickets.map((t, i) => [t.id, i + 1]));
    const unchanged =
      targetStatus === startStatus &&
      columnTickets.every((t) => prev.find((p) => p.id === t.id)?.order === order.get(t.id));
    if (!unchanged) {
      setTickets((current) =>
        current.map((t) =>
          order.has(t.id) ? { ...t, status: targetStatus, order: order.get(t.id)! } : t
        )
      );
      saveLaneOrderRef.current(columnTickets.map((t) => ({ ...t, order: order.get(t.id)! })));
    }

    // This used to change the board only, so a dragged ticket went back to
    // its old status on the next reload.
    if (targetStatus !== startStatus) {
      requestStatusChangeRef.current(activeId, targetStatus, startStatus);
    }
  }, []);

  const handleDndDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    const overId = String(over.id);

    // Determine target status
    let targetStatus: string | null = null;
    if (overId.startsWith('column-')) {
      targetStatus = overId.replace('column-', '');
    } else {
      setTickets((prev) => {
        const overTicket = prev.find((t) => t.id === Number(overId));
        const draggedTicket = prev.find((t) => t.id === activeId);
        if (!overTicket || !draggedTicket) return prev;
        if (draggedTicket.status === overTicket.status) return prev;

        // Move to new column at the end for visual feedback
        const targetColumnTickets = prev.filter(
          (t) => t.status === overTicket.status && t.id !== activeId
        );
        const maxOrder =
          targetColumnTickets.length > 0 ? Math.max(...targetColumnTickets.map((t) => t.order)) : 0;

        return prev.map((t) =>
          t.id === activeId ? { ...t, status: overTicket.status, order: maxOrder + 1 } : t
        );
      });
      return;
    }

    if (targetStatus) {
      setTickets((prev) => {
        const draggedTicket = prev.find((t) => t.id === activeId);
        if (!draggedTicket || draggedTicket.status === targetStatus) return prev;

        const targetColumnTickets = prev.filter(
          (t) => t.status === targetStatus && t.id !== activeId
        );
        const maxOrder =
          targetColumnTickets.length > 0 ? Math.max(...targetColumnTickets.map((t) => t.order)) : 0;

        return prev.map((t) =>
          t.id === activeId ? { ...t, status: targetStatus!, order: maxOrder + 1 } : t
        );
      });
    }
  }, []);

  const activeDragTicket = useMemo(
    () => (activeDragId ? (tickets.find((t) => t.id === activeDragId) ?? null) : null),
    [activeDragId, tickets]
  );

  const renderKanbanBoard = () => {
    // CRITICAL: Force default statuses if we have none
    if (statuses.length === 0) {
      const defaultStatuses = getStatuses();

      // Use setTimeout to prevent infinite re-render
      setTimeout(() => setStatuses(defaultStatuses), 0);

      // EMERGENCY MODE: Show tickets as simple list when kanban fails
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-100 border-l-4 border-red-500 p-6 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">🚨 EMERGENCY MODE FOR SHANE</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Kanban board failed to initialize. Showing tickets in emergency list mode.</p>
                  <p className="mt-1">
                    Tickets loaded: <strong>{tickets.length}</strong> | Statuses:{' '}
                    <strong>{statuses.length}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show empty state if no tickets and user is filtering to "My Tickets"
    if (tickets.length === 0 && showOnlyMyTickets) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🎫</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Tickets Assigned
          </h3>
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

    if (tickets.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📭</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tickets yet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {showOnlyMyTickets || selectedDepartmentId
              ? 'Nothing here with the current filters - try All Tickets or All Departments.'
              : 'New tickets from your customers, the portal or email will show up here.'}
          </p>
        </div>
      );
    }

    if (filteredTickets.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No tickets match this view
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try a different view on the left, or clear the filter.
          </p>
          <button
            onClick={() => setActiveViewFilter('all-tickets')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Show all tickets
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDndDragStart}
          onDragOver={handleDndDragOver}
          onDragEnd={handleDndDragEnd}
        >
          <div
            className={`grid grid-cols-1 gap-6`}
            style={{
              gridTemplateColumns: `repeat(${Math.min(statuses.length, 6)}, minmax(0, 1fr))`,
            }}
          >
            {statuses.map((statusConfig) => {
              const statusTickets = getStatusTickets(statusConfig.value);
              const ticketIds = statusTickets.map((t) => String(t.id));

              return (
                <SortableContext
                  key={statusConfig.value}
                  items={ticketIds}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn
                    id={`column-${statusConfig.value}`}
                    className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 min-h-96 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                      {statusConfig.label} ({statusTickets.length})
                      {['resolved', 'closed'].includes(statusConfig.value) && (
                        <span
                          className="block text-xs font-normal text-gray-500 dark:text-gray-400"
                          title="Older finished tickets stay in the list view and search"
                        >
                          Last {DONE_LANE_DAYS} days
                        </span>
                      )}
                    </h3>
                    <div className="space-y-3">
                      {statusTickets.map((ticket, index) => (
                        <SortableTicketCard
                          key={ticket.id}
                          id={String(ticket.id)}
                          disabled={!boardSettings.dragAndDrop}
                        >
                          <div
                            className={`bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border-l-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 ${getStatusColor(
                              ticket.status
                            )} ${activeDragId === ticket.id ? 'opacity-50 scale-95' : ''}`}
                            onClick={() => openTicket(ticket)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-2 flex-1">
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
                                    {boardSettings.showTicketIds &&
                                      `#${ticket.ticketNumber ?? ticket.id} • `}
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
                                        💬 {ticket.notes.length} note
                                        {ticket.notes.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end space-y-1">
                                <select
                                  value={ticket.priority}
                                  onChange={(e) => changePriority(ticket.id, e.target.value)}
                                  className={`text-xs font-medium border-none bg-transparent ${getPriorityColor(ticket.priority)} cursor-pointer`}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  {orderedPriorities.map((p) => (
                                    <option key={p.value} value={p.value}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                                {boardSettings.showPriorityArrows && (
                                  <div className="flex flex-col space-y-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveTicketInColumn(ticket.id, 'up');
                                      }}
                                      onPointerDown={(e) => e.stopPropagation()}
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
                                      onPointerDown={(e) => e.stopPropagation()}
                                      disabled={index === statusTickets.length - 1}
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
                                  openTicket(ticket);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </SortableTicketCard>
                      ))}

                      {statusTickets.length === 0 && (
                        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                          Drop tickets here
                        </div>
                      )}
                    </div>
                  </DroppableColumn>
                </SortableContext>
              );
            })}
          </div>

          <DragOverlay>
            {activeDragTicket ? (
              <div
                className={`bg-white dark:bg-gray-700 p-4 rounded-lg shadow-lg border-l-4 rotate-2 ${getStatusColor(activeDragTicket.status)}`}
              >
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {activeDragTicket.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {activeDragTicket.customer}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
              onClick={() => openTicket(ticket)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    #{ticket.ticketNumber ?? ticket.id}
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
                    {statuses.find((s) => s.value === ticket.status)?.label ||
                      (ticket.status === 'closed' ? 'Closed' : ticket.status)}
                    {ticket.resolution &&
                      ['resolved', 'closed'].includes(ticket.status) &&
                      ` · ${RESOLUTION_LABELS[ticket.resolution] || ticket.resolution}`}
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
                            {agentName}
                            {isCurrentUser ? ' (You)' : ''}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => navigate('/agent/customers')}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span>Customers</span>
                </button>

                <button
                  onClick={() => navigate('/agent/accounts')}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span>Accounts</span>
                </button>
                <ModulesNav />
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
                    <div className="fixed inset-0 z-10" onClick={() => setShowCreateMenu(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            navigate('/agent/tickets/create?tab=ticket');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700"
                        >
                          <svg
                            className="w-5 h-5 text-purple-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                            />
                          </svg>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              New Ticket
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Create ticket for customer
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            navigate('/agent/tickets/create?tab=account');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700"
                        >
                          <svg
                            className="w-5 h-5 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              New Account
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Create new company
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowCreateMenu(false);
                            navigate('/agent/tickets/create?tab=customer');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
                        >
                          <svg
                            className="w-5 h-5 text-blue-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              New Customer
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Create customer user
                            </div>
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
                    {user?.firstName?.charAt(0)}
                    {user?.lastName?.charAt(0)}
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {/* Logout */}
              <button
                onClick={logout}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
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
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Drag tickets to reorder or move between columns
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Templates Button */}
              <button
                onClick={() => setShowTemplates(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
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

              {/* Refresh Button */}
              <button
                onClick={() => {
                  if (user) {
                    const userKey = `agent-tickets-${user.id}`;
                    const filterKey = `agent-filter-${user.id}`;
                    const idMapKey = `agent-ticket-ids-${user.id}`;
                    localStorage.removeItem(userKey);
                    localStorage.removeItem(filterKey);
                    localStorage.removeItem(idMapKey);
                    window.location.reload();
                  }
                }}
                className="px-3 py-2 text-sm font-medium rounded-md border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title="Refresh tickets from server"
              >
                🔄 Refresh
              </button>

              {/* Ticket Filter Toggle - Sync with Sidebar */}
              <button
                onClick={() => {
                  const newFilter = activeViewFilter === 'my-queue' ? 'all-tickets' : 'my-queue';
                  console.log(
                    '[AgentDashboard] Filter toggle clicked - current:',
                    activeViewFilter,
                    'switching to:',
                    newFilter
                  );
                  setActiveViewFilter(newFilter);
                  // Keep showOnlyMyTickets in sync for backward compatibility
                  setShowOnlyMyTickets(newFilter === 'my-queue');
                }}
                className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                  activeViewFilter === 'my-queue'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                title={
                  activeViewFilter === 'my-queue' ? 'Show all tickets' : 'Show only my tickets'
                }
              >
                {activeViewFilter === 'my-queue' ? 'My Queue' : 'All Tickets'}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
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
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
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
                          const agentTickets = tickets.filter(
                            (t) =>
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
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                    isCurrentUser
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-green-500 text-white'
                                  }`}
                                >
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
                            <svg
                              className="w-4 h-4"
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
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
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

      {pendingResolution && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm h-full w-full z-[60] flex items-center justify-center p-4"
          onClick={() => chooseResolution(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolution-title"
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && chooseResolution(null)}
          >
            <h3
              id="resolution-title"
              className="text-lg font-semibold text-gray-900 dark:text-white mb-1"
            >
              How was it resolved?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              It closes automatically after 7 days unless the customer replies.
            </p>
            <div className="grid gap-2">
              {RESOLUTION_CHOICES.map((value, i) => (
                <button
                  key={value}
                  type="button"
                  autoFocus={i === 0}
                  onClick={() => chooseResolution(value)}
                  className="w-full px-4 py-2 text-left rounded-lg border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                >
                  {RESOLUTION_LABELS[value]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => chooseResolution(null)}
              className="mt-4 w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
