# Database Query & Fix Guide

## Quick Start

### 1. View Common Data
```bash
# List all tables
./scripts/db-common-queries.sh tables

# View all users
./scripts/db-common-queries.sh users

# View provisioned customers
./scripts/db-common-queries.sh provisioned

# View admin users
./scripts/db-common-queries.sh admin

# View record counts
./scripts/db-common-queries.sh count
```

### 2. Run Custom Queries
```bash
# Single query
./scripts/db-query.sh "SELECT * FROM users WHERE email = 'admin@bomizzel.com';"

# Check subscription status
./scripts/db-query.sh "SELECT id, status FROM customer_subscriptions WHERE is_custom = true;"
```

### 3. Interactive Shell
```bash
# Open psql shell
./scripts/db-shell.sh

# Then run queries interactively:
# SELECT * FROM users;
# \dt              -- list tables
# \d users         -- describe users table
# \q               -- quit
```

### 4. Fix Common Issues
```bash
# Enable a user
./scripts/db-fix.sh enable-user user@example.com

# Make someone an admin
./scripts/db-fix.sh make-admin user@example.com

# Activate a subscription
./scripts/db-fix.sh activate-subscription [subscription-id]

# Enable all users in a company
./scripts/db-fix.sh enable-all-company-users [company-id]
```

---

## Common Troubleshooting Scenarios

### Scenario 1: User Can't Log In

**Check user status:**
```bash
./scripts/db-query.sh "SELECT id, email, is_active, email_verified, role FROM users WHERE email = 'user@example.com';"
```

**Fix if inactive:**
```bash
./scripts/db-fix.sh enable-user user@example.com
```

**Fix if email not verified:**
```bash
./scripts/db-fix.sh verify-email user@example.com
```

### Scenario 2: Company is Suspended

**Check company status:**
```bash
./scripts/db-query.sh "SELECT id, name, is_active FROM companies WHERE name = 'Company Name';"
```

**Enable company:**
```bash
./scripts/db-fix.sh enable-company [company-id]
```

**Enable all users in company:**
```bash
./scripts/db-fix.sh enable-all-company-users [company-id]
```

### Scenario 3: Subscription Issues

**Check subscription:**
```bash
./scripts/db-common-queries.sh provisioned
```

**Activate subscription:**
```bash
./scripts/db-fix.sh activate-subscription [subscription-id]
```

**Check subscription details:**
```bash
./scripts/db-query.sh "SELECT * FROM customer_subscriptions WHERE id = '[subscription-id]';"
```

### Scenario 4: Find Suspended Customers

```bash
./scripts/db-common-queries.sh fix-suspended
```

### Scenario 5: Check User's Companies

```bash
./scripts/db-query.sh "SELECT c.* FROM companies c JOIN user_company_associations uca ON c.id = uca.company_id WHERE uca.user_id = '[user-id]';"
```

### Scenario 6: Check Company's Users

```bash
./scripts/db-query.sh "SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, uca.role FROM users u JOIN user_company_associations uca ON u.id = uca.user_id WHERE uca.company_id = '[company-id]';"
```

---

## Useful SQL Queries

### User Queries

```sql
-- Find user by email
SELECT * FROM users WHERE email = 'user@example.com';

-- List all admins
SELECT id, email, first_name, last_name FROM users WHERE role = 'admin';

-- Find inactive users
SELECT id, email, is_active FROM users WHERE is_active = false;

-- Count users by role
SELECT role, COUNT(*) FROM users GROUP BY role;
```

### Company Queries

```sql
-- Find company by name
SELECT * FROM companies WHERE name ILIKE '%company%';

-- List all companies with user count
SELECT c.id, c.name, COUNT(uca.user_id) as user_count 
FROM companies c 
LEFT JOIN user_company_associations uca ON c.id = uca.company_id 
GROUP BY c.id, c.name;

-- Find companies without subscriptions
SELECT c.* FROM companies c 
LEFT JOIN customer_subscriptions cs ON c.id = cs.company_id 
WHERE cs.id IS NULL;
```

### Subscription Queries

```sql
-- All active subscriptions
SELECT * FROM customer_subscriptions WHERE status = 'active';

-- Subscriptions expiring soon
SELECT * FROM customer_subscriptions 
WHERE current_period_end < NOW() + INTERVAL '7 days';

-- Custom/provisioned subscriptions
SELECT cs.*, c.name as company_name, u.email as admin_email 
FROM customer_subscriptions cs 
JOIN companies c ON cs.company_id = c.id 
JOIN users u ON cs.user_id = u.id 
WHERE cs.is_custom = true;
```

### Association Queries

