# Admin Provisioning API Documentation

## Overview
The Admin Provisioning API allows administrators to provision new customers with custom subscriptions, limits, and pricing.

## Base URL
```
/api/admin/provisioning
```

## Authentication
All endpoints require admin authentication:
```
Authorization: Bearer <admin-jwt-token>
```

---

## Endpoints

### 1. Provision New Customer

**POST** `/api/admin/provisioning/customers`

Provision a complete customer setup including company, admin user, and subscription.

#### Request Body
```json
{
  "companyName": "ABC Appliance",
  "companyDomain": "abcappliance.com",
  "companyDescription": "Home appliance repair and service",
  
  "adminEmail": "admin@abcappliance.com",
  "adminFirstName": "John",
  "adminLastName": "Smith",
  "adminPhone": "+1-555-0123",
  
  "planId": "uuid-of-base-plan",  // Optional: use existing plan as base
  
  "customLimits": {
    "maxUsers": 100,
    "maxActiveTickets": 2000,
    "maxCompletedTickets": 5000,
    "maxTotalTickets": 10000,
    "storageQuotaGB": 100,
    "maxAttachmentSizeMB": 50,
    "maxCustomFields": 100,
    "maxQueues": 25
  },
  
  "customPricing": {
    "monthlyPrice": 499.00,
    "annualPrice": 5390.00,
    "setupFee": 1000.00
  },
  
  "billingCycle": "monthly",
  "trialDays": 30,
  "startDate": "2024-01-01T00:00:00Z",
  
  "notes": "Enterprise customer - custom pricing negotiated",
  "metadata": {
    "salesRep": "Jane Doe",
    "contractId": "CONTRACT-2024-001"
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Customer provisioned successfully",
  "data": {
    "company": {
      "id": "company-uuid",
      "name": "ABC Appliance"
    },
    "adminUser": {
      "id": "user-uuid",
      "email": "admin@abcappliance.com",
      "temporaryPassword": "Abc123XYZ!@#$%"
    },
    "subscription": {
      "id": "subscription-uuid",
      "planName": "Custom Plan",
      "limits": {
        "maxUsers": 100,
        "maxActiveTickets": 2000,
        "maxCompletedTickets": 5000,
        "maxTotalTickets": 10000,
        "storageQuotaGB": 100,
        "maxAttachmentSizeMB": 50,
        "maxCustomFields": 100,
        "maxQueues": 25
      },
      "status": "trialing"
    }
  }
}
```

---

### 2. List Provisioned Customers

**GET** `/api/admin/provisioning/customers`

Get all provisioned customers with pagination.

#### Query Parameters
- `limit` (optional): Number of results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by subscription status

#### Example Request
```
GET /api/admin/provisioning/customers?limit=20&offset=0&status=active
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "subscriptionId": "uuid",
        "status": "active",
        "limits": {
          "maxUsers": 100,
          "storageQuotaGB": 100
        },
        "currentPeriod": {
          "start": "2024-01-01T00:00:00Z",
          "end": "2024-02-01T00:00:00Z"
        },
        "company": {
          "id": "uuid",
          "name": "ABC Appliance"
        },
        "admin": {
          "id": "uuid",
          "email": "admin@abcappliance.com",
          "name": "John Smith"
        }
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 1
    }
  }
}
```

---

### 3. Update Subscription Limits

**PUT** `/api/admin/provisioning/subscriptions/:subscriptionId/limits`

Update limits for an existing subscription.

#### Request Body
```json
{
  "maxUsers": 150,
  "storageQuotaGB": 200,
  "maxActiveTickets": 3000,
  "reason": "Customer requested storage upgrade"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Subscription limits updated successfully",
  "data": {
    "success": true,
    "subscriptionId": "uuid",
    "limits": {
      "maxUsers": 150,
      "maxActiveTickets": 3000,
      "maxCompletedTickets": 5000,
      "maxTotalTickets": 10000,
      "storageQuotaGB": 200,
      "maxAttachmentSizeMB": 50,
      "maxCustomFields": 100,
      "maxQueues": 25
    },
    "message": "Subscription limits updated successfully"
  }
}
```

---

### 4. Get Subscription Details

**GET** `/api/admin/provisioning/subscriptions/:subscriptionId`

