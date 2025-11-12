# Admin Settings Structure

## Overview

The new Admin Settings page provides a comprehensive, organized interface for managing all aspects of your ticketing system. Instead of tabs, settings are organized into clear sections with individual pages for each feature.

## Access

Navigate to: `/admin/settings` or click the "⚙️ Settings" button in the admin dashboard.

## Structure

### ORGANIZATION
Manage company-wide settings and structure

- **Company Rebranding** - Customize your company logo and branding
- **Business Hours** - Set your operating hours
- **Holiday List** - Manage company holidays
- **Departments** - Organize your teams into departments
- **Customer Happiness** - Customer satisfaction settings
- **Game Scope** - Gamification and rewards
- **Products** - Manage your product catalog

### USER MANAGEMENT
Control user access and organization

- **Agents** - Manage support agents
- **Teams** - Organize agents into teams
- **Roles** - Define user roles and permissions
- **Profiles** - User profile settings
- **Data Sharing** - Control data access and sharing

### CHANNELS
Configure communication channels

- **Email** - Email channel configuration
- **Phone** - Phone support settings
- **Chat** - Live chat configuration
- **Help Center** - Self-service help center
- **Instant Messaging** - IM integrations
- **Social** - Social media channels
- **Web Forms** - Custom web forms
- **Community** - Community forum settings
- **Agent Scripts** - Predefined agent responses
- **Knowledge Base** - Knowledge base articles

### CUSTOMIZATION
Tailor the system to your needs

- **Buttons** - Custom action buttons
- **Modules And Tabs** - Customize interface modules
- **Layouts and Fields** - Custom ticket layouts (links to existing page)
- **General Settings** - System-wide settings
- **Notifications** - Notification preferences
- **Email Templates** - Customize email templates
- **Ticket Templates** - Predefined ticket templates
- **Time Tracking** - Track time spent on tickets

### AUTOMATION
Automate repetitive tasks

- **Assignment Rules** - Auto-assign tickets to agents
- **Workflows** - Automated workflows
- **Macros** - Quick action macros
- **Service Level Agreements** - SLA management
- **Support Plans** - Customer support plans
- **Schedules** - Automated scheduling

### DATA ADMINISTRATION
Manage your data

- **Import** - Import data from files (links to Data Management)
- **Export** - Export your data (links to Data Management)
- **Data Backup** - Backup and restore (links to Data Management)
- **Recycle Bin** - Recover deleted items

### INTEGRATIONS
Connect with external services

- **Marketplace** - Browse and install integrations

### DEVELOPER SPACE
For developers and advanced users

- **APIs** - API documentation and keys
- **Connections** - External connections
- **Functions** - Custom functions
- **Webhooks** - Webhook configuration

### PRIVACY AND SECURITY
Protect your data

- **Read Receipts** - Email read tracking
- **Audit Logs** - System activity logs
- **Attachment Control** - File upload restrictions

### PERSONALIZATION
Customize your experience

- **My Profile** - Your profile settings
- **My Information** - Personal information
- **Preferences** - Your preferences

## Features

### Search
Use the search bar at the top to quickly find any setting by name or description.

### Visual Organization
Each setting is displayed as a card with:
- Icon for quick identification
- Name and description
- Click to navigate to that setting page

### Responsive Design
The layout adapts to different screen sizes:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

### Theme Support
Fully supports both light and dark themes.

## Implementation Status

### ✅ Implemented
- Admin Settings main page
- Search functionality
- Navigation structure
- Theme support
- Links to existing pages (Layouts, Data Management, Reports)

### 🚧 To Be Implemented
Individual setting pages for each item. These will be created as needed based on priority.

## Navigation

From the Admin Dashboard:
1. Click "⚙️ Settings" button in the top right
2. Browse sections or use search
3. Click on any setting to navigate to that page
4. Use "← Back to Dashboard" to return

## Development Notes

### Adding New Settings

To add a new setting item:

1. Open `packages/frontend/src/pages/AdminSettings.tsx`
2. Find the appropriate section in the `sections` array
3. Add a new item:
```typescript
{
  name: 'Setting Name',
  description: 'Brief description',
  path: '/admin/settings/setting-path',
  icon: '🎯'
}
```

### Creating Setting Pages

When creating individual setting pages:
1. Create the page component in `packages/frontend/src/pages/`
2. Add the route in `App.tsx`
3. Protect with `ProtectedRoute` if needed
4. Follow the existing design patterns for consistency

## Benefits

### For Users
- **Easy to find** - Clear organization and search
- **Visual** - Icons and descriptions help identify settings
- **No tabs** - Direct navigation to each setting
- **Comprehensive** - All settings in one place

### For Developers
- **Scalable** - Easy to add new settings
- **Maintainable** - Clear structure
- **Flexible** - Each setting can have its own complex page
- **Consistent** - Unified design language

## Future Enhancements

- Favorites/Recently Used settings
- Setting categories can be collapsed/expanded
- Quick actions from the settings page
- Setting recommendations based on usage
- Guided setup wizards for complex settings

---

**The new Admin Settings page provides a modern, organized way to manage your entire ticketing system!**
