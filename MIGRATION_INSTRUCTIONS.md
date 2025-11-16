# Running Production Migrations

## What Changed
We've renamed the `employee` role to `agent` throughout the entire system to maintain consistent terminology.

## Changes Made:
1. ✅ All TypeScript code updated (`employee` → `agent`)
2. ✅ Seed data updated
3. ✅ Two new migrations created
4. ✅ Code deployed to Railway (automatic)
5. ⏳ **Need to run migrations on production database**

## How to Run Migrations on Railway

### Option 1: Using Railway Dashboard (Easiest)
1. Go to https://railway.app/dashboard
2. Select your `backend-production` service
3. Click on the "Variables" tab
4. Find your `DATABASE_URL`
5. Go to the "Deployments" tab
6. Click on the latest deployment
7. Click "View Logs"
8. The migrations should run automatically on startup

### Option 2: Using Railway CLI
```bash
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
cd packages/backend
railway run npm run migrate
```

### Option 3: Manual SQL (if needed)
If the automatic migrations don't run, you can execute this SQL directly in Railway's PostgreSQL:

```sql
-- Update users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('customer', 'agent', 'team_lead', 'admin'));
UPDATE users SET role = 'agent' WHERE role = 'employee';

-- Update queues table  
ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_type_check;
ALTER TABLE queues ADD CONSTRAINT queues_type_check 
  CHECK (type IN ('unassigned', 'agent'));
UPDATE queues SET type = 'agent' WHERE type = 'employee';
```

## Verification
After running migrations, verify by checking:
1. Login to bomizzel.com should still work
2. Agents list should display correctly
3. No console errors about invalid roles
4. Departments endpoint should work (no 400 error)

## Rollback (if needed)
If something goes wrong, the migrations have a `down` function:
```bash
cd packages/backend
railway run npm run migrate:rollback
```
