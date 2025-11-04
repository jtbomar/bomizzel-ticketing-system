# Admin Customer Provisioning UI

## Overview
A comprehensive admin interface for provisioning new customers with custom subscriptions, limits, and pricing.

## Access
**URL:** `/admin/provisioning`

**Requirements:** Admin authentication required

## Features

### 1. Provision New Customer Tab
Complete form for provisioning a new customer with:

#### Company Information
- Company Name (required)
- Company Domain
- Company Description

#### Administrator Information
- First Name (required)
- Last Name (required)
- Email (required)
- Phone

#### Subscription Limits
Fully customizable limits for:
- Max Users
- Max Active Tickets
- Max Completed Tickets
- Max Total Tickets
- Storage Quota (GB)
- Max Attachment Size (MB)
- Max Custom Fields
- Max Queues

#### Pricing & Billing
- Monthly Price
- Annual Price
- Setup Fee
- Billing Cycle (Monthly/Annual)
- Trial Days (0-90)

#### Additional Notes
- Free-form text field for internal notes

### 2. Provisioned Customers Tab
View and manage all provisioned customers:

#### Customer List Features
- Company name and ID
- Admin user details
- Subscription status (active, trialing, etc.)
- Current limits (users, tickets, storage)
- Current billing period
- Quick actions

#### Update Limits Modal
- Modify max users
- Modify max active tickets
- Modify storage quota
- Add reason for update
- Instant updates

## Usage Examples

### Example 1: Provision ABC Appliance
1. Navigate to `/admin/provisioning`
2. Fill in company details:
   - Company Name: "ABC Appliance"
   - Domain: "abcappliance.com"
3. Fill in admin details:
   - Name: "John Smith"
   - Email: "admin@abcappliance.com"
4. Set custom limits:
   - Max Users: 100
   - Max Total Tickets: 5000
   - Storage: 100 GB
5. Set pricing:
   - Monthly Price: $499
   - Trial Days: 30
6. Click "Provision Customer"
7. **Save the temporary password** shown in the success message!

### Example 2: Upgrade Storage
1. Go to "Provisioned Customers" tab
2. Find the customer in the list
3. Click "Update Limits"
4. Change Storage Quota from 100 to 200 GB
5. Add reason: "Customer requested storage upgrade"
6. Click "Update Limits"

## Success Flow

After provisioning, you'll see:
```
✅ Customer provisioned successfully!

Company: ABC Appliance
Admin Email: admin@abcappliance.com
Temporary Password: Abc123XYZ!@#$%

⚠️ Make sure to save this password - it won't be shown again!
```

The admin user will also receive an email with:
- Login credentials
- Temporary password
- Link to login page
- Instructions to change password

## API Integration

The UI connects to these backend endpoints:

- `POST /api/admin/provisioning/customers` - Provision new customer
- `GET /api/admin/provisioning/customers` - List all customers
- `PUT /api/admin/provisioning/subscriptions/:id/limits` - Update limits

## Security

- All endpoints require admin authentication
- JWT token stored in localStorage
- Temporary passwords are securely generated
- All actions are logged for audit trail

## Styling

Built with:
- Tailwind CSS for styling
- Responsive design (mobile-friendly)
- Clean, professional interface
- Loading states and error handling
- Success/error notifications

## Future Enhancements

Potential additions:
- Bulk user import
- Usage analytics per customer
- Billing history
- Invoice generation
- Customer activity logs
- Email template customization
- Advanced search and filters
- Export customer data
- Subscription pause/resume
- Custom plan templates

## Screenshots

### Provision Form
Clean, organized form with sections for:
- Company info
- Admin details
- Subscription limits (8 customizable fields)
- Pricing & billing
- Notes

### Customer List
Table view showing:
- Company name
- Admin contact
- Status badge (color-coded)
- Current limits
- Billing period
- Action buttons

### Update Modal
Simple modal for quick limit updates:
- Editable limit fields
- Reason text area
- Save/Cancel buttons

## Development

### Local Testing
1. Start backend: `npm run dev:backend`
2. Start frontend: `npm run dev:frontend`
3. Login as admin
4. Navigate to `/admin/provisioning`

### Admin Credentials
Use an admin account to access:
- Email: `admin@bomizzel.com`
- Password: (your admin password)

## Troubleshooting

### "Authentication required" error
- Make sure you're logged in as an admin
- Check that JWT token is in localStorage
- Verify token hasn't expired

### "Failed to provision customer" error
- Check backend is running
- Verify all required fields are filled
- Check browser console for details
- Ensure email doesn't already exist

### Customer list not loading
- Verify backend API is accessible
- Check network tab for API errors
- Ensure admin permissions are correct

## Support

For issues or questions:
1. Check backend logs
2. Check browser console
3. Verify API endpoints are accessible
4. Review API documentation in `packages/backend/docs/ADMIN_PROVISIONING_API.md`
