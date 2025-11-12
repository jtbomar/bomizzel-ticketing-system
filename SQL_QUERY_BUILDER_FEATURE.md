# SQL Query Builder - Complete Implementation

## Overview

A powerful SQL query interface for the BSI Admin Panel that allows Jeff to run custom queries, build queries visually, and export results to CSV.

## Features

### 1. SQL Editor Mode
- **Direct SQL Input**: Write custom SELECT queries
- **Syntax Highlighting**: Monospace font for better readability
- **Execute & View Results**: Run queries and see results in a table
- **Export to CSV**: Download query results as CSV files

### 2. Visual Query Builder
- **Table Selection**: Choose from available tables
- **Column Selection**: Pick specific columns or select all
- **WHERE Clause**: Add filtering conditions
- **ORDER BY**: Sort results
- **LIMIT**: Control number of results
- **Build Query**: Generates SQL from visual selections

### 3. Query Templates
- **Pre-built Queries**: Common queries ready to use
- **Templates Include**:
  - All Active Users
  - Provisioned Customers
  - Recent Tickets
  - Company Statistics
  - Data Export Activity

### 4. Safety Features
- **READ-ONLY**: Only SELECT queries allowed
- **Blocked Keywords**: DROP, DELETE, UPDATE, INSERT, etc. are blocked
- **Table Whitelist**: Only approved tables can be queried
- **Query Logging**: All queries are logged with execution time
- **Error Handling**: Clear error messages for invalid queries

## Access

### For Jeff (BSI Admin):
1. Log in to BSI Admin Panel (`/bsi/login`)
2. Go to Super Admin Dashboard
3. Click "SQL Query Builder" button
4. Or go directly to `/bsi/query-builder`

## User Interface

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard          SQL Query Builder            │
├─────────────────────────────────────────────────────────────┤
│  [SQL Editor] [Visual Builder]          [📋 Query Templates]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SQL Query (SELECT only)                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SELECT * FROM users LIMIT 10;                       │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [▶ Execute Query]  [📥 Export to CSV]                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Query Results                                              │
│  10 rows • 45ms                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ email          │ first_name │ last_name │ role     │   │
│  │ admin@...      │ Admin      │ User      │ admin    │   │
│  │ john@...       │ John       │ Doe       │ user     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Available Tables

The following tables can be queried:
- `users` - User accounts
- `companies` - Customer companies
- `customer_subscriptions` - Subscription records
- `subscription_plans` - Available plans
- `tickets` - Support tickets
- `ticket_notes` - Ticket comments
- `ticket_attachments` - File attachments
- `custom_fields` - Custom field definitions
- `user_company_associations` - User-company links
- `teams` - Team information
- `queues` - Ticket queues
- `data_export_logs` - Export activity
- `data_import_logs` - Import activity

## Example Queries

### 1. All Active Users
```sql
SELECT 
  u.email, 
  u.first_name, 
  u.last_name, 
  u.role, 
  c.name as company_name
FROM users u
LEFT JOIN user_company_associations uca ON u.id = uca.user_id
LEFT JOIN companies c ON uca.company_id = c.id
WHERE u.is_active = true
ORDER BY u.created_at DESC
LIMIT 100
```

### 2. Provisioned Customers
```sql
SELECT 
  c.name as company_name,
  c.domain,
  u.email as admin_email,
  cs.status,
  cs.limits,
  cs.created_at
FROM customer_subscriptions cs
JOIN companies c ON cs.company_id = c.id
JOIN users u ON cs.user_id = u.id
WHERE cs.is_custom = true
ORDER BY cs.created_at DESC
```

### 3. Company Statistics
```sql
SELECT 
  c.name as company_name,
  COUNT(DISTINCT uca.user_id) as user_count,
  COUNT(DISTINCT t.id) as ticket_count,
  c.created_at
FROM companies c
LEFT JOIN user_company_associations uca ON c.id = uca.company_id
LEFT JOIN tickets t ON c.id = t.company_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.created_at
ORDER BY user_count DESC
```

### 4. Recent Tickets
```sql
SELECT 
  t.id,
  t.title,
  t.status,
  t.priority,
  c.name as company_name,
  creator.email as created_by,
  assignee.email as assigned_to,
  t.created_at
FROM tickets t
JOIN companies c ON t.company_id = c.id
LEFT JOIN users creator ON t.created_by = creator.id
LEFT JOIN users assignee ON t.assigned_to = assignee.id
ORDER BY t.created_at DESC
LIMIT 50
```

## API Endpoints

### Execute Query
```http
POST /api/query-builder/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "SELECT * FROM users LIMIT 10"
}

Response:
{
  "success": true,
  "data": {
    "columns": ["id", "email", "first_name", ...],
    "rows": [{...}, {...}],
    "rowCount": 10,
    "executionTime": 45
  }
}
```

### Get Schema
```http
GET /api/query-builder/schema
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "tableName": "users",
      "columns": [
        {
          "columnName": "id",
          "dataType": "uuid",
          "isNullable": false
        },
        ...
      ]
    },
    ...
  ]
}
```

