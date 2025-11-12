import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PricingPage from './pages/PricingPage';
import CustomerDashboard from './pages/CustomerDashboard';
import SimpleEmployeeDashboard from './pages/SimpleEmployeeDashboard';
import SimpleAdminDashboard from './pages/SimpleAdminDashboard';
import TicketLayoutManagement from './pages/TicketLayoutManagement';
import CreateTicketPage from './pages/CreateTicketPage';
import TestAPI from './TestAPI';
import CompanyRegistrationPage from './pages/CompanyRegistrationPage';
import TestTicketForm from './pages/TestTicketForm';
import ColorPickerDemo from './pages/ColorPickerDemo';
import AdminCustomerProvisioning from './pages/AdminCustomerProvisioning';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import BSIAdminLogin from './pages/BSIAdminLogin';
import DataManagement from './pages/DataManagement';
import SQLQueryBuilder from './pages/SQLQueryBuilder';
import CustomerReports from './pages/CustomerReports';
import VisualReportBuilder from './pages/VisualReportBuilder';
import AdminSettings from './pages/AdminSettings';
import CompanyProfile from './pages/CompanyProfile';
import Rebranding from './pages/Rebranding';
import BusinessHours from './pages/BusinessHours';
import HolidayList from './pages/HolidayList';
import Departments from './pages/Departments';
import CustomerHappiness from './pages/CustomerHappiness';
import Agents from './pages/Agents';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
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
                  <SimpleEmployeeDashboard />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
