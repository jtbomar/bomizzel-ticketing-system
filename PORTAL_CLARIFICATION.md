# Portal Clarification: Where is Data Management?

## Quick Answer

**Data Management is in the CUSTOMER PORTAL, not the BSI Admin Panel.**

## Why?

### Customer Portal (✅ Correct Location)
- **URL**: `/data-management`
- **Who**: Paying customers (company admins)
- **Purpose**: Customers backup and restore THEIR OWN data
- **Access**: Any customer admin can export/import their company's data

### BSI Admin Panel (❌ Not Here)
- **URL**: `/bsi/*`
- **Who**: Jeff Bomar only
- **Purpose**: Manage customer accounts and subscriptions
- **Does NOT**: Access customer data, tickets, or backups

## The Two Portals

```
┌──────────────────────────────────────────────────────────┐
│                    BOMIZZEL SYSTEM                       │
└──────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐
│  BSI ADMIN       │            │  CUSTOMER        │
│  (Jeff's Panel)  │            │  (Their Panel)   │
├──────────────────┤            ├──────────────────┤
│ • Provision      │            │ • Tickets        │
│ • Enable/Disable │            │ • Users          │
│ • Delete         │            │ • Export Data ⭐ │
│ • Subscriptions  │            │ • Import Data ⭐ │
└──────────────────┘            └──────────────────┘
```

## How Customers Access Data Management

### Step 1: Customer Logs In
```
Customer goes to: https://bomizzel.com/login
Enters: their email and password
```

### Step 2: Navigate to Data Management
```
From their dashboard:
Settings → Data Management
OR
Direct URL: https://bomizzel.com/data-management
```

### Step 3: Export or Import
```
Export Tab: Create backup
Import Tab: Restore backup
History Tab: View past exports/imports
```

## What Each Portal Does

### BSI Admin Panel (Jeff)
**Manages**: Customer accounts
- Create new customer accounts
- Set subscription limits
- Enable/disable accounts
- Delete accounts
- View all customers

**Does NOT Manage**: Customer data
- Cannot see customer tickets
- Cannot export customer data
- Cannot access customer files
- Privacy and security separation

### Customer Portal (Customers)
**Manages**: Their own data
- Submit and track tickets
- Manage their team members
- **Export their data** ⭐
- **Import their data** ⭐
- Configure custom fields
- View reports

**Does NOT Manage**: Other companies
- Cannot see other companies' data
- Cannot provision new accounts
- Cannot access BSI admin features

## Why This Separation?

### 1. Privacy
- Customers' data is private
- Jeff doesn't need access to customer tickets
- Each company's data is isolated

### 2. Security
- Separation of concerns
- Reduced attack surface
- Clear access boundaries

### 3. Compliance
- Data portability (GDPR)
- Customer data ownership
- Audit trail

### 4. Self-Service
- Customers control their backups
- No need to contact support
- Immediate access 24/7

## Navigation Path for Customers

```
Login (/login)
    ↓
Dashboard (/customer or /admin)
    ↓
Settings Menu
    ↓
Data Management (/data-management) ⭐
    ↓
Export/Import/History Tabs
```

## Common Questions

### Q: Can Jeff export customer data?
**A**: No. Customer data is private. Jeff manages accounts, not data.

### Q: Can customers see other companies' data?
**A**: No. Each customer only sees their own company's data.

### Q: Where do customers find Data Management?
**A**: In their Settings menu after logging in to the Customer Portal.

### Q: Is Data Management in the admin panel?
**A**: It's in the customer's admin dashboard (company admin), not Jeff's BSI admin panel.

### Q: Can regular users export data?
**A**: Typically only company admins can export/import. Regular users can only view tickets.

## Summary Table

| Feature | BSI Admin (Jeff) | Customer Portal |
|---------|-----------------|-----------------|
| **Login URL** | /bsi/login | /login |
| **Provision Customers** | ✅ | ❌ |
| **Enable/Disable Accounts** | ✅ | ❌ |
| **View All Companies** | ✅ | ❌ |
| **Submit Tickets** | ❌ | ✅ |
| **Export Own Data** | ❌ | ✅ ⭐ |
| **Import Own Data** | ❌ | ✅ ⭐ |
| **View Own Tickets** | ❌ | ✅ |

## Key Takeaway

**Data Management is a CUSTOMER feature, not an admin feature.**

Customers use it to:
- Backup their data regularly
- Restore after data loss
- Migrate to new systems
- Meet compliance requirements
- Have peace of mind

Jeff uses the BSI Admin Panel to:
- Manage customer accounts
- Set subscription limits
- Enable/disable access
- Monitor system health

**Two different portals, two different purposes!**
