import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';

let socket: Socket | null = null;
let lastToken: string | null = null;

export function getSocket(url: string): Socket {
  const token = useStore.getState().token;

  // Reconnect if token changed (new pairing session)
  if (socket && lastToken !== token) {
    socket.disconnect();
    socket = null;
  }

  if (socket?.connected) return socket;

  lastToken = token;
  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: { token },
  });

  socket.on('connect', () => console.log('[socket] connected:', socket?.id));
  socket.on('disconnect', (reason) => console.log('[socket] disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[socket] error:', err.message));

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
