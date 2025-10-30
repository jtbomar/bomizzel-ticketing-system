import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AgentProfile from '../components/AgentProfile';

interface Ticket {
  id: number;
  title: string;
  status: 'Open' | 'In Progress' | 'Review' | 'Resolved';
  priority: 'High' | 'Medium' | 'Low';
  customer: string;
  assigned: string;
  created: string;
  description?: string;
  order: number;
}

const SimpleEmployeeDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();
  const [activeView, setActiveView] = useState<'kanban' | 'list'>('kanban');
  
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
      { id: 1, title: 'Login Issue', status: 'Open', priority: 'High', customer: 'John Doe', assigned: 'You', created: '2024-01-15', description: 'Cannot access account', order: 1 },
      { id: 2, title: 'Feature Request', status: 'In Progress', priority: 'Medium', customer: 'Jane Smith', assigned: 'Alice Johnson', created: '2024-01-10', description: 'Need dark mode', order: 1 },
      { id: 3, title: 'Bug Report', status: 'Review', priority: 'Low', customer: 'Bob Wilson', assigned: 'You', created: '2024-01-05', description: 'Button not working', order: 1 },
      { id: 4, title: 'Account Setup', status: 'Open', priority: 'Medium', customer: 'Sarah Davis', assigned: 'Unassigned', created: '2024-01-12', description: 'Need help with setup', order: 2 },
      { id: 5, title: 'Payment Issue', status: 'Resolved', priority: 'High', customer: 'Mike Brown', assigned: 'You', created: '2024-01-08', description: 'Payment not processing', order: 1 }
    ];
  };

  const [tickets, setTickets] = useState<Ticket[]>(getInitialTickets);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
  const [dragOverTicket, setDragOverTicket] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
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

  // Load board settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('agent-board-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setBoardSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to load board settings:', error);
      }
    }
  }, []);

  // Save board settings to localStorage
  const saveBoardSettings = () => {
    localStorage.setItem('agent-board-settings', JSON.stringify(boardSettings));
    setShowSettings(false);
  };

  // Reset to default settings
  const resetToDefaults = () => {
    const defaultSettings = {
      autoRefresh: true,
      dragAndDrop: true,
      showPriorityArrows: true,
      refreshInterval: 30,
      defaultView: 'kanban' as 'kanban' | 'list',
      ticketsPerColumn: 0,
      showTicketIds: true,
      showAssignee: true,
    };
    setBoardSettings(defaultSettings);
    localStorage.setItem('agent-board-settings', JSON.stringify(defaultSettings));
  };

  const getStatusTickets = (status: string) => tickets
    .filter(t => t.status === status)
    .sort((a, b) => a.order - b.order);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700';
      case 'In Progress': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700';
      case 'Review': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700';
      case 'Resolved': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600 dark:text-red-400';
      case 'Medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'Low': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const moveTicket = (ticketId: number, newStatus: 'Open' | 'In Progress' | 'Review' | 'Resolved') => {
    setTickets(prev => {
      const targetStatusTickets = prev.filter(t => t.status === newStatus);
      const maxOrder = targetStatusTickets.length > 0 ? Math.max(...targetStatusTickets.map(t => t.order)) : 0;
      
      return prev.map(ticket => 
        ticket.id === ticketId 
          ? { ...ticket, status: newStatus, order: maxOrder + 1 } 
          : ticket
      );
    });
  };

  const changePriority = (ticketId: number, newPriority: 'High' | 'Medium' | 'Low') => {
    setTickets(prev => prev.map(ticket => 
      ticket.id === ticketId ? { ...ticket, priority: newPriority } : ticket
    ));
  };

  const moveTicketInColumn = (ticketId: number, direction: 'up' | 'down') => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const statusTickets = getStatusTickets(ticket.status);
    const currentIndex = statusTickets.findIndex(t => t.id === ticketId);
    
    if (direction === 'up' && currentIndex > 0) {
      const otherTicket = statusTickets[currentIndex - 1];
      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) return { ...t, order: otherTicket.order };
        if (t.id === otherTicket.id) return { ...t, order: ticket.order };
        return t;
      }));
    } else if (direction === 'down' && currentIndex < statusTickets.length - 1) {
      const otherTicket = statusTickets[currentIndex + 1];
      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) return { ...t, order: otherTicket.order };
        if (t.id === otherTicket.id) return { ...t, order: ticket.order };
        return t;
      }));
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
      moveTicketToPosition(draggedTicket.id, targetStatus, targetTicket.id, dragOverPosition || 'below');
    }
    
    setDraggedTicket(null);
    setDragOverTicket(null);
    setDragOverPosition(null);
  };

  const handleColumnDrop = (e: React.DragEvent, newStatus: 'Open' | 'In Progress' | 'Review' | 'Resolved') => {
    e.preventDefault();
    
    if (draggedTicket && draggedTicket.status !== newStatus) {
      moveTicket(draggedTicket.id, newStatus);
    }
    
    setDraggedTicket(null);
    setDragOverTicket(null);
    setDragOverPosition(null);
  };

  const reorderTicketsInColumn = (draggedId: number, targetId: number, position: 'above' | 'below') => {
    const draggedTicket = tickets.find(t => t.id === draggedId);
    const targetTicket = tickets.find(t => t.id === targetId);
    
    if (!draggedTicket || !targetTicket || draggedTicket.status !== targetTicket.status) return;
    
    const statusTickets = getStatusTickets(draggedTicket.status);
    const targetIndex = statusTickets.findIndex(t => t.id === targetId);
    
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
    
    setTickets(prev => prev.map(ticket => 
      ticket.id === draggedId ? { ...ticket, order: newOrder } : ticket
    ));
  };

  const moveTicketToPosition = (draggedId: number, newStatus: 'Open' | 'In Progress' | 'Review' | 'Resolved', targetId: number, position: 'above' | 'below') => {
    const targetTicket = tickets.find(t => t.id === targetId);
    if (!targetTicket) return;
    
    const statusTickets = getStatusTickets(newStatus);
    const targetIndex = statusTickets.findIndex(t => t.id === targetId);
    
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
    
    setTickets(prev => prev.map(ticket => 
      ticket.id === draggedId ? { ...ticket, status: newStatus, order: newOrder } : ticket
    ));
  };

  const renderKanbanBoard = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {(['Open', 'In Progress', 'Review', 'Resolved'] as const).map((status) => (
        <div 
          key={status} 
          className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 min-h-96 transition-colors"
          onDragOver={handleDragOver}
          onDrop={(e) => handleColumnDrop(e, status)}
        >
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">
            {status} ({getStatusTickets(status).length})
          </h3>
          <div className="space-y-3">
            {getStatusTickets(status).map((ticket, index) => (
              <div key={ticket.id} className="relative">
                {/* Drop indicator above */}
                {dragOverTicket === ticket.id && dragOverPosition === 'above' && (
                  <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                )}
                
                <div 
                  draggable={boardSettings.dragAndDrop}
                  onDragStart={boardSettings.dragAndDrop ? (e) => handleDragStart(e, ticket) : undefined}
                  onDragOver={boardSettings.dragAndDrop ? (e) => handleTicketDragOver(e, ticket) : undefined}
                  onDragLeave={boardSettings.dragAndDrop ? handleTicketDragLeave : undefined}
                  onDrop={boardSettings.dragAndDrop ? (e) => handleTicketDrop(e, ticket) : undefined}
                  className={`bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border-l-4 cursor-move hover:shadow-md transition-all duration-200 ${
                    getStatusColor(ticket.status)
                  } ${
                    draggedTicket?.id === ticket.id ? 'opacity-50 rotate-2 scale-105' : ''
                  } ${
                    dragOverTicket === ticket.id ? 'ring-2 ring-blue-300 dark:ring-blue-500 ring-opacity-50' : ''
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
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">{ticket.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {boardSettings.showTicketIds && `#${ticket.id} • `}{ticket.customer}
                      </p>
                      {boardSettings.showAssignee && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Assigned: {ticket.assigned}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <select
                      value={ticket.priority}
                      onChange={(e) => changePriority(ticket.id, e.target.value as 'High' | 'Medium' | 'Low')}
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
                  <span className="text-xs text-gray-500 dark:text-gray-400">{ticket.created}</span>
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
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">All Tickets</h3>
      </div>
      <ul className="divide-y divide-gray-200">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    #{ticket.id}
                  </span>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{ticket.title}</div>
                    <div className="text-sm text-gray-500">{ticket.customer} • Assigned: {ticket.assigned}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status).replace('border-', 'border ')}`}>
                    {ticket.status}
                  </span>
                  <div className="text-sm text-gray-500">{ticket.created}</div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderSettingsModal = () => {
    if (!showSettings) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50">
        <div className="relative top-10 mx-auto p-6 border border-gray-200 dark:border-gray-700 w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800 transition-colors">
          <div className="mt-3">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">Agent Board Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Column Configuration */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Column Configuration</h4>
                  <div className="space-y-4">
                    {(['Open', 'In Progress', 'Review', 'Resolved'] as const).map((status) => (
                      <div key={status} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${
                            status === 'Open' ? 'bg-red-500' :
                            status === 'In Progress' ? 'bg-yellow-500' :
                            status === 'Review' ? 'bg-blue-500' : 'bg-green-500'
                          }`}></div>
                          <div>
                            <div className="font-medium text-gray-900">{status}</div>
                            <div className="text-sm text-gray-500">{getStatusTickets(status).length} tickets</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                          <button className="text-sm text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors">
                      <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add New Status Column
                    </button>
                  </div>
                </div>

                {/* Priority Settings */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Priority Levels</h4>
                  <div className="space-y-3">
                    {(['High', 'Medium', 'Low'] as const).map((priority) => (
                      <div key={priority} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority).replace('text-', 'bg-')}`}></div>
                          <span className="font-medium">{priority}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {tickets.filter(t => t.priority === priority).length} tickets
                          </span>
                          <button className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Board Behavior */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Board Behavior</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Auto-refresh</div>
                        <div className="text-sm text-gray-500">Automatically refresh ticket data</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={boardSettings.autoRefresh}
                          onChange={(e) => setBoardSettings(prev => ({ ...prev, autoRefresh: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Drag & Drop</div>
                        <div className="text-sm text-gray-500">Enable drag and drop reordering</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={boardSettings.dragAndDrop}
                          onChange={(e) => setBoardSettings(prev => ({ ...prev, dragAndDrop: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Show Priority Arrows</div>
                        <div className="text-sm text-gray-500">Display up/down arrows for manual reordering</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={boardSettings.showPriorityArrows}
                          onChange={(e) => setBoardSettings(prev => ({ ...prev, showPriorityArrows: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Refresh Interval (seconds)
                      </label>
                      <select 
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={boardSettings.refreshInterval}
                        onChange={(e) => setBoardSettings(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) }))}
                      >
                        <option value="30">30 seconds</option>
                        <option value="60">1 minute</option>
                        <option value="300">5 minutes</option>
                        <option value="600">10 minutes</option>
                        <option value="0">Manual only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Display Options */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Display Options</h4>
                  
                  {/* Theme Setting */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Theme
                    </label>
                    <select 
                      className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                    >
                      <option value="light">Light Mode</option>
                      <option value="dark">Dark Mode</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default View
                      </label>
                      <select 
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={boardSettings.defaultView}
                        onChange={(e) => setBoardSettings(prev => ({ ...prev, defaultView: e.target.value as 'kanban' | 'list' }))}
                      >
                        <option value="kanban">Kanban Board</option>
                        <option value="list">List View</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tickets per Column (Kanban)
                      </label>
                      <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <option value="10">10 tickets</option>
                        <option value="20">20 tickets</option>
                        <option value="50">50 tickets</option>
                        <option value="0">Show all</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Show Ticket IDs</div>
                        <div className="text-sm text-gray-500">Display ticket numbers on cards</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Show Assignee</div>
                        <div className="text-sm text-gray-500">Display assigned agent on cards</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Reset Layout
                    </button>
                    <button className="p-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Export Settings
                    </button>
                    <button className="p-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Import Settings
                    </button>
                    <button 
                      onClick={resetToDefaults}
                      className="p-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Restore Defaults
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveBoardSettings}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save Settings
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
      <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800 transition-colors">
          <div className="mt-3">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Ticket #{selectedTicket.id}</h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <p className="mt-1 text-sm text-gray-900">{selectedTicket.title}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <p className="mt-1 text-sm text-gray-900">{selectedTicket.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => {
                      moveTicket(selectedTicket.id, e.target.value as 'Open' | 'In Progress' | 'Review' | 'Resolved');
                      setSelectedTicket({...selectedTicket, status: e.target.value as 'Open' | 'In Progress' | 'Review' | 'Resolved'});
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => {
                      changePriority(selectedTicket.id, e.target.value as 'High' | 'Medium' | 'Low');
                      setSelectedTicket({...selectedTicket, priority: e.target.value as 'High' | 'Medium' | 'Low'});
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Customer</label>
                <p className="mt-1 text-sm text-gray-900">{selectedTicket.customer}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Assigned To</label>
                <p className="mt-1 text-sm text-gray-900">{selectedTicket.assigned}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-sm text-gray-900">{selectedTicket.created}</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Close
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
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
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">Welcome back, {user?.firstName}! Drag tickets to reorder or move between columns</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setActiveView('kanban')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                    activeView === 'kanban' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setActiveView('list')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
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
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {user && (
                <>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center space-x-2"
                    title="Board Settings"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings</span>
                  </button>
                  
                  <a 
                    href="/admin" 
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    Admin Panel
                  </a>
                </>
              )}
              
              {/* Profile Button */}
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title="My Profile"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium mr-2">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </div>
                <span className="hidden sm:block">Profile</span>
              </button>

              <button 
                onClick={logout}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors">
            <div className="p-5">
              <div className="flex items-center">
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total</dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">{tickets.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {(['Open', 'In Progress', 'Review', 'Resolved'] as const).map((status) => (
            <div key={status} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{status}</dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">{getStatusTickets(status).length}</dd>
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

      {/* Settings Modal */}
      {renderSettingsModal()}

      {/* Profile Modal */}
      {showProfile && (
        <AgentProfile onClose={() => setShowProfile(false)} />
      )}

      {/* Ticket Modal */}
      {renderTicketModal()}
    </div>
  );
};

export default SimpleEmployeeDashboard;