```sql
-- User's companies
SELECT c.*, uca.role 
FROM companies c 
JOIN user_company_associations uca ON c.id = uca.company_id 
WHERE uca.user_id = '[user-id]';

-- Company's users
SELECT u.*, uca.role 
FROM users u 
JOIN user_company_associations uca ON u.id = uca.user_id 
WHERE uca.company_id = '[company-id]';
```

---

## Database Structure

### Key Tables

1. **users** - User accounts
   - id, email, password_hash, first_name, last_name, role, is_active, email_verified

2. **companies** - Customer companies
   - id, name, domain, description, is_active

3. **customer_subscriptions** - Subscription records
   - id, user_id, company_id, plan_id, status, limits, is_custom

4. **user_company_associations** - Links users to companies
   - user_id, company_id, role

5. **tickets** - Support tickets
   - id, company_id, created_by, title, description, status

### View Table Schema

```bash
# View users table structure
./scripts/db-common-queries.sh schema users

# View subscriptions table structure
./scripts/db-common-queries.sh schema customer_subscriptions
```

---

## Direct Database Access

### Using Docker Exec

```bash
# One-off query
docker exec -it bomizzel-postgres psql -U bomizzel_user -d bomizzel_db -c "SELECT * FROM users LIMIT 5;"

# Interactive shell
docker exec -it bomizzel-postgres psql -U bomizzel_user -d bomizzel_db
```

### Connection Details

- **Host**: localhost
- **Port**: 5432
- **Database**: bomizzel_db
- **User**: bomizzel_user
- **Password**: bomizzel_password

### Using GUI Tools

You can connect with tools like:
- pgAdmin (http://localhost:5050 if running)
- DBeaver
- TablePlus
- DataGrip

---

## Safety Tips

1. **Always backup before major changes:**
   ```bash
   docker exec bomizzel-postgres pg_dump -U bomizzel_user bomizzel_db > backup.sql
   ```

2. **Test queries with SELECT first:**
   ```sql
   -- First check what will be affected
   SELECT * FROM users WHERE email = 'user@example.com';
   
   -- Then update
   UPDATE users SET is_active = true WHERE email = 'user@example.com';
   ```

3. **Use transactions for multiple changes:**
   ```sql
   BEGIN;
   UPDATE users SET is_active = false WHERE id = 'user-id';
   UPDATE companies SET is_active = false WHERE id = 'company-id';
   -- Check results, then:
   COMMIT;  -- or ROLLBACK; if something's wrong
   ```

4. **Be careful with DELETE:**
   - Use soft deletes (is_active = false) when possible
   - Always check foreign key constraints
   - Consider cascade effects

---

## Scripts Reference

### db-query.sh
Run a single SQL query
```bash
./scripts/db-query.sh "YOUR SQL QUERY"
```

### db-shell.sh
Open interactive PostgreSQL shell
```bash
./scripts/db-shell.sh
```

### db-common-queries.sh
Pre-built queries for common tasks
```bash
./scripts/db-common-queries.sh [command]
```

### db-fix.sh
Fix common database issues
```bash
./scripts/db-fix.sh [command] [args]
```

---

## Getting Help

### List Available Commands

```bash
# Common queries help
./scripts/db-common-queries.sh

# Fix scripts help
./scripts/db-fix.sh
```

### PostgreSQL Help

```bash
# In psql shell:
\?              # List all commands
\h              # SQL help
\h SELECT       # Help for specific command
```

---

## Examples

### Example 1: Enable a Suspended Customer

```bash
# 1. Find the customer
./scripts/db-common-queries.sh provisioned

# 2. Get subscription ID from output, then activate
./scripts/db-fix.sh activate-subscription abc-123-def

# 3. Enable the company
./scripts/db-fix.sh enable-company company-id-here

# 4. Enable all users
./scripts/db-fix.sh enable-all-company-users company-id-here
```

### Example 2: Check Why User Can't Login

```bash
# 1. Check user status
./scripts/db-query.sh "SELECT id, email, is_active, email_verified, role FROM users WHERE email = 'user@example.com';"

# 2. Check their companies
./scripts/db-query.sh "SELECT c.id, c.name, c.is_active FROM companies c JOIN user_company_associations uca ON c.id = uca.company_id JOIN users u ON uca.user_id = u.id WHERE u.email = 'user@example.com';"

# 3. Fix if needed
./scripts/db-fix.sh enable-user user@example.com
```

### Example 3: Audit Trail

```bash
# Check recent user activity
./scripts/db-query.sh "SELECT id, email, created_at, updated_at FROM users ORDER BY updated_at DESC LIMIT 10;"

# Check recent subscriptions
./scripts/db-query.sh "SELECT id, status, created_at FROM customer_subscriptions ORDER BY created_at DESC LIMIT 10;"
```
