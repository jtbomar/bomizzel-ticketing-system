# Troubleshooting Checklist

## When "Nothing Works" - Step by Step

### 1. Check Your Current IP Address
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```
**Current IP**: 192.168.0.116

### 2. Verify Servers Are Running
```bash
# Check processes
lsof -ti:3000  # Frontend
lsof -ti:3001  # Backend (NOT 5000!)

# Or check with curl
curl http://localhost:3000
curl http://localhost:3001/health
```

### 3. Access the Correct URLs

**From the same machine:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

**From another device on your network:**
- Frontend: http://192.168.0.116:3000
- Backend: http://192.168.0.116:3001

⚠️ **Note**: Your IP address can change! Always check with `ifconfig` first.

### 4. What "Nothing Works" Might Mean

#### A. Page Won't Load At All
**Symptoms**: Browser shows "Can't connect" or "Site can't be reached"

**Causes**:
- Wrong IP address (use 192.168.0.116, not .133)
- Servers not running
- Firewall blocking ports

**Solutions**:
```bash
# Check if servers are running
lsof -ti:3000
lsof -ti:3001

# If not running, start them
npm run dev

# Check firewall (Mac)
# System Preferences > Security & Privacy > Firewall
```

#### B. Page Loads But Shows Errors
**Symptoms**: Page loads but shows error messages, blank screens, or console errors

**Causes**:
- Backend not responding
- API calls failing
- Authentication issues

**Solutions**:
1. Open browser console (F12)
2. Look for red error messages
3. Check Network tab for failed requests
4. Look for CORS errors

#### C. Login Doesn't Work
**Symptoms**: Can't log in, or logged out immediately

**Causes**:
- Wrong credentials
- Backend not running
- Database not running

**Solutions**:
```bash
# Check database
docker ps

# Start database if needed
npm run docker:up

# Test login credentials
# Email: admin@bomizzel.com
# Password: password123
```

#### D. Specific Features Don't Work
**Symptoms**: Can log in but certain pages/buttons don't work

**Causes**:
- API endpoint errors
- Missing data
- Frontend/backend mismatch

**Solutions**:
1. Check browser console for errors
2. Check backend terminal for errors
3. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Win)

### 5. Common Error Messages

#### "Failed to fetch" or "Network Error"
**Meaning**: Frontend can't reach backend

**Check**:
- Is backend running? `lsof -ti:3001`
- Is it on the right port? (3001, not 5000)
- Check browser console for the actual URL being called

#### "401 Unauthorized" or "403 Forbidden"
**Meaning**: Authentication issue

**Solutions**:
- Log out and log back in
- Clear browser cache
- Check if token expired

#### "404 Not Found"
**Meaning**: API endpoint doesn't exist

**Check**:
- Is the route registered in backend?
- Is the URL correct?
- Did you restart backend after adding new routes?

### 6. Nuclear Option - Full Restart

If nothing else works:

```bash
# 1. Kill everything
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
docker-compose down

# 2. Start fresh
docker-compose up -d
npm run dev

# 3. Wait 30 seconds for everything to start

# 4. Hard refresh browser (Cmd+Shift+R)

# 5. Try logging in again
```

### 7. Check Server Logs

**Frontend logs:**
Look at the terminal where `npm run dev:frontend` is running

**Backend logs:**
Look at the terminal where `npm run dev:backend` is running

**Look for**:
- Error messages in red
- Stack traces
- "Failed to..." messages
- Port binding errors

### 8. Verify Database

```bash
# Check if PostgreSQL is running
docker ps

# Should see containers for:
# - postgres
# - redis

# If not running:
npm run docker:up

# Test database connection
npm run db:migrate --workspace=backend
```

### 9. Browser-Specific Issues

**Clear browser cache:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Try incognito/private mode:**
- Eliminates cache/extension issues

**Try a different browser:**
- Rules out browser-specific problems

### 10. Network Issues

**From another device:**
- Make sure both devices are on the same WiFi network
- Check router settings for device isolation
- Try pinging: `ping 192.168.0.116`

**Firewall:**
- Mac: System Preferences > Security & Privacy > Firewall
- Make sure Node.js is allowed

### Quick Diagnostic Commands

```bash
# Check everything at once
echo "=== IP Address ==="
ifconfig | grep "inet " | grep -v 127.0.0.1

echo "=== Frontend (port 3000) ==="
lsof -ti:3000

echo "=== Backend (port 3001) ==="
lsof -ti:3001

echo "=== Database ==="
docker ps | grep postgres

echo "=== Test Frontend ==="
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

echo "=== Test Backend ==="
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
```

### Still Not Working?

1. **Take a screenshot** of:
   - Browser showing the error
   - Browser console (F12 > Console tab)
   - Terminal showing server logs

2. **Note exactly what happens**:
   - What URL are you accessing?
   - What do you see?
   - What error messages appear?
   - What did you try?

3. **Check the basics**:
   - ✅ Correct IP address (192.168.0.116)
   - ✅ Correct ports (3000 for frontend, 3001 for backend)
   - ✅ Servers running
   - ✅ Database running
   - ✅ Hard refreshed browser

---

## Current Status (as of now):

- ✅ Frontend running on: http://192.168.0.116:3000
- ✅ Backend running on: http://192.168.0.116:3001
- ⚠️ Your IP changed from .133 to .116
- ⚠️ Some TypeScript warnings in backend (but still running)

**Try this URL**: http://192.168.0.116:3000
