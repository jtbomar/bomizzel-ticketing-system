# Jeff Bomar - Bomizzel Admin Setup Guide

## 🎉 Your Admin Account is Ready!

### Login Credentials

**Email:** `jeffrey.t.bomar@gmail.com`  
**Password:** `BomizzelAdmin2024!`  
**Company:** Bomizzel Services Inc. (BSI)  
**Role:** Super Administrator

⚠️ **IMPORTANT:** Change your password after first login!

---

## 🚀 How to Access Your Admin Dashboard

### Step 1: Login
1. Go to: http://localhost:3000/login
2. Enter your email: `jeffrey.t.bomar@gmail.com`
3. Enter your password: `BomizzelAdmin2024!`
4. Click "Login"

### Step 2: Access Admin Dashboard
After login, you'll be automatically redirected to:
- **Admin Dashboard:** http://localhost:3000/admin

This dashboard shows you:
- Total customers
- Active subscriptions
- Trial subscriptions
- Monthly revenue
- Quick action buttons

---

## 📋 What You Can Do

### 1. Provision New Customers
**URL:** http://localhost:3000/admin/provisioning

When a company wants to buy Bomizzel:
1. Click "Provision New Customer" button
2. Fill in their company details:
   - Company name (e.g., "ABC Appliance")
   - Domain (e.g., "abcappliance.com")
   - Description
3. Fill in their admin user details:
   - First name, last name, email, phone
4. Set their subscription limits:
   - Max users (e.g., 100)
   - Max tickets (e.g., 5000)
   - Storage quota (e.g., 100 GB)
5. Set pricing:
   - Monthly price (e.g., $499)
   - Setup fee (if any)
   - Trial days (e.g., 30)
6. Add notes (e.g., "Enterprise customer - negotiated pricing")
7. Click "Provision Customer"

**Result:** 
- Customer company is created
- Admin user is created with temporary password
- They receive an email with login credentials
- You see the temporary password (save it to send to them!)

### 2. View All Customers
**URL:** http://localhost:3000/admin/provisioning (Provisioned Customers tab)

See all your customers:
- Company name
- Admin contact
- Subscription status (active, trialing, etc.)
- Current limits
- Billing period

### 3. Update Customer Limits
From the customer list:
1. Click "Update Limits" on any customer
2. Change their limits (e.g., upgrade storage from 100GB to 200GB)
3. Add a reason (e.g., "Customer requested storage upgrade")
4. Click "Update Limits"

---

## 💼 Your Business Workflow

### When Someone Wants to Buy Bomizzel:

1. **Sales/Demo Phase:**
   - Show them the demo
   - Discuss their needs (users, tickets, storage)
   - Agree on pricing

2. **Provision Their Account:**
   - Login to your admin dashboard
   - Click "Provision New Customer"
   - Enter their details and custom limits
   - Set their pricing
   - Provision the account

3. **Send Them Credentials:**
   - Copy the temporary password shown after provisioning
   - Send them an email with:
     - Login URL: https://yourdomain.com/login (or localhost for now)
     - Their email
     - Temporary password
     - Instructions to change password

4. **They're Live!**
   - They login and change their password
   - They can start using their ticketing system
   - They can add their team members
   - They can create tickets

5. **Support & Upgrades:**
   - Monitor their usage from your dashboard
   - Upgrade their limits when needed
   - Provide support as needed

---

## 🔧 Managing Your System

### Update Your Email (When You Get bomizzel.com)

When you register bomizzel.com and want to change your email:

1. **Update in Database:**
   ```sql
   UPDATE users 
   SET email = 'jeff@bomizzel.com' 
   WHERE email = 'jeffrey.t.bomar@gmail.com';
   ```

2. **Or use the UI:**
   - Go to your profile settings
   - Update email address
   - Verify new email

### Add More BSI Employees (When You Hire)

When you hire employees for Bomizzel:

1. Go to admin provisioning
2. Create a user account for them
3. Associate them with "Bomizzel Services Inc." company
4. Give them appropriate role (admin, employee, etc.)

---

## 📊 Understanding Your Dashboard

### Stats Shown:
- **Total Customers:** How many companies are using Bomizzel
- **Active Subscriptions:** Paying customers
- **Trial Subscriptions:** Customers in trial period
- **Monthly Revenue:** Total monthly recurring revenue

### Quick Actions:
- **Provision Customer:** Add new customer
- **View All Customers:** Manage existing customers
- **View Analytics:** (Coming soon) Revenue and usage reports

---

## 🎯 Example: Provisioning ABC Appliance

Let's say ABC Appliance wants to buy Bomizzel:

**Their Requirements:**
- 100 users
- 5000 tickets
- 100GB storage
- $499/month
- 30-day trial

**Steps:**
1. Login to http://localhost:3000/admin
2. Click "Provision New Customer"
3. Fill in:
   ```
   Company Name: ABC Appliance
   Domain: abcappliance.com
   Description: Home appliance repair and service
   
   Admin First Name: John
   Admin Last Name: Smith
   Admin Email: admin@abcappliance.com
   Admin Phone: +1-555-0123
   
   Max Users: 100
   Max Active Tickets: 2000
   Max Total Tickets: 5000
   Storage Quota: 100 GB
   
   Monthly Price: $499
   Trial Days: 30
   
   Notes: Enterprise customer - custom pricing negotiated
   ```
4. Click "Provision Customer"
5. **Save the temporary password shown!**
6. Send John Smith an email:
   ```
   Hi John,

   Your Bomizzel Ticketing System account is ready!

   Login URL: http://localhost:3000/login
   Email: admin@abcappliance.com
   Temporary Password: [paste the password]

   Please login and change your password immediately.

   Your subscription includes:
   - 100 users
   - 5000 tickets
   - 100GB storage
   - 30-day free trial

   If you have any questions, contact me at jeffrey.t.bomar@gmail.com

   Best regards,
   Jeff Bomar
   Bomizzel Services Inc.
   ```

---

## 🔐 Security Best Practices

1. **Change Your Password:**
   - Login and go to profile settings
   - Change from `BomizzelAdmin2024!` to something secure

2. **Keep Credentials Safe:**
   - Don't share your admin password
   - Use a password manager

3. **Customer Passwords:**
   - Always tell customers to change their temporary password
   - Temporary passwords are only shown once

4. **Backup Your Database:**
   - Regularly backup your PostgreSQL database
   - Keep backups secure

---

## 📞 Support & Questions

If you need help:
1. Check the documentation in `packages/backend/docs/`
2. Check the API docs in `ADMIN_PROVISIONING_API.md`
3. Review the code in `packages/backend/src/services/AdminProvisioningService.ts`

---

## 🚀 Next Steps for Your Business

1. **Get bomizzel.com domain**
2. **Set up production hosting** (AWS, DigitalOcean, etc.)
3. **Configure email service** (SendGrid, Mailgun, etc.)
4. **Set up Stripe** for payment processing
5. **Create marketing materials**
6. **Start selling!**

---

## 🎉 You're All Set!

Your Bomizzel admin system is ready to go. You can now:
- ✅ Login as super admin
- ✅ Provision customers
- ✅ Manage subscriptions
- ✅ Update customer limits
- ✅ View all customers
- ✅ Support your customers

**Good luck with Bomizzel Services Inc., Jeff!** 🚀
