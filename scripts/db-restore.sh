#!/bin/bash

# Bomizzel Ticketing System - Database Restore Script
# This script restores PostgreSQL database from backup files

set -e

# Configuration
BACKUP_DIR="backups/database"

# Database configuration (can be overridden by environment variables)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-bomizzel_db}
DB_USER=${DB_USER:-bomizzel_user}
DB_PASSWORD=${DB_PASSWORD:-bomizzel_password}

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <backup_file> [options]"
    echo ""
    echo "Options:"
    echo "  --drop-existing    Drop existing database before restore"
    echo "  --create-db        Create database if it doesn't exist"
    echo "  --no-owner         Skip ownership restoration"
    echo "  --clean            Clean (drop) database objects before recreating"
    echo ""
    echo "Examples:"
    echo "  $0 bomizzel_full_20231025_143022.sql.gz"
    echo "  $0 bomizzel_custom_20231025_143022.dump --drop-existing"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/bomizzel_* 2>/dev/null || echo "  No backups found in $BACKUP_DIR"
    exit 1
fi

BACKUP_FILE="$1"
shift

# Parse options
DROP_EXISTING=false
CREATE_DB=false
NO_OWNER=true
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --drop-existing)
            DROP_EXISTING=true
            shift
            ;;
        --create-db)
            CREATE_DB=true
            shift
            ;;
        --no-owner)
            NO_OWNER=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        *)
            echo "❌ Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try to find it in backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        echo "❌ Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

echo "🔄 Starting database restore..."
echo "============================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup File: $BACKUP_FILE"
echo "Drop Existing: $DROP_EXISTING"
echo "Create DB: $CREATE_DB"

# Set PGPASSWORD for non-interactive operations
export PGPASSWORD="$DB_PASSWORD"

# Function to check if database exists
database_exists() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        --no-password \
        -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1
}

# Function to drop database
drop_database() {
    echo "🗑️ Dropping existing database..."
    
    # Terminate existing connections
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        --no-password \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
        > /dev/null 2>&1 || true
    
    # Drop database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        --no-password \
        -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    echo "✅ Database dropped"
}

# Function to create database
create_database() {
    echo "🏗️ Creating database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        --no-password \
        -c "CREATE DATABASE $DB_NAME;"
    echo "✅ Database created"
}

# Function to restore from SQL file
restore_sql_file() {
    local file="$1"
    
    echo "📥 Restoring from SQL file..."
    
    if [[ "$file" == *.gz ]]; then
        echo "🗜️ Decompressing and restoring..."
        gunzip -c "$file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password \
            --quiet
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password \
            --quiet \
            -f "$file"
    fi
    
    echo "✅ SQL restore completed"
}

# Function to restore from custom format
restore_custom_file() {
    local file="$1"
    local options=""
    
    echo "📥 Restoring from custom format..."
    
    if [ "$NO_OWNER" = true ]; then
        options="$options --no-owner --no-privileges"
    fi
    
    if [ "$CLEAN" = true ]; then
        options="$options --clean"
    fi
    
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password \
        --verbose \
        $options \
        "$file"
    
    echo "✅ Custom format restore completed"
}

# Function to verify restore
verify_restore() {
    echo "🔍 Verifying restore..."
    
    # Check if database is accessible
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password \
        -c "SELECT 1;" > /dev/null 2>&1; then
        echo "❌ Database is not accessible after restore"
        return 1
    fi
    
    # Count tables
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password \
        -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    echo "📊 Tables restored: $table_count"
    
    # Check if migration table exists and get version
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password \
        -tAc "SELECT 1 FROM information_schema.tables WHERE table_name = 'knex_migrations';" | grep -q 1; then
        
        local migration_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password \
            -tAc "SELECT COUNT(*) FROM knex_migrations;")
        
        echo "📋 Migrations applied: $migration_count"
        
        local latest_migration=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password \
            -tAc "SELECT name FROM knex_migrations ORDER BY id DESC LIMIT 1;")
        
        echo "🔄 Latest migration: $latest_migration"
    fi
    
    echo "✅ Restore verification completed"
}

# Function to create restore point
create_restore_point() {
    if database_exists; then
        echo "💾 Creating restore point before restore..."
        local restore_point_file="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql"
        
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password \
            --format=plain \
            --no-owner \
            --no-privileges \
            > "$restore_point_file"
        
        gzip "$restore_point_file"
        echo "✅ Restore point created: $restore_point_file.gz"
    fi
}

# Main restore logic
echo "🔍 Checking current database state..."

if database_exists; then
    echo "ℹ️ Database $DB_NAME already exists"
    
    if [ "$DROP_EXISTING" = true ]; then
        create_restore_point
        drop_database
        create_database
    fi
else
    echo "ℹ️ Database $DB_NAME does not exist"
    
    if [ "$CREATE_DB" = true ]; then
        create_database
    else
        echo "❌ Database does not exist and --create-db not specified"
        exit 1
    fi
fi

# Determine backup file type and restore
echo "🔍 Analyzing backup file..."
if [[ "$BACKUP_FILE" == *.dump ]]; then
    echo "📦 Custom format backup detected"
    restore_custom_file "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *.sql* ]]; then
    echo "📄 SQL format backup detected"
    restore_sql_file "$BACKUP_FILE"
else
    echo "❌ Unknown backup file format"
    exit 1
fi

# Verify restore
verify_restore

# Get database size after restore
echo "📏 Database size after restore:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-password \
    -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as database_size;" \
    -t -A

echo ""
echo "🎉 Database restore completed successfully!"
echo "📁 Restored from: $BACKUP_FILE"
echo ""
echo "💡 Next steps:"
echo "   1. Verify application connectivity"
echo "   2. Run any pending migrations if needed: npm run db:migrate"
echo "   3. Test critical functionality"

# Unset password
unset PGPASSWORD