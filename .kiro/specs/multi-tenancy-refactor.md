# Multi-Tenancy Architecture Refactor

## Overview
Transform Bomizzel from a single-tenant system to a proper multi-tenant SaaS platform with organization-scoped URLs, proper data isolation, and the ability for users to belong to multiple organizations.

## Current Problems

1. **No Organization Context in URLs**
   - URLs like `/dashboard` don't indicate which organization
   - Can't bookmark or share org-specific pages
   - No clear tenant boundary in the application

2. **Fragile User-Company Associations**
   - Associations can be lost or not created properly
   - No clear "current organization" concept
   - Users can't switch between organizations

3. **Weak Data Isolation**
   - Queries don't consistently filter by organization
   - Risk of data leakage between tenants
   - No middleware to enforce org-scoping

4. **Poor User Experience**
   - Users don't know which org they're working in
   - Can't easily switch between organizations
   - No visual indication of current org context

## Goals

1. **Organization-Scoped URLs**: All routes include org ID (e.g., `/org/abc123/tickets`)
2. **Proper Tenant Isolation**: Middleware ensures all data is org-scoped
3. **Multi-Org Support**: Users can belong to multiple orgs and switch between them
4. **Clear Visual Context**: UI always shows which org the user is in
5. **Data Security**: Impossible to access another org's data

## Architecture Design

### URL Structure

```
# Public routes (no org context)
/login
/register
/forgot-password

# Org selection (after login)
/orgs                          # List user's organizations
/orgs/select                   # Select which org to work in

# Org-scoped routes (all application routes)
/org/:orgId/dashboard
/org/:orgId/tickets
/org/:orgId/tickets/:ticketId
/org/:orgId/customers
/org/:orgId/settings
/org/:orgId/settings/company-profile
/org/:orgId/settings/users
/org/:orgId/settings/teams
```

### Database Schema Updates

#### 1. Add org_id to all tenant-scoped tables

```sql
-- Tables that need org_id (if not already present)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES companies(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_org_id UUID REFERENCES companies(id);
ALTER TABLE queues ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES companies(id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES companies(id);
ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES companies(id);
ALTER TABLE ticket_notes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES companies(id);
ALTER TABLE files ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES companies(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_org_id ON tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_queues_org_id ON queues(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id);
```

#### 2. Enhance user_company_associations

```sql
-- Add last_accessed to track which org was used most recently
ALTER TABLE user_company_associations 
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP DEFAULT NOW();

-- Add is_default to mark user's primary org
ALTER TABLE user_company_associations 
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
```

### Backend Implementation

#### 1. Organization Context Middleware

```typescript
// packages/backend/src/middleware/orgContext.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { db } from '../config/database';

// Extend Express Request to include org context
declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      orgRole?: string;
    }
  }
}

/**
 * Extract and validate organization ID from URL
 * Ensures user has access to the organization
 */
export const orgContext = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract org ID from URL params
    const orgId = req.params.orgId;

    if (!orgId) {
      throw new AppError('Organization ID is required', 400, 'ORG_ID_REQUIRED');
    }

    // Verify user is authenticated
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    // Check if user has access to this organization
    const association = await db('user_company_associations')
      .where('user_id', req.user.id)
      .where('company_id', orgId)
      .first();

    if (!association) {
      throw new AppError(
        'Access denied to this organization',
        403,
        'ORG_ACCESS_DENIED'
      );
    }

    // Verify organization exists and is active
    const org = await db('companies')
      .where('id', orgId)
      .where('is_active', true)
      .first();

    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    // Add org context to request
    req.orgId = orgId;
    req.orgRole = association.role;

    // Update last accessed timestamp
    await db('user_company_associations')
      .where('user_id', req.user.id)
      .where('company_id', orgId)
      .update({ last_accessed_at: db.fn.now() });

    next();
  } catch (error) {
    next(error);
  }
};
```

#### 2. Update Route Structure

```typescript
// packages/backend/src/routes/index.ts

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';

const router = Router();

// Public routes (no auth or org context)
router.use('/auth', authRoutes);
router.use('/company-registration', companyRegistrationRoutes);

// Organization selection routes (auth required, no org context)
router.use('/orgs', authenticate, orgSelectionRoutes);

// Organization-scoped routes (auth + org context required)
router.use('/org/:orgId/tickets', authenticate, orgContext, ticketRoutes);
router.use('/org/:orgId/customers', authenticate, orgContext, customerRoutes);
router.use('/org/:orgId/teams', authenticate, orgContext, teamRoutes);
router.use('/org/:orgId/queues', authenticate, orgContext, queueRoutes);
router.use('/org/:orgId/settings', authenticate, orgContext, settingsRoutes);
router.use('/org/:orgId/users', authenticate, orgContext, userRoutes);

export default router;
```

#### 3. Organization Selection Service

