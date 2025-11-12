# Debug Login Issue

## Step-by-Step Debugging

### Step 1: Check if login API works

Open browser console (F12) and run:

```javascript
// Test login directly
fetch('http://192.168.0.133:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@bomizzel.com',
    password: 'your-password-here'
  })
})
.then(r => r.json())
.then(data => console.log('Login response:', data))
.catch(err => console.error('Login error:', err));
```

**Expected:** Should return token and user object

### Step 2: Check localStorage after login attempt

After trying to login, run in console:

```javascript
console.log('Token:', localStorage.getItem('token'));
console.log('User:', localStorage.getItem('user'));
```

**Expected:** Both should have values

### Step 3: Check if verify endpoint works

```javascript
const token = localStorage.getItem('token');
fetch('http://192.168.0.133:3001/api/auth/verify', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => console.log('Verify response:', data))
.catch(err => console.error('Verify error:', err));
```

**Expected:** Should return `{ valid: true, user: {...} }`

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Try to login
3. Look for these requests:
   - `POST /api/auth/login` - What status code?
   - `GET /api/auth/verify` - What status code?

### Step 5: Check Console Logs

Look for these messages:
```
[ProtectedRoute] Verifying token for user: ...
[ProtectedRoute] Token valid
[ProtectedRoute] Role check - required: ...
```

## Common Issues

### Issue 1: CORS Error
**Symptom:** Network tab shows CORS error
**Fix:** Backend needs to allow your IP address

### Issue 2: Backend not running
**Symptom:** Network tab shows "Failed to fetch"
**Fix:** Start backend with `npm run dev:backend`

### Issue 3: Wrong API URL
**Symptom:** Requests go to wrong address
**Fix:** Check VITE_API_URL in .env

### Issue 4: Token not being saved
**Symptom:** localStorage.getItem('token') returns null
**Fix:** Check AuthContext login function

### Issue 5: Verify endpoint failing
**Symptom:** /api/auth/verify returns 401
**Fix:** Check JWT_SECRET in backend .env

## Quick Test Without Protection

To test if the issue is with ProtectedRoute, temporarily access the admin page directly.

In browser console after login:
```javascript
// Force navigate
window.location.href = '/admin';
```

If you see the admin page, the issue is with ProtectedRoute.
If you still can't see it, the issue is with authentication.

## Backend Check

SSH into your server and check:

```bash
# Is backend running?
ps aux | grep node

# Check backend logs
pm2 logs backend

# Or if running with npm:
# Check the terminal where you ran npm run dev:backend
```

## Frontend Check

```bash
# Is frontend running?
ps aux | grep vite

# Check frontend logs in terminal
```

## Environment Variables

Check `packages/backend/.env`:
```bash
JWT_SECRET=<should-be-set>
PORT=3001
NODE_ENV=development
```

Check `packages/frontend/.env`:
```bash
VITE_API_URL=http://192.168.0.133:3001
```

## Nuclear Option: Clear Everything

```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
// Then refresh page and try again
```

## What to Report

If still not working, please provide:

1. **Console errors** (copy from browser console)
2. **Network tab** (screenshot of failed requests)
3. **localStorage contents**:
   ```javascript
   console.log('Token:', localStorage.getItem('token'));
   console.log('User:', localStorage.getItem('user'));
   ```
4. **Backend logs** (from terminal or pm2 logs)
5. **Which step above fails?**
