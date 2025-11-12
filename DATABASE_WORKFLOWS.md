# Database Workflows - Visual Guide

## 🎯 Common Workflows

### Workflow 1: Daily Health Check
```
┌─────────────────────────────────────┐
│  ./scripts/db-health.sh             │
│                                     │
│  Shows:                             │
│  ✓ Container status                 │
│  ✓ Connection status                │
│  ✓ Record counts                    │
│  ✓ Warnings (inactive/suspended)    │
│  ✓ Database size                    │
│  ✓ Recent activity                  │
└─────────────────────────────────────┘
```

### Workflow 2: User Can't Login
```
┌─────────────────────────────────────┐
│  1. Check user status               │
│  ./scripts/db-query.sh \            │
│    "SELECT id, email, is_active,    │
│     email_verified FROM users       │
│     WHERE email = 'user@email.com';"│
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Fix the issue                   │
│  ./scripts/db-fix.sh enable-user \  │
│    user@email.com                   │
│                                     │
│  ./scripts/db-fix.sh verify-email \ │
│    user@email.com                   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Verify fix                      │
│  ./scripts/db-query.sh \            │
│    "SELECT is_active, email_verified│
│     FROM users                      │
│     WHERE email = 'user@email.com';"│
└─────────────────────────────────────┘
```

### Workflow 3: Enable Suspended Customer
```
┌─────────────────────────────────────┐
│  1. Find suspended customers        │
│  ./scripts/db-common-queries.sh \   │
│    fix-suspended                    │
│                                     │
│  OR                                 │
│                                     │
│  ./scripts/db-common-queries.sh \   │
│    provisioned                      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Get IDs from output             │
│  - subscription_id                  │
│  - company_id                       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Activate subscription           │
│  ./scripts/db-fix.sh \              │
│    activate-subscription \          │
│    [subscription-id]                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  4. Enable company                  │
│  ./scripts/db-fix.sh \              │
│    enable-company [company-id]      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  5. Enable all users                │
│  ./scripts/db-fix.sh \              │
│    enable-all-company-users \       │
│    [company-id]                     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  6. Verify                          │
│  ./scripts/db-common-queries.sh \   │
│    provisioned                      │
└─────────────────────────────────────┘
```

### Workflow 4: Make User an Admin
```
┌─────────────────────────────────────┐
│  1. Find user                       │
│  ./scripts/db-query.sh \            │
│    "SELECT id, email, role          │
│     FROM users                      │
│     WHERE email = 'user@email.com';"│
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Make admin                      │
│  ./scripts/db-fix.sh make-admin \   │
│    user@email.com                   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Verify                          │
│  ./scripts/db-common-queries.sh \   │
│    admin                            │
└─────────────────────────────────────┘
```

### Workflow 5: Backup Before Major Changes
```
┌─────────────────────────────────────┐
│  1. Create backup                   │
│  ./scripts/db-backup.sh \           │
│    before-changes                   │
│                                     │
│  Output: backups/before-changes.sql.gz│
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Make your changes               │
│  (migrations, manual updates, etc)  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Test changes                    │
│  ./scripts/db-health.sh             │
└─────────────────────────────────────┘
              ↓
         ┌────┴────┐
         │         │
    ✓ Success  ✗ Problem
         │         │
         │         ↓
         │    ┌─────────────────────────────┐
         │    │  4. Restore backup          │
         │    │  ./scripts/db-restore.sh \  │
         │    │    backups/before-changes...│
         │    └─────────────────────────────┘
         │
         ↓
    ┌─────────────────────────────────┐
    │  Keep changes                   │
    └─────────────────────────────────┘
```

### Workflow 6: Investigate Data Issues
```
┌─────────────────────────────────────┐
│  1. Get overview                    │
│  ./scripts/db-common-queries.sh \   │
│    count                            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Check specific area             │
│  ./scripts/db-common-queries.sh \   │
│    users                            │
│  ./scripts/db-common-queries.sh \   │
│    companies                        │
│  ./scripts/db-common-queries.sh \   │
│    subscriptions                    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Drill down with custom query    │
│  ./scripts/db-query.sh \            │
│    "SELECT ... WHERE ..."           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  4. Fix if needed                   │
│  ./scripts/db-fix.sh [command]      │
└─────────────────────────────────────┘
```

