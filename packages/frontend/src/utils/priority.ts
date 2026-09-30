/**
 * Ticket priority as stored on the server: 0 Low, 1 Medium, 2 High,
 * 3 Critical. The agent dashboard maps its (configurable) priority options
 * onto the same numbers by order. Screens used to disagree: one read it as
 * 0-100 ("Lowest" for everything), the customer portal showed the raw number.
 */
const LEVELS = [
  { label: 'Low', badge: 'bg-green-100 text-green-800 border-green-200' },
  { label: 'Medium', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { label: 'High', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  { label: 'Critical', badge: 'bg-red-100 text-red-800 border-red-200' },
];

const level = (priority: number) =>
  LEVELS[Math.min(Math.max(Math.round(Number(priority) || 0), 0), LEVELS.length - 1)];

export const priorityLabel = (priority: number): string => level(priority).label;

export const priorityBadgeClass = (priority: number): string => level(priority).badge;
