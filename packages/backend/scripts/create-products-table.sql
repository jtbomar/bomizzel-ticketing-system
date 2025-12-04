-- Create products table manually if migration doesn't run
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  org_id UUID,
  department_id INTEGER NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  
  UNIQUE (department_id, product_code)
);

CREATE INDEX IF NOT EXISTS idx_products_company_dept ON products(company_id, department_id);
CREATE INDEX IF NOT EXISTS idx_products_org_dept ON products(org_id, department_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);

-- Insert into migrations table to mark as run
INSERT INTO knex_migrations (name, batch, migration_time)
VALUES ('20251204000000_create_products_table.js', (SELECT COALESCE(MAX(batch), 0) + 1 FROM knex_migrations), NOW())
ON CONFLICT DO NOTHING;
