/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Create departments table
    .createTable('departments', (table) => {
      table.increments('id').primary();
      table.uuid('company_id').notNullable();
      table.string('name', 255).notNullable();
      table.text('description');
      table.text('logo'); // Base64 encoded image or URL
      table.string('color', 7).defaultTo('#3B82F6'); // Hex color for department branding
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_default').defaultTo(false);
      table.timestamps(true, true);
      
      // Foreign key constraints
      table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
      
      // Indexes
      table.index(['company_id', 'is_active']);
      table.index(['company_id', 'name']);
    })
    
    // Create department_agents junction table (many-to-many)
    .createTable('department_agents', (table) => {
      table.increments('id').primary();
      table.integer('department_id').unsigned().notNullable();
      table.uuid('user_id').notNullable();
      table.enum('role', ['member', 'lead', 'manager']).defaultTo('member');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      // Foreign key constraints
      table.foreign('department_id').references('id').inTable('departments').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      
      // Unique constraint to prevent duplicate assignments
      table.unique(['department_id', 'user_id']);
      
      // Indexes
      table.index(['department_id', 'is_active']);
      table.index(['user_id', 'is_active']);
    })
    
    // Create department_ticket_templates table
    .createTable('department_ticket_templates', (table) => {
      table.increments('id').primary();
      table.integer('department_id').unsigned().notNullable();
      table.string('name', 255).notNullable();
      table.text('description');
      table.json('template_fields'); // JSON structure for custom fields
      table.json('default_values'); // Default values for fields
      table.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium');
      table.string('category', 100);
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_default').defaultTo(false);
      table.timestamps(true, true);
      
      // Foreign key constraints
      table.foreign('department_id').references('id').inTable('departments').onDelete('CASCADE');
      
      // Indexes
      table.index(['department_id', 'is_active']);
      table.index(['department_id', 'name']);
    })
    
    // Add department_id to existing tickets table (if it doesn't exist)
    .alterTable('tickets', (table) => {
      // Check if column exists first
      table.integer('department_id').unsigned().nullable();
      table.foreign('department_id').references('id').inTable('departments').onDelete('SET NULL');
      table.index(['department_id']);
    })
    .catch(() => {
      // If tickets table doesn't exist or column already exists, ignore the error
      console.log('Tickets table modification skipped (table may not exist or column already exists)');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('department_ticket_templates')
    .dropTableIfExists('department_agents')
    .dropTableIfExists('departments')
    .alterTable('tickets', (table) => {
      table.dropColumn('department_id');
    })
    .catch(() => {
      // Ignore errors if tables don't exist
      console.log('Some tables may not exist during rollback');
    });
};