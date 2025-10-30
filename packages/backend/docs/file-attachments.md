# File Attachment System

The file attachment system allows users to upload, download, and manage files associated with tickets in the Bomizzel ticketing system.

## Features

- **Secure File Upload**: Files are validated for type, size, and security
- **Access Control**: Users can only access files from tickets they have permission to view
- **Image Thumbnails**: Automatic thumbnail generation for image files
- **File Management**: Upload, download, and delete file attachments
- **Storage**: Local file storage with configurable upload directory

## Supported File Types

- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV
- Archives: ZIP

## File Size Limits

- Maximum file size: 10MB (configurable via `MAX_FILE_SIZE` environment variable)
- Maximum files per upload: 5 files

## API Endpoints

### Upload File to Ticket

```
POST /api/files/upload
Content-Type: multipart/form-data

Body:
- file: File to upload
- ticketId: UUID of the ticket
- noteId: (optional) UUID of the note to associate with
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "attachment-uuid",
    "ticketId": "ticket-uuid",
    "fileName": "generated-filename.jpg",
    "originalName": "user-filename.jpg",
    "fileSize": 1024,
    "mimeType": "image/jpeg",
    "isImage": true,
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### Upload File Directly to Ticket

```
POST /api/tickets/:ticketId/attachments
Content-Type: multipart/form-data

Body:
- file: File to upload
- noteId: (optional) UUID of the note to associate with
```

### Get File Attachment

```
GET /api/files/:attachmentId
```

Downloads the file with appropriate headers for the browser.

### Get File Attachment Info

```
GET /api/files/:attachmentId/info
```

Returns file metadata without downloading the file.

### Get Image Thumbnail

```
GET /api/files/:attachmentId/thumbnail
```

Returns a 200x200 thumbnail for image files.

### Delete File Attachment

```
DELETE /api/files/:attachmentId
```

Deletes the file attachment. Only the uploader or employees can delete files.

### Get Ticket Attachments

```
GET /api/tickets/:ticketId/attachments
```

Returns all attachments for a specific ticket.

## Access Control

### Customers
- Can upload files to tickets from their associated companies
- Can download files from tickets they have access to
- Can only delete files they uploaded

### Employees/Team Leads/Admins
- Can access all ticket attachments
- Can delete any file attachment
- Can upload files to any ticket

## File Storage

Files are stored locally in the configured upload directory with the following structure:

```
uploads/
├── uuid-filename.jpg
├── uuid-filename.pdf
└── thumbnails/
    └── thumb_uuid-filename.jpg
```

## Security Features

- File type validation based on MIME type
- File size limits
- Filename sanitization to prevent path traversal
- Access control based on ticket permissions
- Virus scanning (can be added via additional middleware)

## Configuration

Environment variables for file upload configuration:

```bash
# Upload directory (default: ./uploads)
UPLOAD_DIR=./uploads

# Maximum file size in bytes (default: 10MB)
MAX_FILE_SIZE=10485760
```

## Error Handling

The system handles various error scenarios:

- **File too large**: Returns 400 with FILE_TOO_LARGE error
- **Invalid file type**: Returns 400 with VALIDATION_ERROR
- **No file provided**: Returns 400 with NO_FILE error
- **Access denied**: Returns 403 with FORBIDDEN error
- **File not found**: Returns 404 with NOT_FOUND error

## Usage Examples

### Upload a file using curl

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/file.jpg" \
  -F "ticketId=ticket-uuid" \
  http://localhost:5000/api/files/upload
```

### Upload a file to a specific ticket

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/file.pdf" \
  http://localhost:5000/api/tickets/ticket-uuid/attachments
```

### Download a file

```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o downloaded-file.jpg \
  http://localhost:5000/api/files/attachment-uuid
```