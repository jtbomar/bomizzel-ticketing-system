# Data Export & Import Feature - Complete Implementation

## Overview

Customers can now backup and restore their complete company data including users, tickets, contacts, attachments metadata, and custom fields through a user-friendly interface.

## Features Implemented

### 1. Data Export
- **What Can Be Exported:**
  - ✅ Users (all company users with roles and preferences)
  - ✅ Tickets (with full history and notes)
  - ✅ Attachments metadata (file information)
  - ✅ Custom Fields (field definitions and configurations)
  - ✅ Ticket Notes (all comments and internal notes)
  
- **Export Options:**
  - Select which data types to include
  - Filter by date range (tickets only)
  - JSON format (structured, easy to read)
  - ZIP compression for smaller file size
  - 24-hour download link expiration

### 2. Data Import
- **What Can Be Imported:**
  - ✅ Users (creates new or updates existing)
  - ✅ Tickets (with all notes and history)
  - ✅ Custom Fields (field definitions)
  
- **Import Options:**
  - **Skip Duplicates**: Don't import records that already exist
  - **Overwrite Existing**: Update existing records with imported data
  - **Validate Only**: Check file without importing (dry run)
  
- **Smart Import:**
  - Matches users by email
  - Preserves relationships (tickets to users)
  - Handles missing references gracefully
  - Detailed error reporting

### 3. History & Audit Trail
- **Export History:**
  - Who exported data
  - When it was exported
  - What was included (counts)
  
- **Import History:**
  - Who imported data
  - When it was imported
  - What was imported (counts)
  - Any errors that occurred

## User Interface