Get detailed information about a specific subscription.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "uuid",
      "status": "active",
      "limits": {
        "maxUsers": 100,
        "maxActiveTickets": 2000,
        "storageQuotaGB": 100
      },
      "customPricing": {
        "monthlyPrice": 499.00,
        "setupFee": 1000.00
      },
      "billingCycle": "monthly",
      "currentPeriod": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-02-01T00:00:00Z"
      },
      "trialEnd": null,
      "notes": "Enterprise customer",
      "metadata": {
        "salesRep": "Jane Doe"
      }
    },
    "company": {
      "id": "uuid",
      "name": "ABC Appliance",
      "domain": "abcappliance.com",
      "description": "Home appliance repair"
    },
    "admin": {
      "id": "uuid",
      "email": "admin@abcappliance.com",
      "firstName": "John",
      "lastName": "Smith",
      "phone": "+1-555-0123"
    }
  }
}
```

---

## Enhanced Registration API

### Register with Company Association

**POST** `/api/auth/register-enhanced`

Enhanced registration that allows users to create or join a company during signup.

#### Request Body
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "phone": "+1-555-0199",
  
  "companyAction": "create",
  "companyName": "New Company Inc",
  
  "role": "customer",
  "department": "Support",
  "jobTitle": "Support Manager",
  
  "marketingOptIn": true,
  "communicationPreferences": {
    "email": true,
    "sms": false,
    "push": true
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Registration successful! Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "customer"
    },
    "company": {
      "id": "uuid",
      "name": "New Company Inc",
      "role": "admin"
    },
    "verificationRequired": true
  }
}
```

---

### Search Companies

**GET** `/api/auth/search-companies?query=acme&limit=10`

Search for companies to join during registration.

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "ACME Corporation",
      "description": "Leading provider of...",
      "allowsSelfRegistration": true
    }
  ],
  "message": "Found 1 companies matching \"acme\""
}
```

---

### Verify Email

**POST** `/api/auth/verify-email`

Verify email address with token.

#### Request Body
```json
{
  "token": "verification-token-uuid"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Email verified successfully! You can now log in.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  }
}
```

---

### Resend Verification Email

**POST** `/api/auth/resend-verification`

Resend verification email to user.

#### Request Body
```json
{
  "email": "jane@example.com"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Verification email sent successfully."
}
```

---

## Use Cases

### Use Case 1: Provision Enterprise Customer

**Scenario:** ABC Appliance signs up for 100 users, 5000 ticket limit, 100GB storage

```bash
curl -X POST http://localhost:5000/api/admin/provisioning/customers \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "ABC Appliance",
    "companyDomain": "abcappliance.com",
    "adminEmail": "admin@abcappliance.com",
    "adminFirstName": "John",
    "adminLastName": "Smith",
    "customLimits": {
      "maxUsers": 100,
      "maxTotalTickets": 5000,
      "storageQuotaGB": 100
    },
    "customPricing": {
      "monthlyPrice": 499.00
    },
    "billingCycle": "monthly",
    "trialDays": 30
  }'
```

### Use Case 2: Upgrade Storage

**Scenario:** Customer needs more storage (100GB → 200GB)

```bash
curl -X PUT http://localhost:5000/api/admin/provisioning/subscriptions/{subscriptionId}/limits \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "storageQuotaGB": 200,
    "reason": "Customer requested storage upgrade"
  }'
```

### Use Case 3: Self-Service Registration

**Scenario:** New user signs up and creates their company

```bash
curl -X POST http://localhost:5000/api/auth/register-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@newcompany.com",
    "password": "SecurePass123!",
    "companyAction": "create",
    "companyName": "New Company Inc"
  }'
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "Email already registered",
    "companyName": "Company name is required"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Subscription not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Customer provisioning failed",
  "error": "Detailed error message (development only)"
}
```

---

## Notes

1. **Temporary Passwords**: When provisioning customers, a secure temporary password is generated and sent via email. Users should change it on first login.

2. **Email Verification**: Self-registered users require email verification. Admin-provisioned users are auto-verified.

3. **Audit Trail**: All provisioning actions are logged with the admin user ID for audit purposes.

4. **Custom Limits**: You can override any plan limits when provisioning. If no planId is provided, a fully custom subscription is created.

5. **Billing Integration**: Custom pricing is stored but requires manual Stripe setup for actual billing.

6. **Trial Periods**: You can set custom trial periods (0-90 days) for any provisioned customer.
