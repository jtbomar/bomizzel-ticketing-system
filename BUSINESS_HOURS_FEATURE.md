# Business Hours Management Feature

## Overview
The Business Hours feature allows organizations to define their operating hours for SLA calculations, automations, and time-bound activities. This ensures tickets don't become overdue or get escalated during non-office hours.

## Features

### 📋 Business Hours Configuration
- **Multiple Configurations**: Create multiple business hours configurations for different scenarios
- **Default Setting**: Mark one configuration as default for system-wide use
- **Active/Inactive Status**: Enable or disable configurations without deleting them
- **Timezone Support**: Set timezone for accurate time calculations

### 🕐 Weekly Schedule Management
- **7-Day Configuration**: Set working hours for each day of the week
- **Working/Non-Working Days**: Mark days as working or non-working
- **Flexible Hours**: Set different start and end times for each day
- **Break Times**: Optional lunch break or other break periods
- **Time Format**: 24-hour time format with minute precision

### 🎯 Use Cases
- **SLA Calculations**: Calculate ticket due times based on business hours
- **Automations**: Time-bound workflows and escalations
- **Reporting**: Business hours context for performance metrics
- **Customer Expectations**: Clear communication of response times

## Database Structure

### business_hours Table
- `id`: Primary key
- `company_id`: Reference to company (UUID)
- `title`: Configuration name
- `description`: Optional description
- `timezone`: Timezone identifier (e.g., 'America/New_York')
- `is_active`: Whether configuration is active
- `is_default`: Whether this is the default configuration
- `created_at`, `updated_at`: Timestamps

### business_hours_schedule Table
- `id`: Primary key
- `business_hours_id`: Reference to business hours configuration
- `day_of_week`: Day number (0=Sunday, 1=Monday, etc.)
- `is_working_day`: Whether this day is a working day
- `start_time`: Work start time (HH:MM:SS)
- `end_time`: Work end time (HH:MM:SS)
- `break_start`: Optional break start time
- `break_end`: Optional break end time

## API Endpoints

### GET /api/business-hours
Get all business hours configurations for the authenticated user's company.

### GET /api/business-hours/:id
Get a specific business hours configuration by ID.

### POST /api/business-hours
Create a new business hours configuration.
```json
{
  "businessHours": {
    "title": "Standard Hours",
    "description": "Monday to Friday business hours",
    "timezone": "America/New_York",
    "is_active": true,
    "is_default": false
  },
  "schedule": [
    {
      "day_of_week": 0,
      "is_working_day": false,
      "start_time": null,
      "end_time": null
    },
    // ... 6 more days
  ]
}
```

### PUT /api/business-hours/:id
Update an existing business hours configuration.

### DELETE /api/business-hours/:id
Delete a business hours configuration (cannot delete if it's the only one).

### GET /api/business-hours/default/current
Get the default business hours configuration for the company.

### GET /api/business-hours/check/current-status
Check if the current time is within business hours.

## Frontend Interface

### 📱 User Interface
- **Configuration List**: View all business hours configurations
- **Details View**: See schedule and settings for selected configuration
- **Edit Form**: Create and modify business hours configurations
- **Visual Schedule**: Clear display of weekly working hours
- **Timezone Selection**: Dropdown with common timezones

### 🎨 Design Features
- **Responsive Layout**: Works on desktop and mobile
- **Intuitive Forms**: Easy-to-use time pickers and checkboxes
- **Status Indicators**: Visual badges for default/active status
- **Validation**: Form validation for required fields and time logic

## Access Control
- **Authentication Required**: All endpoints require valid JWT token
- **Company Isolation**: Users can only manage their company's business hours
- **Admin Role**: Typically accessed through admin settings panel

## Navigation
Access through: **Admin Settings → Organization → Business Hours**

## Default Configuration
When seeded, creates a standard Monday-Friday, 9 AM to 5 PM configuration with lunch break from 12 PM to 1 PM.

## Technical Implementation

### Backend Services
- `BusinessHoursService`: Core business logic
- Database transactions for data consistency
- Validation for schedule completeness
- Timezone handling utilities

### Frontend Components
- React functional component with hooks
- Axios for API communication
- Form state management
- Real-time validation

### Security Features
- JWT authentication
- Company-based data isolation
- Input validation and sanitization
- Protected routes

## Future Enhancements
- Holiday integration
- Multiple break periods per day
- Recurring schedule patterns
- Business hours templates
- Integration with SLA calculations
- Notification preferences based on business hours