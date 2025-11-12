# Database Scripts - Complete Implementation

## Summary

Created a comprehensive set of database management scripts to query, fix, backup, and monitor the PostgreSQL database.

## Scripts Created

### 1. db-query.sh
**Purpose**: Run custom SQL queries
```bash
./scripts/db-query.sh "SELECT * FROM users LIMIT 5;"
```

### 2. db-shell.sh
**Purpose**: Open interactive PostgreSQL shell
```bash
./scripts/db-shell.sh
```

### 3. db-common-queries.sh
**Purpose**: Pre-built queries for common tasks
```bash
./scripts/db-common-queries.sh users
./scripts/db-common-queries.sh provisioned
./scripts/db-common-queries.sh count
```

**Available Commands**:
- `tables` - List all tables
- `users` - Show all users
- `companies` - Show all companies
- `subscriptions` - Show all subscriptions
- `provisioned` - Show provisioned customers
- `admin` - Show admin users
- `inactive` - Show inactive users and companies
- `schema [table]` - Show table schema
- `count` - Show record counts
- `fix-suspended` - Find suspended customers

### 4. db-fix.sh
**Purpose**: Fix common database issues
```bash
./scripts/db-fix.sh enable-user user@example.com
./scripts/db-fix.sh make-admin user@example.com
./scripts/db-fix.sh activate-subscription [sub-id]
```

**Available Commands**:
- `enable-user [email]` - Enable a user account
- `disable-user [email]` - Disable a user account
- `make-admin [email]` - Make user an admin
- `verify-email [email]` - Mark email as verified
- `enable-company [company-id]` - Enable a company
- `disable-company [company-id]` - Disable a company
- `enable-all-company-users [company-id]` - Enable all users in company
- `disable-all-company-users [company-id]` - Disable all users in company
- `activate-subscription [sub-id]` - Activate a subscription
- `suspend-subscription [sub-id]` - Suspend a subscription

### 5. db-backup.sh
**Purpose**: Create database backups
```bash
./scripts/db-backup.sh                    # Auto-named backup
./scripts/db-backup.sh my-backup          # Custom name
```

**Features**:
- Creates SQL dump
- Compresses with gzip
- Shows file size
- Lists recent backups

### 6. db-restore.sh
**Purpose**: Restore database from backup
```bash
./scripts/db-restore.sh backups/backup.sql.gz
```

**Features**:
- Handles compressed files
- Confirmation prompt
- Drops and recreates database
- Cleanup of temp files

### 7. db-health.sh
**Purpose**: Check database health and status
```bash
./scripts/db-health.sh
```

**Checks**:
- Container status
- Database connection
- Record counts
- Inactive users/companies
- Suspended subscriptions
- Admin count
- Database size
- Recent activity (24h)

### 8. help.sh
**Purpose**: Display help for all scripts
```bash
./scripts/help.sh
```

## Documentation Created

### 1. DATABASE_GUIDE.md
Comprehensive guide covering:
- Quick start examples
- Common troubleshooting scenarios
- Useful SQL queries
- Database structure
- Direct database access
- Safety tips
- Script reference

### 2. QUICK_DB_REFERENCE.md
Quick reference card with:
- Most common commands
- Common troubleshooting
- Useful queries
- All available scripts
- Database connection info

### 3. Updated README.md
Added database management section with:
- Script examples
- Quick reference
- Link to full guide

## Usage Examples

### Example 1: Check System Health
```bash
./scripts/db-health.sh
```

### Example 2: View All Users
```bash
./scripts/db-common-queries.sh users
```

### Example 3: Enable a Suspended Customer
```bash
# 1. Find the customer
./scripts/db-common-queries.sh provisioned

# 2. Activate subscription
./scripts/db-fix.sh activate-subscription [sub-id]

# 3. Enable company
./scripts/db-fix.sh enable-company [company-id]

# 4. Enable all users
./scripts/db-fix.sh enable-all-company-users [company-id]
```

### Example 4: Backup Before Changes
```bash
# Create backup
./scripts/db-backup.sh before-changes

# Make changes...

# Restore if needed
./scripts/db-restore.sh backups/before-changes.sql.gz
```

### Example 5: Custom Query
```bash
./scripts/db-query.sh "SELECT u.email, c.name FROM users u JOIN user_company_associations uca ON u.id = uca.user_id JOIN companies c ON uca.company_id = c.id WHERE u.role = 'admin';"
```

## Testing Results

All scripts tested and working:
- ✅ db-query.sh - Executes queries successfully
- ✅ db-shell.sh - Opens interactive shell
- ✅ db-common-queries.sh - All commands working
- ✅ db-fix.sh - All fix commands working
- ✅ db-backup.sh - Creates and compresses backups
- ✅ db-restore.sh - Restores from backups
- ✅ db-health.sh - Shows comprehensive health info
- ✅ help.sh - Displays help information

## Database Connection Details

- **Container**: bomizzel-postgres
- **Host**: localhost
- **Port**: 5432
- **Database**: bomizzel_db
- **User**: bomizzel_user
- **Password**: bomizzel_password

## Files Created

### Scripts (in scripts/)
1. db-query.sh
2. db-shell.sh
3. db-common-queries.sh
4. db-fix.sh
5. db-backup.sh
6. db-restore.sh
7. db-health.sh
8. help.sh

### Documentation
1. DATABASE_GUIDE.md - Full guide
2. QUICK_DB_REFERENCE.md - Quick reference
3. DATABASE_SCRIPTS_COMPLETE.md - This file
4. Updated README.md - Added database section

## Benefits

1. **Easy Troubleshooting**: Quick commands to diagnose issues
2. **Safe Operations**: Backup/restore capabilities
3. **Time Saving**: Pre-built queries for common tasks
4. **Learning Tool**: Examples of SQL queries
5. **Monitoring**: Health check for system status
6. **Documentation**: Comprehensive guides and references

## Future Enhancements

Potential additions:
1. Database migration rollback script
2. Data export/import for specific tables
3. Performance monitoring script
4. Automated backup scheduling
5. Database cleanup script (old records)
6. Connection pool monitoring
7. Query performance analysis

## Status

✅ **COMPLETE** - All scripts implemented, tested, and documented
- 8 scripts created
- 3 documentation files
- All scripts executable and tested
- Comprehensive examples provided
- README updated
