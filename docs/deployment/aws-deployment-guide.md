# AWS Deployment Guide

This guide provides step-by-step instructions for deploying the Bomizzel Ticketing System to AWS.

## 🎯 **Recommended Architecture**

```
Internet Gateway
    │
    ▼
Application Load Balancer (ALB)
    │
    ├─── Frontend (ECS Fargate)
    └─── Backend API (ECS Fargate)
         │
         ├─── RDS PostgreSQL
         └─── ElastiCache Redis
```

## 📋 **Prerequisites**

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Docker installed locally
- Domain name (optional but recommended)

## 🚀 **Option 1: Quick EC2 Deployment (Fastest)**

### Step 1: Launch EC2 Instance

```bash
# Launch Ubuntu 22.04 LTS instance
# Instance type: t3.medium (minimum) or t3.large (recommended)
# Security Group: Allow ports 22, 80, 443
# Storage: 20GB minimum
```

### Step 2: Connect and Setup

```bash
# Connect to your instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js (for building)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Logout and login again for Docker permissions
exit
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### Step 3: Deploy Your Application

```bash
# Clone your repository
git clone https://github.com/your-username/bomizzel-ticketing-system.git
cd bomizzel-ticketing-system

# Create production environment files
cat > packages/backend/.env << EOF
# Database (using local PostgreSQL for now)
DATABASE_URL=postgresql://bomizzel:bomizzel123@localhost:5432/bomizzel
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bomizzel
DB_USER=bomizzel
DB_PASSWORD=bomizzel123

# Redis (using local Redis)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=production
CORS_ORIGIN=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000

# Basic email config (update with your SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
EOF

cat > packages/frontend/.env << EOF
# API Configuration (using EC2 public IP)
VITE_API_BASE_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5000/api
VITE_WS_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):5000

# Environment
VITE_NODE_ENV=production
VITE_ENABLE_DEBUG=false
VITE_ENABLE_MOCK_DATA=false
EOF

# Build the applications
npm ci
npm run build

# Start with Docker Compose (includes PostgreSQL and Redis)
docker-compose up -d

# Wait for services to start
sleep 30

# Run database migrations
npm run migrate --workspace=backend

# Check if everything is running
docker-compose ps
curl http://localhost:5000/api/health
curl http://localhost:3000
```

### Step 4: Access Your Application

```bash
# Get your EC2 public IP
curl -s http://169.254.169.254/latest/meta-data/public-ipv4

# Your application will be available at:
# Frontend: http://YOUR-EC2-IP:3000
# Backend API: http://YOUR-EC2-IP:5000/api
```

## 🏗️ **Option 2: Production AWS ECS Deployment**

### Step 1: Create AWS Resources

```bash
# Install AWS CLI if not already installed
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID, Secret Access Key, Region (e.g., us-east-1)
```

### Step 2: Create Infrastructure with CloudFormation

Create `aws-infrastructure.yml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Bomizzel Ticketing System Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]

Resources:
  # VPC and Networking
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-vpc

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-public-1

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-public-2

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.3.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-private-1

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.4.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-private-2

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-igw

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # Route Tables
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-public-rt

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: AttachGateway
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !Ref PublicRouteTable

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet2
      RouteTableId: !Ref PublicRouteTable

  # Security Groups
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Application Load Balancer
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0

  ECSSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for ECS tasks
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3000
          SourceSecurityGroupId: !Ref ALBSecurityGroup
        - IpProtocol: tcp
          FromPort: 5000
          ToPort: 5000
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for RDS database
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref ECSSecurityGroup

  # RDS Database
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS database
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-db-subnet-group

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub ${Environment}-bomizzel-db
      DBInstanceClass: db.t3.micro
      Engine: postgres
      EngineVersion: '15.4'
      MasterUsername: bomizzel
      MasterUserPassword: !Sub '{{resolve:secretsmanager:${Environment}-bomizzel-db-password:SecretString:password}}'
      AllocatedStorage: 20
      StorageType: gp2
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      BackupRetentionPeriod: 7
      MultiAZ: false
      PubliclyAccessible: false
      StorageEncrypted: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-database

  # ElastiCache Redis
  CacheSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for ElastiCache
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2

  RedisCache:
    Type: AWS::ElastiCache::CacheCluster
    Properties:
      CacheNodeType: cache.t3.micro
      Engine: redis
      NumCacheNodes: 1
      CacheSubnetGroupName: !Ref CacheSubnetGroup
      VpcSecurityGroupIds:
        - !Ref DatabaseSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-bomizzel-redis

  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub ${Environment}-bomizzel-alb
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub ${Environment}-bomizzel-cluster
      CapacityProviders:
        - FARGATE
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1

