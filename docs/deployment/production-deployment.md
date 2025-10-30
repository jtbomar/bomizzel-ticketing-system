# Production Deployment Guide

This guide covers the complete process for deploying the Bomizzel Ticketing System to production.

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04 LTS or CentOS 8+
- **CPU**: Minimum 4 cores (8 cores recommended)
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: Minimum 100GB SSD (500GB recommended)
- **Network**: Stable internet connection with static IP

### Software Requirements
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Node.js**: Version 18+ (for build process)
- **PostgreSQL**: Version 15+ (managed service recommended)
- **Redis**: Version 7+ (managed service recommended)
- **Nginx**: Version 1.20+ (for reverse proxy)

### Access Requirements
- **SSH Access**: To production servers
- **Database Access**: Connection credentials for PostgreSQL
- **DNS Management**: Ability to configure DNS records
- **SSL Certificates**: Valid SSL certificates for HTTPS
- **Monitoring Access**: Access to monitoring systems

## Pre-Deployment Checklist

### Code and Testing
- [ ] All tests passing (unit, integration, e2e)
- [ ] Security scan completed and vulnerabilities addressed
- [ ] Performance tests passed with acceptable results
- [ ] Code review completed and approved
- [ ] Release notes prepared

### Infrastructure
- [ ] Production servers provisioned and configured
- [ ] Database server ready with proper configuration
- [ ] Redis server ready and accessible
- [ ] Load balancer configured
- [ ] SSL certificates installed and valid
- [ ] DNS records configured
- [ ] Monitoring systems configured

### Security
- [ ] Security hardening completed on all servers
- [ ] Firewall rules configured
- [ ] VPN access configured for team members
- [ ] Backup encryption keys secured
- [ ] Access controls reviewed and updated

### Data and Backups
- [ ] Database backup strategy implemented
- [ ] File storage backup configured
- [ ] Disaster recovery plan tested
- [ ] Data migration scripts tested (if applicable)

## Deployment Architecture

### Production Environment Layout
```
Internet
    │
    ▼
┌─────────────────┐
│  Load Balancer  │ (AWS ALB / Nginx)
│   (SSL Term)    │
└─────────────────┘
    │
    ▼
┌─────────────────┐    ┌─────────────────┐
│   Web Server    │    │   Web Server    │
│   (Frontend)    │    │   (Frontend)    │
│   Port 3000     │    │   Port 3000     │
└─────────────────┘    └─────────────────┘
    │                      │
    ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│   API Server    │    │   API Server    │
│   (Backend)     │    │   (Backend)     │
│   Port 5000     │    │   Port 5000     │
└─────────────────┘    └─────────────────┘
    │                      │
    └──────────┬───────────┘
               ▼
    ┌─────────────────┐    ┌─────────────────┐
    │   PostgreSQL    │    │     Redis       │
    │   (Database)    │    │    (Cache)      │
    │   Port 5432     │    │   Port 6379     │
    └─────────────────┘    └─────────────────┘
```

## Deployment Process

### Step 1: Prepare Production Environment

#### 1.1 Server Setup
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install additional tools
sudo apt install -y nginx certbot python3-certbot-nginx htop curl wget git
```

#### 1.2 Create Application User
```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash bomizzel
sudo usermod -aG docker bomizzel

# Create application directories
sudo mkdir -p /opt/bomizzel
sudo chown bomizzel:bomizzel /opt/bomizzel
```

#### 1.3 Configure Firewall
```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### Step 2: Deploy Application Code

#### 2.1 Clone Repository
```bash
# Switch to application user
sudo su - bomizzel

# Clone repository
cd /opt/bomizzel
git clone https://github.com/your-org/bomizzel-ticketing-system.git
cd bomizzel-ticketing-system

# Checkout specific release tag
git checkout v1.0.0
```

#### 2.2 Build Application
```bash
# Install dependencies
npm ci

# Build applications
npm run build

# Verify build artifacts
ls -la packages/backend/dist/
ls -la packages/frontend/dist/
```

### Step 3: Configure Environment

