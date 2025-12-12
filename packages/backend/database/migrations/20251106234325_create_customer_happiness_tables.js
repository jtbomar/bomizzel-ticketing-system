/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return (
    knex.schema
      // Create customer_happiness_settings table
      .createTable('customer_happiness_settings', (table) => {
        table.increments('id').primary();
        table.uuid('company_id').notNullable();
        table.string('name', 255).notNullable();
        table.text('description');
        table.boolean('is_active').defaultTo(true);
        table.boolean('is_default').defaultTo(false);

        // Survey Configuration
        table.json('survey_config').notNullable(); // Survey questions, rating scales, etc.
        table.json('trigger_conditions').notNullable(); // When to send surveys
        table.json('email_template').notNullable(); // Email template for surveys

        // Timing Settings
        table.integer('delay_hours').defaultTo(24); // Hours after ticket resolution to send survey
        table.integer('reminder_hours').defaultTo(72); // Hours after first survey to send reminder
        table.integer('max_reminders').defaultTo(1); // Maximum number of reminders

        // Response Settings
        table.string('thank_you_message', 1000).defaultTo('Thank you for your feedback!');
        table.string('follow_up_message', 1000); // Message for low ratings
        table.integer('low_rating_threshold').defaultTo(3); // Ratings below this trigger follow-up

        table.timestamps(true, true);

        // Foreign key constraints
        table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');

        // Indexes
        table.index(['company_id', 'is_active']);
        table.index(['company_id', 'name']);
      })

      // Create customer_feedback table
      .createTable('customer_feedback', (table) => {
        table.increments('id').primary();
        table.uuid('ticket_id').notNullable();
        table.uuid('customer_id').notNullable();
        table.integer('happiness_setting_id').unsigned().notNullable();
        table.string('survey_token', 255).notNullable().unique(); // Unique token for survey access

        // Survey Response
        table.integer('overall_rating').nullable(); // 1-5 or 1-10 scale
        table.json('question_responses').nullable(); // Responses to custom questions
        table.text('comments').nullable();

        // Metadata
        table.enum('status', ['pending', 'completed', 'expired']).defaultTo('pending');
        table.timestamp('sent_at').nullable();
        table.timestamp('completed_at').nullable();
        table.timestamp('expires_at').nullable();
        table.integer('reminder_count').defaultTo(0);
        table.timestamp('last_reminder_at').nullable();

        // Response tracking
        table.string('ip_address', 45).nullable();
        table.string('user_agent', 500).nullable();
        table.json('response_metadata').nullable(); // Additional tracking data

        table.timestamps(true, true);

        // Foreign key constraints
        table.foreign('ticket_id').references('id').inTable('tickets').onDelete('CASCADE');
        table.foreign('customer_id').references('id').inTable('users').onDelete('CASCADE');
        table
          .foreign('happiness_setting_id')
          .references('id')
          .inTable('customer_happiness_settings')
          .onDelete('CASCADE');

        // Indexes
        table.index(['ticket_id']);
        table.index(['customer_id']);
        table.index(['happiness_setting_id']);
        table.index(['status', 'sent_at']);
        table.index(['survey_token']);
        table.index(['expires_at']);
      })

      // Create customer_happiness_analytics table for reporting
      .createTable('customer_happiness_analytics', (table) => {
        table.increments('id').primary();
        table.uuid('company_id').notNullable();
        table.integer('happiness_setting_id').unsigned().notNullable();
        table.date('date').notNullable();

        // Daily metrics
        table.integer('surveys_sent').defaultTo(0);
        table.integer('surveys_completed').defaultTo(0);
        table.decimal('completion_rate', 5, 2).defaultTo(0); // Percentage
        table.decimal('average_rating', 3, 2).nullable();
        table.integer('total_responses').defaultTo(0);

        // Rating distribution
        table.integer('rating_1_count').defaultTo(0);
        table.integer('rating_2_count').defaultTo(0);
        table.integer('rating_3_count').defaultTo(0);
        table.integer('rating_4_count').defaultTo(0);
        table.integer('rating_5_count').defaultTo(0);

        // Follow-up metrics
        table.integer('low_rating_count').defaultTo(0);
        table.integer('follow_up_triggered').defaultTo(0);

        table.timestamps(true, true);

        // Foreign key constraints
        table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
        table
          .foreign('happiness_setting_id')
          .references('id')
          .inTable('customer_happiness_settings')
          .onDelete('CASCADE');

        // Indexes
        table.index(['company_id', 'date']);
        table.index(['happiness_setting_id', 'date']);
        table.unique(['company_id', 'happiness_setting_id', 'date']);
      })
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('customer_happiness_analytics')
    .dropTableIfExists('customer_feedback')
    .dropTableIfExists('customer_happiness_settings');
};
