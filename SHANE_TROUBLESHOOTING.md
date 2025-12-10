# Shane's Ticket Issue Troubleshooting Guide

## Current Status
We've deployed debugging improvements to help identify why you're not seeing tickets. Here's what to check:

## Step 1: Check Browser Console
1. **Open Developer Tools** (F12 or right-click → Inspect)
2. **Go to Console tab**
3. **Refresh the AgentDashboard page**
4. **Look for these log messages:**
   - `[AgentDashboard] User state changed: your-email@domain.com (employee)`
   - `[AgentDashboard] Initial tickets loaded: X`
   - `[AgentDashboard] Fetching fresh tickets from API`
   - `[AgentDashboard] Received X tickets from API`

## Step 2: Verify Login Status
**Check if you're properly logged in:**
1. Look for user info in the console logs
2. If you see "User state changed: null", you're not logged in
3. **Try logging in with these test credentials:**
   - Email: `admin@bomizzel.com`
   - Password: `password123`
   - OR Email: `sarah@bomizzel.com` / Password: `password123`

## Step 3: Check Network Tab
1. **Open Network tab** in Developer Tools
2. **Refresh the page**
3. **Look for API calls to:**
   - `/api/tickets` - should return ticket data
   - `/api/agents` - should return agent list
4. **Check if any calls are failing (red status)**

## Step 4: Check Ticket Filtering
**The dashboard now defaults to "All Tickets" so you should see tickets immediately!**
1. **Look for the filter toggle button** - it should show "All Tickets" by default now
2. **If you see ticket counts but no individual tickets**, check the console for filtering logs
3. **Click the 🔄 Refresh button** to force fresh data from server
4. **Try toggling between "All Tickets" and "My Tickets"**

## Step 5: Clear Cache (If Needed)
If you're still having issues:
1. **Clear localStorage:** Open Console and run: `localStorage.clear()`
2. **Hard refresh:** Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. **Log in again**

## Expected Behavior After Fixes:
- ✅ **Login** should work with test credentials
- ✅ **Tickets should load** from the database (125+ tickets available)
- ✅ **Assignment changes** should persist when you assign tickets to yourself
- ✅ **Status changes** should persist when you change ticket status
- ✅ **Filter toggle** should work between "My Tickets" and "All Tickets"
- ✅ **Refresh button** should fetch latest data

## NEW: Enhanced Debugging (After Screenshot Issue)
Based on your screenshot showing ticket counts but no individual tickets:

1. **Open Browser Console** (F12 → Console tab)
2. **Refresh the AgentDashboard page**
3. **Look for these specific log messages:**
   - `[AgentDashboard] Filtering tickets - total: X`
   - `[AgentDashboard] getStatusTickets("open") - filteredTickets: X statusTickets: Y`
   - `[AgentDashboard] Rendering tickets for status "open": X`

4. **If you see a debug screen instead of the kanban board:**
   - Click the "Log Debug Info" button
   - Copy the console output

5. **Check if ticket statuses match:**
   - Look for "Sample ticket statuses" vs "Expected statuses" in any debug messages

## What to Report Back:
Please share:
1. **Console log messages** (copy/paste the relevant ones, especially the filtering and rendering logs)
2. **Any error messages** in red
3. **Screenshot of any debug screens** that appear
4. **Whether you can log in successfully**
5. **The exact ticket counts** you see in the column headers

## Quick Test Accounts:
- **Admin**: `admin@bomizzel.com` / `password123`
- **Employee**: `sarah@bomizzel.com` / `password123`
- **Employee**: `mike@bomizzel.com` / `password123`

The debugging information will help us identify exactly what's happening!