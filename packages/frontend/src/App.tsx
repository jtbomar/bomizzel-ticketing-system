import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
import StatusPriorityConfig from './components/StatusPriorityConfig';
import AdminStatusConfig from './components/AdminStatusConfig';
import TestTicketForm from './pages/TestTicketForm';
import ColorPickerDemo from './pages/ColorPickerDemo';
import AdminCustomerProvisioning from './pages/AdminCustomerProvisioning';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import BSIAdminLogin from './pages/BSIAdminLogin';

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
            <Route path="/customer" element={<CustomerDashboard />} />
            <Route path="/employee" element={<SimpleEmployeeDashboard />} />
            <Route path="/admin" element={<SimpleAdminDashboard />} />
            <Route path="/admin/layouts" element={<TicketLayoutManagement />} />
            <Route path="/create-ticket" element={<CreateTicketPage />} />
            
            {/* BSI Admin Routes - For Jeff to manage Bomizzel customers */}
            <Route path="/bsi/login" element={<BSIAdminLogin />} />
            <Route path="/bsi/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/bsi/provisioning" element={<AdminCustomerProvisioning />} />
            
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
