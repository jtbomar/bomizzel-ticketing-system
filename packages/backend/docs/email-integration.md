# Email Integration System

## Overview

The email integration system provides comprehensive email functionality for the Bomizzel ticketing system, including sending emails from tickets, managing email templates, and handling email notifications.

## Features

### Core Email Functionality

- **Ticket Email Sending**: Send emails directly from tickets with automatic note creation
- **Email Threading**: Track email conversations with proper threading and reply handling
- **SMTP Configuration**: Flexible SMTP setup with connection verification
- **Email Notifications**: Automated notifications for ticket events

### Template Management

- **Dynamic Templates**: Create and manage email templates with variable substitution
- **Template Variables**: Support for ticket, customer, company, and system variables
- **Template Validation**: Validate template syntax and variable usage
- **Template Rendering**: Render templates with dynamic data

### Email Threading and Tracking

- **Message Threading**: Maintain email conversation threads
- **Reply Tracking**: Track replies and maintain conversation history
- **Email Metadata**: Store comprehensive email metadata for audit trails

## Configuration

### Environment Variables

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### Initialization

The email service is automatically initialized on application startup if SMTP credentials are provided.

```typescript
import { initializeEmailService } from '@/config/email';

// Initialize during app startup
initializeEmailService();
```

## API Endpoints

### Email Operations

#### Send Email from Ticket

```
POST /api/tickets/:ticketId/email
```

Send an email from within a ticket context.

**Request Body:**

```json
{
  "to": ["customer@example.com"],
  "cc": ["manager@example.com"],
  "bcc": ["archive@example.com"],
  "subject": "Regarding your support ticket",
  "htmlBody": "<p>Email content in HTML</p>",
  "textBody": "Email content in plain text",
  "templateId": "template-uuid",
  "templateVariables": {
    "customer.firstName": "John",
    "ticket.title": "Support Request"
  },
  "replyTo": "support@example.com",
  "inReplyTo": "previous-message-id",
  "references": ["msg-1", "msg-2"]
}
```

#### Send Ticket Notification

```
POST /api/tickets/:ticketId/notify
```

Send automated notifications for ticket events.

**Request Body:**

```json
{
  "type": "assigned",
  "recipients": ["customer@example.com"],
  "message": "Additional message",
  "additionalData": {
    "assigneeName": "John Doe"
  }
}
```

#### Get Email Service Status

```
GET /api/email/status
```

Check email service initialization and connection status.

### Template Management

#### Create Email Template

```
POST /api/email/templates
```

Create a new email template.

**Request Body:**

```json
{
  "name": "ticket_created",
  "subject": "New Ticket: {{ticket.title}}",
  "htmlBody": "<p>Hello {{customer.firstName}}</p>",
  "textBody": "Hello {{customer.firstName}}",
  "variables": ["ticket.title", "customer.firstName"]
}
```

#### Get All Templates

```
GET /api/email/templates
```

Retrieve all email templates.

**Query Parameters:**

- `activeOnly`: Return only active templates (boolean)

#### Get Template by ID

```
GET /api/email/templates/:templateId
```

#### Update Template

```
PUT /api/email/templates/:templateId
```

#### Delete Template

```
DELETE /api/email/templates/:templateId
```

#### Render Template

```
POST /api/email/templates/:templateId/render
```

Render a template with provided variables.

**Request Body:**

```json
{
  "variables": {
    "ticket.title": "My Ticket",
    "customer.firstName": "John"
  }
}
```

#### Get Template Variables Reference

```
GET /api/email/template-variables
```

Get available template variables organized by category.

## Template Variables

### Available Variable Categories

#### Ticket Variables

- `ticket.id` - Ticket ID
- `ticket.title` - Ticket title
- `ticket.description` - Ticket description
- `ticket.status` - Current status
- `ticket.priority` - Priority level
- `ticket.createdAt` - Creation timestamp
- `ticket.updatedAt` - Last update timestamp

#### Customer Variables

- `customer.firstName` - Customer first name
- `customer.lastName` - Customer last name
- `customer.email` - Customer email
- `customer.fullName` - Full name (first + last)

#### Company Variables

- `company.name` - Company name
- `company.domain` - Company domain

#### Assignee Variables

- `assignee.firstName` - Assignee first name
- `assignee.lastName` - Assignee last name
- `assignee.email` - Assignee email
- `assignee.fullName` - Assignee full name

#### System Variables

- `system.baseUrl` - Application base URL
- `system.supportEmail` - Support email address
- `system.currentDate` - Current date
- `system.currentTime` - Current time

### Variable Syntax

Variables use double curly braces: `{{variable.name}}`

