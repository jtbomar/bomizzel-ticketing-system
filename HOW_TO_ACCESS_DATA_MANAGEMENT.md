# How to Access Data Management

## For Customers: Step-by-Step Guide

### Method 1: Through Admin Dashboard (Recommended)

```
1. Log in to your account
   URL: https://bomizzel.com/login
   
2. Navigate to Admin Dashboard
   Click: "Admin" or "Administration" in the menu
   URL: https://bomizzel.com/admin
   
3. Click "Data Management" tab
   Look for the tab in the navigation bar:
   [Users] [Companies] [Teams] [Layouts] [Profile] [Data Management] ⭐ [Settings]
   
4. Click "Go to Data Management" button
   This takes you to the full Data Management page
```

### Method 2: Direct URL

```
Simply go to: https://bomizzel.com/data-management
```

## Visual Guide

### Step 1: Login Page
```
┌─────────────────────────────────────┐
│  Bomizzel Ticketing System          │
├─────────────────────────────────────┤
│  Email:    [________________]       │
│  Password: [________________]       │
│  [Login]                            │
└─────────────────────────────────────┘
```

### Step 2: Admin Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  Administration                                             │
│  Welcome back, John! Manage users, teams, and system config │
├─────────────────────────────────────────────────────────────┤
│  Tabs:                                                      │
│  [Users] [Companies] [Teams] [Layouts] [Profile]           │
│  [Data Management] ⭐ [Settings]                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Click on "Data Management" tab above ↑                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 3: Data Management Tab View
```
┌─────────────────────────────────────────────────────────────┐
│  Data Management                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              📦                                             │
│                                                             │
│         Data Management                                     │
│                                                             │
│  Export and import your company data for                    │
│  backup and migration purposes                              │
│                                                             │
│  [Go to Data Management] ← Click this button                │
│                                                             │
│  What you can do:                                           │
│  ✓ Export Data: Create backups of users, tickets...        │
│  ✓ Import Data: Restore from previous backups...           │
│  ✓ View History: Track all export and import activities    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Full Data Management Page
```
┌─────────────────────────────────────────────────────────────┐
│  Data Management                                            │
│  Export your data for backup or import data from exports   │
├─────────────────────────────────────────────────────────────┤
│  [Export Data] [Import Data] [History]                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Export Your Data                                           │
│  ☑ Include Users                                            │
│  ☑ Include Tickets                                          │
│  ☑ Include Attachments Metadata                            │
│  ☑ Include Custom Fields                                    │
│                                                             │
│  [Export Data]                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Where to Find It

### In the Navigation

**Admin Dashboard** → **Data Management Tab** → **Go to Data Management Button**

Or just bookmark: `https://bomizzel.com/data-management`

## What You'll See

### Tab Navigation
The Data Management tab is located between "Profile" and "Settings" in the admin dashboard:

```
Users | Companies | Teams | Layouts | Profile | [Data Management] | Settings
                                                      ↑
                                                  Click here!
```

### Features Available
Once you click "Go to Data Management", you'll see three tabs:

1. **Export Data** - Create backups
2. **Import Data** - Restore backups
3. **History** - View past exports/imports

## Quick Access Checklist

- [x] Route added: `/data-management`
- [x] Tab added to Admin Dashboard
- [x] Button to navigate to full page
- [x] Full-featured Data Management page
- [x] Export functionality
- [x] Import functionality
- [x] History tracking

## Troubleshooting

### "I don't see the Data Management tab"
**Solution**: Make sure you're logged in as a company admin, not a regular user.

### "The tab is there but nothing happens when I click it"
**Solution**: Click the blue "Go to Data Management" button that appears.

### "I want to go directly to the page"
**Solution**: Use the direct URL: `/data-management`

## For Developers

### Files Modified
1. `packages/frontend/src/App.tsx` - Added route
2. `packages/frontend/src/pages/SimpleAdminDashboard.tsx` - Added tab and content
3. `packages/frontend/src/pages/DataManagement.tsx` - Full page component

### Route Configuration
```typescript
<Route path="/data-management" element={<DataManagement />} />
```

### Tab Configuration
```typescript
const tabs = [
  { id: 'users', name: 'User Management' },
  { id: 'companies', name: 'Company Management' },
  { id: 'teams', name: 'Team Management' },
  { id: 'layouts', name: 'Ticket Layouts' },
  { id: 'profile', name: 'Company Profile' },
  { id: 'data', name: 'Data Management' }, // ← NEW
  { id: 'settings', name: 'System Settings' },
];
```

## Summary

**To access Data Management:**

1. Log in as admin
2. Go to Admin Dashboard (`/admin`)
3. Click "Data Management" tab
4. Click "Go to Data Management" button
5. Or go directly to `/data-management`

**You should now see it in your admin panel!** 🎉
