# Bomizzel Ticketing System

A comprehensive ticketing system with customer portal and employee dashboard, built with modern web technologies.

## 🔒 Security Notice

**This application is now secured with authentication and authorization!** All admin routes, employee dashboards, and BSI admin areas require proper authentication.

📖 **Start here:** [START_HERE_SECURITY.md](START_HERE_SECURITY.md)

For deployment: [PRE_DEPLOYMENT_SECURITY_CHECKLIST.md](PRE_DEPLOYMENT_SECURITY_CHECKLIST.md)

## Features

- **Customer Portal**: Web interface for customers to sign up, submit tickets, and track their requests
- **Employee Dashboard**: Internal interface for Bomizzel staff to manage tickets and queues
- **Multi-Company Support**: Customers can associate with multiple companies
- **Custom Fields**: Teams can configure custom fields for their ticket types
- **Flexible Queues**: Support for both Kanban board and list views
- **Real-time Updates**: Live notifications and dashboard metrics
- **File Attachments**: Support for file uploads on tickets
- **Email Integration**: Send emails from tickets with automatic note creation

## Technology Stack

### Backend
- **Node.js** with **Express.js** framework
- **TypeScript** for type safety
- **PostgreSQL** for relational data storage
- **Redis** for caching and session management
- **Socket.io** for real-time updates
- **JWT** for authentication

### Frontend
- **React.js** with **TypeScript**
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **React Router** for navigation

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for databases)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bomizzel-ticketing-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   # Edit the .env file with your configuration
   ```

4. **Start the databases**
   ```bash
   npm run docker:up
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Seed the database (optional)**
   ```bash
   npm run db:seed
   ```

7. **Start the development servers**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

### Development Commands

```bash
# Start both frontend and backend
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Build for production
npm run build

# Run tests
npm run test

# Run linting
npm run lint

# Database operations
npm run db:migrate        # Run migrations
npm run db:seed          # Seed database
npm run docker:up        # Start databases
npm run docker:down      # Stop databases

# Database query and fix scripts
./scripts/db-common-queries.sh users          # View all users
./scripts/db-common-queries.sh provisioned    # View provisioned customers
./scripts/db-fix.sh enable-user [email]       # Enable a user
./scripts/db-backup.sh                        # Backup database
```

### Database Management

The project includes helpful scripts for database operations:

```bash
# View data
./scripts/db-common-queries.sh tables         # List all tables
./scripts/db-common-queries.sh users          # View all users
./scripts/db-common-queries.sh companies      # View all companies
./scripts/db-common-queries.sh provisioned    # View provisioned customers
./scripts/db-common-queries.sh count          # Show record counts

# Run custom queries
./scripts/db-query.sh "SELECT * FROM users LIMIT 5;"

# Interactive shell
./scripts/db-shell.sh

# Fix common issues
./scripts/db-fix.sh enable-user user@example.com
./scripts/db-fix.sh make-admin user@example.com
./scripts/db-fix.sh activate-subscription [sub-id]

# Backup and restore
./scripts/db-backup.sh                        # Create backup
./scripts/db-restore.sh backups/backup.sql.gz # Restore from backup
```

For detailed database management instructions, see [DATABASE_GUIDE.md](DATABASE_GUIDE.md).
```

## Project Structure

```
bomizzel-ticketing-system/
├── packages/
│   ├── backend/          # Node.js API server
│   │   ├── src/
│   │   │   ├── config/   # Database and Redis configuration
│   │   │   ├── middleware/ # Express middleware
│   │   │   ├── routes/   # API routes
│   │   │   ├── services/ # Business logic
│   │   │   ├── types/    # TypeScript type definitions
│   │   │   └── utils/    # Utility functions
│   │   ├── database/     # Migrations and seeds
│   │   └── tests/        # Backend tests
│   └── frontend/         # React application
│       ├── src/
│       │   ├── components/ # Reusable components
│       │   ├── contexts/   # React contexts
│       │   ├── hooks/      # Custom hooks
│       │   ├── pages/      # Page components
│       │   ├── services/   # API services
│       │   ├── types/      # TypeScript types
│       │   └── utils/      # Utility functions
│       └── tests/        # Frontend tests
├── docker-compose.yml    # Database services
└── README.md
```

## API Documentation

The API follows RESTful conventions and includes the following main endpoints:

- `/api/auth/*` - Authentication and user management
- `/api/tickets/*` - Ticket operations
- `/api/users/*` - User and company management
- `/api/queues/*` - Queue management
- `/api/custom-fields/*` - Custom field configuration
- `/api/files/*` - File upload and management
- `/api/email/*` - Email operations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.