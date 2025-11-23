#!/bin/bash

# Nuclear database reset - drops and recreates everything
echo "🚨 NUCLEAR RESET: Dropping and recreating database..."

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

DB_NAME=${DB_NAME:-bomizzel_db}
DB_USER=${DB_USER:-bomizzel_user}
DB_PASSWORD=${DB_PASSWORD:-bomizzel_password}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Drop and recreate database
echo "Dropping database $DB_NAME..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "Creating database $DB_NAME..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "Running migrations..."
npm run migrate

echo "Seeding database..."
npm run seed

echo "✅ Nuclear reset complete!"
