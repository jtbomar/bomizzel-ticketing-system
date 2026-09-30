/**
 * How a ticket is referred to on screen: its permanent number, "#1001".
 * (Fallback for a ticket without one: the end of its id.)
 */
export const ticketRef = (ticket: { ticketNumber?: number | null; id: string | number }): string =>
  ticket.ticketNumber ? `#${ticket.ticketNumber}` : `#${String(ticket.id).slice(-8)}`;
