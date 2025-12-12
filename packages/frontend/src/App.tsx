import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

// Core pages loaded immediately (small, frequently accessed)
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Lazy load heavy components
const PricingPage = lazy(() => import('./pages/PricingPage'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const AgentDashboard = lazy(() => import('./pages/AgentDashboard'));
const SimpleAdminDashboard = lazy(() => import('./pages/SimpleAdminDashboard'));
const TicketLayoutManagement = lazy(() => import('./pages/TicketLayoutManagement'));
const CreateTicketPage = lazy(() => import('./pages/CreateTicketPage'));
const TestAPI = lazy(() => import('./TestAPI'));
const CompanyRegistrationPage = lazy(() => import('./pages/CompanyRegistrationPage'));
const TestTicketForm = lazy(() => import('./pages/TestTicketForm'));
const ColorPickerDemo = lazy(() => import('./pages/ColorPickerDemo'));
const AdminCustomerProvisioning = lazy(() => import('./pages/AdminCustomerProvisioning'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const BSIAdminLogin = lazy(() => import('./pages/BSIAdminLogin'));
const DataManagement = lazy(() => import('./pages/DataManagement'));
const SQLQueryBuilder = lazy(() => import('./pages/SQLQueryBuilder'));
const CustomerReports = lazy(() => import('./pages/CustomerReports'));
const VisualReportBuilder = lazy(() => import('./pages/VisualReportBuilder'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const CompanyProfile = lazy(() => import('./pages/CompanyProfile'));
const Rebranding = lazy(() => import('./pages/Rebranding'));
const BusinessHours = lazy(() => import('./pages/BusinessHours'));
const HolidayList = lazy(() => import('./pages/HolidayList'));
const Departments = lazy(() => import('./pages/Departments'));
const CustomerHappiness = lazy(() => import('./pages/CustomerHappiness'));
const Agents = lazy(() => import('./pages/Agents'));
const Teams = lazy(() => import('./pages/Teams'));
const OrganizationalRoles = lazy(() => import('./pages/OrganizationalRoles'));
const Profiles = lazy(() => import('./pages/Profiles'));
const Products = lazy(() => import('./pages/Products'));
const Gamification = lazy(() => import('./pages/Gamification'));
const TicketStatusManagement = lazy(() => import('./pages/TicketStatusManagement'));
const AgentCreateTicketForm = lazy(() => import('./components/AgentCreateTicketForm'));
const AgentAccountsList = lazy(() => import('./pages/AgentAccountsList'));
const AgentCustomersList = lazy(() => import('./pages/AgentCustomersList'));
const AgentAccountDetail = lazy(() => import('./pages/AgentAccountDetail'));
const AgentCustomerDetail = lazy(() => import('./pages/AgentCustomerDetail'));
const SimpleTicketTest = lazy(() => import('./pages/SimpleTicketTest'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />

            {/* Customer Routes - For customers using the ticketing system */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/company-register" element={<CompanyRegistrationPage />} />
            <Route
              path="/customer"
              element={
                <ProtectedRoute requiredRole="customer">
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent"
              element={
                <ProtectedRoute requiredRole="employee">
                  <AgentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/tickets/create"
              element={
                <ProtectedRoute requiredRole="employee">
                  <AgentCreateTicketForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/accounts"
              element={
                <ProtectedRoute requiredRole="employee">
                  <AgentAccountsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/customers"
              element={
                <ProtectedRoute requiredRole="employee">
                  <AgentCustomersList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/accounts/:accountId"
              element={
                <ProtectedRoute requiredRole="employee">
                  <AgentAccountDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/customers/:customerId"
              element={
                <ProtectedRoute requiredRole="employee">
                  <AgentCustomerDetail />
                </ProtectedRoute>
              }
            />
            {/* Redirect old employee URL to new agent URL */}
            <Route path="/employee" element={<Navigate to="/agent" replace />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/old-dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SimpleAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/layouts"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TicketLayoutManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-ticket"
              element={
                <ProtectedRoute>
                  <CreateTicketPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DataManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requiredRole="admin">
                  <CustomerReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visual-reports"
              element={
                <ProtectedRoute requiredRole="admin">
                  <VisualReportBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/*"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/company-profile"
              element={
                <ProtectedRoute requiredRole="admin">
                  <CompanyProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/rebranding"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Rebranding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/business-hours"
              element={
                <ProtectedRoute requiredRole="admin">
                  <BusinessHours />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/holidays"
              element={
                <ProtectedRoute requiredRole="admin">
                  <HolidayList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/departments"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Departments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/customer-happiness"
              element={
                <ProtectedRoute requiredRole="admin">
                  <CustomerHappiness />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/agents"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Agents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/teams"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Teams />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/roles"
              element={
                <ProtectedRoute requiredRole="admin">
                  <OrganizationalRoles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/profiles"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Profiles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/products"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/game-scope"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Gamification />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/ticket-statuses"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TicketStatusManagement />
                </ProtectedRoute>
              }
            />

            {/* BSI Admin Routes - For Jeff to manage Bomizzel customers */}
            <Route path="/bsi/login" element={<BSIAdminLogin />} />
            <Route
              path="/bsi/dashboard"
              element={
                <ProtectedRoute requireBSI={true}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bsi/provisioning"
              element={
                <ProtectedRoute requireBSI={true}>
                  <AdminCustomerProvisioning />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bsi/query-builder"
              element={
                <ProtectedRoute requireBSI={true}>
                  <SQLQueryBuilder />
                </ProtectedRoute>
              }
            />

            {/* Test Routes */}
            <Route path="/test-ticket-form" element={<TestTicketForm />} />
            <Route path="/color-picker-demo" element={<ColorPickerDemo />} />
            <Route path="/test" element={<TestAPI />} />
            <Route
              path="/simple-ticket-test"
              element={
                <ProtectedRoute requiredRole="employee">
                  <SimpleTicketTest />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
