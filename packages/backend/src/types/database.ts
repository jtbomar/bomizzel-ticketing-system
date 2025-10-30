// Database table interfaces matching the schema

export interface UserTable {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'customer' | 'employee' | 'team_lead' | 'admin';
  is_active: boolean;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires_at?: Date;
  password_reset_token?: string;
  password_reset_expires_at?: Date;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CompanyTable {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserCompanyAssociationTable {
  user_id: string;
  company_id: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface TeamTable {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMembershipTable {
  user_id: string;
  team_id: string;
  role: 'member' | 'lead' | 'admin';
  created_at: Date;
  updated_at: Date;
}

export interface QueueTable {
  id: string;
  name: string;
  description?: string;
  type: 'unassigned' | 'employee';
  assigned_to_id?: string;
  team_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CustomFieldTable {
  id: string;
  team_id: string;
  name: string;
  label: string;
  type: 'string' | 'number' | 'decimal' | 'integer' | 'picklist';
  is_required: boolean;
  options?: string[];
  validation?: Record<string, any>;
  order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TicketStatusTable {
  id: string;
  team_id: string;
  name: string;
  label: string;
  color: string;
  order: number;
  is_default: boolean;
  is_closed: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TicketTable {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  submitter_id: string;
  company_id: string;
  assigned_to_id?: string;
  queue_id: string;
  team_id: string;
  custom_field_values: Record<string, any>;
  resolved_at?: Date;
  closed_at?: Date;
  archived_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface TicketNoteTable {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  is_email_generated: boolean;
  email_metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface FileAttachmentTable {
  id: string;
  ticket_id: string;
  note_id?: string;
  file_name: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by_id: string;
  storage_key: string;
  storage_path: string;
  is_image: boolean;
  thumbnail_path?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TicketHistoryTable {
  id: string;
  ticket_id: string;
  user_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface EmailTemplateTable {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  variables: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SystemSettingTable {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionPlanTable {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  billing_interval: 'month' | 'year';
  active_ticket_limit: number;
  completed_ticket_limit: number;
  total_ticket_limit: number;
  features: string | string[];
  trial_days: number;
  is_active: boolean;
  sort_order: number;
  description?: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerSubscriptionTable {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'trial' | 'cancelled' | 'past_due' | 'suspended';
  current_period_start: Date;
  current_period_end: Date;
  trial_start?: Date;
  trial_end?: Date;
  cancelled_at?: Date;
  cancel_at_period_end: boolean;
  payment_method_id?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  metadata: string | Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface UsageTrackingTable {
  id: string;
  subscription_id: string;
  ticket_id: string;
  action: 'created' | 'completed' | 'archived' | 'deleted';
  previous_status?: string;
  new_status?: string;
  action_timestamp: Date;
  metadata: string | Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface UsageSummaryTable {
  id: string;
  subscription_id: string;
  period: string;
  active_tickets_count: number;
  completed_tickets_count: number;
  total_tickets_count: number;
  archived_tickets_count: number;
  last_updated: Date;
  created_at: Date;
  updated_at: Date;
}

export interface BillingRecordTable {
  id: string;
  subscription_id: string;
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  invoice_number?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  billing_date: Date;
  due_date?: Date;
  paid_at?: Date;
  voided_at?: Date;
  hosted_invoice_url?: string;
  invoice_pdf_url?: string;
  payment_method_id?: string;
  attempt_count: number;
  failure_reason?: string;
  line_items: string; // JSON string
  metadata: string; // JSON string
  created_at: Date;
  updated_at: Date;
}