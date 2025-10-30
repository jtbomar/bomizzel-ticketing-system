# Ticket Notes System

## Overview

The ticket notes system allows customers and employees to add comments and communications to tickets. It supports both internal notes (visible only to employees) and customer-visible notes, with special handling for email-generated notes.

## Features

### Core Functionality
- **Note Creation**: Add notes to tickets with content and visibility controls
- **Note Visibility**: Internal notes (employee-only) vs customer-visible notes
- **Email Integration**: Automatic note creation from sent emails
- **Note Management**: Update and delete notes (with restrictions)
- **Attachment Linking**: Associate file attachments with specific notes

### Access Control
- **Customers**: Can only see non-internal notes for tickets in their companies
- **Employees**: Can see all notes regardless of visibility
- **Note Ownership**: Only note authors can edit/delete their notes
- **Email Notes**: Cannot be edited or deleted (read-only)

### Search and Filtering
- **Content Search**: Search notes by text content
- **Filtering**: Filter by author, ticket, internal status, email-generated status
- **Pagination**: Support for paginated results
- **History**: View chronological note history for tickets

## API Endpoints

### Create Note
```
POST /api/tickets/:ticketId/notes
```
Creates a new note for a ticket.

**Request Body:**
```json
{
  "content": "Note content",
  "isInternal": false
}
```

### Get Ticket Notes
```
GET /api/tickets/:ticketId/notes
```
Retrieves all notes for a ticket with pagination.

**Query Parameters:**
- `includeInternal`: Include internal notes (employees only)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

### Update Note
```
PUT /api/notes/:noteId
```
Updates an existing note (author only, non-email notes).

**Request Body:**
```json
{
  "content": "Updated content",
  "isInternal": true
}
```

### Delete Note
```
DELETE /api/notes/:noteId
```
Deletes a note (author only, non-email notes).

### Search Notes
```
GET /api/notes/search
```
Searches notes across tickets.

**Query Parameters:**
- `q`: Search query
- `ticketIds`: Comma-separated ticket IDs
- `authorId`: Filter by author
- `isInternal`: Filter by internal status
- `isEmailGenerated`: Filter by email-generated status
- `page`: Page number
- `limit`: Items per page

### Note History
```
GET /api/tickets/:ticketId/notes/history
```
Gets chronological history of all notes for a ticket.

### Attachment Management
```
POST /api/notes/:noteId/attachments/:attachmentId
DELETE /api/notes/:noteId/attachments/:attachmentId
GET /api/notes/:noteId/attachments
```
Link, unlink, and list attachments for notes.

## Data Models

### TicketNote
```typescript
interface TicketNote {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  isEmailGenerated: boolean;
  emailMetadata?: EmailMetadata;
  createdAt: Date;
  updatedAt: Date;
  author?: User;
  attachments?: FileAttachment[];
}
```

### EmailMetadata
```typescript
interface EmailMetadata {
  messageId?: string;
  subject?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}
```

## Business Rules

### Note Creation
1. All notes must have non-empty content
2. Internal notes are only visible to employees
3. Email-generated notes are always customer-visible
4. Note creation triggers ticket history entry

### Note Modification
1. Only note authors can edit their notes
2. Email-generated notes cannot be edited or deleted
3. Note updates preserve original creation timestamp
4. Content cannot be empty after update

### Access Control
1. Customers can only access notes for tickets in their companies
2. Customers cannot see internal notes
3. Employees can see all notes regardless of visibility
4. Note access is validated on every request

### Attachment Linking
1. Attachments can only be linked to notes in the same ticket
2. Attachments can be linked to multiple notes
3. Unlinking removes the note association but preserves the file
4. Attachment access follows note access rules

## Implementation Notes

### Database Schema
- Notes are stored in the `ticket_notes` table
- Foreign key relationships to `tickets` and `users`
- JSONB field for email metadata
- Indexes on ticket_id, author_id, and timestamps

### Performance Considerations
- Pagination is enforced for all list operations
- Database indexes optimize common query patterns
- Note search uses full-text search capabilities
- Attachment queries are optimized with proper joins

### Security
- All endpoints require authentication
- Access control is enforced at the service layer
- Input validation prevents XSS and injection attacks
- File attachments follow secure upload practices

## Usage Examples

### Customer Adding a Note
```javascript
// Customer adds a public note
const response = await fetch('/api/tickets/123/notes', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'I need additional help with this issue',
    isInternal: false
  })
});
```

### Employee Adding Internal Note
```javascript
// Employee adds an internal note
const response = await fetch('/api/tickets/123/notes', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Customer called, escalating to senior support',
    isInternal: true
  })
});
```

### Searching Notes
```javascript
// Search for notes containing specific keywords
const response = await fetch('/api/notes/search?q=escalation&isInternal=true', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});
```