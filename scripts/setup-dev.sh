#!/bin/bash

# Bomizzel Ticketing System - Development Environment Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Bomizzel Ticketing System Development Environment"
echo "=============================================================="

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_NODE_VERSION="18.0.0"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and npm 9+"
    exit 1
fi

# Simple version comparison
if [[ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+"
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION is compatible"

# Check npm version
echo "📋 Checking npm version..."
NPM_VERSION=$(npm --version)
REQUIRED_NPM_VERSION="9.0.0"

if [[ "$(printf '%s\n' "$REQUIRED_NPM_VERSION" "$NPM_VERSION" | sort -V | head -n1)" != "$REQUIRED_NPM_VERSION" ]]; then
    echo "❌ npm version $NPM_VERSION is too old. Please upgrade to npm 9+"
    exit 1
fi

echo "✅ npm version $NPM_VERSION is compatible"

# Check Docker
echo "📋 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker and Docker Compose"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose"
    exit 1
fi

echo "✅ Docker is available"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up environment files
echo "🔧 Setting up environment files..."

# Backend environment
if [ ! -f "packages/backend/.env" ]; then
    echo "Creating backend .env file..."
    cat > packages/backend/.env << EOF
# Database Configuration
DATABASE_URL=postgresql://bomizzel_user:bomizzel_password@localhost:5432/bomizzel_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bomizzel_db
DB_USER=bomizzel_user
DB_PASSWORD=bomizzel_password

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Email Configuration (for development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@bomizzel.com

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,txt

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
LOG_FILE=logs/app.log
EOF
    echo "✅ Created backend .env file"
else
    echo "✅ Backend .env file already exists"
fi

# Frontend environment
if [ ! -f "packages/frontend/.env" ]; then
    echo "Creating frontend .env file..."
    cat > packages/frontend/.env << EOF
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000

# Environment
VITE_NODE_ENV=development

# Feature Flags
VITE_ENABLE_DEBUG=true
VITE_ENABLE_MOCK_DATA=false
EOF
    echo "✅ Created frontend .env file"
else
    echo "✅ Frontend .env file already exists"
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if services are healthy
echo "🔍 Checking service health..."
if ! docker-compose ps | grep -q "healthy"; then
    echo "⚠️  Services may not be fully ready. Continuing anyway..."
fi

# Run database migrations
echo "🗄️  Running database migrations..."
npm run db:migrate

# Seed database
echo "🌱 Seeding database with initial data..."
npm run db:seed

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p packages/backend/logs
mkdir -p packages/backend/uploads
mkdir -p packages/backend/temp

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start the development servers: npm run dev"
echo "   2. Open your browser to:"
echo "      - Frontend: http://localhost:3000"
echo "      - Backend API: http://localhost:5000"
echo "      - pgAdmin (optional): http://localhost:8080"
echo ""
echo "🔧 Useful commands:"
echo "   - npm run dev              # Start both frontend and backend"
echo "   - npm run docker:up        # Start database services"
echo "   - npm run docker:down      # Stop database services"
echo "   - npm run test             # Run all tests"
echo "   - npm run db:migrate       # Run database migrations"
echo "   - npm run db:seed          # Seed database"
echo ""
echo "📚 Documentation:"
echo "   - API docs: packages/backend/docs/"
echo "   - Frontend docs: packages/frontend/docs/"
echo "   - Specs: .kiro/specs/"