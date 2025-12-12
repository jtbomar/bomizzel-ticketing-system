import React from 'react';
// TODO: Implement @dnd-kit drag and drop
// import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Ticket, TicketStatus } from '../types';
// import TicketCard from './TicketCard'; // TODO: Use TicketCard component

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
  // onTicketMove, // TODO: Implement drag and drop
  onTicketClick,
  loading = false,
}) => {
  // Group tickets by status
  const ticketsByStatus = tickets.reduce((acc, ticket) => {
    const status = ticket.status || 'Open';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(ticket);
    return acc;
  }, {} as Record<string, Ticket[]>);

  // TODO: Implement drag and drop with @dnd-kit
  // const handleDragEnd = (result: any) => {
  //   // Placeholder for drag and drop functionality
  //   console.log('Drag ended:', result);
  // };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex space-x-6 overflow-x-auto pb-6">
      {statuses.map((status) => {
        const statusTickets = ticketsByStatus[status.name] || [];

        return (
          <div
            key={status.id}
            className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{status.name}</h3>
              <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm">
                {statusTickets.length}
              </span>
            </div>

            <div className="min-h-[200px] p-2">
              {statusTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-3 mb-2 bg-white rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onTicketClick(ticket)}
                >
                  <h4 className="font-medium text-gray-900">{ticket.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">#{ticket.id}</span>
                    <span className="text-xs text-gray-500">{ticket.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;