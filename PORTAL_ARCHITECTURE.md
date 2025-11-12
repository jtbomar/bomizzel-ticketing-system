# Bomizzel Portal Architecture

## Two Separate Portals

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOMIZZEL SYSTEM                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   BSI ADMIN PORTAL        │   │   CUSTOMER PORTAL         │
│   (Jeff Bomar Only)       │   │   (Paying Customers)      │
├───────────────────────────┤   ├───────────────────────────┤
│                           │   │                           │
│ URL: /bsi/*               │   │ URL: /customer, /admin    │
│                           │   │                           │
│ Login: /bsi/login         │   │ Login: /login             │
│ Email: admin@bomizzel.com │   │ Email: customer emails    │
│                           │   │                           │
│ FEATURES:                 │   │ FEATURES:                 │
│ ✓ Provision Customers     │   │ ✓ Submit Tickets          │
│ ✓ Enable/Disable Accounts │   │ ✓ Manage Users            │
│ ✓ Delete Customers        │   │ ✓ View Tickets            │
│ ✓ Manage Subscriptions    │   │ ✓ Custom Fields           │
│ ✓ View All Customers      │   │ ✓ Export/Import Data ⭐   │
│ ✓ Set Custom Limits       │   │ ✓ Company Settings        │
│                           │   │ ✓ Reports & Analytics     │
└───────────────────────────┘   └───────────────────────────┘
```

## Portal Details

### BSI Admin Portal (Jeff's Portal)

**Purpose**: Manage Bomizzel's business operations

**Access**:
- URL: `https://bomizzel.com/bsi/login`
- Email: `admin@bomizzel.com`
- Password: Set by Jeff

**Pages**:
1. `/bsi/login` - Admin login page
2. `/bsi/dashboard` - Super admin dashboard
3. `/bsi/provisioning` - Provision new customers

**Capabilities**:
- Create new customer accounts
- Set custom subscription limits
- Enable/disable customer access
- Delete customer accounts
- View all provisioned customers
- Monitor system health

**Who Uses It**: Jeff Bomar (Bomizzel owner)

---

### Customer Portal

**Purpose**: Customers manage their ticketing system

**Access**:
- URL: `https://bomizzel.com/login`
- Email: Customer's email address
- Password: Set by customer

**Pages**:
1. `/login` - Customer login
2. `/register` - New customer registration
3. `/customer` - Customer dashboard
4. `/admin` - Company admin dashboard
5. `/employee` - Employee dashboard
6. `/create-ticket` - Create new ticket
7. `/data-management` ⭐ - **NEW: Export/Import data**

**Capabilities**:
- Submit support tickets
- Track ticket status
- Manage company users
- Configure custom fields
- **Export company data** ⭐
- **Import company data** ⭐
- View reports
- Manage settings

**Who Uses It**: Paying customers and their team members

---

## Data Management Feature Location

### ✅ Correct: Customer Portal

The Data Management feature is in the **Customer Portal** because:

1. **Customers own their data** - They should control backups
2. **Self-service** - No need to contact Jeff for backups
3. **Privacy** - Customers can't see other companies' data
4. **Compliance** - Meets data portability requirements

### ❌ Not in BSI Admin Portal

Jeff (BSI Admin) does NOT have access to customer data export/import because:
- Customers' data is private
- Jeff manages accounts, not customer data
- Separation of concerns
- Security and privacy best practices

---

## Navigation Structure

### Customer Portal Navigation

```
┌─────────────────────────────────────────┐
│  [Logo] Bomizzel Ticketing              │
├─────────────────────────────────────────┤
│  Dashboard                              │
│  Tickets                                │
│  Users                                  │
│  Reports                                │
│  Settings                               │
│    ├─ Company Settings                  │
│    ├─ Custom Fields                     │
│    ├─ Data Management ⭐ NEW            │
│    └─ Billing                           │
│  Logout                                 │
└─────────────────────────────────────────┘
```

### BSI Admin Portal Navigation

```
┌─────────────────────────────────────────┐
│  [Logo] Bomizzel Admin                  │
├─────────────────────────────────────────┤
│  Dashboard                              │
│  Provision Customer                     │
│  Manage Customers                       │
│  System Health                          │
│  Logout                                 │
└─────────────────────────────────────────┘
```

---

## User Roles & Access

### BSI Admin (Jeff)
- **Portal**: BSI Admin Portal only
- **Can**: Manage customer accounts
- **Cannot**: Access customer data, tickets, or exports

### Customer Admin
- **Portal**: Customer Portal only
- **Can**: Manage their company, export/import data
- **Cannot**: Access other companies or BSI admin features

### Customer User
- **Portal**: Customer Portal only
- **Can**: Submit tickets, view their tickets
- **Cannot**: Export data (admin only), access other companies

### Customer Employee
- **Portal**: Customer Portal only
- **Can**: View and respond to tickets
- **Cannot**: Manage users, export data

---

## Data Flow

### Customer Data Export
```
Customer Admin
    ↓
Customer Portal (/data-management)
    ↓
Export API (/api/data-export/export)
    ↓
DataExportService
    ↓
Database (company's data only)
    ↓
ZIP file created
    ↓
Download link (24 hours)
    ↓
Customer downloads
```

### Customer Data Import
```
Customer Admin
    ↓
Customer Portal (/data-management)
    ↓
Upload JSON file
    ↓
Import API (/api/data-export/import)
    ↓
DataImportService
    ↓
Validate & Import
    ↓
Database (company's data only)
    ↓
Import summary shown
```

---

## Security Boundaries

### Portal Separation
```
┌─────────────────────────────────────────┐
│  BSI Admin Portal                       │
│  - Separate login                       │
│  - Separate routes (/bsi/*)            │
│  - Admin role required                  │
│  - Cannot access customer data          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Customer Portal                        │
│  - Separate login                       │
│  - Company-scoped data                  │
│  - Cannot access other companies        │
│  - Cannot access BSI admin features     │
└─────────────────────────────────────────┘
```

### API Security
- All endpoints require authentication
- Company ID verified for every request
- Users can only access their company's data
- Export/import logs track all activity

---

## Summary

| Feature | BSI Admin Portal | Customer Portal |
|---------|-----------------|-----------------|
| **Purpose** | Manage Bomizzel business | Manage ticketing system |
| **User** | Jeff Bomar | Paying customers |
| **Login URL** | /bsi/login | /login |
| **Provision Customers** | ✅ Yes | ❌ No |
| **Manage Subscriptions** | ✅ Yes | ❌ No |
| **Submit Tickets** | ❌ No | ✅ Yes |
| **Manage Users** | ❌ No | ✅ Yes |
| **Export/Import Data** | ❌ No | ✅ Yes ⭐ |
| **View Other Companies** | ✅ Yes (all) | ❌ No (own only) |

**Key Point**: Data Management is a **customer self-service feature** in the Customer Portal, not an admin feature!
