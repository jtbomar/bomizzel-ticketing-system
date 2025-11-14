import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'customer' | 'employee' | 'admin' | 'bsi_admin';
  requireBSI?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole,
  requireBSI = false 
}) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      // No token = not authenticated
      if (!token || !userStr) {
        console.log('[ProtectedRoute] No token or user found');
        setIsAuthenticated(false);
        setHasPermission(false);
        return;
      }

      try {
        const user = JSON.parse(userStr);
        
        console.log('[ProtectedRoute] User found:', user.email, 'role:', user.role);
        
        // TEMPORARY: Skip server verification, just trust the local token
        // TODO: Fix database migrations on Railway then re-enable verification
        setIsAuthenticated(true);
        console.log('[ProtectedRoute] Token accepted (verification temporarily disabled)');

        // Check BSI admin access
        if (requireBSI) {
          const isBSIAdmin = user.role === 'admin' && 
            (user.email === 'jeffrey.t.bomar@gmail.com' || 
             user.email?.includes('@bomizzel.com') || 
             user.email?.includes('bomizzel'));
          
          console.log('[ProtectedRoute] BSI admin check:', isBSIAdmin);
          setHasPermission(isBSIAdmin);
          return;
        }

        // Check role-based access
        if (requiredRole) {
          const hasRole = user.role === requiredRole || 
                         (requiredRole === 'employee' && user.role === 'admin') ||
                         (requiredRole === 'customer' && user.role === 'admin');
          console.log('[ProtectedRoute] Role check - required:', requiredRole, 'user:', user.role, 'hasRole:', hasRole);
          setHasPermission(hasRole);
        } else {
          console.log('[ProtectedRoute] No role required, granting access');
          setHasPermission(true);
        }
      } catch (error) {
        console.error('[ProtectedRoute] Auth verification failed:', error);
        // Token is invalid, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setHasPermission(false);
      }
    };

    verifyAuth();
  }, [requiredRole, requireBSI]);

  // Still checking
  if (isAuthenticated === null || hasPermission === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    // Redirect to appropriate login page
    const loginPath = requireBSI ? '/bsi/login' : '/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Authenticated but no permission
  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-sm text-gray-600 mb-6">
            You don't have permission to access this page.
            {requireBSI && ' This area is restricted to Bomizzel Services Inc. administrators.'}
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Authenticated and has permission
  return <>{children}</>;
};

export default ProtectedRoute;
