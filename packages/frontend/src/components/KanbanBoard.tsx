import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Ticket, TicketStatus } from '../types';
import TicketCard from './TicketCard';

interface KanbanBoardProps {
  tickets: Ticket[];
  statuses: TicketStatus[];
  onTicketMove: (ticketId: string, newStatus: string, newPriority: number) => void;
  onTicketClick: (ticket: Ticket) => void;
  loading?: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tickets,
  statuses,
  onTicketMove,
  onTicketClick,
  loading = false,
}) => {
  const [ticketsByStatus, setTicketsByStatus] = useState<Record<string, Ticket[]>>({});

  useEffect(() => {
    // Group tickets by status
    const grouped = tickets.reduce(
      (acc, ticket) => {
        const status = ticket.status;
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(ticket);
        return acc;
      },
      {} as Record<string, Ticket[]>
    );

    // Sort tickets within each status by priority (higher priority first)
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => b.priority - a.priority);
    });

    setTicketsByStatus(grouped);
  }, [tickets]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;
    const ticketId = draggableId;

    // Find the ticket being moved
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    // Calculate new priority based on position with better spacing
    const destTickets = ticketsByStatus[destStatus] || [];
    let newPriority = ticket.priority;

    if (destTickets.length === 0) {
      newPriority = 50; // Default priority for empty column
    } else if (destination.index === 0) {
      // Moving to top - higher priority than current top ticket
      const topPriority = destTickets[0].priority;
      newPriority = Math.min(topPriority + 10, 100);

      // If we're at max priority, redistribute priorities
      if (newPriority >= 100) {
        newPriority = 100;
        // TODO: Could implement priority redistribution here
      }
    } else if (destination.index >= destTickets.length) {
      // Moving to bottom - lower priority than current bottom ticket
      const bottomPriority = destTickets[destTickets.length - 1].priority;
      newPriority = Math.max(bottomPriority - 10, 0);

      // If we're at min priority, redistribute priorities
      if (newPriority <= 0) {
        newPriority = 0;
        // TODO: Could implement priority redistribution here
      }
    } else {
      // Moving between tickets - calculate midpoint with minimum gap
      const above = destTickets[destination.index - 1];
      const below = destTickets[destination.index];
      const gap = above.priority - below.priority;

      if (gap > 2) {
        newPriority = Math.floor((above.priority + below.priority) / 2);
      } else {
        // Not enough space, use above priority - 1
        newPriority = Math.max(above.priority - 1, 0);
      }
    }

    // Update local state optimistically
    const newTicketsByStatus = { ...ticketsByStatus };

    // Remove from source
    newTicketsByStatus[sourceStatus] = newTicketsByStatus[sourceStatus].filter(
      (t) => t.id !== ticketId
    );

    // Add to destination
    if (!newTicketsByStatus[destStatus]) {
      newTicketsByStatus[destStatus] = [];
    }

    const updatedTicket = { ...ticket, status: destStatus, priority: newPriority };
    newTicketsByStatus[destStatus].splice(destination.index, 0, updatedTicket);

    setTicketsByStatus(newTicketsByStatus);

    // Call the callback to update the backend
    onTicketMove(ticketId, destStatus, newPriority);
  };

  const getStatusColor = (status: TicketStatus) => {
    return status.color || '#6B7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex space-x-6 overflow-x-auto pb-6">
        {statuses.map((status) => {
          const statusTickets = ticketsByStatus[status.name] || [];

          return (
            <div key={status.id} className="flex-shrink-0 w-80">
              <div className="bg-gray-50 rounded-lg p-4">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: getStatusColor(status) }}
                    />
                    <h3 className="font-medium text-gray-900">{status.label}</h3>
                    <span className="ml-2 bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {statusTickets.length}
                    </span>
                  </div>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={status.name}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        min-h-[200px] space-y-3
                        ${snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg' : ''}
                      `}
                    >
                      {statusTickets.map((ticket, index) => (
                        <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <TicketCard
                                ticket={ticket}
                                isDragging={snapshot.isDragging}
                                onClick={onTicketClick}
                                showAssignee={true}
                                showCompany={true}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Empty State */}
                      {statusTickets.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <svg
                            className="w-8 h-8 mx-auto mb-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <p className="text-sm">No tickets</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
