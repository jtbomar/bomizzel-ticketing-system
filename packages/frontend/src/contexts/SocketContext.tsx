import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { apiService, getApiBaseUrl } from '../services/api';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// The API's server, without /api: socket.io would take "/api" for a namespace
const socketUrl = (): string => getApiBaseUrl().replace(/\/api\/?$/, '');

/**
 * Live updates. One socket per signed-in person, signed in with their API
 * token (again after every reconnect); a new one when someone else signs in.
 */
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    const newSocket = io(socketUrl(), { transports: ['websocket', 'polling'] });
    let retried = false;

    const signIn = () => newSocket.emit('authenticate', { token: localStorage.getItem('token') });

    newSocket.on('connect', () => {
      setIsConnected(true);
      retried = false;
      signIn();
    });

    // An expired token (the page sat idle): any API call renews it, then retry once
    newSocket.on('authenticated', (res: { success: boolean }) => {
      if (res?.success || retried) return;
      retried = true;
      apiService
        .getProfile()
        .then(signIn)
        .catch(() => undefined);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    socket,
    isConnected,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Call `onChange` (at most once a second) when a ticket the signed-in person
 * can see changes - by someone else. Their own changes are already on screen.
 */
export const useTicketChanges = (onChange: () => void) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handle = (event: { by?: string | null }) => {
      if (event?.by && event.by === user?.id) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        latest.current();
      }, 1000);
    };
    socket.on('ticket:changed', handle);
    return () => {
      socket.off('ticket:changed', handle);
      if (timer) clearTimeout(timer);
    };
  }, [socket, user?.id]);
};
