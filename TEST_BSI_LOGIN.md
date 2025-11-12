# Test BSI Login

## Your Credentials
- Email: `jeffrey.t.bomar@gmail.com`
- Password: `BomizzelAdmin2024!`
- Role: `admin` ✅
- Active: `true` ✅

## Backend Test (WORKING ✅)

The backend login works correctly:
```bash
curl -X POST http://192.168.0.133:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jeffrey.t.bomar@gmail.com","password":"BomizzelAdmin2024!"}'
```

Returns token and user successfully.

## Frontend Test Steps

### Step 1: Clear Everything
Open browser console (F12) and run:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Step 2: Check API URL
After page reloads, in console run:
```javascript
console.log('API URL:', import.meta.env.VITE_API_URL);
// Should show: http://192.168.0.133:3001
```

### Step 3: Test Login from Console
```javascript
// Test the login directly
fetch('http://192.168.0.133:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'jeffrey.t.bomar@gmail.com',
    password: 'BomizzelAdmin2024!'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Login response:', data);
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    console.log('✅ Logged in! Now navigate to /bsi/dashboard');
    window.location.href = '/bsi/dashboard';
  }
})
.catch(err => console.error('Login error:', err));
```

### Step 4: Navigate to BSI Login
```
http://192.168.0.133:3000/bsi/login
```

### Step 5: Try Login
- Email: `jeffrey.t.bomar@gmail.com`
- Password: `BomizzelAdmin2024!`

## What to Check

### In Browser Console
Look for:
1. Any error messages
2. Network requests - are they going to `192.168.0.133:3001` or `localhost:3001`?
3. Response from login API

### In Network Tab
1. Open DevTools → Network tab
2. Try to login
3. Look for `POST /api/auth/login`
4. Check:
   - Request URL: Should be `http://192.168.0.133:3001/api/auth/login`
   - Status: Should be `200 OK`
   - Response: Should have `token` and `user`

## Common Issues

### Issue 1: "Login failed" error
**Cause:** Wrong password or API not reachable
**Check:** Network tab - is request going to correct URL?

### Issue 2: Redirects back to login
**Cause:** ProtectedRoute denying access
**Check:** Console logs for `[ProtectedRoute]` messages

### Issue 3: "Access denied" message
**Cause:** BSI admin check failing
**Check:** User role is `admin` and email matches

## Manual Login Workaround

If the form doesn't work, use console:

```javascript
// 1. Login
const response = await fetch('http://192.168.0.133:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'jeffrey.t.bomar@gmail.com',
    password: 'BomizzelAdmin2024!'
  })
});

const data = await response.json();
console.log('Response:', data);

// 2. Store credentials
localStorage.setItem('token', data.token);
localStorage.setItem('user', JSON.stringify(data.user));

// 3. Navigate
window.location.href = '/bsi/dashboard';
```

## Verify BSI Admin Access

After login, check:
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('User:', user);
console.log('Is BSI Admin:', 
  user.role === 'admin' && 
  (user.email === 'jeffrey.t.bomar@gmail.com' || 
   user.email.includes('@bomizzel.com'))
);
// Should show: true
```

## Expected Flow

1. Navigate to `/bsi/login`
2. Enter credentials
3. Click "Sign in to BSI Admin"
4. Backend validates credentials ✅
5. Frontend stores token and user ✅
6. Frontend checks if user is BSI admin ✅
7. Redirect to `/bsi/dashboard`
8. ProtectedRoute verifies token ✅
9. ProtectedRoute checks BSI admin status ✅
10. Dashboard loads ✅

## Debug Output

When you try to login, you should see in console:
```
POST http://192.168.0.133:3001/api/auth/login
Response: {token: "...", user: {...}}
Navigating to /bsi/dashboard
[ProtectedRoute] Verifying token for user: jeffrey.t.bomar@gmail.com role: admin
[ProtectedRoute] Token valid
[ProtectedRoute] BSI admin check: true
```

## If Still Not Working

Tell me:
1. What error message do you see?
2. What's in the browser console?
3. What's in the Network tab?
4. Does the manual console login work?