Outputs:
  VPCId:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub ${Environment}-bomizzel-vpc-id

  DatabaseEndpoint:
    Description: RDS Database Endpoint
    Value: !GetAtt Database.Endpoint.Address
    Export:
      Name: !Sub ${Environment}-bomizzel-db-endpoint

  RedisEndpoint:
    Description: Redis Cache Endpoint
    Value: !GetAtt RedisCache.RedisEndpoint.Address
    Export:
      Name: !Sub ${Environment}-bomizzel-redis-endpoint

  LoadBalancerDNS:
    Description: Load Balancer DNS Name
    Value: !GetAtt ApplicationLoadBalancer.DNSName
    Export:
      Name: !Sub ${Environment}-bomizzel-alb-dns
```

### Step 3: Deploy Infrastructure

```bash
# Create database password secret
aws secretsmanager create-secret \
  --name production-bomizzel-db-password \
  --description "Database password for Bomizzel" \
  --secret-string '{"password":"YourSecurePassword123!"}'

# Deploy CloudFormation stack
aws cloudformation create-stack \
  --stack-name bomizzel-infrastructure \
  --template-body file://aws-infrastructure.yml \
  --parameters ParameterKey=Environment,ParameterValue=production \
  --capabilities CAPABILITY_IAM

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name bomizzel-infrastructure
```

### Step 4: Build and Push Docker Images

```bash
# Create ECR repositories
aws ecr create-repository --repository-name bomizzel/backend
aws ecr create-repository --repository-name bomizzel/frontend

# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
docker build -t bomizzel/backend packages/backend/
docker tag bomizzel/backend:latest YOUR-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/bomizzel/backend:latest
docker push YOUR-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/bomizzel/backend:latest

# Build and push frontend
docker build -t bomizzel/frontend packages/frontend/
docker tag bomizzel/frontend:latest YOUR-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/bomizzel/frontend:latest
docker push YOUR-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/bomizzel/frontend:latest
```

## 💰 **Cost Estimates**

### Option 1: EC2 (Simple)
- **t3.medium EC2**: ~$30/month
- **20GB EBS storage**: ~$2/month
- **Data transfer**: ~$5-10/month
- **Total**: ~$40-45/month

### Option 2: ECS Production
- **Fargate tasks**: ~$50-80/month
- **RDS db.t3.micro**: ~$15/month
- **ElastiCache**: ~$15/month
- **Load Balancer**: ~$20/month
- **Total**: ~$100-130/month

## 🔧 **Quick Start Commands**

For the fastest deployment, use Option 1:

```bash
# 1. Launch EC2 instance (t3.medium, Ubuntu 22.04)
# 2. SSH into instance and run:

curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 3. Logout and login again, then:
git clone https://github.com/your-username/bomizzel-ticketing-system.git
cd bomizzel-ticketing-system

# 4. Create environment files (update with your values)
# 5. Build and start:
npm ci && npm run build && docker-compose up -d

# 6. Run migrations:
npm run migrate --workspace=backend
```

## 🚀 **Next Steps**

1. **Start with Option 1** for quick testing
2. **Set up a domain name** and SSL certificates
3. **Configure monitoring** using the existing setup
4. **Set up automated backups**
5. **Move to Option 2** for production scaling

## 📞 **Need Help?**

- Check the existing deployment docs in `docs/deployment/`
- Review monitoring setup in `monitoring/`
- Use the health check scripts in `scripts/`

Your application is already well-structured for AWS deployment!