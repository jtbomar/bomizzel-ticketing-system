#!/bin/bash

# Bomizzel Ticketing System - Database Backup Script
# This script creates backups of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR="backups/database"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30

# Database configuration (can be overridden by environment variables)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-bomizzel_db}
DB_USER=${DB_USER:-bomizzel_user}
DB_PASSWORD=${DB_PASSWORD:-bomizzel_password}

# Backup configuration
BACKUP_TYPE=${1:-full}  # full, schema, data
COMPRESS=${COMPRESS:-true}

echo "🗄️ Starting database backup..."
echo "============================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup Type: $BACKUP_TYPE"
echo "Timestamp: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Set PGPASSWORD for non-interactive backup
export PGPASSWORD="$DB_PASSWORD"

# Function to create full backup
create_full_backup() {
    local backup_file="$BACKUP_DIR/bomizzel_full_$TIMESTAMP.sql"
    
    echo "📦 Creating full database backup..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --no-password \
        --format=plain \
        --no-owner \
        --no-privileges \
        > "$backup_file"
    
    if [ "$COMPRESS" = "true" ]; then
        echo "🗜️ Compressing backup..."
        gzip "$backup_file"
        backup_file="$backup_file.gz"
    fi
    
    echo "✅ Full backup created: $backup_file"
    return 0
}

# Function to create schema-only backup
create_schema_backup() {
    local backup_file="$BACKUP_DIR/bomizzel_schema_$TIMESTAMP.sql"
    
    echo "📋 Creating schema-only backup..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --no-password \
        --format=plain \
        --schema-only \
        --no-owner \
        --no-privileges \
        > "$backup_file"
    
    if [ "$COMPRESS" = "true" ]; then
        echo "🗜️ Compressing backup..."
        gzip "$backup_file"
        backup_file="$backup_file.gz"
    fi
    
    echo "✅ Schema backup created: $backup_file"
    return 0
}

# Function to create data-only backup
create_data_backup() {
    local backup_file="$BACKUP_DIR/bomizzel_data_$TIMESTAMP.sql"
    
    echo "📊 Creating data-only backup..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --no-password \
        --format=plain \
        --data-only \
        --no-owner \
        --no-privileges \
        > "$backup_file"
    
    if [ "$COMPRESS" = "true" ]; then
        echo "🗜️ Compressing backup..."
        gzip "$backup_file"
        backup_file="$backup_file.gz"
    fi
    
    echo "✅ Data backup created: $backup_file"
    return 0
}

# Function to create custom format backup (for faster restore)
create_custom_backup() {
    local backup_file="$BACKUP_DIR/bomizzel_custom_$TIMESTAMP.dump"
    
    echo "🔧 Creating custom format backup..."
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        --no-owner \
        --no-privileges \
        --file="$backup_file"
    
    echo "✅ Custom backup created: $backup_file"
    return 0
}

# Function to verify backup
verify_backup() {
    local backup_file="$1"
    
    echo "🔍 Verifying backup integrity..."
    
    if [[ "$backup_file" == *.gz ]]; then
        if gzip -t "$backup_file"; then
            echo "✅ Compressed backup is valid"
        else
            echo "❌ Compressed backup is corrupted"
            return 1
        fi
    elif [[ "$backup_file" == *.dump ]]; then
        if pg_restore --list "$backup_file" > /dev/null 2>&1; then
            echo "✅ Custom format backup is valid"
        else
            echo "❌ Custom format backup is corrupted"
            return 1
        fi
    else
        if [ -s "$backup_file" ]; then
            echo "✅ Backup file exists and is not empty"
        else
            echo "❌ Backup file is empty or missing"
            return 1
        fi
    fi
    
    return 0
}

# Function to clean old backups
cleanup_old_backups() {
    echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -name "bomizzel_*" -type f -mtime +$RETENTION_DAYS -delete
    
    local remaining_count=$(find "$BACKUP_DIR" -name "bomizzel_*" -type f | wc -l)
    echo "📊 $remaining_count backup files remaining"
}

# Function to get database size
get_database_size() {
    echo "📏 Database size information:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password \
        -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as database_size;" \
        -t -A
}

# Main backup logic
case "$BACKUP_TYPE" in
    "full")
        get_database_size
        create_full_backup
        backup_file="$BACKUP_DIR/bomizzel_full_$TIMESTAMP.sql"
        [ "$COMPRESS" = "true" ] && backup_file="$backup_file.gz"
        verify_backup "$backup_file"
        ;;
    "schema")
        create_schema_backup
        backup_file="$BACKUP_DIR/bomizzel_schema_$TIMESTAMP.sql"
        [ "$COMPRESS" = "true" ] && backup_file="$backup_file.gz"
        verify_backup "$backup_file"
        ;;
    "data")
        create_data_backup
        backup_file="$BACKUP_DIR/bomizzel_data_$TIMESTAMP.sql"
        [ "$COMPRESS" = "true" ] && backup_file="$backup_file.gz"
        verify_backup "$backup_file"
        ;;
    "custom")
        get_database_size
        create_custom_backup
        backup_file="$BACKUP_DIR/bomizzel_custom_$TIMESTAMP.dump"
        verify_backup "$backup_file"
        ;;
    *)
        echo "❌ Invalid backup type: $BACKUP_TYPE"
        echo "Valid types: full, schema, data, custom"
        exit 1
        ;;
esac

# Cleanup old backups
cleanup_old_backups

# Get backup file size
if [ -f "$backup_file" ]; then
    backup_size=$(du -h "$backup_file" | cut -f1)
    echo "📦 Backup size: $backup_size"
fi

echo ""
echo "🎉 Database backup completed successfully!"
echo "📁 Backup location: $backup_file"
echo ""
echo "💡 Restore commands:"
if [[ "$backup_file" == *.gz ]]; then
    echo "   gunzip -c $backup_file | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
elif [[ "$backup_file" == *.dump ]]; then
    echo "   pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME $backup_file"
else
    echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < $backup_file"
fi

# Unset password
unset PGPASSWORD