# User Guide: Data Backup & Restore

## For Customers: How to Backup and Restore Your Data

### What Can You Backup?

Your Bomizzel account includes all your important data:
- **Users**: All team members with their roles and settings
- **Tickets**: All support tickets with complete history
- **Notes**: All comments and internal notes on tickets
- **Attachments**: Information about all uploaded files
- **Custom Fields**: Your custom field configurations

### How to Create a Backup

1. **Log in** to your Bomizzel account
2. **Navigate** to Settings > Data Management
3. **Select** what you want to backup:
   - ✓ Include Users
   - ✓ Include Tickets
   - ✓ Include Attachments
   - ✓ Include Custom Fields
4. **(Optional)** Set date range for tickets
5. **Click** "Export Data"
6. **Wait** for the export to complete (usually 10-30 seconds)
7. **Download** the ZIP file
8. **Store** the file in a safe location

**Important**: Download links expire after 24 hours!

### How to Restore from Backup

1. **Log in** to your Bomizzel account
2. **Navigate** to Settings > Data Management
3. **Click** the "Import" tab
4. **Select** your backup file (JSON or ZIP)
5. **Choose** import options:
   - Skip Duplicates (recommended for first-time import)
   - Overwrite Existing (use carefully!)
   - Validate Only (test before importing)
6. **Click** "Import Data"
7. **Review** the import summary

### Best Practices

#### Regular Backups
- **Weekly**: For active companies with many tickets
- **Monthly**: For smaller companies
- **Before Major Changes**: Always backup before:
  - Bulk deletions
  - Major configuration changes
  - System migrations

#### Storage
- Keep at least 3 recent backups
- Store backups in multiple locations:
  - Local computer
  - Cloud storage (Google Drive, Dropbox)
  - External hard drive

#### Testing
- Test your backups occasionally
- Use "Validate Only" to check backup files
- Keep a test account for restore testing

### Common Scenarios

#### Scenario 1: Weekly Backup
```
Every Monday morning:
1. Go to Data Management
2. Export all data
3. Download the file
4. Upload to Google Drive
5. Delete backups older than 3 months
```

#### Scenario 2: Accidental Deletion
```
If you accidentally delete important data:
1. Find your most recent backup
2. Go to Data Management > Import
3. Select "Validate Only" first
4. Review what will be imported
5. Uncheck "Validate Only"
6. Select "Skip Duplicates"
7. Import the data
```

#### Scenario 3: Moving to New Account
```
To move data to a new Bomizzel account:
1. Export from old account
2. Download the backup file
3. Log in to new account
4. Import the backup file
5. Users will need to reset passwords
```

### Understanding Import Options

#### Skip Duplicates (Recommended)
- **What it does**: Ignores records that already exist
- **When to use**: Most imports, especially restores
- **Example**: If user john@example.com exists, skip importing them

#### Overwrite Existing
- **What it does**: Updates existing records with imported data
- **When to use**: When you want to update existing records
- **Example**: Update user preferences from backup

#### Validate Only
- **What it does**: Checks the file without importing
- **When to use**: Before every import to check for errors
- **Example**: Make sure backup file is valid before importing

### What Gets Imported

#### Users
- ✅ Email, name, phone
- ✅ Role and permissions
- ✅ Preferences and settings
- ❌ Passwords (users must reset)

#### Tickets
- ✅ Title, description, status
- ✅ Priority, category
- ✅ All notes and comments
- ✅ Custom field values
- ✅ Assignment information

#### Custom Fields
- ✅ Field names and types
- ✅ Options (for picklists)
- ✅ Required/optional settings
- ✅ Display order

#### Attachments
- ✅ File names and sizes
- ✅ Upload information
- ❌ Actual files (metadata only)

### Troubleshooting

#### "Export file not found or has expired"
- **Problem**: Download link expired (24 hours)
- **Solution**: Create a new export

#### "Failed to import user: Email already exists"
- **Problem**: User already in system
- **Solution**: Enable "Skip Duplicates" or "Overwrite Existing"

#### "Invalid import data"
- **Problem**: Corrupted or wrong file format
- **Solution**: Use "Validate Only" to check file, or create new export

#### "Permission denied"
- **Problem**: Not authorized to export/import
- **Solution**: Contact your account administrator

### View Your History

The History tab shows:
- **Recent Exports**: When, who, and what was exported
- **Recent Imports**: When, who, and what was imported

This helps you:
- Track backup activity
- See who made changes
- Find specific exports

### Security & Privacy

#### Your Data is Safe
- ✅ Only you can access your company's data
- ✅ Export files are encrypted in transit
- ✅ Files automatically deleted after 24 hours
- ✅ All activity is logged

#### What's NOT Included
- ❌ Passwords (for security)
- ❌ Payment information
- ❌ Actual attachment files (only metadata)

### Need Help?

If you have questions or issues:
1. Check this guide first
2. Contact support: support@bomizzel.com
3. Include your export/import ID from the History tab

### Quick Reference

| Action | Location | Time |
|--------|----------|------|
| Create Backup | Data Management > Export | 10-30 sec |
| Download Backup | After export completes | Instant |
| Restore Data | Data Management > Import | 30-60 sec |
| View History | Data Management > History | Instant |

### Tips for Success

1. **Test First**: Always use "Validate Only" before importing
2. **Backup Regularly**: Set a schedule and stick to it
3. **Store Safely**: Keep backups in multiple locations
4. **Check History**: Review the History tab occasionally
5. **Download Quickly**: Don't wait - download links expire!

---

**Remember**: Your data is valuable. Regular backups protect you from:
- Accidental deletions
- System issues
- User errors
- Data corruption

Take 5 minutes each week to create a backup. Your future self will thank you!
