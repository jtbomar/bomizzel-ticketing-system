/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Add indexes for tickets table
    .alterTable('tickets', function(table) {
      // Composite index for common queries
      table.index(['company_id', 'status', 'created_at'], 'idx_tickets_company_status_created');
      table.index(['assigned_to_id', 'status'], 'idx_tickets_assigned_status');
      table.index(['submitter_id', 'created_at'], 'idx_tickets_submitter_created');
      table.index(['queue_id', 'priority', 'created_at'], 'idx_tickets_queue_priority_created');
      table.index(['team_id', 'status'], 'idx_tickets_team_status');
      table.index(['created_at'], 'idx_tickets_created_at');
      table.index(['updated_at'], 'idx_tickets_updated_at');
    })
    
    // Add indexes for users table
    .alterTable('users', function(table) {
      table.index(['role', 'is_active'], 'idx_users_role_active');
      table.index(['created_at'], 'idx_users_created_at');
    })
    
    // Add indexes for user_company_associations table
    .alterTable('user_company_associations', function(table) {
      table.index(['company_id'], 'idx_user_company_company_id');
      table.index(['user_id', 'company_id'], 'idx_user_company_composite');
    })
    
    // Add indexes for team_memberships table
    .alterTable('team_memberships', function(table) {
      table.index(['team_id'], 'idx_team_memberships_team_id');
      table.index(['user_id', 'team_id'], 'idx_team_memberships_composite');
    })
    
    // Add indexes for ticket_notes table
    .alterTable('ticket_notes', function(table) {
      table.index(['ticket_id', 'created_at'], 'idx_ticket_notes_ticket_created');
      table.index(['author_id'], 'idx_ticket_notes_author');
      table.index(['is_internal'], 'idx_ticket_notes_internal');
    })
    
    // Add indexes for file_attachments table
    .alterTable('file_attachments', function(table) {
      table.index(['ticket_id'], 'idx_file_attachments_ticket');
      table.index(['uploaded_by_id'], 'idx_file_attachments_uploader');
      table.index(['created_at'], 'idx_file_attachments_created');
    })
    
    // Add indexes for custom_fields table
    .alterTable('custom_fields', function(table) {
      table.index(['team_id', 'is_active'], 'idx_custom_fields_team_active');
      table.index(['type'], 'idx_custom_fields_type');
    })
    
    // Add indexes for queues table
    .alterTable('queues', function(table) {
      table.index(['team_id', 'is_active'], 'idx_queues_team_active');
      table.index(['assigned_to_id'], 'idx_queues_assigned_to');
    })
    
    // Add indexes for ticket_history table
    .alterTable('ticket_history', function(table) {
      table.index(['ticket_id', 'created_at'], 'idx_ticket_history_ticket_created');
      table.index(['user_id'], 'idx_ticket_history_user');
      table.index(['action'], 'idx_ticket_history_action');
    })
    
    // Add indexes for email_templates table
    .alterTable('email_templates', function(table) {
      table.index(['name', 'is_active'], 'idx_email_templates_name_active');
    })
    
    // Add indexes for ticket_statuses table
    .alterTable('ticket_statuses', function(table) {
      table.index(['team_id', 'is_active'], 'idx_ticket_statuses_team_active');
      table.index(['is_default'], 'idx_ticket_statuses_default');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('tickets', function(table) {
      table.dropIndex([], 'idx_tickets_company_status_created');
      table.dropIndex([], 'idx_tickets_assigned_status');
      table.dropIndex([], 'idx_tickets_submitter_created');
      table.dropIndex([], 'idx_tickets_queue_priority_created');
      table.dropIndex([], 'idx_tickets_team_status');
      table.dropIndex([], 'idx_tickets_created_at');
      table.dropIndex([], 'idx_tickets_updated_at');
    })
    
    .alterTable('users', function(table) {
      table.dropIndex([], 'idx_users_role_active');
      table.dropIndex([], 'idx_users_created_at');
    })
    
    .alterTable('user_company_associations', function(table) {
      table.dropIndex([], 'idx_user_company_company_id');
      table.dropIndex([], 'idx_user_company_composite');
    })
    
    .alterTable('team_memberships', function(table) {
      table.dropIndex([], 'idx_team_memberships_team_id');
      table.dropIndex([], 'idx_team_memberships_composite');
    })
    
    .alterTable('ticket_notes', function(table) {
      table.dropIndex([], 'idx_ticket_notes_ticket_created');
      table.dropIndex([], 'idx_ticket_notes_author');
      table.dropIndex([], 'idx_ticket_notes_internal');
    })
    
    .alterTable('file_attachments', function(table) {
      table.dropIndex([], 'idx_file_attachments_ticket');
      table.dropIndex([], 'idx_file_attachments_uploader');
      table.dropIndex([], 'idx_file_attachments_created');
    })
    
    .alterTable('custom_fields', function(table) {
      table.dropIndex([], 'idx_custom_fields_team_active');
      table.dropIndex([], 'idx_custom_fields_type');
    })
    
    .alterTable('queues', function(table) {
      table.dropIndex([], 'idx_queues_team_active');
      table.dropIndex([], 'idx_queues_assigned_to');
    })
    
    .alterTable('ticket_history', function(table) {
      table.dropIndex([], 'idx_ticket_history_ticket_created');
      table.dropIndex([], 'idx_ticket_history_user');
      table.dropIndex([], 'idx_ticket_history_action');
    })
    
    .alterTable('email_templates', function(table) {
      table.dropIndex([], 'idx_email_templates_name_active');
    })
    
    .alterTable('ticket_statuses', function(table) {
      table.dropIndex([], 'idx_ticket_statuses_team_active');
      table.dropIndex([], 'idx_ticket_statuses_default');
    });
};