#!/bin/bash
# Database backup script
# Usage: ./scripts/db-backup.sh [optional-backup-name]

CONTAINER="bomizzel-postgres"
DB_USER="bomizzel_user"
DB_NAME="bomizzel_db"
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${1:-backup_$TIMESTAMP}"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "📦 Creating database backup..."
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_DIR/${BACKUP_NAME}.sql"

# Create backup
docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/${BACKUP_NAME}.sql"

if [ $? -eq 0 ]; then
  # Get file size
  SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.sql" | cut -f1)
  echo "✅ Backup created successfully!"
  echo "📁 Location: $BACKUP_DIR/${BACKUP_NAME}.sql"
  echo "📊 Size: $SIZE"
  
  # Compress backup
  echo "🗜️  Compressing backup..."
  gzip "$BACKUP_DIR/${BACKUP_NAME}.sql"
  COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.sql.gz" | cut -f1)
  echo "✅ Compressed to: $BACKUP_DIR/${BACKUP_NAME}.sql.gz"
  echo "📊 Compressed size: $COMPRESSED_SIZE"
  
  # List recent backups
  echo ""
  echo "📋 Recent backups:"
  ls -lh $BACKUP_DIR/*.sql.gz 2>/dev/null | tail -5
else
  echo "❌ Backup failed!"
  exit 1
fi
