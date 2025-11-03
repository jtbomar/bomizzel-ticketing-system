/**
 * Add organization profile fields to companies table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('companies', function(table) {
    // Organization branding
    table.string('logo_url');
    table.string('primary_color', 7); // Hex color code
    table.string('secondary_color', 7); // Hex color code
    
    // Contact information
    table.string('primary_contact_name');
    table.string('primary_contact_email');
    table.string('primary_contact_phone');
    table.string('mobile_phone');
    table.string('website_url');
    
    // Address information
    table.string('address_line_1');
    table.string('address_line_2');
    table.string('city');
    table.string('state_province');
    table.string('postal_code');
    table.string('country');
    
    // Timezone and localization
    table.string('timezone').defaultTo('UTC');
    table.string('date_format').defaultTo('MM/DD/YYYY');
    table.string('time_format').defaultTo('12'); // 12 or 24 hour
    table.string('currency').defaultTo('USD');
    table.string('language').defaultTo('en');
    
    // Subscription and billing
    table.string('subscription_plan_id');
    table.string('billing_email');
    table.date('trial_ends_at');
    table.boolean('is_trial').defaultTo(true);
    table.integer('max_users').defaultTo(5);
    table.integer('max_tickets_per_month').defaultTo(100);
    
    // Company settings
    table.boolean('allow_public_registration').defaultTo(false);
    table.boolean('require_email_verification').defaultTo(true);
    table.text('welcome_message');
    table.json('custom_fields_config');
    
    // Indexes
    table.index('subscription_plan_id');
    table.index('timezone');
    table.index('is_trial');
    table.index('trial_ends_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('companies', function(table) {
    table.dropColumn([
      'logo_url', 'primary_color', 'secondary_color',
      'primary_contact_name', 'primary_contact_email', 'primary_contact_phone',
      'mobile_phone', 'website_url',
      'address_line_1', 'address_line_2', 'city', 'state_province', 'postal_code', 'country',
      'timezone', 'date_format', 'time_format', 'currency', 'language',
      'subscription_plan_id', 'billing_email', 'trial_ends_at', 'is_trial',
      'max_users', 'max_tickets_per_month',
      'allow_public_registration', 'require_email_verification', 'welcome_message',
      'custom_fields_config'
    ]);
  });
};