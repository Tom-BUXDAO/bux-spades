"use client";

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import type { GameState, Card, GameRules } from '@/types/game';

// Create separate socket instances for regular and test connections
let regularSocket: typeof Socket | null = null;
const testSockets: Map<string, typeof Socket> = new Map();
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export function useSocket(clientId: string = '') {
  const isTestConnection = clientId.startsWith('test_');
  const socketRef = useRef<typeof Socket | null>(null);
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
        
        testSocket = io(SOCKET_URL, {
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
        
        regularSocket = io(SOCKET_URL, {
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
      setIsConnected(regularSocket.connected);
      
      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        if (regularSocket) {
          regularSocket.off('connect', onConnect);
          regularSocket.off('disconnect', onDisconnect);
          regularSocket.off('error', onError);
          regularSocket.off('connect_error', onError);
          regularSocket.disconnect();
        }
      };
    }
  }, [clientId, isTestConnection]);
  
  return { 
    socket: socketRef.current,
    isConnected
  };
}

interface JoinOptions {
  name?: string;
  team?: 1 | 2;
  browserSessionId?: string;
  position?: number;
  image?: string;
}

// Helper function to safely emit events
function safeEmit(socket: typeof Socket | null, event: string, data: any) {
  if (!socket) return;
  if (!socket.connected) {
    console.log(`Socket not connected, queueing ${event} event`);
    socket.once('connect', () => {
      console.log(`Socket reconnected, emitting queued ${event} event`);
      socket.emit(event, data);
    });
    return;
  }
  socket.emit(event, data);
}

// Helper function to explicitly join a game room
export function joinGameRoom(socket: typeof Socket | null, gameId: string) {
  if (!socket || !gameId) return;
  console.log(`Explicitly joining game room: ${gameId}`);
  safeEmit(socket, 'join_room', { gameId });
}

// API Functions using socket
export function getGames(socket: typeof Socket | null, callback: (games: GameState[]) => void) {
  if (!socket) return () => {};
  
  // Create a wrapped callback with extra logging
  const wrappedCallback = (games: GameState[]) => {
    console.log(`Received games_update with ${games.length} games`);
    callback(games);
  };

  // Remove any existing listeners to prevent duplicates
  socket.off('games_update');
  socket.off('game_update');
  socket.off('game_over');
  socket.off('connect');

  // Listen for games update from server
  socket.on('games_update', wrappedCallback);
  
  // Listen for individual game updates and request full game list to ensure consistency
  socket.on('game_update', (updatedGame: GameState) => {
    console.log(`Received game_update for game: ${updatedGame.id}, status: ${updatedGame.status}, currentPlayer: ${updatedGame.currentPlayer}`);
    // Request full game list to ensure everything is in sync
    safeEmit(socket, 'get_games', undefined);
  });
  
  // Listen for game_over event
  socket.on('game_over', () => {
    console.log('Game over event received, requesting updated games list');
    // Request full game list to ensure everything is in sync
    safeEmit(socket, 'get_games', undefined);
  });
  
  // Request games again when reconnecting
  socket.on('connect', () => {
    console.log('Socket reconnected, requesting games list');
    safeEmit(socket, 'get_games', undefined);
  });
  
  // Initial request if already connected
  if (socket.connected) {
    safeEmit(socket, 'get_games', undefined);
  }
  
  // Return cleanup function
  return () => {
    socket.off('games_update', wrappedCallback);
    socket.off('game_update');
    socket.off('game_over');
    socket.off('connect');
  };
}

export function authenticateUser(socket: typeof Socket | null, userId: string) {
  if (!socket) return;
  socket.emit('authenticate', { userId });
}

export function createGame(socket: typeof Socket | null, user: { id: string; name?: string | null }, gameRules?: GameRules) {
  if (!socket) return;
  safeEmit(socket, 'create_game', { user, gameRules });
}

export function joinGame(socket: typeof Socket | null, gameId: string, userId: string, options?: JoinOptions) {
  if (!socket) return;
  console.log(`SOCKET JOIN: Game=${gameId}, Player=${userId}, Position=${options?.position}, Team=${options?.team}`);
  safeEmit(socket, 'join_game', { 
    gameId, 
    userId, 
    testPlayer: options ? {
      name: options.name || userId,
      team: options.team || 1,
      browserSessionId: options.browserSessionId,
      position: options.position,
      image: options.image
    } : undefined,
    position: options?.position
  });
}