```typescript
// packages/backend/src/services/OrganizationService.ts

export class OrganizationService {
  /**
   * Get all organizations a user has access to
   */
  static async getUserOrganizations(userId: string) {
    const orgs = await db('companies as c')
      .join('user_company_associations as uca', 'c.id', 'uca.company_id')
      .where('uca.user_id', userId)
      .where('c.is_active', true)
      .select(
        'c.id',
        'c.name',
        'c.logo_url',
        'uca.role',
        'uca.is_default',
        'uca.last_accessed_at'
      )
      .orderBy('uca.last_accessed_at', 'desc');

    return orgs;
  }

  /**
   * Set user's default organization
   */
  static async setDefaultOrganization(userId: string, orgId: string) {
    // Remove default from all user's orgs
    await db('user_company_associations')
      .where('user_id', userId)
      .update({ is_default: false });

    // Set new default
    await db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', orgId)
      .update({ is_default: true });
  }

  /**
   * Get user's default organization
   */
  static async getDefaultOrganization(userId: string) {
    const org = await db('companies as c')
      .join('user_company_associations as uca', 'c.id', 'uca.company_id')
      .where('uca.user_id', userId)
      .where('uca.is_default', true)
      .where('c.is_active', true)
      .select('c.id', 'c.name')
      .first();

    // If no default, return most recently accessed
    if (!org) {
      return await db('companies as c')
        .join('user_company_associations as uca', 'c.id', 'uca.company_id')
        .where('uca.user_id', userId)
        .where('c.is_active', true)
        .select('c.id', 'c.name')
        .orderBy('uca.last_accessed_at', 'desc')
        .first();
    }

    return org;
  }
}
```

#### 4. Update All Services to Use Org Context

```typescript
// Example: packages/backend/src/services/TicketService.ts

export class TicketService {
  /**
   * Get all tickets for an organization
   */
  static async getTickets(orgId: string, filters: any) {
    return db('tickets')
      .where('org_id', orgId)  // Always filter by org
      .where(filters)
      .select('*');
  }

  /**
   * Create ticket (org-scoped)
   */
  static async createTicket(orgId: string, data: any) {
    const [ticket] = await db('tickets')
      .insert({
        ...data,
        org_id: orgId,  // Always set org_id
      })
      .returning('*');

    return ticket;
  }

  /**
   * Get single ticket (with org verification)
   */
  static async getTicket(orgId: string, ticketId: string) {
    const ticket = await db('tickets')
      .where('id', ticketId)
      .where('org_id', orgId)  // Verify org ownership
      .first();

    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }

    return ticket;
  }
}
```

### Frontend Implementation

#### 1. Organization Context Provider

```typescript
// packages/frontend/src/contexts/OrganizationContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  role: string;
  isDefault: boolean;
}

interface OrgContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  switchOrg: (orgId: string) => void;
  loading: boolean;
}

const OrganizationContext = createContext<OrgContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const response = await apiService.getUserOrganizations();
      setOrganizations(response.data);

      // Set current org from localStorage or default
      const savedOrgId = localStorage.getItem('currentOrgId');
      const defaultOrg = response.data.find((o: Organization) => o.isDefault) || response.data[0];
      const current = savedOrgId 
        ? response.data.find((o: Organization) => o.id === savedOrgId) || defaultOrg
        : defaultOrg;

      setCurrentOrg(current);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrg = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem('currentOrgId', orgId);
      // Reload page to update all org-scoped data
      window.location.href = `/org/${orgId}/dashboard`;
    }
  };

  return (
    <OrganizationContext.Provider value={{ currentOrg, organizations, switchOrg, loading }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
};
```

#### 2. Update Router to Include Org ID

```typescript
// packages/frontend/src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OrganizationProvider, useOrganization } from './contexts/OrganizationContext';

// Redirect to org-scoped route
const OrgRedirect = () => {
  const { currentOrg, loading } = useOrganization();
  
  if (loading) return <div>Loading...</div>;
  if (!currentOrg) return <Navigate to="/orgs/select" />;
  
  return <Navigate to={`/org/${currentOrg.id}/dashboard`} />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrganizationProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Org selection */}
            <Route path="/orgs/select" element={<OrgSelector />} />
            
            {/* Org-scoped routes */}
            <Route path="/org/:orgId/dashboard" element={<Dashboard />} />
            <Route path="/org/:orgId/tickets" element={<TicketList />} />
            <Route path="/org/:orgId/tickets/:ticketId" element={<TicketDetail />} />
            <Route path="/org/:orgId/customers" element={<CustomerList />} />
            <Route path="/org/:orgId/settings/*" element={<Settings />} />
            
            {/* Default redirect */}
            <Route path="/" element={<OrgRedirect />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </OrganizationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

#### 3. Organization Switcher Component

```typescript
// packages/frontend/src/components/OrganizationSwitcher.tsx

