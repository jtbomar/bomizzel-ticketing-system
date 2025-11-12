# Quick Database Reference Card

## 🚀 Most Common Commands

### View Data
```bash
./scripts/db-common-queries.sh users          # All users
./scripts/db-common-queries.sh provisioned    # Provisioned customers
./scripts/db-common-queries.sh admin          # Admin users
./scripts/db-common-queries.sh count          # Record counts
```

### Fix Issues
```bash
./scripts/db-fix.sh enable-user [email]                    # Enable user
./scripts/db-fix.sh make-admin [email]                     # Make admin
./scripts/db-fix.sh activate-subscription [sub-id]         # Activate subscription
./scripts/db-fix.sh enable-all-company-users [company-id]  # Enable all users
```

### Custom Queries
```bash
./scripts/db-query.sh "SELECT * FROM users WHERE email = 'user@example.com';"
```

### Backup
```bash
./scripts/db-backup.sh                        # Create backup
./scripts/db-restore.sh backups/backup.sql.gz # Restore
```

---

## 🔍 Common Troubleshooting

### User Can't Login
```bash
# 1. Check user
./scripts/db-query.sh "SELECT id, email, is_active, email_verified FROM users WHERE email = 'user@example.com';"

# 2. Fix
./scripts/db-fix.sh enable-user user@example.com
./scripts/db-fix.sh verify-email user@example.com
```

### Company Suspended
```bash
# 1. Find company
./scripts/db-common-queries.sh companies

# 2. Enable
./scripts/db-fix.sh enable-company [company-id]
./scripts/db-fix.sh enable-all-company-users [company-id]
```

### Check Subscription
```bash
./scripts/db-common-queries.sh provisioned
./scripts/db-fix.sh activate-subscription [sub-id]
```

---

## 📊 Useful Queries

### Find User
```sql
SELECT * FROM users WHERE email = 'user@example.com';
```

### User's Companies
```sql
SELECT c.* FROM companies c 
JOIN user_company_associations uca ON c.id = uca.company_id 
JOIN users u ON uca.user_id = u.id 
WHERE u.email = 'user@example.com';
```

### Company's Users
```sql
SELECT u.id, u.email, u.first_name, u.last_name, uca.role 
FROM users u 
JOIN user_company_associations uca ON u.id = uca.user_id 
WHERE uca.company_id = '[company-id]';
```

### All Admins
```sql
SELECT id, email, first_name, last_name FROM users WHERE role = 'admin';
```

### Inactive Users
```sql
SELECT id, email, is_active FROM users WHERE is_active = false;
```

---

## 🛠️ All Available Scripts

### db-common-queries.sh
```bash
./scripts/db-common-queries.sh tables
./scripts/db-common-queries.sh users
./scripts/db-common-queries.sh companies
./scripts/db-common-queries.sh subscriptions
./scripts/db-common-queries.sh provisioned
./scripts/db-common-queries.sh admin
./scripts/db-common-queries.sh inactive
./scripts/db-common-queries.sh count
./scripts/db-common-queries.sh schema [table]
```

### db-fix.sh
```bash
./scripts/db-fix.sh enable-user [email]
./scripts/db-fix.sh disable-user [email]
./scripts/db-fix.sh make-admin [email]
./scripts/db-fix.sh verify-email [email]
./scripts/db-fix.sh enable-company [company-id]
./scripts/db-fix.sh disable-company [company-id]
./scripts/db-fix.sh activate-subscription [sub-id]
./scripts/db-fix.sh suspend-subscription [sub-id]
./scripts/db-fix.sh enable-all-company-users [company-id]
./scripts/db-fix.sh disable-all-company-users [company-id]
```

---

## 💾 Database Connection

- **Host**: localhost
- **Port**: 5432
- **Database**: bomizzel_db
- **User**: bomizzel_user
- **Password**: bomizzel_password

---

## 📚 Full Documentation

See [DATABASE_GUIDE.md](DATABASE_GUIDE.md) for complete documentation.
