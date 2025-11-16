#!/bin/bash

# Script to run migrations on Railway production database
# This will connect to your Railway PostgreSQL and run the new migrations

echo "🚀 Running migrations on Railway production database..."
echo ""
echo "This will:"
echo "  1. Rename 'employee' role to 'agent' in users table"
echo "  2. Rename 'employee' queue type to 'agent' in queues table"
echo ""

# Run migrations using Railway CLI
cd packages/backend
railway run npm run migrate

echo ""
echo "✅ Migrations complete!"
echo ""
echo "Your production database now uses 'agent' instead of 'employee'"
