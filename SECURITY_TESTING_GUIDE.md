# Security Testing Guide

## Quick Security Test Checklist

Use this guide to verify that your application is properly secured before deployment.

## 🔒 Test 1: Unauthenticated Access

**Goal:** Verify that protected routes redirect to login

### Steps:
1. Open browser in incognito/private mode
2. Navigate to: `http://localhost:3000/admin`
3. **Expected:** Redirects to `/login`

4. Navigate to: `http://localhost:3000/bsi/dashboard`
5. **Expected:** Redirects to `/bsi/login`

6. Navigate to: `http://localhost:3000/employee`
7. **Expected:** Redirects to `/login`

8. Navigate to: `http://localhost:3000/customer`
9. **Expected:** Redirects to `/login`

### ✅ Pass Criteria:
- All protected routes redirect to appropriate login page
- No dashboard content is visible
- No API calls succeed without authentication

---

## 🔒 Test 2: Customer Role Access

**Goal:** Verify customers can only access customer areas

### Steps:
1. Login as a customer account
2. Navigate to: `http://localhost:3000/customer`
3. **Expected:** ✅ Access granted - Customer dashboard loads

4. Navigate to: `http://localhost:3000/admin`
5. **Expected:** ❌ "Access Denied" message shown

6. Navigate to: `http://localhost:3000/employee`
7. **Expected:** ❌ "Access Denied" message shown

8. Navigate to: `http://localhost:3000/bsi/dashboard`
9. **Expected:** ❌ "Access Denied" message shown

### ✅ Pass Criteria:
- Customer can access `/customer`
- Customer cannot access `/admin`, `/employee`, or `/bsi/*`
- Clear "Access Denied" messages displayed

---

## 🔒 Test 3: Employee Role Access

**Goal:** Verify employees can access employee areas but not admin

### Steps:
1. Login as an employee account
2. Navigate to: `http://localhost:3000/employee`
3. **Expected:** ✅ Access granted - Employee dashboard loads

4. Navigate to: `http://localhost:3000/admin`
5. **Expected:** ❌ "Access Denied" message shown

6. Navigate to: `http://localhost:3000/bsi/dashboard`
7. **Expected:** ❌ "Access Denied" message shown

### ✅ Pass Criteria:
- Employee can access `/employee`
- Employee cannot access `/admin` or `/bsi/*`

---

## 🔒 Test 4: Admin Role Access (Non-BSI)

**Goal:** Verify regular admins can access admin areas but not BSI areas

### Steps:
1. Login as a regular admin (not @bomizzel.com)
2. Navigate to: `http://localhost:3000/admin`
3. **Expected:** ✅ Access granted - Admin dashboard loads

4. Navigate to: `http://localhost:3000/employee`
5. **Expected:** ✅ Access granted - Employee dashboard loads

6. Navigate to: `http://localhost:3000/data-management`
7. **Expected:** ✅ Access granted - Data management loads

8. Navigate to: `http://localhost:3000/bsi/dashboard`
9. **Expected:** ❌ "Access Denied" - BSI admin only

### ✅ Pass Criteria:
- Admin can access `/admin`, `/employee`, `/data-management`, `/reports`
- Admin cannot access `/bsi/*` routes

---

## 🔒 Test 5: BSI Admin Access

**Goal:** Verify BSI admins (Jeff) can access everything

### Steps:
1. Login as `jeffrey.t.bomar@gmail.com`
2. Navigate to: `http://localhost:3000/bsi/dashboard`
3. **Expected:** ✅ Access granted - BSI dashboard loads

4. Navigate to: `http://localhost:3000/bsi/provisioning`
5. **Expected:** ✅ Access granted - Provisioning page loads

6. Navigate to: `http://localhost:3000/bsi/query-builder`
7. **Expected:** ✅ Access granted - Query builder loads

8. Navigate to: `http://localhost:3000/admin`
9. **Expected:** ✅ Access granted - Regular admin also works

### ✅ Pass Criteria:
- BSI admin can access all `/bsi/*` routes
- BSI admin can also access regular admin routes

---

## 🔒 Test 6: Token Expiration

**Goal:** Verify expired tokens are handled properly

### Steps:
1. Login to any account
2. Open browser DevTools → Application → Local Storage
3. Delete the `token` key
4. Try to navigate to any protected route
5. **Expected:** Redirects to login page

