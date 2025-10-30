#!/bin/bash

# Bomizzel Ticketing System - Development Environment Reset Script
# This script resets the development environment to a clean state

set -e

echo "🔄 Resetting Bomizzel Ticketing System Development Environment"
echo "============================================================="

# Stop all running services
echo "🛑 Stopping all services..."
docker-compose down -v

# Clean up Docker volumes and containers
echo "🧹 Cleaning up Docker resources..."
docker-compose down --volumes --remove-orphans

# Remove node_modules and reinstall
echo "📦 Cleaning and reinstalling dependencies..."
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/dist
rm -rf packages/*/build
npm install

# Clean up generated files
echo "🗑️  Cleaning up generated files..."
rm -rf packages/backend/logs/*
rm -rf packages/backend/uploads/*
rm -rf packages/backend/temp/*
rm -rf packages/frontend/dist/*

# Recreate directories
echo "📁 Recreating directories..."
mkdir -p packages/backend/logs
mkdir -p packages/backend/uploads
mkdir -p packages/backend/temp

# Start fresh Docker services
echo "🐳 Starting fresh Docker services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 15

# Reset database
echo "🗄️  Resetting database..."
npm run migrate:rollback --workspace=backend || true
npm run db:migrate
npm run db:seed

echo ""
echo "✅ Development environment reset complete!"
echo ""
echo "🚀 You can now start development with: npm run dev"