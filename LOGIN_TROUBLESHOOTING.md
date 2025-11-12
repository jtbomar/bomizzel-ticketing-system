# Login Troubleshooting Guide

## Issue: Login redirects back to login page

### What was fixed:
The login page was always redirecting to `/employee` regardless of user role. Now it redirects based on the user's actual role.

### How login now works:

1. User enters credentials
2. Backend authenticates and returns user data with role
3. Frontend stores token and user in localStorage
4. **NEW:** Login page checks user role and redirects appropriately:
   - `admin` → `/admin`
   - `employee` → `/employee`
   - `customer` → `/customer`

---

## Debugging Steps

### Step 1: Check Browser Console

Open browser DevTools (F12) and look for these messages:

```
[ProtectedRoute] Verifying token for user: admin@bomizzel.com role: admin
[ProtectedRoute] Token valid
[ProtectedRoute] Role check - required: admin user: admin hasRole: true
```

### Step 2: Check localStorage

In browser console, run:

```javascript
console.log('Token:', localStorage.getItem('token'));
console.log('User:', JSON.parse(localStorage.getItem('user')));
```

You should see:
```javascript
Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
User: {
  id: "...",
  email: "admin@bomizzel.com",
  role: "admin",
  firstName: "...",
  lastName: "..."
}
```

### Step 3: Check Network Tab

1. Open DevTools → Network tab
2. Try to login
3. Look for these requests:
   - `POST /api/auth/login` → Should return 200 with token
   - `GET /api/auth/verify` → Should return 200 with valid: true

### Step 4: Clear Everything and Retry

```javascript
// In browser console
localStorage.clear();
// Then refresh page and login again
```

---

## Common Issues & Solutions

### Issue: "Access Denied" after login

**Cause:** User role doesn't match required role for the route

**Solution:** 
1. Check user role in localStorage
2. Verify the route requires that role
3. Admin users should be able to access admin, employee, and customer routes

### Issue: Infinite redirect loop

**Cause:** Token is invalid or expired

**Solution:**
```javascript
localStorage.clear();
// Refresh and login again
```

### Issue: Login succeeds but immediately logs out

**Cause:** Backend `/api/auth/verify` endpoint failing

**Solution:**
1. Check backend is running
2. Check backend logs for errors
3. Verify JWT_SECRET is set in backend .env

### Issue: "Token invalid" in console

**Cause:** JWT_SECRET mismatch or token expired

**Solution:**
1. Check backend JWT_SECRET is set
2. Restart backend server
3. Clear localStorage and login again

---

## Testing Different Roles

### Test Admin Login

1. Login with admin credentials (admin@bomizzel.com)
2. Should redirect to `/admin`
3. Should be able to access:
   - ✅ `/admin`
   - ✅ `/employee`
   - ✅ `/customer`
   - ✅ `/data-management`
   - ✅ `/reports`

### Test Employee Login

1. Login with employee credentials
2. Should redirect to `/employee`
3. Should be able to access:
   - ✅ `/employee`
   - ❌ `/admin` (Access Denied)
   - ❌ `/bsi/dashboard` (Access Denied)

### Test Customer Login

1. Login with customer credentials
2. Should redirect to `/customer`
3. Should be able to access:
   - ✅ `/customer`
   - ❌ `/employee` (Access Denied)
   - ❌ `/admin` (Access Denied)

---

## Backend Verification

### Check if backend is running:

```bash
curl http://localhost:3001/api/auth/verify
# Should return: {"error":"No token provided"}
```

### Test login endpoint:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bomizzel.com","password":"your-password"}'
```

Should return:
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "admin@bomizzel.com",
    "role": "admin"
  }
}
```

### Test verify endpoint:

```bash
curl http://localhost:3001/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Should return:
```json
{
  "valid": true,
  "user": {
    "id": "...",
    "email": "admin@bomizzel.com",
    "role": "admin"
  }
}
```

---

## Quick Fix Checklist

If login is not working:

- [ ] Backend server is running (`npm run dev:backend`)
- [ ] Frontend server is running (`npm run dev:frontend`)
- [ ] Database is running (`npm run docker:up`)
- [ ] User exists in database
- [ ] Password is correct
- [ ] JWT_SECRET is set in backend .env
- [ ] localStorage is cleared before testing
- [ ] Browser console shows no errors
- [ ] Network tab shows successful API calls

---

## Environment Variables

Make sure these are set in `packages/backend/.env`:

```bash
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=1h
NODE_ENV=development
```

---

## Still Having Issues?

### Enable Verbose Logging

The ProtectedRoute component now logs detailed information. Check browser console for:

```
[ProtectedRoute] No token or user found
[ProtectedRoute] Verifying token for user: ...
[ProtectedRoute] Token valid
[ProtectedRoute] Role check - required: ... user: ... hasRole: ...
```

### Check User Data

```javascript
// In browser console after login
const user = JSON.parse(localStorage.getItem('user'));
console.log('User Role:', user.role);
console.log('User Email:', user.email);
```

### Verify Role Matching

The ProtectedRoute allows:
- Admin users can access admin, employee, and customer routes
- Employee users can only access employee routes
- Customer users can only access customer routes

---

## Contact Support

If you've tried all the above and still have issues:

1. Copy browser console logs
2. Copy network tab errors
3. Copy backend server logs
4. Note which user/role you're testing with
5. Note which route you're trying to access

---

## Summary of Changes

### What Changed:
1. **LoginPage.tsx** - Now redirects based on user role instead of always going to `/employee`
2. **ProtectedRoute.tsx** - Added console logging for debugging

### Why It Was Failing:
- Admin users were being redirected to `/employee`
- `/employee` route requires `employee` role
- Admin users have `admin` role, not `employee` role
- ProtectedRoute was denying access and redirecting back to login

### How It's Fixed:
- Login now checks user role and redirects appropriately
- Admin → `/admin`
- Employee → `/employee`
- Customer → `/customer`
- Admin users can still access employee and customer routes (role hierarchy)
