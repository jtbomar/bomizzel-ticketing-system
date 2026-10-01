/** The plans as the API lists them (GET /plans, /org-billing). */
export interface PlanInfo {
  key: 'free' | 'standard' | 'professional';
  name: string;
  monthly: number;
  yearly: number;
  limits: {
    agents: number | null;
    ticketsPerMonth: number | null;
    departments: number | null;
    macros: number | null;
    ticketFields: number | null;
    assignmentRules: boolean;
    roundRobin: boolean;
    recordFields: boolean;
    customModules: boolean;
  };
}

/** What a plan costs for some number of agents, e.g. "3 agents: $36 a month". */
export const priceExample = (perAgent: number, agents: number): string =>
  `${agents} agent${agents === 1 ? '' : 's'}: $${perAgent * agents} a month`;

/** One line per thing a plan includes, for the plan cards. */
export const planFeatures = (p: PlanInfo): string[] => {
  const l = p.limits;
  const n = (v: number | null, one: string, many: string) =>
    v === null ? `Unlimited ${many}` : `${v} ${v === 1 ? one : many}`;
  return [
    l.agents === null ? 'Add as many agents as you need' : `Up to ${l.agents} agents, free`,
    l.ticketsPerMonth === null ? 'Unlimited tickets' : `${l.ticketsPerMonth} tickets a month`,
    'Email to ticket, board, attachments',
    n(l.departments, 'department', 'departments'),
    n(l.macros, 'macro', 'macros'),
    l.ticketFields === null ? 'Custom ticket fields' : `${l.ticketFields} custom ticket fields`,
    ...(l.assignmentRules
      ? [l.roundRobin ? 'Assignment rules, with round-robin' : 'Assignment rules']
      : []),
    ...(l.recordFields ? ['Account and contact custom fields'] : []),
    ...(l.customModules ? ['Custom modules and lookups'] : []),
  ];
};
