# Custom Fields System

The custom fields system allows teams to define additional form fields for their tickets beyond the standard fields. This enables flexible data collection based on each team's specific requirements.

## Features

### Field Types
- **String**: Text input with optional length and pattern validation
- **Number/Decimal**: Numeric input with optional min/max validation
- **Integer**: Whole number input with optional min/max validation
- **Picklist**: Dropdown selection from predefined options

### Validation Rules
- **Required/Optional**: Fields can be marked as required or optional
- **Length Validation**: String fields support min/max character limits
- **Numeric Validation**: Number fields support min/max value limits
- **Pattern Validation**: String fields support regex pattern matching
- **Picklist Options**: Dropdown fields require predefined option lists

## API Endpoints

### Get Team Custom Fields
```
GET /api/custom-fields/teams/:teamId
```
Returns all active custom fields for a team, ordered by their configured order.

### Create Custom Field
```
POST /api/custom-fields/teams/:teamId
```
Creates a new custom field for a team. Only team leads and admins can create fields.

**Request Body:**
```json
{
  "name": "customer_priority",
  "label": "Customer Priority",
  "type": "picklist",
  "isRequired": true,
  "options": ["Low", "Medium", "High", "Critical"],
  "validation": {
    "message": "Please select a priority level"
  }
}
```

### Update Custom Field
```
PUT /api/custom-fields/:fieldId/teams/:teamId
```
Updates an existing custom field. Field name and type cannot be changed.

### Delete Custom Field
```
DELETE /api/custom-fields/:fieldId/teams/:teamId
```
Soft deletes a custom field (sets is_active to false).

### Reorder Custom Fields
```
PUT /api/custom-fields/teams/:teamId/reorder
```
Updates the display order of custom fields.

**Request Body:**
```json
{
  "fieldOrders": [
    { "fieldId": "field-1", "order": 0 },
    { "fieldId": "field-2", "order": 1 }
  ]
}
```

### Validate Field Values
```
POST /api/custom-fields/teams/:teamId/validate
```
Validates custom field values against the team's field definitions.

**Request Body:**
```json
{
  "values": {
    "customer_priority": "High",
    "customer_name": "John Doe"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": {}
  }
}
```

## Usage in Tickets

Custom field values are stored in the `custom_field_values` JSONB column of the tickets table. When creating or updating tickets, the values are validated against the team's custom field definitions.

## Permissions

- **Customers**: Cannot access custom field configuration endpoints
- **Employees**: Can view team custom fields and validate values
- **Team Leads**: Can create, update, delete, and reorder custom fields for their teams
- **Admins**: Full access to all custom field operations

## Database Schema

Custom fields are stored in the `custom_fields` table with the following structure:

```sql
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  label VARCHAR NOT NULL,
  type VARCHAR NOT NULL CHECK (type IN ('string', 'number', 'decimal', 'integer', 'picklist')),
  is_required BOOLEAN DEFAULT FALSE,
  options JSONB NULL,
  validation JSONB NULL,
  order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, name)
);
```

## Implementation Notes

- Field names must be unique within a team
- Field names must start with a letter and contain only letters, numbers, and underscores
- Picklist fields require at least one option
- Validation rules are type-specific and enforced both at creation and value validation
- Fields are soft-deleted to preserve historical data integrity
- Field ordering is managed through the `order` column