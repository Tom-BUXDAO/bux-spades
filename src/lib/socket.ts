"use client";

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import type { GameState, Card, GameRules } from '@/types/game';
import { PrismaClient, GameStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Create separate socket instances for regular and test connections
let regularSocket: typeof Socket | null = null;
const testSockets: Map<string, typeof Socket> = new Map();
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Rate limit handling
const eventQueue = new Map<string, Array<{ event: string; data: any; }>>();
const rateLimitedEvents = new Set<string>();
const MAX_QUEUE_SIZE = 10;
const BASE_RETRY_DELAY = 1000;

function handleRateLimit(socket: typeof Socket, event: string, data: any) {
  // Add to queue if not full
  if (!eventQueue.has(event)) {
    eventQueue.set(event, []);
  }
  const queue = eventQueue.get(event)!;
  if (queue.length < MAX_QUEUE_SIZE) {
    queue.push({ event, data });
  }
  
  // Mark event as rate limited
  rateLimitedEvents.add(event);
  
  // Set retry with exponential backoff
  const retryDelay = BASE_RETRY_DELAY * Math.pow(2, queue.length);
  setTimeout(() => {
    if (socket.connected && rateLimitedEvents.has(event)) {
      const nextEvent = queue.shift();
      if (nextEvent) {
        rateLimitedEvents.delete(event);
        safeEmit(socket, nextEvent.event, nextEvent.data);
      }
    }
  }, retryDelay);
}

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
        // If it's a rate limit error, handle with queue system
        if (error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
          const event = error.message.match(/rate limiting (\w+)/)?.[1];
          if (event) {
            rateLimitedEvents.add(event);
            console.log(`Rate limited for event: ${event}, will retry with backoff`);
          }
          return;
        }
        // Other error handling...
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
      if (!rateLimitedEvents.has(event)) {
        socket.emit(event, data);
      } else {
        handleRateLimit(socket, event, data);
      }
    });
    return;
  }
  
  if (rateLimitedEvents.has(event)) {
    handleRateLimit(socket, event, data);
  } else {
    socket.emit(event, data);
  }
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

// Get socket instance
function getSocket(): typeof Socket | null {
  return regularSocket;
}

// Game completion handling
function handleGameCompletion(socket: typeof Socket, gameId: string) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off('game_complete', onGameComplete);
      socket.off('game_error', onGameError);
    };

    const onGameComplete = async (data: { 
      gameId: string;
      winners: Array<{ userId: string; coins: number; position: number }>;
      timestamp: number;
    }) => {
      if (data.gameId !== gameId) return;
      
      try {
        // Update player stats and coins
        for (const winner of data.winners) {
          await prisma.user.update({
            where: { id: winner.userId },
            data: { 
              coins: { increment: winner.coins },
              // Update game player record with final score
              gamePlayers: {
                update: {
                  where: {
                    gameId_position: {
                      gameId: gameId,
                      position: winner.position
                    }
                  },
                  data: {
                    score: { increment: winner.coins }
                  }
                }
              }
            }
          });
        }
        
        // Mark game as completed
        await prisma.game.update({
          where: { id: gameId },
          data: { 
            status: GameStatus.FINISHED,
            updatedAt: new Date(data.timestamp)
          }
        });

        cleanup();
        resolve(data);
      } catch (error) {
        console.error('Error handling game completion:', error);
        cleanup();
        reject(error);
      }
    };

    const onGameError = (error: any) => {
      console.error('Game error:', error);
      cleanup();
      reject(error);
    };

    socket.on('game_complete', onGameComplete);
    socket.on('game_error', onGameError);

    // Set timeout for completion
    setTimeout(() => {
      cleanup();
      reject(new Error('Game completion timeout'));
    }, 30000); // 30 second timeout
  });
}

// Modify startGame to use completion handling
export function startGame(socket: typeof Socket | null, gameId: string, userId?: string): Promise<void> {
  if (!socket) return Promise.reject("No socket connection");
  
  return new Promise<void>((resolve, reject) => {
    console.log('Starting game:', { gameId, userId });
    
    const cleanup = () => {
      socket.off('game_started', onGameStarted);
      socket.off('game_error', onGameError);
    };

    const onGameStarted = (gameState: GameState) => {
      cleanup();
      resolve(); // Resolve without passing the gameState
    };

    const onGameError = (error: any) => {
      console.error('Error starting game:', error);
      cleanup();
      reject(error);
    };

    socket.on('game_started', onGameStarted);
    socket.on('game_error', onGameError);
    
    socket.emit('start_game', { gameId, userId });
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