// Service for managing status and priority configuration

export interface StatusOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
}

export interface PriorityOption {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isActive: boolean;
}

export interface StatusPriorityConfig {
  statuses: StatusOption[];
  priorities: PriorityOption[];
}

// Default configuration
const DEFAULT_STATUSES: StatusOption[] = [
  { id: '1', label: 'Open', value: 'open', color: 'red', order: 1, isActive: true },
  { id: '2', label: 'In Progress', value: 'in_progress', color: 'yellow', order: 2, isActive: true },
  { id: '3', label: 'Waiting', value: 'waiting', color: 'purple', order: 3, isActive: true },
  { id: '4', label: 'Testing', value: 'testing', color: 'orange', order: 4, isActive: true },
  { id: '5', label: 'Review', value: 'review', color: 'blue', order: 5, isActive: true },
  { id: '6', label: 'Resolved', value: 'resolved', color: 'green', order: 6, isActive: true },
];

const DEFAULT_PRIORITIES: PriorityOption[] = [
  { id: '1', label: 'Critical', value: 'critical', color: 'purple', order: 1, isActive: true },
  { id: '2', label: 'High', value: 'high', color: 'red', order: 2, isActive: true },
  { id: '3', label: 'Medium', value: 'medium', color: 'yellow', order: 3, isActive: true },
  { id: '4', label: 'Low', value: 'low', color: 'green', order: 4, isActive: true },
];

export class StatusConfigService {
  private static getStorageKey(teamId: string, type: 'statuses' | 'priorities'): string {
    return `team-${teamId}-${type}`;
  }

  // Get configured statuses for a team
  static getStatuses(teamId: string): StatusOption[] {
    try {
      const saved = localStorage.getItem(this.getStorageKey(teamId, 'statuses'));
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.filter((status: StatusOption) => status.isActive)
                    .sort((a: StatusOption, b: StatusOption) => a.order - b.order);
      }
    } catch (error) {
      console.error('Error loading statuses:', error);
    }
    return DEFAULT_STATUSES.filter(s => s.isActive);
  }

  // Get configured priorities for a team
  static getPriorities(teamId: string): PriorityOption[] {
    try {
      const saved = localStorage.getItem(this.getStorageKey(teamId, 'priorities'));
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.filter((priority: PriorityOption) => priority.isActive)
                    .sort((a: PriorityOption, b: PriorityOption) => a.order - b.order);
      }
    } catch (error) {
      console.error('Error loading priorities:', error);
    }
    return DEFAULT_PRIORITIES.filter(p => p.isActive);
  }

  // Get all statuses (including inactive) for admin configuration
  static getAllStatuses(teamId: string): StatusOption[] {
    try {
      const saved = localStorage.getItem(this.getStorageKey(teamId, 'statuses'));
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading all statuses:', error);
    }
    return DEFAULT_STATUSES;
  }

  // Get all priorities (including inactive) for admin configuration
  static getAllPriorities(teamId: string): PriorityOption[] {
    try {
      const saved = localStorage.getItem(this.getStorageKey(teamId, 'priorities'));
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading all priorities:', error);
    }
    return DEFAULT_PRIORITIES;
  }

  // Save statuses configuration
  static saveStatuses(teamId: string, statuses: StatusOption[]): void {
    try {
      localStorage.setItem(this.getStorageKey(teamId, 'statuses'), JSON.stringify(statuses));
    } catch (error) {
      console.error('Error saving statuses:', error);
      throw error;
    }
  }

  // Save priorities configuration
  static savePriorities(teamId: string, priorities: PriorityOption[]): void {
    try {
      localStorage.setItem(this.getStorageKey(teamId, 'priorities'), JSON.stringify(priorities));
    } catch (error) {
      console.error('Error saving priorities:', error);
      throw error;
    }
  }

  // Get color classes for a status
  static getStatusColorClasses(color: string): string {
    const colorMap: Record<string, string> = {
      // Primary Colors
      red: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700',
      orange: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700',
      yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700',
      green: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700',
      blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700',
      
      // Secondary Colors
      purple: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700',
      pink: 'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-700',
      teal: 'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700',
      indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
      cyan: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700',
      
      // Extended Colors
      emerald: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700',
      lime: 'bg-lime-100 dark:bg-lime-900 text-lime-800 dark:text-lime-200 border-lime-200 dark:border-lime-700',
      amber: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700',
      rose: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700',
      violet: 'bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-700',
      
      // Neutral Colors
      slate: 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600',
      zinc: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700',
      stone: 'bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700',
      neutral: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700'
    };
    
    // Handle custom colors
    if (color.startsWith('custom-')) {
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
    
    return colorMap[color] || colorMap.gray;
  }

  // Get color classes for a priority
  static getPriorityColorClasses(color: string): string {
    const colorMap: Record<string, string> = {
      // Primary Colors
      red: 'text-red-600 dark:text-red-400',
      orange: 'text-orange-600 dark:text-orange-400',
      yellow: 'text-yellow-600 dark:text-yellow-400',
      green: 'text-green-600 dark:text-green-400',
      blue: 'text-blue-600 dark:text-blue-400',
      
      // Secondary Colors
      purple: 'text-purple-600 dark:text-purple-400',
      pink: 'text-pink-600 dark:text-pink-400',
      teal: 'text-teal-600 dark:text-teal-400',
      indigo: 'text-indigo-600 dark:text-indigo-400',
      cyan: 'text-cyan-600 dark:text-cyan-400',
      
      // Extended Colors
      emerald: 'text-emerald-600 dark:text-emerald-400',
      lime: 'text-lime-600 dark:text-lime-400',
      amber: 'text-amber-600 dark:text-amber-400',
      rose: 'text-rose-600 dark:text-rose-400',
      violet: 'text-violet-600 dark:text-violet-400',
      
      // Neutral Colors
      slate: 'text-slate-600 dark:text-slate-400',
      gray: 'text-gray-600 dark:text-gray-400',
      zinc: 'text-zinc-600 dark:text-zinc-400',
      stone: 'text-stone-600 dark:text-stone-400',
      neutral: 'text-neutral-600 dark:text-neutral-400'
    };
    
    // Handle custom colors
    if (color.startsWith('custom-')) {
      return 'text-gray-600 dark:text-gray-400';
    }
    
    return colorMap[color] || colorMap.gray;
  }

  // Get status by value
  static getStatusByValue(teamId: string, value: string): StatusOption | undefined {
    const statuses = this.getStatuses(teamId);
    return statuses.find(status => status.value === value);
  }

  // Get priority by value
  static getPriorityByValue(teamId: string, value: string): PriorityOption | undefined {
    const priorities = this.getPriorities(teamId);
    return priorities.find(priority => priority.value === value);
  }

  // Convert status value to display label
  static getStatusLabel(teamId: string, value: string): string {
    const status = this.getStatusByValue(teamId, value);
    return status ? status.label : value;
  }

  // Convert priority value to display label
  static getPriorityLabel(teamId: string, value: string): string {
    const priority = this.getPriorityByValue(teamId, value);
    return priority ? priority.label : value;
  }

  // Get status color by value
  static getStatusColor(teamId: string, value: string): string {
    const status = this.getStatusByValue(teamId, value);
    return status ? this.getStatusColorClasses(status.color) : this.getStatusColorClasses('gray');
  }

  // Get priority color by value
  static getPriorityColor(teamId: string, value: string): string {
    const priority = this.getPriorityByValue(teamId, value);
    return priority ? this.getPriorityColorClasses(priority.color) : this.getPriorityColorClasses('gray');
  }
}

export default StatusConfigService;