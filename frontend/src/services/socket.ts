import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

const getSocketUrl = (): string => {
  // In development, window.location.origin is proxied through Vite to :5050
  // Can also fallback to explicit backend port if needed
  return window.location.origin;
};

export const getSocket = (): Socket => {
  if (!socket) {
    const token = getToken();
    socket = io(getSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const connectSocket = (): Socket => {
  const token = getToken();
  if (socket) {
    if (!socket.connected) {
      socket.auth = { token };
      socket.connect();
    }
    return socket;
  }

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
