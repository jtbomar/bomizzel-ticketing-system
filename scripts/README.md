# Development Scripts

This directory contains scripts to help with development environment setup and maintenance.

## Scripts Overview

### Setup Scripts
- **`setup-dev.sh`** - Linux/macOS development environment setup
- **`setup-dev.ps1`** - Windows PowerShell development environment setup
- **`reset-dev.sh`** - Reset development environment to clean state
- **`health-check.sh`** - Check health of all development services

### Usage

#### Initial Setup (Linux/macOS)
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run setup
./scripts/setup-dev.sh
```

#### Initial Setup (Windows)
```powershell
# Run setup
.\scripts\setup-dev.ps1
```

#### Health Check
```bash
# Linux/macOS
./scripts/health-check.sh

# Windows (using Git Bash or WSL)
bash scripts/health-check.sh
```

#### Reset Environment
```bash
# Linux/macOS
./scripts/reset-dev.sh

# Windows (using Git Bash or WSL)
bash scripts/reset-dev.sh
```

## What the Setup Script Does

1. **System Requirements Check**
   - Verifies Node.js 18+ is installed
   - Verifies npm 9+ is installed
   - Verifies Docker and Docker Compose are available

2. **Dependency Installation**
   - Installs all npm dependencies for the monorepo

3. **Environment Configuration**
   - Creates `.env` files for backend and frontend with development defaults
   - Configures database connection strings
   - Sets up JWT secrets (change for production!)
   - Configures CORS and API endpoints

4. **Database Setup**
   - Starts PostgreSQL and Redis containers
   - Runs database migrations
   - Seeds database with initial development data

5. **Directory Structure**
   - Creates necessary directories for logs, uploads, and temporary files

## Environment Variables

### Backend (.env)
- **Database**: PostgreSQL connection settings
- **Redis**: Cache and session storage settings
- **JWT**: Authentication token configuration
- **Server**: Port and CORS settings
- **Email**: SMTP configuration for development
- **Files**: Upload directory and size limits
- **Security**: Rate limiting and logging settings

### Frontend (.env)
- **API**: Backend API base URL
- **WebSocket**: Real-time connection URL
- **Environment**: Development mode settings
- **Features**: Debug and development flags

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Stop existing services: `npm run docker:down`
   - Check for running Node.js processes: `ps aux | grep node`

2. **Database Connection Failed**
   - Ensure Docker is running
   - Wait for containers to be healthy: `docker-compose ps`
   - Check logs: `docker-compose logs postgres`

3. **Permission Denied (Linux/macOS)**
   - Make scripts executable: `chmod +x scripts/*.sh`

4. **Node.js Version Issues**
   - Use Node Version Manager (nvm) to install Node.js 18+
   - Verify version: `node --version`

### Health Check Interpretation

The health check script provides status for:
- ✅ Service is running and healthy
- ⚠️ Service is running but may have issues
- ❌ Service is not running or not responding
- ℹ️ Informational message (optional services or unavailable checks)

### Reset When Needed

Use the reset script when:
- Dependencies are corrupted
- Database is in an inconsistent state
- Docker volumes need to be recreated
- Starting fresh after major changes

## Development Workflow

1. **Initial Setup**: Run setup script once
2. **Daily Development**: `npm run dev`
3. **Health Checks**: Run health check if issues arise
4. **Clean Reset**: Use reset script for major issues
5. **Database Changes**: `npm run db:migrate` and `npm run db:seed`

## Production Notes

⚠️ **Important**: These scripts are for development only!

For production deployment:
- Use proper environment variables
- Use managed database services
- Implement proper security measures
- Use production-grade secrets
- Configure proper logging and monitoring