### Workflow 7: Interactive Exploration
```
┌─────────────────────────────────────┐
│  1. Open shell                      │
│  ./scripts/db-shell.sh              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Explore interactively           │
│  \dt                  (list tables) │
│  \d users            (table schema) │
│  SELECT * FROM users LIMIT 5;       │
│  \q                          (quit) │
└─────────────────────────────────────┘
```

---

## 🔍 Decision Tree: Which Script to Use?

```
Need to...
│
├─ View data?
│  ├─ Common queries → db-common-queries.sh
│  ├─ Custom query → db-query.sh
│  └─ Interactive → db-shell.sh
│
├─ Fix an issue?
│  └─ db-fix.sh [command]
│
├─ Check system health?
│  └─ db-health.sh
│
├─ Backup/restore?
│  ├─ Backup → db-backup.sh
│  └─ Restore → db-restore.sh
│
└─ Need help?
   └─ help.sh
```

---

## 📋 Quick Command Reference

### Most Used Commands (Top 10)

```bash
# 1. Health check
./scripts/db-health.sh

# 2. View all users
./scripts/db-common-queries.sh users

# 3. View provisioned customers
./scripts/db-common-queries.sh provisioned

# 4. Enable a user
./scripts/db-fix.sh enable-user user@example.com

# 5. Make someone admin
./scripts/db-fix.sh make-admin user@example.com

# 6. Activate subscription
./scripts/db-fix.sh activate-subscription [sub-id]

# 7. Create backup
./scripts/db-backup.sh

# 8. Custom query
./scripts/db-query.sh "SELECT * FROM users WHERE role = 'admin';"

# 9. View record counts
./scripts/db-common-queries.sh count

# 10. Interactive shell
./scripts/db-shell.sh
```

---

## 🚨 Emergency Procedures

### Emergency 1: Database Not Responding
```bash
# 1. Check container
docker ps | grep postgres

# 2. If not running
npm run docker:up

# 3. Check health
./scripts/db-health.sh
```

### Emergency 2: All Users Locked Out
```bash
# 1. Check inactive users
./scripts/db-common-queries.sh inactive

# 2. Enable specific user
./scripts/db-fix.sh enable-user admin@bomizzel.com

# 3. Or enable all users in company
./scripts/db-fix.sh enable-all-company-users [company-id]
```

### Emergency 3: Need to Rollback Changes
```bash
# 1. List backups
ls -lh backups/

# 2. Restore from backup
./scripts/db-restore.sh backups/[backup-file].sql.gz

# 3. Verify
./scripts/db-health.sh
```

---

## 💡 Pro Tips

1. **Always backup before major changes**
   ```bash
   ./scripts/db-backup.sh before-migration
   npm run db:migrate
   ```

2. **Use health check regularly**
   ```bash
   # Add to your daily routine
   ./scripts/db-health.sh
   ```

3. **Test queries with SELECT first**
   ```bash
   # First check what will be affected
   ./scripts/db-query.sh "SELECT * FROM users WHERE email = 'user@example.com';"
   
   # Then update
   ./scripts/db-fix.sh enable-user user@example.com
   ```

4. **Keep backups organized**
   ```bash
   ./scripts/db-backup.sh before-feature-x
   ./scripts/db-backup.sh before-migration-027
   ./scripts/db-backup.sh weekly-backup-$(date +%Y%m%d)
   ```

5. **Use help when unsure**
   ```bash
   ./scripts/help.sh
   ./scripts/db-common-queries.sh  # (no args shows help)
   ./scripts/db-fix.sh             # (no args shows help)
   ```

---

## 📚 Related Documentation

- **Full Guide**: [DATABASE_GUIDE.md](DATABASE_GUIDE.md)
- **Quick Reference**: [QUICK_DB_REFERENCE.md](QUICK_DB_REFERENCE.md)
- **Customer Management**: [packages/backend/docs/CUSTOMER_MANAGEMENT.md](packages/backend/docs/CUSTOMER_MANAGEMENT.md)
- **Scripts Summary**: [DATABASE_SCRIPTS_COMPLETE.md](DATABASE_SCRIPTS_COMPLETE.md)