### Export to CSV
```http
POST /api/query-builder/export
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "SELECT * FROM users LIMIT 10"
}

Response: CSV file download
```

### Get Templates
```http
GET /api/query-builder/templates
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "name": "All Active Users",
      "description": "List all active users with their companies",
      "query": "SELECT ..."
    },
    ...
  ]
}
```

## Security

### Read-Only Access
- Only `SELECT` queries are allowed
- All modification keywords are blocked:
  - DROP, DELETE, TRUNCATE
  - ALTER, CREATE
  - INSERT, UPDATE
  - GRANT, REVOKE

### Table Whitelist
- Only pre-approved tables can be queried
- Prevents access to sensitive system tables
- Easy to add new tables to whitelist

### Query Validation
- Queries must start with SELECT
- Maximum query length: 10,000 characters
- Dangerous keywords are blocked
- Clear error messages for invalid queries

### Audit Trail
- All queries are logged in `query_execution_logs`
- Logs include:
  - User who executed the query
  - Query text
  - Number of rows returned
  - Execution time
  - Timestamp

### Admin Only
- Only users with `admin` role can access
- Requires authentication token
- Separate from customer portal

## Use Cases

### Use Case 1: Find All Users in a Company
```sql
SELECT u.email, u.first_name, u.last_name, u.role
FROM users u
JOIN user_company_associations uca ON u.id = uca.user_id
WHERE uca.company_id = 'company-id-here'
```

### Use Case 2: Check Subscription Status
```sql
SELECT 
  c.name,
  cs.status,
  cs.current_period_end,
  cs.limits
FROM customer_subscriptions cs
JOIN companies c ON cs.company_id = c.id
WHERE c.name LIKE '%Company Name%'
```

### Use Case 3: Export User List
1. Write query to select users
2. Click "Execute Query" to preview
3. Click "Export to CSV" to download
4. Open in Excel or Google Sheets

### Use Case 4: Analyze Ticket Volume
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as ticket_count,
  status
FROM tickets
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), status
ORDER BY date DESC
```

## Visual Query Builder

### Step-by-Step
1. **Select Table**: Choose from dropdown
2. **Select Columns**: Check boxes for columns (or leave empty for all)
3. **Add WHERE**: Enter filter conditions
4. **Add ORDER BY**: Specify sorting
5. **Set LIMIT**: Control result count
6. **Build Query**: Generates SQL
7. **Execute**: Run the generated query

### Example
```
Table: users
Columns: email, first_name, last_name, role
WHERE: is_active = true
ORDER BY: created_at DESC
LIMIT: 50

Generates:
SELECT email, first_name, last_name, role
FROM users
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 50
```

## Technical Implementation

### Backend
- **Service**: `QueryBuilderService.ts`
  - Query execution
  - Query validation
  - Schema retrieval
  - CSV export
  - Query logging

- **Routes**: `queryBuilder.ts`
  - POST `/execute` - Run query
  - POST `/build` - Build from visual params
  - GET `/schema` - Get table schema
  - GET `/templates` - Get query templates
  - GET `/history` - Get query history
  - POST `/export` - Export to CSV

- **Database**: `query_execution_logs` table
  - Tracks all query executions
  - Stores query text, results, timing

### Frontend
- **Component**: `SQLQueryBuilder.tsx`
  - SQL editor with textarea
  - Visual query builder
  - Results table display
  - CSV export functionality
  - Template selector

## Files Created

### Backend
1. `packages/backend/src/services/QueryBuilderService.ts`
2. `packages/backend/src/routes/queryBuilder.ts`
3. `packages/backend/database/migrations/029_create_query_execution_logs.js`

### Frontend
1. `packages/frontend/src/pages/SQLQueryBuilder.tsx`

### Documentation
1. `SQL_QUERY_BUILDER_FEATURE.md` (this file)

## Future Enhancements

1. **Saved Queries**: Save frequently used queries
2. **Query Sharing**: Share queries with other admins
3. **Scheduled Queries**: Run queries on a schedule
4. **Email Reports**: Email query results automatically
5. **Chart Visualization**: Display results as charts
6. **Query History**: View and re-run past queries
7. **Advanced Joins**: Visual join builder
8. **Query Optimization**: Suggest query improvements
9. **Export Formats**: JSON, Excel, PDF exports
10. **Query Validation**: Check query before execution

## Testing Checklist

- [x] Execute SELECT query
- [x] Block non-SELECT queries
- [x] Visual query builder
- [x] Export to CSV
- [x] Load query templates
- [x] Display results in table
- [x] Error handling
- [x] Admin authentication
- [x] Query logging
- [x] Schema retrieval

## Status

✅ **COMPLETE** - Full SQL Query Builder implemented
- Backend service: ✅
- API routes: ✅
- Database migration: ✅
- Frontend UI: ✅
- Security features: ✅
- Documentation: ✅

Jeff can now run custom SQL queries, build queries visually, and export results to CSV from the BSI Admin Panel!
