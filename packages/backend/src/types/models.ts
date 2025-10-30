// Application model interfaces (API responses)

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
    defaultView: 'kanban' | 'list';
    ticketsPerPage: number;
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

export interface UserCompanyAssociation {
  userId: string;
  companyId: string;
  role: string;
  createdAt: Date;
  company?: Company;
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
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  submitter?: User;
  company?: Company;
  assignedTo?: User;
  queue?: Queue;
  team?: Team;
  notes?: TicketNote[];
  attachments?: FileAttachment[];
  history?: TicketHistory[];
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

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketHistory {
  id: string;
  ticketId: string;
  userId: string;
  action: TicketAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

export type TicketAction = 
  | 'created'
  | 'updated' 
  | 'assigned'
  | 'unassigned'
  | 'status_changed'
  | 'priority_changed'
  | 'note_added'
  | 'file_attached'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'archived'
  | 'restored';

// Request/Response types
export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'customer' | 'employee';
  selectedPlanId?: string;
  startTrial?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  companyId: string;
  teamId: string;
  customFieldValues?: Record<string, any>;
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  assignedToId?: string;
  customFieldValues?: Record<string, any>;
}

export interface CreateNoteRequest {
  content: string;
  isInternal?: boolean;
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

export interface SystemSetting {
  id: string;
  key: string;
  value: any;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  stripePriceId?: string;
  stripeProductId?: string;
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
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  plan?: SubscriptionPlan;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  ticketId: string;
  action: 'created' | 'completed' | 'archived' | 'deleted';
  previousStatus?: string;
  newStatus?: string;
  actionTimestamp: Date;
  metadata: Record<string, any>;
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
  subscription: CustomerSubscription;
  plan: SubscriptionPlan;
  usage: UsageStats;
  limitStatus: UsageLimitStatus;
}

export interface BillingRecord {
  id: string;
  subscriptionId: string;
  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  invoiceNumber?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  billingDate: Date;
  dueDate?: Date;
  paidAt?: Date;
  voidedAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  paymentMethodId?: string;
  attemptCount: number;
  failureReason?: string;
  lineItems: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    quantity: number;
    priceId?: string;
    productId?: string;
  }>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}