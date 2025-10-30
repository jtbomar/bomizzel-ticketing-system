# Bomizzel Ticketing System - Development Environment Setup Script (PowerShell)
# This script sets up the complete development environment on Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Bomizzel Ticketing System Development Environment" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green

# Check Node.js version
Write-Host "📋 Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $nodeVersionNumber = $nodeVersion.Substring(1)
    $requiredVersion = [Version]"18.0.0"
    $currentVersion = [Version]$nodeVersionNumber
    
    if ($currentVersion -lt $requiredVersion) {
        Write-Host "❌ Node.js version $nodeVersionNumber is too old. Please upgrade to Node.js 18+" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js version $nodeVersionNumber is compatible" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ and npm 9+" -ForegroundColor Red
    exit 1
}

# Check npm version
Write-Host "📋 Checking npm version..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    $requiredNpmVersion = [Version]"9.0.0"
    $currentNpmVersion = [Version]$npmVersion
    
    if ($currentNpmVersion -lt $requiredNpmVersion) {
        Write-Host "❌ npm version $npmVersion is too old. Please upgrade to npm 9+" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ npm version $npmVersion is compatible" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not available" -ForegroundColor Red
    exit 1
}

# Check Docker
Write-Host "📋 Checking Docker..." -ForegroundColor Yellow
try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
    Write-Host "✅ Docker is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker or Docker Compose is not installed. Please install Docker Desktop" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Set up environment files
Write-Host "🔧 Setting up environment files..." -ForegroundColor Yellow

# Backend environment
if (-not (Test-Path "packages/backend/.env")) {
    Write-Host "Creating backend .env file..." -ForegroundColor Cyan
    @"
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
"@ | Out-File -FilePath "packages/backend/.env" -Encoding UTF8
    Write-Host "✅ Created backend .env file" -ForegroundColor Green
} else {
    Write-Host "✅ Backend .env file already exists" -ForegroundColor Green
}

# Frontend environment
if (-not (Test-Path "packages/frontend/.env")) {
    Write-Host "Creating frontend .env file..." -ForegroundColor Cyan
    @"
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000

# Environment
VITE_NODE_ENV=development

# Feature Flags
VITE_ENABLE_DEBUG=true
VITE_ENABLE_MOCK_DATA=false
"@ | Out-File -FilePath "packages/frontend/.env" -Encoding UTF8
    Write-Host "✅ Created frontend .env file" -ForegroundColor Green
} else {
    Write-Host "✅ Frontend .env file already exists" -ForegroundColor Green
}

# Start Docker services
Write-Host "🐳 Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Run database migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Yellow
npm run db:migrate

# Seed database
Write-Host "🌱 Seeding database with initial data..." -ForegroundColor Yellow
npm run db:seed

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "packages/backend/logs" | Out-Null
New-Item -ItemType Directory -Force -Path "packages/backend/uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "packages/backend/temp" | Out-Null

Write-Host ""
Write-Host "🎉 Development environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Start the development servers: npm run dev"
Write-Host "   2. Open your browser to:"
Write-Host "      - Frontend: http://localhost:3000"
Write-Host "      - Backend API: http://localhost:5000"
Write-Host "      - pgAdmin (optional): http://localhost:8080"
Write-Host ""
Write-Host "🔧 Useful commands:" -ForegroundColor Cyan
Write-Host "   - npm run dev              # Start both frontend and backend"
Write-Host "   - npm run docker:up        # Start database services"
Write-Host "   - npm run docker:down      # Stop database services"
Write-Host "   - npm run test             # Run all tests"
Write-Host "   - npm run db:migrate       # Run database migrations"
Write-Host "   - npm run db:seed          # Seed database"
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - API docs: packages/backend/docs/"
Write-Host "   - Frontend docs: packages/frontend/docs/"
Write-Host "   - Specs: .kiro/specs/"