# Technology Stack

## Architecture
Monorepo structure with separate backend API and frontend React application using npm workspaces.

## Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with middleware (CORS, Helmet, Morgan)
- **Database**: PostgreSQL with Knex.js query builder
- **Caching**: Redis for sessions and caching
- **Authentication**: JWT tokens with bcryptjs for password hashing
- **Real-time**: Socket.io for live updates
- **File Handling**: Multer for uploads, Sharp for image processing
- **Email**: Nodemailer for email integration
- **Validation**: Joi for request validation
- **Testing**: Jest with Supertest for API testing
- **Logging**: Winston for structured logging

## Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS with Headless UI components
- **State Management**: React Query for server state
- **Forms**: React Hook Form for form handling
- **Routing**: React Router DOM
- **UI Components**: Heroicons, React Beautiful DnD for drag-drop
- **HTTP Client**: Axios for API calls
- **Real-time**: Socket.io client
- **Testing**: Vitest with UI testing capabilities

## Development Tools
- **Code Quality**: ESLint + TypeScript ESLint, Prettier
- **Process Management**: Concurrently for running multiple services
- **Database**: Docker Compose for PostgreSQL and Redis
- **Optional**: pgAdmin for database management

## Common Commands

### Development
```bash
npm run dev              # Start both frontend and backend
npm run dev:backend      # Start only backend (port 5000)
npm run dev:frontend     # Start only frontend (port 3000)
```

### Database Operations
```bash
npm run docker:up        # Start PostgreSQL and Redis containers
npm run docker:down      # Stop database containers
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with initial data
```

### Build and Test
```bash
npm run build           # Build both packages for production
npm run test            # Run tests for all packages
npm run lint            # Run linting for all packages
npm run lint:fix        # Auto-fix linting issues
```

### Backend Specific
```bash
npm run migrate --workspace=backend         # Run migrations
npm run migrate:rollback --workspace=backend # Rollback migrations
npm run migrate:make --workspace=backend     # Create new migration
npm run seed --workspace=backend            # Run database seeds
```

## Environment Requirements
- Node.js 18+ and npm 9+
- Docker and Docker Compose for databases
- Environment variables configured in `packages/backend/.env`

## Code Style
- Single quotes, semicolons, 2-space indentation
- 100 character line width
- ES5 trailing commas
- TypeScript strict mode with explicit typing preferred