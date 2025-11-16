# How to Reseed Production Database

Your production database needs to be reseeded to restore all the test data (companies, departments, business hours, holiday lists, etc.)

## Option 1: Using Railway Dashboard (Easiest)

1. Go to https://railway.app/dashboard
2. Click on your **backend-production** service
3. Click the **"Settings"** tab
4. Scroll down to **"Service Settings"**
5. Click **"Deploy"** dropdown
6. Select **"Run a command"**
7. Enter this command:
   ```
   npm run seed
   ```
8. Click **"Run"**
9. Wait 30 seconds for it to complete

## Option 2: Using Railway CLI

```bash
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run seed
cd packages/backend
railway run npm run seed
```

## Option 3: Manual SQL (if above don't work)

If the seed command doesn't work, you can manually add a company:

1. Go to Railway dashboard
2. Click on your **PostgreSQL** database
3. Click **"Data"** tab
4. Click **"Query"** 
5. Run this SQL:

```sql
-- Add a test company
INSERT INTO companies (id, name, domain, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Acme Corporation',
  'acme.com',
  true,
  NOW(),
  NOW()
);

-- Add a department
INSERT INTO departments (id, company_id, name, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  id,
  'Support',
  true,
  NOW(),
  NOW()
FROM companies WHERE name = 'Acme Corporation';
```

## What Gets Restored

Running the seed will create:
- ✅ 5 Companies (Acme Corp, TechStart, Global Industries, etc.)
- ✅ 20 Customers (4 per company)
- ✅ 4 Agents (Sarah, Mike, Emily, David)
- ✅ 50 Tickets with various statuses
- ✅ 2 Teams (Support, Technical)
- ✅ Departments for each company
- ✅ Business hours
- ✅ Holiday lists

## Verify It Worked

After reseeding:
1. Refresh bomizzel.com
2. Login as admin@bomizzel.com / password123
3. Check Admin menu - you should see:
   - Companies
   - Departments
   - Business Hours
   - Holiday Lists
   - Customer Happiness

## If You Get Errors

If you see "duplicate key" errors, the data is already there. Just refresh your browser.

If you see "relation does not exist" errors, the migrations haven't run. Contact me.
