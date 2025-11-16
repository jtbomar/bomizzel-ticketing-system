#!/bin/bash

# Script to reseed the production database on Railway
# This will restore all test data including companies, customers, agents, etc.

echo "🔄 Reseeding production database..."
echo ""
echo "⚠️  WARNING: This will delete and recreate all test data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Connecting to Railway and running seed..."

# You'll need Railway CLI installed for this
# Install with: npm install -g @railway/cli

cd packages/backend

# Option 1: If you have Railway CLI
if command -v railway &> /dev/null; then
    echo "Using Railway CLI..."
    railway run npm run seed
else
    echo "❌ Railway CLI not found"
    echo ""
    echo "To reseed manually:"
    echo "1. Go to https://railway.app/dashboard"
    echo "2. Select your backend service"
    echo "3. Go to 'Settings' tab"
    echo "4. Click 'Deploy' → 'Run Command'"
    echo "5. Enter: npm run seed"
    echo "6. Click 'Run'"
fi

echo ""
echo "✅ Reseed complete!"
