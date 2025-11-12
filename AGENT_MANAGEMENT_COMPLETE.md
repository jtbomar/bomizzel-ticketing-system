# Agent Management System - Complete Implementation

## Overview
Comprehensive agent management system with organizational structure, contact information, and password management.

## Database Schema

### New Tables Created

#### 1. `organizational_roles`
Company hierarchy positions (President, Director, Manager, etc.)
- `id` - Primary key
- `company_id` - Company identifier
- `name` - Role name (e.g., "Director of Support")
- `description` - Role description
- `hierarchy_level` - Numeric level (1=highest, 8=lowest)
- `is_active` - Active status
- `created_at`, `updated_at` - Timestamps

#### 2. `user_profiles`
Functional roles with permissions (Support Administrator, Technical Lead, etc.)
- `id` - Primary key
- `company_id` - Company identifier
- `name` - Profile name
- `description` - Profile description
- `permissions` - JSONB field for permission settings
- `is_active` - Active status
- `created_at`, `updated_at` - Timestamps

#### 3. `user_departments`
Junction table for many-to-many user-department relationships
- `id` - Primary key
- `user_id` - Foreign key to users
- `department_id` - Foreign key to departments
- `is_primary` - Boolean for primary department
- `created_at`, `updated_at` - Timestamps

### Enhanced Users Table
New fields added to `users` table:
- `phone` - Office phone number
- `mobile_phone` - Mobile phone number
- `extension` - Phone extension
- `about` - Bio/description text
- `organizational_role_id` - FK to organizational_roles
- `user_profile_id` - FK to user_profiles
- `must_change_password` - Force password change flag
- `default_password` - Temporary storage for initial password

## Default Data Seeded

### Organizational Roles (8 levels)
1. President (Level 1)
2. Vice President (Level 2)
3. Director (Level 3)
4. Manager (Level 4)
5. Supervisor (Level 5)
6. Team Lead (Level 6)
7. Senior Agent (Level 7)
8. Agent (Level 8)

### User Profiles (5 profiles)
1. System Administrator - Full system access
2. Support Administrator - Manage support operations
3. Technical Lead - Technical support specialist
4. Customer Support Specialist - Handle customer inquiries
5. Billing Specialist - Handle billing issues

## Backend API Endpoints

### Organizational Roles
- `GET /api/organizational-roles` - List all roles
- `POST /api/organizational-roles` - Create new role (admin only)
- `PUT /api/organizational-roles/:id` - Update role (admin only)
- `DELETE /api/organizational-roles/:id` - Deactivate role (admin only)

### User Profiles
- `GET /api/user-profiles` - List all profiles
- `POST /api/user-profiles` - Create new profile (admin only)
- `PUT /api/user-profiles/:id` - Update profile (admin only)
- `DELETE /api/user-profiles/:id` - Deactivate profile (admin only)

## Frontend - Agents Page

### Route
`/admin/settings/agents`

### Features

#### Agent Creation Form
Comprehensive form with the following sections:

**1. Basic Information**
- First Name (required)
- Last Name (required)
- Email (required)

**2. Contact Information**
- Phone
- Mobile Phone
- Extension

**3. Password Settings**
- Starting Password (default: "Welcome123!")
- Checkbox: "Require password change on first login" (default: checked)

**4. Organizational Structure**
- System Role dropdown (Agent, Team Lead, Administrator)
- Organizational Role dropdown (President, Director, Manager, etc.)
- User Profile dropdown (Support Admin, Technical Lead, etc.)

**5. Departments**
- Multi-select checkboxes for department assignments
- Can assign agent to multiple departments

**6. About**
- Text area for bio/description

#### Agent List View
- Display all agents with their information
- Statistics dashboard (Total, Active, Inactive)
- Activate/Deactivate buttons
- Delete button
- Filter to show only employees and team leads

## How to Use

### For Super Admins

#### 1. Build Your Organizational Structure
Navigate to Admin Settings and create:
- Custom organizational roles matching your company hierarchy
- User profiles for different functional roles
- Departments for your organization

#### 2. Add Agents
1. Go to `/admin/settings/agents`
2. Click "Add Agent"
3. Fill in all required fields:
   - Basic info (name, email)
   - Contact info (phones, extension)
   - Set starting password or use default
   - Choose if they must change password on first login
   - Select system role (access level)
   - Select organizational role (hierarchy position)
   - Select user profile (functional role)
   - Assign to one or more departments
   - Add bio/about information
4. Click "Add Agent"

#### 3. Manage Existing Agents
- View all agents in a table
- Click status badge to activate/deactivate
- Use action buttons to manage agents
- See statistics at a glance

### For New Agents
When a new agent logs in for the first time:
1. They use the starting password provided by admin
2. If "must change password" was checked, they'll be prompted to change it
3. They can then access the system based on their assigned role and profile

## Password Management
- Admins set a starting password (default: "Welcome123!")
- Option to force password change on first login
- Secure password storage with bcrypt hashing
- Password reset functionality available

## Permissions System
User profiles include a permissions JSON object that can define:
- `canManageUsers` - User management access
- `canManageSettings` - System settings access
- `canViewReports` - Reporting access
- `canManageTickets` - Ticket management access

These can be extended as needed for your specific requirements.

## Multi-Department Support
- Agents can be assigned to multiple departments
- One department can be marked as primary
- Useful for agents who handle multiple areas of support

## Benefits
1. **Flexible Hierarchy** - Build any organizational structure you need
2. **Role-Based Access** - Control permissions through user profiles
3. **Complete Contact Info** - Store all agent contact details
4. **Multi-Department** - Agents can work across departments
5. **Secure Onboarding** - Force password changes for new users
6. **Scalable** - Easy to add new roles, profiles, and departments

## Next Steps
To further enhance this system, you could:
1. Add role/profile management UI pages
2. Implement permission checking throughout the application
3. Add agent performance metrics
4. Create team assignment functionality
5. Add agent availability/schedule management
6. Implement agent skill tags for routing

All the database structure and backend APIs are in place to support these enhancements!