export function leaveGame(socket: typeof Socket | null, gameId: string, userId: string) {
  if (!socket) return;
  safeEmit(socket, 'leave_game', { gameId, userId });
}

export function startGame(socket: typeof Socket | null, gameId: string, userId?: string) {
  if (!socket) return Promise.reject('No socket connection');
  
  console.log(`Attempting to start game: ${gameId} with user: ${userId || 'unknown'}`);
  
  return new Promise<void>((resolve, reject) => {
    // Remove any existing listeners
    socket.off('game_update');
    socket.off('error');
    
    const handleUpdate = (updatedGame: GameState) => {
      if (updatedGame.id === gameId) {
        console.log(`Game ${gameId} updated, status: ${updatedGame.status}`);
        if (updatedGame.status === 'BIDDING') {
          cleanup();
          resolve();
        }
      }
    };
    
    const handleError = (error: any) => {
      console.error("Start game error:", error);
      cleanup();
      reject(error);
    };
    
    const cleanup = () => {
      socket.off('game_update', handleUpdate);
      socket.off('error', handleError);
      if (timeoutId) clearTimeout(timeoutId);
    };
    
    socket.on('game_update', handleUpdate);
    socket.on('error', handleError);
    
    // Get current game state
    safeEmit(socket, 'get_game', { gameId });
    
    // Send start game command
    console.log(`Sending start_game command for game ${gameId}${userId ? ` with user ${userId}` : ''}`);
    safeEmit(socket, 'start_game', { gameId, userId });
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      cleanup();
      reject('Timeout waiting for game to start');
    }, 5000);
  });
}

export function makeMove(socket: typeof Socket | null, gameId: string, userId: string, move: any) {
  if (!socket) return;
  socket.emit('make_move', { gameId, userId, move });
}

export function makeBid(socket: typeof Socket | null, gameId: string, userId: string, bid: number) {
  if (!socket) return;
  safeEmit(socket, 'make_bid', { gameId, userId, bid });
}

export function playCard(socket: typeof Socket | null, gameId: string, userId: string, cardIndex: number) {
  if (!socket) return;
  safeEmit(socket, 'play_card', { gameId, userId, cardIndex });
}

export function sendChatMessage(socket: typeof Socket | null, gameId: string, userId: string, message: string) {
  if (!socket) return;
  if (!message.trim()) return;
  
  safeEmit(socket, 'chat_message', {
    gameId,
    userId,
    message: message.trim(),
    timestamp: Date.now()
  });
}

// Add a new debug function that logs trick winner information received from server
interface TrickWinnerData {
  winningCard?: {
    rank: number | string;
    suit: string;
  };
  winningPlayerId?: string;
  playerName?: string;
  gameId?: string;
}

export function debugTrickWinner(socket: typeof Socket | null, gameId: string) {
  if (!socket) return () => {};
  
  const handleTrickWinner = (data: { trickCards: Card[], winningIndex: number }) => {
    console.log('Trick winner debug:', {
      cards: data.trickCards.map(card => `${card.suit}${card.rank}`),
      winningIndex: data.winningIndex,
      winningCard: data.trickCards[data.winningIndex]
    });
  };
  
  socket.on('trick_winner', handleTrickWinner);
  
  return () => {
    socket.off('trick_winner', handleTrickWinner);
  };
}

export function setupTrickCompletionDelay(
  socket: typeof Socket | null, 
  gameId: string, 
  onTrickComplete: (data: { trickCards: Card[], winningIndex: number }) => void
) {
  if (!socket) return () => {};
  
  // Remove any existing listeners
  socket.off('trick_winner');
  socket.off('game_update');
  
  const handleTrickWinner = (data: { trickCards: Card[], winningIndex: number }) => {
    onTrickComplete(data);
  };
  
  socket.on('trick_winner', handleTrickWinner);
  
  // Return cleanup function
  return () => {
    socket.off('trick_winner', handleTrickWinner);
    socket.off('game_update');
  };
} 