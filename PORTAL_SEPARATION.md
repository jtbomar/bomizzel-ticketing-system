# Portal Separation Guide

## Two Separate Systems

Bomizzel has **TWO completely separate portals**:

---

## 1. 🏢 BSI Admin Portal (For Jeff Bomar)

**Purpose:** Manage Bomizzel Services Inc. - provision customers, manage subscriptions

**Login URL:** http://localhost:3000/bsi/login

**Who Uses This:**
- Jeff Bomar (jeffrey.t.bomar@gmail.com)
- Future BSI employees

**What You Can Do:**
- ✅ Provision new customers
- ✅ View all customers
- ✅ Update customer limits
- ✅ Manage subscriptions
- ✅ View revenue and analytics

**Login Credentials:**
- Email: `jeffrey.t.bomar@gmail.com`
- Password: `BomizzelAdmin2024!`

**Key URLs:**
- Login: http://localhost:3000/bsi/login
- Dashboard: http://localhost:3000/bsi/dashboard
- Provisioning: http://localhost:3000/bsi/provisioning

---

## 2. 🎫 Customer Portal (For Your Customers)

**Purpose:** Use the ticketing system - create tickets, manage support

**Login URL:** http://localhost:3000/login

**Who Uses This:**
- ABC Appliance (when you provision them)
- XYZ Company (when you provision them)
- Any customer who buys Bomizzel

**What They Can Do:**
- ✅ Create support tickets
- ✅ Track ticket status
- ✅ Manage their team
- ✅ View their dashboard
- ✅ Use the ticketing system

**Example Customer Login:**
- Email: `admin@bomizzel.com` (test customer)
- Password: `password123`

**Key URLs:**
- Login: http://localhost:3000/login
- Register: http://localhost:3000/register
- Dashboard: http://localhost:3000/customer
- Create Ticket: http://localhost:3000/create-ticket

---

## Visual Separation

```
┌─────────────────────────────────────────────────────────────┐
│                    BOMIZZEL SYSTEM                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│   BSI ADMIN PORTAL    │       │   CUSTOMER PORTAL     │
│   /bsi/login          │       │   /login              │
├───────────────────────┤       ├───────────────────────┤
│                       │       │                       │
│ For: Jeff Bomar       │       │ For: Your Customers   │
│                       │       │                       │
│ Purpose:              │       │ Purpose:              │
│ • Provision customers │       │ • Use ticketing       │
│ • Manage billing      │       │ • Create tickets      │
│ • View all customers  │       │ • Track support       │
│ • Update limits       │       │ • Manage team         │
│                       │       │                       │
│ Email:                │       │ Example:              │
│ jeffrey.t.bomar@      │       │ admin@abcappliance.   │
│ gmail.com             │       │ com                   │
│                       │       │                       │
└───────────────────────┘       └───────────────────────┘
```

---

## How It Works

### When You (Jeff) Work:

1. Go to **http://localhost:3000/bsi/login**
2. Login with your BSI admin credentials
3. You see:
   - Dashboard with all customers
   - Provisioning interface
   - Customer management
   - Revenue analytics

### When a Customer Works:

1. Go to **http://localhost:3000/login**
2. Login with their customer credentials
3. They see:
   - Their ticketing dashboard
   - Create ticket form
   - Their team's tickets
   - Their company's data ONLY

---

## Example Workflow

### Scenario: ABC Appliance Buys Bomizzel

**Step 1: You (Jeff) Provision Them**
1. Login at http://localhost:3000/bsi/login
2. Go to provisioning
3. Create ABC Appliance account:
   - Company: ABC Appliance
   - Admin: john@abcappliance.com
   - Limits: 100 users, 5000 tickets, 100GB
   - Price: $499/month

**Step 2: ABC Appliance Uses It**
1. John gets email with credentials
2. John goes to http://localhost:3000/login (NOT /bsi/login!)
3. John logs in with john@abcappliance.com
4. John sees ONLY ABC Appliance's ticketing system
5. John can:
   - Create tickets
   - Add team members
   - Manage support requests
   - View their dashboard

**Step 3: You Support Them**
1. Login at http://localhost:3000/bsi/login
2. View all customers
3. See ABC Appliance's usage
4. Upgrade their limits if needed
5. Monitor their subscription

---

## Key Differences

| Feature | BSI Admin Portal | Customer Portal |
|---------|-----------------|-----------------|
| **URL** | /bsi/login | /login |
| **Who** | Jeff Bomar (BSI) | Customers |
| **Purpose** | Manage customers | Use ticketing |
| **Can See** | All customers | Own company only |
| **Can Do** | Provision, bill, manage | Create tickets, support |
| **Email** | @bomizzel or @gmail | @customer-domain |

---

## Security

### BSI Admin Portal:
- ✅ Only accessible to BSI administrators
- ✅ Checks if user email contains "bomizzel"
- ✅ Requires admin role
- ✅ Separate login page

### Customer Portal:
- ✅ Each customer sees only their data
- ✅ Company-based isolation
- ✅ Role-based permissions
- ✅ Separate from BSI admin

---

## Testing Both Portals

### Test BSI Admin (You):
```bash
URL: http://localhost:3000/bsi/login
Email: jeffrey.t.bomar@gmail.com
Password: BomizzelAdmin2024!
```

### Test Customer Portal:
```bash
URL: http://localhost:3000/login
Email: admin@bomizzel.com
Password: password123
```

**Important:** These are DIFFERENT portals with DIFFERENT purposes!

---

## Production Setup

When you deploy to production:

### BSI Admin Portal:
- Could be: https://admin.bomizzel.com
- Or: https://bomizzel.com/bsi/login
- Only you and BSI employees access this

### Customer Portal:
- Could be: https://app.bomizzel.com
- Or: https://bomizzel.com/login
- All your customers access this

---

## Summary

✅ **BSI Admin Portal** = You manage Bomizzel business  
✅ **Customer Portal** = Customers use ticketing system  
✅ **Completely Separate** = Different logins, different purposes  
✅ **Clear Separation** = No confusion between admin and customer  

**You're all set with proper separation!** 🎉
