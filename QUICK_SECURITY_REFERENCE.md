# Quick Security Reference Card

## 🔐 Authentication Status: SECURED ✅

---

## Route Access Matrix

| Route | Public | Customer | Employee | Admin | BSI Admin |
|-------|--------|----------|----------|-------|-----------|
| `/` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/register` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/customer` | ❌ | ✅ | ❌ | ✅ | ✅ |
| `/employee` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/admin` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/data-management` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/reports` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/bsi/dashboard` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/bsi/provisioning` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/bsi/query-builder` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## BSI Admin Criteria

To access `/bsi/*` routes, user must have:
- `role: 'admin'` AND
- Email is one of:
  - `jeffrey.t.bomar@gmail.com`
  - Any `@bomizzel.com` email
  - Any email containing "bomizzel"

---

## Quick Test Commands

### Test 1: Unauthenticated Access
```bash
# Open incognito browser
# Navigate to: http://localhost:3000/admin
# Expected: Redirects to /login ✅
```

### Test 2: Check Token
```javascript
// In browser console
console.log('Token:', localStorage.getItem('token'));
console.log('User:', localStorage.getItem('user'));
```

### Test 3: API Verification
```bash
# Without token (should fail)
curl http://localhost:3001/api/auth/verify

# With token (should succeed)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/auth/verify
```

---

## Common Issues & Fixes

### Issue: "Access Denied" on valid route
**Fix:** Check user role matches required role

### Issue: Infinite redirect loop
**Fix:** Clear localStorage and login again
```javascript
localStorage.clear();
```

### Issue: Token expired
**Fix:** Login again to get new token

### Issue: Can't access BSI routes
**Fix:** Verify email is jeffrey.t.bomar@gmail.com or @bomizzel.com

---

## Production Environment Variables

```bash
# Required for production
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_EXPIRATION=1h
FRONTEND_URL=https://bomizzel.com
BACKEND_URL=https://api.bomizzel.com
NODE_ENV=production
```

---

## Security Checklist (Quick)

Before deployment:
- [ ] All routes tested
- [ ] JWT_SECRET is strong
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting active
- [ ] Backups configured

---

## Emergency Procedures

### If Security Breach Detected:
1. Take site offline immediately
2. Revoke all JWT tokens (restart backend)
3. Force password reset for all users
4. Investigate breach
5. Patch vulnerability
6. Restore service

### Force Logout All Users:
```bash
# Change JWT_SECRET in .env
JWT_SECRET=<new-secret>

# Restart backend
pm2 restart bomizzel-backend
```

---

## Key Files

| File | Purpose |
|------|---------|
| `ProtectedRoute.tsx` | Frontend route protection |
| `auth.ts` | Backend auth endpoints |
| `App.tsx` | Route configuration |
| `SECURITY_IMPLEMENTATION.md` | Full documentation |
| `SECURITY_TESTING_GUIDE.md` | Testing procedures |
| `PRE_DEPLOYMENT_SECURITY_CHECKLIST.md` | Deployment checklist |

---

## Support Contacts

- **Security Issues:** [Your security contact]
- **Deployment Help:** [Your DevOps contact]
- **Emergency:** [Your emergency contact]

---

## Version

- **Security Implementation:** v1.0
- **Date:** November 5, 2025
- **Status:** Production Ready ✅

---

**Keep this card handy for quick reference!** 📋
