// Frontend type definitions based on backend models

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'customer' | 'employee' | 'team_lead' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  companies?: Array<{
    companyId: string;
    role: string;
    company: {
      id: string;
      name: string;
      domain?: string;
    };
  }>;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  notifications?: {
    email: boolean;
    browser: boolean;
    ticketAssigned: boolean;
    ticketUpdated: boolean;
    ticketResolved: boolean;
  };
  dashboard?: {
    defaultView?: 'kanban' | 'list';
    ticketsPerPage?: number;
  };
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  customFields?: CustomField[];
  customStatuses?: TicketStatus[];
  members?: TeamMembership[];
}

export interface TeamMembership {
  userId: string;
  teamId: string;
  role: 'member' | 'lead' | 'admin';
  createdAt: Date;
  user?: User;
  team?: Team;
}

export interface Queue {
  id: string;
  name: string;
  description?: string;
  type: 'unassigned' | 'employee';
  assignedToId?: string;
  teamId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: User;
  team?: Team;
  ticketCount?: number;
}

export interface CustomField {
  id: string;
  teamId: string;
  name: string;
  label: string;
  type: 'string' | 'number' | 'decimal' | 'integer' | 'picklist';
  isRequired: boolean;
  options?: string[];
  validation?: FieldValidation;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface TicketStatus {
  id: string;
  teamId: string;
  name: string;
  label: string;
  color: string;
  order: number;
  isDefault: boolean;
  isClosed: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  submitterId: string;
  companyId: string;
  assignedToId?: string;
  queueId: string;
  teamId: string;
  customFieldValues: Record<string, any>;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  submitter?: User;
  company?: Company;
  assignedTo?: User;
  queue?: Queue;
  team?: Team;
  notes?: TicketNote[];
  attachments?: FileAttachment[];
}

export interface TicketNote {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  isEmailGenerated: boolean;
  emailMetadata?: EmailMetadata;
  createdAt: Date;
  updatedAt: Date;
  author?: User;
  attachments?: FileAttachment[];
}

export interface EmailMetadata {
  messageId?: string;
  subject?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface FileAttachment {
  id: string;
  ticketId: string;
  noteId?: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  storageKey: string;
  storagePath: string;
  isImage: boolean;
  thumbnailPath?: string;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy?: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QueueMetrics {
  queueId: string;
  queueName: string;
  totalTickets: number;
  openTickets: number;
  assignedTickets: number;
  resolvedTickets: number;
  averageResolutionTime: number;
  statusBreakdown: Record<string, number>;
}

// Subscription types
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billingInterval: 'month' | 'year';
  limits: {
    activeTickets: number;
    completedTickets: number;
    totalTickets: number;
  };
  features: string[];
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'trial' | 'cancelled' | 'past_due' | 'suspended';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelledAt?: Date;
  cancelAtPeriodEnd: boolean;
  paymentMethodId?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageStats {
  activeTickets: number;
  completedTickets: number;
  totalTickets: number;
  archivedTickets: number;
}

export interface UsageLimitStatus {
  isAtLimit: boolean;
  isNearLimit: boolean;
  percentageUsed: {
    active: number;
    completed: number;
    total: number;
  };
  limits: {
    activeTickets: number;
    completedTickets: number;
    totalTickets: number;
  };
  current: UsageStats;
}

export interface SubscriptionDetails {
  subscription: CustomerSubscription | null;
  plan: SubscriptionPlan | null;
  usage: UsageStats;
  limitStatus: UsageLimitStatus;
}

// UI-specific types
export interface ViewPreferences {
  view: 'kanban' | 'list';
  ticketsPerPage: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}