Example:

```html
<p>Hello {{customer.firstName}},</p>
<p>Your ticket "{{ticket.title}}" has been {{ticket.status}}.</p>
```

## Email Threading

### Thread Management

The system automatically manages email threads using standard email headers:

- **Message-ID**: Unique identifier for each email
- **In-Reply-To**: References the message being replied to
- **References**: Chain of message IDs in the conversation

### Reply Handling

```typescript
// Generate reply references
const references = EmailService.generateReplyReferences(originalMessageId, existingReferences);

// Parse thread information
const { threadId, parentMessageId } = EmailService.parseEmailThread(references, inReplyTo);
```

## Default Templates

The system includes several default templates:

### ticket_created

Sent when a new ticket is created.

### ticket_assigned

Sent when a ticket is assigned to a team member.

### ticket_resolved

Sent when a ticket is marked as resolved.

### customer_reply

Template for customer communication emails.

## Service Classes

### EmailService

Main service for email operations.

**Key Methods:**

- `initialize(config)` - Initialize with SMTP configuration
- `sendTicketEmail(senderId, emailRequest)` - Send email from ticket
- `sendTicketNotification(ticketId, type, recipients)` - Send notifications
- `verifyConnection()` - Test SMTP connection

### EmailTemplateService

Service for template management.

**Key Methods:**

- `createTemplate(templateData)` - Create new template
- `renderTemplate(templateId, variables)` - Render template
- `validateTemplate(templateData)` - Validate template syntax

## Integration with Ticket Notes

When emails are sent from tickets:

1. Email is sent via SMTP
2. Automatic note is created in the ticket
3. Note is marked as email-generated
4. Email metadata is stored with the note
5. Note appears in ticket communication history

## Error Handling

### Common Error Scenarios

- **SMTP Connection Failed**: Check SMTP configuration
- **Template Not Found**: Verify template ID exists
- **Invalid Template**: Check template syntax and variables
- **Missing Email Body**: Provide either HTML or text body
- **Authentication Failed**: Verify SMTP credentials

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": ["Additional error details"]
  }
}
```

## Security Considerations

### Email Security

- SMTP credentials stored as environment variables
- Email headers include ticket and sender identification
- Access control enforced for all email operations
- Template variables sanitized to prevent injection

### Authentication

- All email endpoints require authentication
- Role-based access control for template management
- Audit trail maintained for all email operations

## Performance Considerations

### Email Delivery

- Asynchronous email sending to prevent blocking
- Connection pooling for SMTP connections
- Retry logic for failed email deliveries
- Rate limiting to prevent spam

### Template Processing

- Template compilation and caching
- Variable extraction and validation
- Efficient template rendering

## Usage Examples

### Sending a Simple Email

```typescript
const emailRequest = {
  ticketId: 'ticket-123',
  to: ['customer@example.com'],
  subject: 'Ticket Update',
  textBody: 'Your ticket has been updated.',
  htmlBody: '<p>Your ticket has been updated.</p>',
};

const metadata = await EmailService.sendTicketEmail('employee-123', emailRequest);
```

### Using Templates

```typescript
// Render template
const rendered = await EmailTemplateService.renderTemplate('ticket_created', {
  'ticket.title': 'My Support Request',
  'customer.firstName': 'John',
});

// Send with template
const emailRequest = {
  ticketId: 'ticket-123',
  to: ['customer@example.com'],
  subject: rendered.subject,
  htmlBody: rendered.htmlBody,
  textBody: rendered.textBody,
};
```

### Creating Custom Templates

```typescript
const template = await EmailTemplateService.createTemplate({
  name: 'custom_notification',
  subject: 'Custom: {{ticket.title}}',
  htmlBody: '<h1>{{ticket.title}}</h1><p>{{custom.message}}</p>',
  textBody: '{{ticket.title}}\n\n{{custom.message}}',
});
```

## Monitoring and Logging

### Email Metrics

- Track email delivery success/failure rates
- Monitor SMTP connection health
- Log template usage statistics
- Audit email sending activities

### Logging

- All email operations are logged
- SMTP errors captured and reported
- Template rendering errors tracked
- Performance metrics collected

## Troubleshooting

### Common Issues

#### Email Not Sending

1. Check SMTP configuration
2. Verify network connectivity
3. Test SMTP credentials
4. Check email service status endpoint

#### Template Rendering Errors

1. Validate template syntax
2. Check variable names
3. Verify template exists and is active
4. Test with sample data

#### Threading Issues

1. Verify Message-ID generation
2. Check References header format
3. Validate In-Reply-To header
4. Review email client compatibility
