import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AgentProfile from '../components/AgentProfile';
import DepartmentSelector from '../components/DepartmentSelector';
import AgentGlobalSearch from '../components/AgentGlobalSearch';

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

  // Load statuses and priorities from AdminStatusConfig
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
        label: 'Review',
        value: 'review',
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
    const saved = localStorage.getItem('agent-tickets');
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
      },
      {
        id: 3,
        title: 'Bug Report',
        status: 'review',
        priority: 'low',
        customer: 'Bob Wilson',
        assigned: 'You',
        created: '2024-01-05',
        description: 'Button not working',
        order: 1,
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
      },
    ];
  };

  // Migrate tickets to match current status configuration
  const migrateTickets = (tickets: Ticket[], statuses: StatusOption[]): Ticket[] => {
    const statusValueMap: { [key: string]: string } = {
      Open: 'open',
      'In Progress': 'in_progress',
      Waiting: 'waiting',
      Testing: 'testing',
      Review: 'review',
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

  const initialTickets = migrateTickets(getInitialTickets(), statuses);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
  const [dragOverTicket, setDragOverTicket] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Modal state
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'notes'>('details');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteIsInternal, setNewNoteIsInternal] = useState(false);

  // Views state
  const [activeViewFilter, setActiveViewFilter] = useState('my-queue');

  // Default views for filtering
  const defaultViews = [
    {
      id: 'my-queue',
      name: 'My Queue',
      icon: '👤',
      filter: (ticket: Ticket) => ticket.assigned === 'You',
    },
    {
      id: 'unassigned',
      name: 'Unassigned',
      icon: '📥',
      filter: (ticket: Ticket) => ticket.assigned === 'Unassigned',
    },
    {
      id: 'all-open',
      name: 'All Open',
      icon: '🔓',
      filter: (ticket: Ticket) => ticket.status === 'open',
    },
  ];

  // Get filtered tickets
  const getFilteredTickets = () => {
    const view = defaultViews.find((v) => v.id === activeViewFilter);
    return view ? tickets.filter(view.filter) : tickets;
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
    localStorage.setItem('agent-tickets', JSON.stringify(tickets));
  }, [tickets]);

  // Save migrated tickets on first load
  useEffect(() => {
    localStorage.setItem('agent-tickets', JSON.stringify(initialTickets));
  }, []);

  // Load board settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('agent-board-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setBoardSettings((prev) => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to load board settings:', error);
      }
    }
  }, []);

  // Handle board settings changes from AgentProfile
  const handleBoardSettingsChange = (newSettings: any) => {
    setBoardSettings(newSettings);
    localStorage.setItem('agent-board-settings', JSON.stringify(newSettings));
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

  const moveTicket = (ticketId: number, newStatus: string) => {
    setTickets((prev) => {
      const targetStatusTickets = prev.filter((t) => t.status === newStatus);
      const maxOrder =
        targetStatusTickets.length > 0 ? Math.max(...targetStatusTickets.map((t) => t.order)) : 0;

      return prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: newStatus, order: maxOrder + 1 } : ticket
      );
    });
  };

  const changePriority = (ticketId: number, newPriority: string) => {
    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, priority: newPriority } : ticket))
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

  const renderKanbanBoard = () => (
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
                      <option value="You">You</option>
                      <option value="Alice Johnson">Alice Johnson</option>
                      <option value="Bob Smith">Bob Smith</option>
                      <option value="Unassigned">Unassigned</option>
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
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                  {selectedTicket.title}
                </h2>
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
            </nav>
          </div>

          {/* Content */}
          <div className="px-8 py-6 overflow-y-auto max-h-[60vh]">
            {activeModalTab === 'details' && (
              <div className="space-y-8">
                {/* Description */}
                {selectedTicket.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Description
                    </h3>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {selectedTicket.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Status & Priority */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                        className={`relative rounded-xl p-6 border transition-colors ${
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

                        <div className="prose prose-sm max-w-none">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {note.content}
                          </p>
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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 space-y-4">
            {/* Top Row: Title and Actions */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Dashboard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Welcome back, {user?.firstName}! Drag tickets to reorder or move between columns
                </p>
              </div>
              <div className="flex items-center space-x-3">
              {/* Department Selector */}
              <div className="min-w-[200px]">
                <DepartmentSelector
                  selectedDepartmentId={selectedDepartmentId}
                  onDepartmentChange={setSelectedDepartmentId}
                  showAllOption={true}
                />
              </div>
              
              {/* Visual Report Builder Button */}
              <button
                onClick={() => window.location.href = '/visual-reports'}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span>Reports</span>
              </button>

              {/* Accounts Button */}
              <button
                onClick={() => navigate('/agent/accounts')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Accounts</span>
              </button>

              {/* Customers Button */}
              <button
                onClick={() => navigate('/agent/customers')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Customers</span>
              </button>

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

              {/* Admin Setup */}
              <a
                href="/admin"
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Admin Setup"
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
              </a>

              {/* Profile Avatar */}
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center space-x-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Profile"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {user?.firstName?.charAt(0)}
                  {user?.lastName?.charAt(0)}
                </div>
              </button>

              <button
                onClick={logout}
                className="px-3 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
            </div>

            {/* Second Row: Global Search */}
            <div className="flex items-center space-x-4">
              <AgentGlobalSearch />
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout with Sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Views</h2>
            <div className="space-y-2">
              {/* Debug Info */}
              <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <div>Total tickets: {tickets.length}</div>
                <div>Filtered tickets: {filteredTickets.length}</div>
                <div>Active statuses: {statuses.map((s) => s.value).join(', ')}</div>
                <div>Ticket statuses: {[...new Set(tickets.map((t) => t.status))].join(', ')}</div>
              </div>

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
    </div>
  );
};

export default AgentDashboard;
