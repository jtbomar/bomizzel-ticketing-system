# Database Migration Strategy

This document outlines the database migration strategy for the Bomizzel Ticketing System.

## Overview

Our migration strategy ensures safe, reliable, and reversible database schema changes across all environments (development, staging, production).

## Migration Principles

### 1. **Backward Compatibility**
- All migrations must be backward compatible with the previous application version
- Use feature flags for breaking changes
- Implement gradual rollouts for major schema changes

### 2. **Zero-Downtime Deployments**
- Migrations should not require application downtime
- Use online schema changes when possible
- Implement blue-green deployment patterns for major changes

### 3. **Rollback Safety**
- Every migration must have a corresponding rollback
- Test rollbacks in staging environment
- Maintain data integrity during rollbacks

### 4. **Testing Requirements**
- All migrations tested in development and staging
- Performance impact assessed for large tables
- Data validation after migration completion

## Migration Types

### 1. **Safe Migrations** (Can run during deployment)
- Adding new tables
- Adding new columns (with defaults)
- Adding indexes (concurrently)
- Creating new views
- Adding constraints (validated separately)

### 2. **Risky Migrations** (Require maintenance window)
- Dropping columns or tables
- Renaming columns or tables
- Changing column types
- Adding NOT NULL constraints to existing columns
- Large data migrations

### 3. **Multi-Step Migrations** (For breaking changes)
1. **Step 1**: Add new schema alongside old
2. **Step 2**: Dual-write to both schemas
3. **Step 3**: Migrate existing data
4. **Step 4**: Switch reads to new schema
5. **Step 5**: Remove old schema

## Migration Workflow

### Development Environment
```bash
# Create new migration
npm run migrate:make migration_name --workspace=backend

# Run migrations
npm run migrate --workspace=backend

# Rollback last migration
npm run migrate:rollback --workspace=backend

# Check migration status
npx knex migrate:status --knexfile knexfile.js
```

### Staging Environment
```bash
# 1. Backup database
./scripts/db-backup.sh custom

# 2. Run migrations
npm run migrate --workspace=backend

# 3. Verify migration
./scripts/health-check.sh

# 4. Test rollback (if needed)
npm run migrate:rollback --workspace=backend
./scripts/db-restore.sh backup_file.dump
```

### Production Environment
```bash
# 1. Create backup
./scripts/db-backup.sh custom

# 2. Run migration with monitoring
npm run migrate --workspace=backend 2>&1 | tee migration.log

# 3. Verify migration success
./scripts/health-check.sh

# 4. Monitor application health
# (Check logs, metrics, error rates)
```

## Migration Best Practices

### 1. **Migration File Structure**
```javascript
exports.up = async function(knex) {
  // Forward migration
  // Use transactions for multiple operations
  return knex.transaction(async (trx) => {
    // Migration operations
  });
};

exports.down = async function(knex) {
  // Rollback migration
  // Must reverse all operations from up()
  return knex.transaction(async (trx) => {
    // Rollback operations
  });
};
```

### 2. **Adding Columns Safely**
```javascript
// Good: Add column with default value
await knex.schema.table('tickets', (table) => {
  table.string('new_field').defaultTo('default_value');
});

// Bad: Add NOT NULL column without default
await knex.schema.table('tickets', (table) => {
  table.string('new_field').notNullable(); // Will fail on existing rows
});
```

### 3. **Index Creation**
```javascript
// Good: Create index concurrently (PostgreSQL)
await knex.raw('CREATE INDEX CONCURRENTLY idx_tickets_status ON tickets(status)');

// Alternative: Create index in separate migration
await knex.schema.table('tickets', (table) => {
  table.index('status', 'idx_tickets_status');
});
```

### 4. **Data Migrations**
```javascript
// Good: Process in batches
const batchSize = 1000;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const batch = await knex('tickets')
    .select('id', 'old_field')
    .limit(batchSize)
    .offset(offset);
  
  if (batch.length === 0) {
    hasMore = false;
    break;
  }
  
  // Process batch
  for (const row of batch) {
    await knex('tickets')
      .where('id', row.id)
      .update('new_field', transformData(row.old_field));
  }
  
  offset += batchSize;
}
```

## Emergency Procedures

### 1. **Migration Failure During Deployment**
```bash
# 1. Stop application deployment
# 2. Check migration status
npx knex migrate:status --knexfile knexfile.js

# 3. If migration partially completed, assess damage
# 4. Rollback if safe
npm run migrate:rollback --workspace=backend

# 5. If rollback not safe, restore from backup
./scripts/db-restore.sh latest_backup.dump --drop-existing
```

### 2. **Performance Issues After Migration**
```bash
# 1. Check database performance metrics
# 2. Identify problematic queries
# 3. If caused by missing indexes, add them
# 4. If caused by migration, consider rollback
```

### 3. **Data Corruption After Migration**
```bash
# 1. Stop application immediately
# 2. Assess extent of corruption
# 3. Restore from backup if necessary
./scripts/db-restore.sh pre_migration_backup.dump --drop-existing

# 4. Investigate root cause
# 5. Fix migration and re-test
```

## Monitoring and Alerts

### 1. **Migration Monitoring**
- Track migration execution time
- Monitor database performance during migrations
- Alert on migration failures
- Log all migration activities

### 2. **Post-Migration Checks**
- Verify data integrity
- Check application functionality
- Monitor error rates
- Validate performance metrics

### 3. **Automated Checks**
```bash
# Add to CI/CD pipeline
npm run migrate --workspace=backend
npm run test:integration --workspace=backend
./scripts/health-check.sh
```

## Migration Checklist

### Before Migration
- [ ] Migration tested in development
- [ ] Migration tested in staging
- [ ] Rollback tested and verified
- [ ] Performance impact assessed
- [ ] Backup strategy confirmed
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment

### During Migration
- [ ] Database backup created
- [ ] Migration executed successfully
- [ ] Application health verified
- [ ] Performance metrics normal
- [ ] Error rates within acceptable limits

### After Migration
- [ ] Data integrity verified
- [ ] Application functionality tested
- [ ] Performance metrics stable
- [ ] Monitoring alerts reviewed
- [ ] Documentation updated
- [ ] Team notified of completion

## Tools and Scripts

### Available Scripts
- `./scripts/db-backup.sh` - Create database backups
- `./scripts/db-restore.sh` - Restore from backups
- `./scripts/health-check.sh` - Verify system health
- `npm run migrate` - Run pending migrations
- `npm run migrate:rollback` - Rollback last migration

### Monitoring Tools
- Database performance monitoring
- Application health checks
- Error rate monitoring
- Custom migration metrics

## Documentation Requirements

### Migration Documentation
Each migration should include:
- Purpose and description
- Risk assessment
- Rollback procedure
- Performance impact
- Testing results

### Example Migration Documentation
```markdown
# Migration: Add ticket priority field

## Purpose
Add priority field to tickets table to support priority-based queue sorting.

## Risk Assessment
- Low risk: Adding nullable column with default value
- No downtime required
- Backward compatible

## Rollback Procedure
- Remove priority column
- Update application to handle missing field

## Performance Impact
- Minimal: Single column addition
- No index required initially

## Testing
- Tested in development: ✅
- Tested in staging: ✅
- Rollback tested: ✅
```