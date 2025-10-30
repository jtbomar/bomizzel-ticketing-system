# Project Structure

## Repository Organization
Monorepo using npm workspaces with clear separation between frontend and backend packages.

```
bomizzel-ticketing-system/
├── packages/
│   ├── backend/          # Node.js API server
│   └── frontend/         # React application
├── .kiro/               # Kiro configuration and specs
├── docker-compose.yml   # Database services
└── package.json         # Root workspace configuration
```

## Backend Structure (`packages/backend/`)
```
backend/
├── src/
│   ├── config/          # Database and Redis configuration
│   ├── middleware/      # Express middleware (auth, rate limiting)
│   ├── models/          # Data models and TypeScript interfaces
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic layer
│   ├── types/           # Shared TypeScript type definitions
│   └── utils/           # Utility functions (JWT, validation)
├── database/
│   ├── migrations/      # Knex database migrations
│   └── seeds/           # Database seed files
├── tests/               # Jest test files
├── docs/                # API and feature documentation
└── knexfile.js         # Database configuration
```

## Frontend Structure (`packages/frontend/`)
```
frontend/
├── src/
│   ├── components/      # Reusable React components
│   ├── contexts/        # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page-level components
│   ├── services/        # API service functions
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── tests/               # Vitest test files
└── public/              # Static assets
```

## Key Architectural Patterns

### Backend Patterns
- **Service Layer**: Business logic separated from route handlers
- **Model Layer**: Data models with TypeScript interfaces
- **Middleware**: Authentication, validation, and rate limiting
- **Route Organization**: RESTful API endpoints grouped by resource

### API Structure
- `/api/auth/*` - Authentication and user management
- `/api/tickets/*` - Ticket CRUD operations
- `/api/users/*` - User and company management
- `/api/queues/*` - Queue management
- `/api/custom-fields/*` - Custom field configuration
- `/api/files/*` - File upload and management
- `/api/email/*` - Email operations

### Frontend Patterns
- **Component Composition**: Reusable UI components
- **Custom Hooks**: Shared logic extraction
- **Context Providers**: Global state management
- **Service Layer**: API interaction abstraction

### Database Organization
- **Migrations**: Version-controlled schema changes in `database/migrations/`
- **Seeds**: Initial data setup in `database/seeds/`
- **Models**: TypeScript interfaces matching database schema

## File Naming Conventions
- **Backend**: PascalCase for services and models, camelCase for utilities
- **Frontend**: PascalCase for components, camelCase for hooks and utilities
- **Tests**: Match source file names with `.test.ts` or `.test.tsx` suffix
- **Types**: Descriptive interfaces in `types/` directories

## Configuration Files
- **Root**: ESLint, Prettier, and workspace configuration
- **Backend**: Knex configuration, Jest setup
- **Frontend**: Vite configuration, Tailwind setup
- **Docker**: Database services in `docker-compose.yml`

## Documentation Location
- **API Docs**: `packages/backend/docs/`
- **Specs**: `.kiro/specs/` for feature specifications
- **Steering**: `.kiro/steering/` for development guidelines