import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// Define the socket server URL
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Singleton socket instance for regular connections
let regularSocket: ReturnType<typeof io> | null = null;

// Map to store test sockets
const testSockets = new Map<string, ReturnType<typeof io>>();

/**
 * Hook to manage a Socket.IO connection
 * @param clientId - Optional client ID to connect to
 * @returns Socket instance and connection status
 */
export function useSocket(clientId: string = '') {
  const isTestConnection = clientId.startsWith('test_');
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const lastReconnectAttemptRef = useRef<number>(0);
  
  useEffect(() => {
    // For test connections, create a new socket for each client
    if (isTestConnection) {
      // Get cached socket or create new one for this test client
      let testSocket = testSockets.get(clientId);
      
      if (!testSocket) {
        console.log('Creating new test socket for client:', clientId);
        
        testSocket = io(SOCKET_SERVER_URL, {
          transports: ['websocket'],
          reconnectionAttempts: maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          query: { isTestClient: 'true', clientId },
        });
        
        testSockets.set(clientId, testSocket);
      }
      
      socketRef.current = testSocket;
      
      // Handle test socket reconnection
      const onConnect = () => {
        console.log('Test socket connected for client:', clientId);
        setIsConnected(true);
        reconnectAttempts.current = 0;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
      };
      
      const onDisconnect = (reason: string) => {
        console.log('Test socket disconnected for client:', clientId, 'reason:', reason);
        setIsConnected(false);
        
        const now = Date.now();
        const timeSinceLastReconnect = now - lastReconnectAttemptRef.current;
        
        if (
          (reason === 'io server disconnect' || reason === 'transport close') &&
          reconnectAttempts.current < maxReconnectAttempts &&
          timeSinceLastReconnect > 5000 // At least 5 seconds between reconnect attempts
        ) {
          console.log(`Test socket attempting reconnect (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          reconnectAttempts.current++;
          lastReconnectAttemptRef.current = now;
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (testSocket && !testSocket.connected) {
              testSocket.connect();
            }
          }, delay);
        }
      };
      
      testSocket.on('connect', onConnect);
      testSocket.on('disconnect', onDisconnect);
      
      // Set initial connection state
      setIsConnected(testSocket.connected);
      
      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        testSocket.off('connect', onConnect);
        testSocket.off('disconnect', onDisconnect);
        // Don't disconnect test sockets on unmount
      };
    } else {
      // For regular connections, use a singleton socket with proper cleanup
      if (!regularSocket) {
        console.log('Creating new regular socket connection');
        
        regularSocket = io(SOCKET_SERVER_URL, {
          transports: ['websocket'],
          reconnectionAttempts: maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          autoConnect: true,
        });
      }
      
      socketRef.current = regularSocket;
      
      // Handle regular socket reconnection
      const onConnect = () => {
        console.log('Regular socket connected with ID:', regularSocket?.id);
        setIsConnected(true);
        reconnectAttempts.current = 0;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
      };
      
      const onDisconnect = (reason: string) => {
        console.log('Regular socket disconnected:', reason);
        setIsConnected(false);
        
        const now = Date.now();
        const timeSinceLastReconnect = now - lastReconnectAttemptRef.current;
        
        if (
          (reason === 'io server disconnect' || reason === 'transport close') &&
          reconnectAttempts.current < maxReconnectAttempts &&
          timeSinceLastReconnect > 5000 // At least 5 seconds between reconnect attempts
        ) {
          console.log(`Regular socket attempting reconnect (${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          reconnectAttempts.current++;
          lastReconnectAttemptRef.current = now;
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (regularSocket && !regularSocket.connected) {
              regularSocket.connect();
            }
          }, delay);
        }
      };
      
      const onError = (error: Error) => {
        console.error('Socket error:', error);
        // If it's a rate limit error, wait longer before reconnecting
        if (error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            if (regularSocket && !regularSocket.connected) {
              regularSocket.connect();
            }
          }, 10000); // Wait 10 seconds before retrying after rate limit
        }
      };
      
      regularSocket.on('connect', onConnect);
      regularSocket.on('disconnect', onDisconnect);
      regularSocket.on('error', onError);
      regularSocket.on('connect_error', onError);
      
      // Set initial connection state
      setIsConnected(regularSocket?.connected || false);
      
      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (regularSocket) {
          regularSocket.off('connect', onConnect);
          regularSocket.off('disconnect', onDisconnect);
          regularSocket.off('error', onError);
          regularSocket.off('connect_error', onError);
        }
      };
    }
  }, [clientId, isTestConnection]);
  
  return { 
    socket: socketRef.current,
    isConnected
  };
}

export default useSocket; 