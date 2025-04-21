"use client";

import { useEffect, useRef, useState } from 'react';
import { Manager } from 'socket.io-client';
import type { Socket as SocketIOClient } from 'socket.io-client/build/esm/socket';
import type { GameState, Card, GameRules } from '@/types/game';
import { useSession } from 'next-auth/react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Socket configuration
const socketConfig = {
  transports: ['websocket'],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 30000,
  withCredentials: true,
  path: '/socket.io/',
  forceNew: true,
};

export const useSocket = () => {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<SocketIOClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      console.log('No session, skipping socket connection');
      return;
    }

    console.log('Connecting to socket with session:', session);

    const newSocket = new Manager(SOCKET_URL, socketConfig);
    const socketInstance = newSocket.socket('/');

    socketInstance.on('connect', () => {
      console.log('Socket connected, authenticating...');
      setIsConnected(true);
      socketInstance.emit('authenticate', { userId: session.user.id });
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('authenticated', () => {
      console.log('Socket authenticated successfully');
      setError(null);
    });

    socketInstance.on('error', (err: string) => {
      console.error('Socket error:', err);
      setError(err);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [session]);

  return { socket, error, isConnected };
};

// Helper function to explicitly join a game room
export function joinGameRoom(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string) {
  if (!socket || !gameId) return;
  console.log(`Explicitly joining game room: ${gameId}`);
  socket.emit('join_room', { gameId });
}

// API Functions using socket
export function getGames(socket: ReturnType<typeof Manager.prototype.socket> | null, callback: (games: GameState[]) => void) {
  if (!socket) return () => {};
  
  const wrappedCallback = (games: GameState[]) => {
    console.log(`Received games_update with ${games.length} games`);
    callback(games);
  };

  socket.on('games_update', wrappedCallback);
  
  socket.on('game_update', (updatedGame: GameState) => {
    console.log(`Received game_update for game: ${updatedGame.id}`);
    socket.emit('get_games');
  });
  
  socket.on('game_over', (data: { team1Score: number, team2Score: number, winningTeam: 1 | 2, team1Bags: number, team2Bags: number }) => {
    console.log('Game over event received:', data);
    socket.emit('get_games');
  });
  
  socket.emit('get_games');
  
  socket.on('connect', () => {
    console.log('Socket reconnected, requesting games list');
    socket.emit('get_games');
  });
  
  return () => {
    socket.off('games_update', wrappedCallback);
    socket.off('game_update');
    socket.off('game_over');
    socket.off('connect');
  };
}

export function authenticateUser(socket: ReturnType<typeof Manager.prototype.socket> | null, userId: string) {
  if (!socket) return;
  socket.emit('authenticate', { userId });
}

export function createGame(socket: ReturnType<typeof Manager.prototype.socket> | null, user: { id: string; name?: string | null }, gameRules?: GameRules) {
  if (!socket) return;
  socket.emit('create_game', { user, gameRules });
}

interface JoinOptions {
  name?: string;
  team?: 1 | 2;
  browserSessionId?: string;
  position?: number;
  image?: string;
}

export function joinGame(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, userId: string, options?: JoinOptions) {
  if (!socket) return;
  console.log(`SOCKET JOIN: Game=${gameId}, Player=${userId}, Position=${options?.position}, Team=${options?.team}`);
  socket.emit('join_game', { 
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

export function leaveGame(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, userId: string) {
  if (!socket) return;
  socket.emit('leave_game', { gameId, userId });
}

export function startGame(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, userId?: string) {
  if (!socket) return Promise.reject('No socket connection');
  
  return new Promise<void>((resolve, reject) => {
    const handleUpdate = (updatedGame: GameState) => {
      if (updatedGame.id === gameId && updatedGame.status === 'BIDDING') {
        socket.off('game_update', handleUpdate);
        resolve();
      }
    };
    
    const handleError = (error: any) => {
      console.error("Start game error:", error);
      socket.off('error', handleError);
      socket.off('game_update', handleUpdate);
      reject(error);
    };
    
    socket.on('game_update', handleUpdate);
    socket.on('error', handleError);
    
    socket.emit('start_game', { gameId, userId });
    
    setTimeout(() => {
      socket.off('game_update', handleUpdate);
      socket.off('error', handleError);
      reject('Timeout waiting for game to start');
    }, 5000);
  });
}

export function makeMove(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, userId: string, move: any) {
  if (!socket) return;
  socket.emit('make_move', { gameId, userId, move });
}

export function makeBid(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, userId: string, bid: number) {
  if (!socket) return;
  socket.emit('make_bid', { gameId, userId, bid });
}

export function playCard(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, userId: string, card: Card) {
  if (!socket) return;
  socket.emit('play_card', { gameId, userId, card });
}

export function sendChatMessage(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, message: any) {
  if (!socket) {
    console.error('Cannot send chat message: socket is null');
    return;
  }
  
  const sendWithRetry = (retryCount = 0) => {
    if (!socket.connected) {
      if (retryCount < 3) {
        console.log(`Socket not connected, retrying in ${Math.pow(2, retryCount)}s...`);
        setTimeout(() => sendWithRetry(retryCount + 1), Math.pow(2, retryCount) * 1000);
      } else {
        console.error('Failed to send message after 3 retries');
      }
      return;
    }

    try {
      console.log(`Sending chat message to game ${gameId}:`, message);
      socket.emit('chat_message', { 
        gameId, 
        message 
      }, (ack: any) => {
        if (ack?.error) {
          console.error('Error acknowledgment from server:', ack.error);
          if (retryCount < 3) {
            setTimeout(() => sendWithRetry(retryCount + 1), Math.pow(2, retryCount) * 1000);
          }
        }
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      if (retryCount < 3) {
        setTimeout(() => sendWithRetry(retryCount + 1), Math.pow(2, retryCount) * 1000);
      }
    }
  };

  sendWithRetry();
}

interface TrickWinnerData {
  winningCard?: {
    rank: number | string;
    suit: string;
  };
  winningPlayerId?: string;
  playerName?: string;
  gameId?: string;
}

export function debugTrickWinner(socket: ReturnType<typeof Manager.prototype.socket> | null, gameId: string, onTrickWinnerDetermined?: (data: TrickWinnerData) => void) {
  if (!socket) {
    console.error('Cannot setup debug: socket is null');
    return;
  }
  
  socket.on('trick_winner', (data: TrickWinnerData) => {
    console.log('🎯 DEBUG TRICK WINNER:', data);
    if (onTrickWinnerDetermined && data.gameId === gameId) {
      onTrickWinnerDetermined(data);
    }
  });
  
  return () => {
    socket.off('trick_winner');
  };
}

export function setupTrickCompletionDelay(
  socket: ReturnType<typeof Manager.prototype.socket> | null, 
  gameId: string, 
  onTrickComplete: (data: { trickCards: Card[], winningIndex: number }) => void
) {
  if (!socket) return () => {};
  
  let lastCompleteTrick: Card[] = [];
  let lastWinningData: TrickWinnerData | null = null;
  
  const handleTrickWinner = (data: TrickWinnerData) => {
    if (data.gameId !== gameId) return;
    lastWinningData = data;
  };
  
  socket.on('game_update', (data: GameState) => {
    if (data.id !== gameId) return;
    
    if (data.currentTrick && data.currentTrick.length === 4) {
      lastCompleteTrick = [...data.currentTrick];
      
      if (lastWinningData?.winningCard) {
        const winningIndex = lastCompleteTrick.findIndex(
          card => card.rank === lastWinningData?.winningCard?.rank && 
                 card.suit === lastWinningData?.winningCard?.suit
        );
        
        if (winningIndex >= 0) {
          onTrickComplete({
            trickCards: lastCompleteTrick,
            winningIndex
          });
        }
      }
    }
    else if (data.currentTrick && data.currentTrick.length === 0) {
      lastCompleteTrick = [];
      lastWinningData = null;
    }
  });
  
  socket.on('trick_winner', handleTrickWinner);
  
  return () => {
    socket.off('trick_winner', handleTrickWinner);
    socket.off('game_update');
  };
} 