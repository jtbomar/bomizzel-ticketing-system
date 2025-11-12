# Customer Management API

## Overview
The Admin Provisioning API provides endpoints to manage provisioned customers, including the ability to enable, disable, and delete customers.

## Authentication
All endpoints require admin authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Disable Customer
**POST** `/api/admin/provisioning/subscriptions/:subscriptionId/disable`

Disables a customer account, blocking all users from accessing the system.

**Request Body:**
```json
{
  "reason": "Payment overdue"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer disabled successfully. All users have been blocked from accessing the system.",
  "data": {
    "success": true,
    "message": "Customer disabled successfully. All users have been blocked from accessing the system.",
    "subscriptionId": "uuid"
  }
}
```

**What happens:**
- Subscription status changed to `suspended`
- Company `is_active` set to `false`
- All users in the company `is_active` set to `false`
- Users cannot log in or access the system

---

### 2. Enable Customer
**POST** `/api/admin/provisioning/subscriptions/:subscriptionId/enable`

Re-enables a disabled customer account, allowing users to access the system again.

**Request Body:**
```json
{
  "reason": "Payment received"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer enabled successfully. All users can now access the system.",
  "data": {
    "success": true,
    "message": "Customer enabled successfully. All users can now access the system.",
    "subscriptionId": "uuid"
  }
}
```

**What happens:**
- Subscription status changed to `active`
- Company `is_active` set to `true`
- All users in the company `is_active` set to `true`
- Users can log in and access the system

---

### 3. Delete Customer
**DELETE** `/api/admin/provisioning/subscriptions/:subscriptionId`

Permanently deletes a customer and all associated data. **This action cannot be undone.**

**Request Body:**
```json
{
  "reason": "Customer requested account deletion"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer deleted successfully. All data has been permanently removed.",
  "data": {
    "success": true,
    "message": "Customer deleted successfully. All data has been permanently removed.",
    "subscriptionId": "uuid"
  }
}
```

**What happens:**
- Subscription record deleted
- Company record deleted (cascade deletes user associations)
- All tickets and related data deleted (via database cascade)
- **This is permanent and cannot be undone**

---

## Frontend Integration

The `ProvisionedCustomersList` component provides UI buttons for these actions:

### Disable Button
- Shows for customers with `status: 'active'` or `status: 'trial'`
- Prompts for reason
- Confirms action
- Calls disable endpoint

### Enable Button
- Shows for customers with `status: 'suspended'`
- Prompts for reason
- Calls enable endpoint

### Delete Button
- Always visible (use with caution!)
- Prompts for reason
- Requires double confirmation
- Calls delete endpoint

## Usage Example

```typescript
// Disable a customer
const response = await axios.post(
  `${apiUrl}/api/admin/provisioning/subscriptions/${subscriptionId}/disable`,
  { reason: 'Payment overdue' },
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

// Enable a customer
const response = await axios.post(
  `${apiUrl}/api/admin/provisioning/subscriptions/${subscriptionId}/enable`,
  { reason: 'Payment received' },
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

// Delete a customer
const response = await axios.delete(
  `${apiUrl}/api/admin/provisioning/subscriptions/${subscriptionId}`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: { reason: 'Customer requested deletion' }
  }
);
```

## Security Considerations

1. **Authorization**: Only admin users can access these endpoints
2. **Audit Trail**: All actions are logged with:
   - Subscription ID
   - Company ID
   - Admin user who performed the action
   - Reason provided
   - Timestamp

3. **Confirmation**: The frontend requires:
   - Reason input for all actions
   - Single confirmation for enable/disable
   - Double confirmation for delete

4. **Cascade Effects**: Be aware that:
   - Disabling affects all users in the company
   - Deleting removes all data permanently
   - Database foreign key constraints handle cascading deletes

## Testing

To test these endpoints, you can:

1. **Via Frontend**: 
   - Log in as Jeff Bomar (admin@bomizzel.com)
   - Navigate to Super Admin Dashboard
   - Use the Provisioned Customers List
   - Click the action buttons

2. **Via API**:
   - Get a valid JWT token by logging in
   - Use curl or Postman to call the endpoints
   - Check the database to verify changes

## Database Impact

### Disable Customer
```sql
-- Subscription
UPDATE customer_subscriptions SET status = 'suspended' WHERE id = ?;

-- Company
UPDATE companies SET is_active = false WHERE id = ?;

-- Users
UPDATE users SET is_active = false 
WHERE id IN (
  SELECT user_id FROM user_company_associations WHERE company_id = ?
);
```

### Enable Customer
```sql
-- Subscription
UPDATE customer_subscriptions SET status = 'active' WHERE id = ?;

-- Company
UPDATE companies SET is_active = true WHERE id = ?;

-- Users
UPDATE users SET is_active = true 
WHERE id IN (
  SELECT user_id FROM user_company_associations WHERE company_id = ?
);
```

### Delete Customer
```sql
-- Subscription
DELETE FROM customer_subscriptions WHERE id = ?;

-- Company (cascades to user_company_associations and tickets)
DELETE FROM companies WHERE id = ?;
```