### Export Tab
```
┌─────────────────────────────────────────┐
│ Export Your Data                        │
├─────────────────────────────────────────┤
│ ☑ Include Users                         │
│ ☑ Include Tickets                       │
│ ☑ Include Attachments Metadata          │
│ ☑ Include Custom Fields                 │
│                                         │
│ Date From: [________]  Date To: [_____] │
│                                         │
│ [Export Data]                           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Export Complete!                    │ │
│ │ File: company_export_123.zip        │ │
│ │ Size: 2.5 MB                        │ │
│ │ Expires: Nov 5, 2025 5:00 PM       │ │
│ │                                     │ │
│ │ Included Data:                      │ │
│ │ • 25 Users                          │ │
│ │ • 150 Tickets                       │ │
│ │ • 45 Attachments                    │ │
│ │ • 10 Custom Fields                  │ │
│ │                                     │ │
│ │ [Download Export]                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Import Tab
```
┌─────────────────────────────────────────┐
│ Import Data                             │
├─────────────────────────────────────────┤
│ Select Export File (JSON):              │
│ [Choose File] company_export_123.json   │
│                                         │
│ ☐ Overwrite Existing Records            │
│ ☑ Skip Duplicate Records                │
│ ☐ Validate Only (Don't Import)          │
│                                         │
│ [Import Data]                           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Import Complete!                    │ │
│ │ Users Imported: 20                  │ │
│ │ Users Skipped: 5                    │ │
│ │ Tickets Imported: 145               │ │
│ │ Tickets Skipped: 5                  │ │
│ │ Custom Fields Imported: 10          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### History Tab
```
┌─────────────────────────────────────────┐
│ Export & Import History                 │
├─────────────────────────────────────────┤
│ Recent Exports                          │
│ ┌─────────────────────────────────────┐ │
│ │ Export ID: export_123_456           │ │
│ │ Nov 4, 2025 3:30 PM                 │ │
│ │ By: John Doe (john@company.com)     │ │
│ │ 25 users, 150 tickets               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Recent Imports                          │
│ ┌─────────────────────────────────────┐ │
│ │ Import ID: import_789_012           │ │
│ │ Nov 3, 2025 2:15 PM                 │ │
│ │ By: Jane Smith (jane@company.com)   │ │
│ │ 20 users, 145 tickets imported      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## API Endpoints

### Export Data
```http
POST /api/data-export/export
Authorization: Bearer <token>
Content-Type: application/json

{
  "companyId": "uuid",
  "includeUsers": true,
  "includeTickets": true,
  "includeAttachments": true,
  "includeCustomFields": true,
  "dateFrom": "2025-01-01",
  "dateTo": "2025-12-31"
}

Response:
{
  "success": true,
  "data": {
    "exportId": "export_123_456",
    "fileName": "company_export_123.zip",
    "fileSize": 2621440,
    "downloadUrl": "/api/data-export/download/export_123_456/company_export_123.zip",
    "expiresAt": "2025-11-05T17:00:00Z",
    "includedData": {
      "users": 25,
      "tickets": 150,
      "attachments": 45,
      "customFields": 10
    }
  }
}
```

### Download Export
```http
GET /api/data-export/download/:exportId/:fileName
Authorization: Bearer <token>

Response: File download
```

### Import Data
```http
POST /api/data-export/import
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <uploaded-file>
companyId: uuid
overwriteExisting: false
skipDuplicates: true
validateOnly: false

Response:
{
  "success": true,
  "data": {
    "importId": "import_789_012",
    "summary": {
      "usersImported": 20,
      "usersSkipped": 5,
      "ticketsImported": 145,
      "ticketsSkipped": 5,
      "customFieldsImported": 10,
      "errors": []
    }
  }
}
```

### Get History
```http
GET /api/data-export/history/:companyId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "exports": [...],
    "imports": [...]
  }
}
```

## Export File Structure

```json
{
  "exportInfo": {
    "exportId": "export_123_456",
    "companyId": "uuid",
    "companyName": "Acme Corp",
    "exportedBy": "user-uuid",
    "exportedAt": "2025-11-04T15:30:00Z",
    "options": {
      "includeUsers": true,
      "includeTickets": true,
      "includeAttachments": true,
      "includeCustomFields": true
    }
  },
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890",
        "role": "user",
        "companyRole": "member",
        "isActive": true,
        "emailVerified": true,
        "preferences": {},
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-11-04T00:00:00Z"
      }
    ],
    "tickets": [
      {
        "id": "ticket-uuid",
        "title": "Issue with login",
        "description": "Cannot log in to the system",
        "status": "open",
        "priority": "high",
        "category": "technical",
        "customFields": {},
        "createdBy": {
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe"
        },
        "assignedTo": {
          "email": "support@example.com",
          "firstName": "Support",
          "lastName": "Team"
        },
        "notes": [
          {
            "id": "note-uuid",
            "content": "Looking into this issue",
            "isInternal": false,
            "author": {
              "email": "support@example.com",
              "firstName": "Support",
              "lastName": "Team"
            },
            "createdAt": "2025-11-04T10:00:00Z"
          }
        ],
        "createdAt": "2025-11-04T09:00:00Z",
        "updatedAt": "2025-11-04T10:00:00Z",
        "resolvedAt": null
      }
    ],
    "customFields": [
      {
        "id": "field-uuid",
        "name": "Priority Level",
        "fieldType": "picklist",
        "options": ["Low", "Medium", "High", "Critical"],
        "isRequired": true,
        "isActive": true,
        "displayOrder": 1,
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "attachments": [
      {
        "id": "attachment-uuid",
        "ticketId": "ticket-uuid",
        "fileName": "screenshot.png",
        "fileSize": 102400,
        "fileType": "image/png",
        "filePath": "/uploads/...",
        "uploadedBy": {
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe"
        },
        "uploadedAt": "2025-11-04T09:05:00Z"
      }
    ]
  }
}
```

## Use Cases

### Use Case 1: Regular Backup
**Scenario**: Company wants weekly backups of all data

**Steps:**
1. Navigate to Data Management page
2. Select all data types
3. Click "Export Data"
4. Download the ZIP file
5. Store in secure backup location

**Frequency**: Weekly (automated via cron job possible)

### Use Case 2: Migration to New System
**Scenario**: Company is migrating from another system

**Steps:**
1. Export data from old system
2. Transform to Bomizzel format
3. Navigate to Data Management > Import
4. Select "Validate Only" first
5. Review validation results
6. Uncheck "Validate Only"
7. Import data
8. Review import summary

### Use Case 3: Disaster Recovery
**Scenario**: Data loss occurred, need to restore

**Steps:**
1. Locate most recent backup file
2. Navigate to Data Management > Import
3. Select backup file
4. Choose "Overwrite Existing" if needed
5. Import data
6. Verify data integrity

### Use Case 4: Partial Data Export
**Scenario**: Need only tickets from last quarter

**Steps:**
1. Navigate to Data Management > Export
2. Uncheck "Include Users"
3. Set Date From: Oct 1, 2025
4. Set Date To: Dec 31, 2025
5. Export and download

## Security & Privacy

### Access Control
- ✅ Only authenticated users can export/import
- ✅ Users can only export/import their own company data
- ✅ Admin role required for cleanup operations

### Data Protection
- ✅ Export files expire after 24 hours
- ✅ Files stored in secure directory
- ✅ Automatic cleanup of old exports
- ✅ No passwords included in exports (users must reset)

### Audit Trail
- ✅ All exports logged with user and timestamp
- ✅ All imports logged with user and timestamp
- ✅ Summary of what was exported/imported
- ✅ Error tracking for failed operations

## Technical Implementation

### Backend Services
1. **DataExportService.ts**
   - `exportCompanyData()` - Main export function
   - `exportUsers()` - Export user data
   - `exportTickets()` - Export tickets with notes
   - `exportCustomFields()` - Export field definitions
   - `exportAttachments()` - Export attachment metadata
   - `createZipArchive()` - Create compressed file
   - `getExportHistory()` - Retrieve export history
   - `cleanupOldExports()` - Remove expired files

2. **DataImportService.ts**
   - `importCompanyData()` - Main import function
   - `validateImportData()` - Validate file structure
   - `importUsers()` - Import user records
   - `importTickets()` - Import tickets with notes
   - `importCustomFields()` - Import field definitions
   - `getImportHistory()` - Retrieve import history

### API Routes
- `POST /api/data-export/export` - Export data
- `GET /api/data-export/download/:exportId/:fileName` - Download file
- `POST /api/data-export/import` - Import data
- `GET /api/data-export/history/:companyId` - Get history
- `POST /api/data-export/cleanup` - Cleanup old files (admin)

### Database Tables
- `data_export_logs` - Export activity tracking
- `data_import_logs` - Import activity tracking

### Frontend Component
- `DataManagement.tsx` - Complete UI with tabs for export/import/history

## Files Created

### Backend
1. `packages/backend/src/services/DataExportService.ts`
2. `packages/backend/src/services/DataImportService.ts`
3. `packages/backend/src/routes/dataExport.ts`
4. `packages/backend/database/migrations/028_create_data_export_import_logs.js`

### Frontend
1. `packages/frontend/src/pages/DataManagement.tsx`

### Documentation
1. `DATA_EXPORT_IMPORT_FEATURE.md` (this file)

## Dependencies Added
- `archiver` - For creating ZIP archives

## Future Enhancements

1. **Scheduled Exports**
   - Automatic daily/weekly/monthly backups
   - Email notification when export is ready
   - Cloud storage integration (S3, Google Drive)

2. **Advanced Filtering**
   - Export specific tickets by status/priority
   - Export specific users by role
   - Export by custom field values

3. **CSV Format**
   - Export to CSV for spreadsheet analysis
   - Import from CSV for bulk operations

4. **Incremental Backups**
   - Only export changes since last backup
   - Smaller file sizes
   - Faster exports

5. **Attachment Files**
   - Include actual attachment files in export
   - Restore attachment files on import
   - Larger ZIP files with complete data

6. **Data Transformation**
   - Import from other ticketing systems
   - Export to other formats
   - Data mapping tools

7. **Encryption**
   - Encrypt export files
   - Password-protected downloads
   - Enhanced security

## Testing Checklist

- [x] Export with all data types
- [x] Export with date filters
- [x] Export with selective data types
- [x] Download exported file
- [x] Import valid file
- [x] Import with skip duplicates
- [x] Import with overwrite existing
- [x] Import validation only
- [x] View export history
- [x] View import history
- [x] File expiration (24 hours)
- [x] Cleanup old exports
- [x] Error handling
- [x] Permission checks

## Status

✅ **COMPLETE** - Full data export/import system implemented
- Backend services: ✅
- API routes: ✅
- Database migrations: ✅
- Frontend UI: ✅
- Documentation: ✅
- Testing: ✅

Customers now have a complete, user-friendly system to backup and restore their data!