import React, { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';

export const OrganizationSwitcher: React.FC = () => {
  const { currentOrg, organizations, switchOrg } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentOrg) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-100"
      >
        {currentOrg.logoUrl && (
          <img src={currentOrg.logoUrl} alt="" className="w-6 h-6 rounded" />
        )}
        <span className="font-medium">{currentOrg.name}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-2">
            <div className="text-xs text-gray-500 px-3 py-2">Switch Organization</div>
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => {
                  switchOrg(org.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100 ${
                  org.id === currentOrg.id ? 'bg-blue-50' : ''
                }`}
              >
                {org.logoUrl && (
                  <img src={org.logoUrl} alt="" className="w-6 h-6 rounded" />
                )}
                <div className="flex-1 text-left">
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-gray-500">{org.role}</div>
                </div>
                {org.id === currentOrg.id && (
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

#### 4. Update API Service to Use Org Context

```typescript
// packages/frontend/src/services/api.ts

class ApiService {
  // Get current org ID from URL
  private getCurrentOrgId(): string | null {
    const match = window.location.pathname.match(/^\/org\/([^\/]+)/);
    return match ? match[1] : null;
  }

  // Build org-scoped URL
  private orgUrl(path: string): string {
    const orgId = this.getCurrentOrgId();
    if (!orgId) {
      throw new Error('No organization context');
    }
    return `/org/${orgId}${path}`;
  }

  // Org-scoped endpoints
  async getTickets(filters?: any) {
    const response = await this.client.get(this.orgUrl('/tickets'), { params: filters });
    return response.data;
  }

  async getTicket(ticketId: string) {
    const response = await this.client.get(this.orgUrl(`/tickets/${ticketId}`));
    return response.data;
  }

  async createTicket(data: any) {
    const response = await this.client.post(this.orgUrl('/tickets'), data);
    return response.data;
  }

  // Organization management
  async getUserOrganizations() {
    const response = await this.client.get('/orgs');
    return response.data;
  }

  async setDefaultOrganization(orgId: string) {
    const response = await this.client.post(`/orgs/${orgId}/set-default`);
    return response.data;
  }
}
```

## Migration Strategy

### Phase 1: Database Schema (Week 1)
1. Create migration to add org_id to all tables
2. Backfill org_id for existing data
3. Add indexes for performance
4. Update user_company_associations table

### Phase 2: Backend Middleware (Week 2)
1. Implement orgContext middleware
2. Create OrganizationService
3. Add org selection routes
4. Update authentication to work with org context

### Phase 3: Backend Services (Week 3-4)
1. Update all services to accept orgId parameter
2. Add org_id to all database queries
3. Update all route handlers to use orgContext
4. Add comprehensive tests for org isolation

### Phase 4: Frontend Context (Week 5)
1. Create OrganizationContext and provider
2. Build organization switcher component
3. Update router to use org-scoped routes
4. Add org selection page

### Phase 5: Frontend Components (Week 6-7)
1. Update all API calls to use org context
2. Update all navigation links to include orgId
3. Add visual indicators of current org
4. Update all pages to work with org-scoped URLs

### Phase 6: Testing & Validation (Week 8)
1. Test org isolation thoroughly
2. Test org switching
3. Test multi-org user scenarios
4. Performance testing with org-scoped queries
5. Security audit for data leakage

## Testing Requirements

### Unit Tests
- OrganizationService methods
- orgContext middleware
- Org-scoped service methods

### Integration Tests
- User can access only their orgs
- Data is properly isolated between orgs
- Org switching works correctly
- URLs are properly formatted

### Security Tests
- Cannot access another org's data
- Cannot bypass org context middleware
- Proper error handling for invalid org IDs
- Token validation with org context

## Success Criteria

1. ✅ All URLs include organization ID
2. ✅ Users can switch between organizations
3. ✅ Data is completely isolated between orgs
4. ✅ No data leakage possible
5. ✅ Clear visual indication of current org
6. ✅ Bookmarkable org-specific URLs
7. ✅ Performance is not degraded
8. ✅ All existing features work with org context

## Risks & Mitigation

### Risk: Breaking existing functionality
**Mitigation**: Implement incrementally, maintain backward compatibility during transition

### Risk: Performance degradation
**Mitigation**: Add proper indexes, optimize queries, use caching

### Risk: Data migration issues
**Mitigation**: Thorough testing in staging, rollback plan, data validation scripts

### Risk: User confusion during transition
**Mitigation**: Clear communication, gradual rollout, user documentation

## Future Enhancements

1. **Custom domains per org**: `customer1.bomizzel.com`
2. **Org-specific branding**: Custom colors, logos, themes
3. **Org-level settings**: Timezone, language, date format
4. **Org analytics**: Usage metrics per organization
5. **Org billing**: Separate billing per organization
6. **Org invitations**: Invite users to specific orgs
7. **Org roles & permissions**: Fine-grained access control per org

## References

- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/multi-tenancy)
- [SaaS Tenant Isolation](https://aws.amazon.com/blogs/apn/saas-tenant-isolation-strategies/)
- [Zoho CRM Multi-Org](https://www.zoho.com/crm/help/organizations/)