### Alternative:
1. Login to any account
2. Wait for token to expire (default: 1 hour)
3. Try to access protected route
4. **Expected:** Redirects to login page

### ✅ Pass Criteria:
- Expired/missing tokens redirect to login
- No errors in console
- User data is cleared from localStorage

---

## 🔒 Test 7: Direct URL Manipulation

**Goal:** Verify users can't bypass security by typing URLs

### Steps:
1. Login as customer
2. Manually type in address bar: `http://localhost:3000/admin`
3. Press Enter
4. **Expected:** "Access Denied" message

5. Open DevTools → Network tab
6. Verify no sensitive API calls succeed
7. **Expected:** API calls return 401/403 errors

### ✅ Pass Criteria:
- URL manipulation doesn't grant access
- Backend also rejects unauthorized requests
- No sensitive data leaks in network responses

---

## 🔒 Test 8: Browser Back Button

**Goal:** Verify logout properly clears access

### Steps:
1. Login to any account
2. Navigate to protected route (e.g., `/admin`)
3. Logout
4. Press browser back button
5. **Expected:** Redirects to login (not cached page)

### ✅ Pass Criteria:
- Back button doesn't show cached protected content
- User is redirected to login
- Token is cleared from localStorage

---

## 🔒 Test 9: Multiple Tabs

**Goal:** Verify logout affects all tabs

### Steps:
1. Login to account
2. Open protected route in Tab 1
3. Open same route in Tab 2
4. Logout in Tab 1
5. Refresh Tab 2
6. **Expected:** Tab 2 redirects to login

### ✅ Pass Criteria:
- Logout clears token globally
- All tabs require re-authentication

---

## 🔒 Test 10: API Endpoint Security

**Goal:** Verify backend endpoints are protected

### Using curl or Postman:

```bash
# Test without token (should fail)
curl http://localhost:3001/api/admin/provisioning/customers

# Expected: 401 Unauthorized

# Test with invalid token (should fail)
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:3001/api/admin/provisioning/customers

# Expected: 401 Unauthorized

# Test with valid token (should succeed)
curl -H "Authorization: Bearer <your-valid-token>" \
  http://localhost:3001/api/admin/provisioning/customers

# Expected: 200 OK with data
```

### ✅ Pass Criteria:
- Endpoints reject requests without tokens
- Endpoints reject invalid tokens
- Endpoints only accept valid, non-expired tokens

---

## 🚨 Security Issues to Watch For

### Red Flags (FAIL):
- ❌ Protected content visible without login
- ❌ API calls succeed without authentication
- ❌ Users can access routes above their permission level
- ❌ Token persists after logout
- ❌ Sensitive data in browser console/network tab

### Green Flags (PASS):
- ✅ All protected routes require authentication
- ✅ Role-based access control works correctly
- ✅ Logout clears all authentication data
- ✅ Expired tokens are handled gracefully
- ✅ Backend validates all requests

---

## Quick Test Script

Run this in your browser console on any page:

```javascript
// Check if protected routes are accessible
const testRoutes = [
  '/admin',
  '/employee',
  '/customer',
  '/bsi/dashboard',
  '/data-management'
];

console.log('Testing route protection...');
testRoutes.forEach(route => {
  fetch(`http://localhost:3000${route}`)
    .then(r => console.log(`${route}: ${r.status}`))
    .catch(e => console.log(`${route}: Error`));
});

// Check localStorage
console.log('Token:', localStorage.getItem('token') ? 'Present' : 'Missing');
console.log('User:', localStorage.getItem('user') ? 'Present' : 'Missing');
```

---

## Production Deployment Checklist

Before deploying to bomizzel.com:

- [ ] All 10 security tests pass
- [ ] HTTPS is enforced
- [ ] JWT_SECRET is strong and unique
- [ ] CORS is configured for production domain
- [ ] Rate limiting is enabled
- [ ] Security headers are set (Helmet)
- [ ] Error messages don't leak sensitive info
- [ ] Logging captures security events
- [ ] Database credentials are secure
- [ ] Environment variables are not committed to git

---

## Need Help?

If any test fails:
1. Check browser console for errors
2. Check network tab for failed API calls
3. Verify token is present in localStorage
4. Check backend logs for authentication errors
5. Review `SECURITY_IMPLEMENTATION.md` for configuration

Your application should now be **production-ready** from a security standpoint! 🔒