#### 3.1 Create Production Environment Files
```bash
# Backend environment
cat > packages/backend/.env << EOF
# Database Configuration
DATABASE_URL=postgresql://bomizzel_user:SECURE_PASSWORD@db.bomizzel.com:5432/bomizzel_prod
DB_HOST=db.bomizzel.com
DB_PORT=5432
DB_NAME=bomizzel_prod
DB_USER=bomizzel_user
DB_PASSWORD=SECURE_PASSWORD

# Redis Configuration
REDIS_URL=redis://redis.bomizzel.com:6379
REDIS_HOST=redis.bomizzel.com
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=SUPER_SECURE_JWT_SECRET_CHANGE_THIS
JWT_REFRESH_SECRET=SUPER_SECURE_REFRESH_SECRET_CHANGE_THIS
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://bomizzel.com

# Email Configuration
SMTP_HOST=smtp.bomizzel.com
SMTP_PORT=587
SMTP_USER=noreply@bomizzel.com
SMTP_PASS=SECURE_SMTP_PASSWORD
SMTP_FROM=noreply@bomizzel.com

# File Upload Configuration
UPLOAD_DIR=/opt/bomizzel/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,txt

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=/opt/bomizzel/logs/app.log

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
EOF

# Frontend environment
cat > packages/frontend/.env << EOF
# API Configuration
VITE_API_BASE_URL=https://api.bomizzel.com/api
VITE_WS_URL=https://api.bomizzel.com

# Environment
VITE_NODE_ENV=production

# Feature Flags
VITE_ENABLE_DEBUG=false
VITE_ENABLE_MOCK_DATA=false
EOF
```

#### 3.2 Create Production Docker Compose
```bash
cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    container_name: bomizzel-backend-prod
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - packages/backend/.env
    volumes:
      - /opt/bomizzel/uploads:/app/uploads
      - /opt/bomizzel/logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    container_name: bomizzel-frontend-prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - packages/frontend/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      - backend

networks:
  default:
    name: bomizzel-prod-network

volumes:
  uploads:
  logs:
EOF
```

### Step 4: Database Setup

#### 4.1 Run Database Migrations
```bash
# Create database backup directory
mkdir -p /opt/bomizzel/backups/database

# Run migrations
npm run migrate --workspace=backend

# Verify migration status
npx knex migrate:status --knexfile packages/backend/knexfile.js
```

#### 4.2 Seed Initial Data (if needed)
```bash
# Run seeds for production data
npm run seed --workspace=backend
```

### Step 5: Deploy Application

#### 5.1 Start Services
```bash
# Create necessary directories
mkdir -p /opt/bomizzel/uploads
mkdir -p /opt/bomizzel/logs

# Start application services
docker-compose -f docker-compose.prod.yml up -d

# Verify services are running
docker-compose -f docker-compose.prod.yml ps
```

#### 5.2 Verify Deployment
```bash
# Check application health
curl -f http://localhost:5000/api/health
curl -f http://localhost:3000/health

# Check logs
docker-compose -f docker-compose.prod.yml logs backend --tail=50
docker-compose -f docker-compose.prod.yml logs frontend --tail=50
```

### Step 6: Configure Reverse Proxy

#### 6.1 Nginx Configuration
```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/bomizzel.com << EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name bomizzel.com www.bomizzel.com api.bomizzel.com;
    return 301 https://\$server_name\$request_uri;
}

# Frontend (bomizzel.com)
server {
    listen 443 ssl http2;
    server_name bomizzel.com www.bomizzel.com;

    ssl_certificate /etc/letsencrypt/live/bomizzel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bomizzel.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Backend API (api.bomizzel.com)
server {
    listen 443 ssl http2;
    server_name api.bomizzel.com;

    ssl_certificate /etc/letsencrypt/live/bomizzel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bomizzel.com/privkey.pem;
    
    # SSL configuration (same as above)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/bomizzel.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6.2 SSL Certificate Setup
```bash
# Obtain SSL certificates
sudo certbot --nginx -d bomizzel.com -d www.bomizzel.com -d api.bomizzel.com

# Set up automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Step 7: Configure Monitoring

