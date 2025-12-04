/**
 * Create products table for department-specific product management
 */
exports.up = async function(knex) {
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.uuid('company_id').notNullable();
    table.uuid('org_id');
    table.integer('department_id').unsigned().notNullable();
    table.string('product_code', 100).notNullable();
    table.string('name', 255).notNullable();
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.foreign('org_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.foreign('department_id').references('id').inTable('departments').onDelete('CASCADE');

    // Indexes
    table.index(['company_id', 'department_id']);
    table.index(['org_id', 'department_id']);
    table.index('product_code');
    
    // Unique constraint on product code per department
    table.unique(['department_id', 'product_code']);
  });

  console.log('✅ Created products table');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('products');
};
