import React, { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import apiService from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    selectedPlanId?: string;
    startTrial?: boolean;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Load user from localStorage on initialization
  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Use the backend API for authentication
      const response = await apiService.login(email, password);
      const { token, user: backendUser } = response;

      // Store the token
      localStorage.setItem('token', token);

      // Convert backend user to frontend User type
      const frontendUser: User = {
        id: backendUser.id,
        email: backendUser.email,
        firstName: backendUser.firstName,
        lastName: backendUser.lastName,
        role: backendUser.role as 'customer' | 'employee' | 'team_lead' | 'admin',
        isActive: true,
        emailVerified: true,
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            browser: true,
            ticketAssigned: true,
            ticketUpdated: true,
            ticketResolved: true,
          },
          dashboard: {
            defaultView: 'kanban',
            ticketsPerPage: 25,
          },
        },
        createdAt: new Date(backendUser.createdAt || Date.now()),
        updatedAt: new Date(backendUser.updatedAt || Date.now()),
      };

      setUser(frontendUser);
      localStorage.setItem('user', JSON.stringify(frontendUser));
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    selectedPlanId?: string;
    startTrial?: boolean;
  }) => {
    setIsLoading(true);
    try {
      const response = await apiService.register({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'customer',
        selectedPlanId: userData.selectedPlanId,
        startTrial: userData.startTrial,
      });

      const { user: registeredUser, token, refreshToken } = response;

      // Store tokens
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(registeredUser));

      setUser(registeredUser);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
