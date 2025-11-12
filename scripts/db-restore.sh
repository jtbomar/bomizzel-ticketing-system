#!/bin/bash
# Database restore script
# Usage: ./scripts/db-restore.sh [backup-file]

CONTAINER="bomizzel-postgres"
DB_USER="bomizzel_user"
DB_NAME="bomizzel_db"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file required"
  echo ""
  echo "Usage: ./scripts/db-restore.sh [backup-file]"
  echo ""
  echo "Available backups:"
  ls -lh backups/*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  WARNING: This will replace all data in the database!"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

# Check if file is compressed
if [[ $BACKUP_FILE == *.gz ]]; then
  echo "📦 Decompressing backup..."
  TEMP_FILE="${BACKUP_FILE%.gz}"
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  RESTORE_FILE="$TEMP_FILE"
  CLEANUP_TEMP=true
else
  RESTORE_FILE="$BACKUP_FILE"
  CLEANUP_TEMP=false
fi

echo "🔄 Restoring database..."

# Drop and recreate database
docker exec -it $CONTAINER psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec -it $CONTAINER psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
cat "$RESTORE_FILE" | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME

if [ $? -eq 0 ]; then
  echo "✅ Database restored successfully!"
  
  # Cleanup temp file if created
  if [ "$CLEANUP_TEMP" = true ]; then
    rm "$TEMP_FILE"
  fi
else
  echo "❌ Restore failed!"
  exit 1
fi