#### 7.1 Set up Monitoring Stack
```bash
# Copy monitoring configuration
cp -r monitoring/ /opt/bomizzel/

# Start monitoring services
cd /opt/bomizzel
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Verify monitoring services
curl -f http://localhost:9090  # Prometheus
curl -f http://localhost:3001  # Grafana
```

#### 7.2 Configure Alerts
```bash
# Update AlertManager configuration with production contacts
# Edit monitoring/alertmanager/alertmanager.yml
# Update email addresses, Slack webhooks, PagerDuty keys
```

### Step 8: Set up Automated Backups

#### 8.1 Database Backup Cron Job
```bash
# Create backup script
sudo tee /opt/bomizzel/scripts/backup-cron.sh << EOF
#!/bin/bash
cd /opt/bomizzel/bomizzel-ticketing-system
./scripts/db-backup.sh custom
EOF

sudo chmod +x /opt/bomizzel/scripts/backup-cron.sh

# Add to crontab
sudo crontab -e
# Add: 0 2 * * * /opt/bomizzel/scripts/backup-cron.sh
```

#### 8.2 File Backup Setup
```bash
# Set up file backup (example with rsync)
sudo tee /opt/bomizzel/scripts/file-backup.sh << EOF
#!/bin/bash
rsync -av --delete /opt/bomizzel/uploads/ backup-server:/backups/bomizzel/uploads/
rsync -av --delete /opt/bomizzel/logs/ backup-server:/backups/bomizzel/logs/
EOF

sudo chmod +x /opt/bomizzel/scripts/file-backup.sh

# Add to crontab
# Add: 0 3 * * * /opt/bomizzel/scripts/file-backup.sh
```

## Post-Deployment Verification

### Functional Testing
```bash
# Test user registration
curl -X POST https://api.bomizzel.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","firstName":"Test","lastName":"User"}'

# Test login
curl -X POST https://api.bomizzel.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Test ticket creation
curl -X POST https://api.bomizzel.com/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Test Ticket","description":"Test description"}'
```

### Performance Testing
```bash
# Run basic load test
ab -n 1000 -c 10 https://bomizzel.com/
ab -n 1000 -c 10 https://api.bomizzel.com/api/health
```

### Security Testing
```bash
# Test SSL configuration
curl -I https://bomizzel.com
curl -I https://api.bomizzel.com

# Test security headers
curl -I https://bomizzel.com | grep -i security
```

## Rollback Procedures

### Application Rollback
```bash
# Stop current services
docker-compose -f docker-compose.prod.yml down

# Checkout previous version
git checkout v0.9.0

# Rebuild and restart
npm run build
docker-compose -f docker-compose.prod.yml up -d
```

### Database Rollback
```bash
# Restore from backup
./scripts/db-restore.sh /opt/bomizzel/backups/database/latest_backup.dump --drop-existing
```

## Maintenance Procedures

### Regular Maintenance Tasks
- **Daily**: Check application logs and monitoring alerts
- **Weekly**: Review performance metrics and error rates
- **Monthly**: Update system packages and security patches
- **Quarterly**: Review and test disaster recovery procedures

### Update Procedures
1. **Test updates in staging environment**
2. **Schedule maintenance window**
3. **Create backup before update**
4. **Deploy updates using blue-green deployment**
5. **Verify functionality after update**
6. **Monitor for issues post-deployment**

## Troubleshooting

### Common Issues
- **Application won't start**: Check environment variables and dependencies
- **Database connection errors**: Verify database credentials and network connectivity
- **High memory usage**: Check for memory leaks and optimize queries
- **SSL certificate issues**: Verify certificate validity and renewal

### Log Locations
- **Application logs**: `/opt/bomizzel/logs/app.log`
- **Nginx logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Docker logs**: `docker-compose logs [service]`
- **System logs**: `/var/log/syslog`

## Support and Escalation

### Contact Information
- **DevOps Team**: ops@bomizzel.com
- **Development Team**: dev@bomizzel.com
- **Emergency**: +1-555-BOMIZZEL

### Documentation
- **API Documentation**: https://api.bomizzel.com/docs
- **Monitoring Dashboards**: https://monitoring.bomizzel.com
- **Status Page**: https://status.bomizzel.com