# Pre-Deployment Security Checklist

## ✅ Complete This Before Deploying to bomizzel.com

---

## 🔐 Authentication & Authorization

- [ ] **JWT Secret is Strong**
  - Generate a new, random JWT secret for production
  - Minimum 32 characters, use: `openssl rand -base64 32`
  - Store in environment variable, never in code

- [ ] **Token Expiration Configured**
  - Access tokens expire in 1 hour or less
  - Refresh tokens expire in 7 days or less
  - Configured in `.env.production`

- [ ] **All Routes Protected**
  - Test every route without authentication
  - Verify redirects to login work
  - Check "Access Denied" messages display correctly

- [ ] **Role-Based Access Works**
  - Customer can only access customer routes
  - Employee can only access employee routes
  - Admin can access admin routes
  - BSI admin can access BSI routes

---

## 🌐 Network Security

- [ ] **HTTPS Enforced**
  - SSL certificate installed (Let's Encrypt)
  - HTTP redirects to HTTPS
  - HSTS header enabled

- [ ] **CORS Configured**
  ```typescript
  // packages/backend/src/index.ts
  app.use(cors({
    origin: 'https://bomizzel.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }));
  ```

- [ ] **Security Headers Set**
  - Helmet middleware enabled
  - CSP (Content Security Policy) configured
  - X-Frame-Options set to DENY
  - X-Content-Type-Options set to nosniff

---

## 🗄️ Database Security

- [ ] **Database Credentials Secure**
  - Strong password (16+ characters)
  - Not using default postgres user
  - Stored in environment variables only

- [ ] **Database Access Restricted**
  - Only accessible from application server
  - Firewall rules configured
  - No public internet access

- [ ] **SQL Injection Prevention**
  - Using parameterized queries (Knex)
  - No raw SQL with user input
  - Input validation on all endpoints

---

## 🔑 Environment Variables

- [ ] **Production .env File Created**
  ```bash
  # packages/backend/.env.production
  NODE_ENV=production
  PORT=3001
  
  # Strong, unique secret
  JWT_SECRET=<generate-new-secret>
  JWT_EXPIRATION=1h
  REFRESH_TOKEN_EXPIRATION=7d
  
  # Production database
  DATABASE_URL=postgresql://user:password@localhost:5432/bomizzel_prod
  REDIS_URL=redis://localhost:6379
  
  # Production URLs
  FRONTEND_URL=https://bomizzel.com
  BACKEND_URL=https://api.bomizzel.com
  
  # Email (production SMTP)
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-email@gmail.com
  SMTP_PASS=your-app-password
  ```

- [ ] **.env Files Not in Git**
  - `.env*` in `.gitignore`
  - No secrets committed to repository
  - Use `.env.example` for documentation

---

## 🚦 Rate Limiting

- [ ] **Auth Endpoints Rate Limited**
  - Login: 5 attempts per 15 minutes
  - Register: 3 attempts per hour
  - Password reset: 3 attempts per hour

- [ ] **API Endpoints Rate Limited**
  - General API: 100 requests per 15 minutes
  - File uploads: 10 per hour
  - Configured in middleware

---

## 📝 Logging & Monitoring

- [ ] **Security Events Logged**
  - Failed login attempts
  - Unauthorized access attempts
  - Admin actions
  - Data exports/imports

- [ ] **Error Handling Secure**
  - No stack traces in production
  - Generic error messages to users
  - Detailed logs server-side only

- [ ] **Monitoring Set Up**
  - Uptime monitoring (UptimeRobot)
  - Error tracking (Sentry - optional)
  - Log aggregation configured

---

## 🔒 Code Security

- [ ] **Dependencies Updated**
  ```bash
  npm audit
  npm audit fix
  ```

- [ ] **No Sensitive Data in Code**
  - No hardcoded passwords
  - No API keys in source
  - No test credentials

- [ ] **Console.logs Removed**
  - No `console.log` in production code
  - Use proper logging (Winston)
  - No sensitive data in logs

---

## 🧪 Testing

- [ ] **All Security Tests Pass**
  - Run through `SECURITY_TESTING_GUIDE.md`
  - All 10 tests must pass
  - Document any issues

- [ ] **Penetration Testing**
  - Test SQL injection attempts
  - Test XSS attempts
  - Test CSRF attacks
  - Test authentication bypass

---

## 📦 Build & Deployment

- [ ] **Production Build Works**
  ```bash
  npm run build
  # No errors
  ```

- [ ] **Environment Variables Set on Server**
  - All required variables configured
  - Secrets are secure
  - No development values

- [ ] **Database Migrations Run**
  ```bash
  NODE_ENV=production npm run db:migrate
  ```

- [ ] **Backup Strategy in Place**
  - Daily database backups
  - Backup retention policy
  - Tested restore procedure

---

## 🔐 BSI Admin Security

- [ ] **Jeff's Account Secured**
  - Strong password (16+ characters)
  - Email: jeffrey.t.bomar@gmail.com
  - Role: admin
  - BSI access verified

- [ ] **BSI Routes Protected**
  - `/bsi/dashboard` requires BSI admin
  - `/bsi/provisioning` requires BSI admin
  - `/bsi/query-builder` requires BSI admin

- [ ] **SQL Query Builder Restricted**
  - Only BSI admin can access
  - Query validation in place
  - Dangerous queries blocked (DROP, DELETE without WHERE)

---

## 🌍 Domain & DNS

- [ ] **Domain Configured**
  - bomizzel.com points to server
  - www.bomizzel.com redirects to bomizzel.com
  - api.bomizzel.com points to backend

- [ ] **SSL Certificate Valid**
  - Certificate installed
  - Auto-renewal configured
  - Covers all subdomains

---

## 🔥 Firewall & Server

- [ ] **Firewall Configured**
  - Only ports 80, 443, 22 open
  - SSH key authentication only
  - No password authentication

- [ ] **Server Hardened**
  - OS updates applied
  - Unnecessary services disabled
  - Fail2ban installed (optional)

- [ ] **Process Manager Running**
  - PM2 configured
  - Auto-restart on crash
  - Starts on server boot

---

## 📋 Documentation

- [ ] **Admin Credentials Documented**
  - Stored securely (password manager)
  - Shared with authorized personnel only
  - Recovery process documented

- [ ] **Deployment Process Documented**
  - Update procedure written
  - Rollback procedure tested
  - Emergency contacts listed

---

## 🚀 Final Checks

- [ ] **Test in Production-Like Environment**
  - Staging server with production config
  - All features work
  - Performance acceptable

- [ ] **Security Scan Run**
  ```bash
  npm audit
  # 0 vulnerabilities
  ```

- [ ] **Load Testing Done**
  - Application handles expected traffic
  - Database performs well
  - No memory leaks

- [ ] **Rollback Plan Ready**
  - Previous version backed up
  - Rollback procedure tested
  - Database rollback plan

---

## ⚠️ Critical Security Issues (Must Fix Before Deploy)

### 🚨 STOP DEPLOYMENT IF:

- ❌ Any route accessible without authentication
- ❌ JWT_SECRET is weak or default value
- ❌ Database credentials in source code
- ❌ HTTPS not working
- ❌ CORS allows all origins (`*`)
- ❌ SQL injection possible
- ❌ Admin routes accessible to non-admins
- ❌ BSI routes accessible to non-BSI admins
- ❌ Sensitive data in error messages
- ❌ No rate limiting on auth endpoints

---

## ✅ Ready to Deploy When:

- ✅ All checklist items completed
- ✅ All security tests pass
- ✅ No critical vulnerabilities
- ✅ Backups configured
- ✅ Monitoring in place
- ✅ Documentation complete
- ✅ Team trained on security procedures

---

## 📞 Security Incident Response

If you discover a security issue after deployment:

1. **Assess Severity**
   - Critical: Take site offline immediately
   - High: Fix within 24 hours
   - Medium: Fix within 1 week
   - Low: Schedule for next release

2. **Contain the Issue**
   - Disable affected feature
   - Revoke compromised credentials
   - Block malicious IPs

3. **Fix the Vulnerability**
   - Patch the code
   - Test thoroughly
   - Deploy fix

4. **Notify Affected Users**
   - If data was compromised
   - Transparent communication
   - Offer remediation

5. **Post-Mortem**
   - Document what happened
   - How it was fixed
   - How to prevent in future

---

## 🎯 Security Maintenance Schedule

### Daily
- Monitor error logs
- Check failed login attempts
- Review system alerts

### Weekly
- Review access logs
- Check for unusual activity
- Update dependencies if needed

### Monthly
- Security audit
- Penetration testing
- Review user permissions
- Update documentation

### Quarterly
- Full security review
- Update security policies
- Team security training
- Disaster recovery drill

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Sign-off:**

- [ ] Security review completed by: ________________
- [ ] Date: ________________
- [ ] Approved for deployment: ☐ Yes ☐ No

---

**Remember:** Security is not a one-time task. It's an ongoing process. Stay vigilant! 🔒
