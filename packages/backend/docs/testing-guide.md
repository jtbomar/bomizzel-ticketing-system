# Comprehensive Testing Guide

This document outlines the comprehensive test suite implemented for the Bomizzel ticketing system, covering unit tests, integration tests, end-to-end tests, performance tests, and security tests.

## Test Structure Overview

```
packages/
├── backend/tests/
│   ├── setup.ts                    # Test environment setup
│   ├── runAllTests.ts              # Comprehensive test runner
│   ├── *Service.test.ts            # Unit tests for services
│   ├── *.test.ts                   # Integration tests for API endpoints
│   ├── integration/                # End-to-end workflow tests
│   ├── performance/                # Load and performance tests
│   └── security/                   # Security and authentication tests
└── frontend/src/test/
    ├── setup.ts                    # Frontend test setup
    ├── components/                 # Component unit tests
    └── e2e/                        # End-to-end user workflow tests
```

## Test Categories

### 1. Unit Tests

**Backend Services (`*Service.test.ts`)**

- TicketService: Core ticket management logic
- UserService: User profile and preference management
- AuthService: Authentication and authorization
- CustomFieldService: Dynamic field validation
- EmailService: Email template and sending logic

**Frontend Components (`components/*.test.tsx`)**

- KanbanBoard: Drag-and-drop ticket management
- CreateTicketForm: Dynamic form with custom fields
- TicketListView: List-based ticket display
- DashboardMetrics: Real-time metrics display

### 2. Integration Tests

**API Endpoint Tests (`*.test.ts`)**

- Authentication endpoints (register, login, refresh)
- Ticket CRUD operations
- User and company management
- Custom field configuration
- File upload and management
- Email integration

**Workflow Tests (`integration/*.test.ts`)**

- Complete ticket lifecycle (creation → assignment → resolution)
- Custom field configuration and usage
- Multi-company user workflows
- Queue management and assignment
- Bulk operations

### 3. End-to-End Tests

**Customer Workflows (`e2e/customerWorkflow.test.tsx`)**

- Customer registration and login
- Ticket creation with custom fields
- Multi-company ticket management
- File attachments and notes
- Ticket status tracking

**Employee Workflows (`e2e/employeeWorkflow.test.tsx`)**

- Employee dashboard navigation
- Kanban vs List view switching
- Ticket assignment and status updates
- Internal notes and email communication
- Real-time updates and notifications

### 4. Performance Tests

**Load Testing (`performance/loadTest.test.ts`)**

- Concurrent ticket creation (50+ simultaneous)
- High-volume ticket retrieval
- Database query performance with large datasets
- Authentication system under load
- File upload performance
- Memory usage monitoring

**Performance Benchmarks:**

- Ticket creation: <200ms average response time
- Ticket search: <1000ms for 1000+ tickets
- Concurrent logins: <100ms average
- File uploads: <5000ms for 10 concurrent uploads

### 5. Security Tests

**Authentication Security (`security/authSecurity.test.ts`)**

- JWT token validation and expiration
- Invalid token rejection
- Authorization boundary testing
- Role-based access control
- Session management security

**Input Validation Security**

- SQL injection prevention
- XSS attack prevention
- File upload security
- Rate limiting enforcement
- CORS policy validation

## Running Tests

### Individual Test Categories

```bash
# Backend unit tests
npm run test:unit --workspace=backend

# Backend integration tests
npm run test:integration --workspace=backend

# Security tests
npm run test:security --workspace=backend

# Performance tests
npm run test:performance --workspace=backend

# Frontend component tests
npm run test:components --workspace=frontend

# Frontend E2E tests
npm run test:e2e --workspace=frontend
```

### Comprehensive Test Execution

```bash
# Run all backend tests with detailed reporting
npm run test:all --workspace=backend

# Run all frontend tests
npm run test --workspace=frontend

# Run all tests across both packages
npm run test:all
```

### Coverage Reports

```bash
# Generate coverage for backend
npm run test:coverage --workspace=backend

# Generate coverage for frontend
npm run test:coverage --workspace=frontend

# Generate coverage for all packages
npm run test:coverage
```

## Test Configuration

### Backend (Jest)

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  testTimeout: 10000,
  maxWorkers: 1, // Sequential execution for database tests
};
```

### Frontend (Vitest)

```javascript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

## Test Data Management

### Database Setup

- Automated migration and seeding for test database
- Transaction-based test isolation
- Cleanup between test runs

### Mock Data

- Realistic test data for all entities
- Consistent data relationships
- Performance test datasets (1000+ records)

## Continuous Integration

### Pre-commit Hooks

```bash
# Run linting and unit tests before commit
npm run lint && npm run test:unit
```

### CI Pipeline

```bash
# Full test suite execution
npm run test:all
npm run test:coverage
npm run lint
```

## Coverage Targets

- **Unit Tests**: 90% code coverage minimum
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user workflows covered
- **Security Tests**: All authentication/authorization paths
- **Performance Tests**: Load scenarios for expected usage

## Test Maintenance

### Adding New Tests

1. Follow existing naming conventions
2. Include both positive and negative test cases
3. Mock external dependencies appropriately
4. Update this documentation

### Test Data Updates

1. Update seed files for new features
2. Maintain test data consistency
3. Consider performance impact of large datasets

### Performance Benchmarks

1. Update benchmarks for new features
2. Monitor performance regression
3. Adjust timeouts as needed

## Troubleshooting

### Common Issues

**Database Connection Errors**

```bash
# Ensure test database is running
npm run docker:up
npm run db:setup
```

**Test Timeouts**

- Increase timeout for performance tests
- Check for hanging promises
- Verify database cleanup

**Mock Issues**

- Clear mocks between tests
- Verify mock implementations
- Check for mock leakage

### Debug Mode

```bash
# Run tests with debug output
DEBUG=* npm run test

# Run specific test file
npx jest tests/ticketService.test.ts --verbose
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Realistic Data**: Use data that mirrors production scenarios
3. **Error Scenarios**: Test both success and failure paths
4. **Performance Awareness**: Monitor test execution time
5. **Security Focus**: Include security testing in all features
6. **Documentation**: Keep test documentation updated

## Metrics and Reporting

The test suite provides comprehensive metrics:

- Code coverage percentages
- Test execution times
- Performance benchmarks
- Security vulnerability detection
- Integration test results

All metrics are available in HTML reports generated after test execution.
