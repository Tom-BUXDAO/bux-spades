"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GameLobby from "@/components/lobby/GameLobby";
import GameTable from "@/components/game/GameTable";
import type { GameState } from "@/types/game";
import { useSocket } from "@/lib/socket";
import * as socketApi from "@/lib/socket";
import WelcomeModal from "@/components/WelcomeModal";

export default function GamePage() {
  const router = useRouter();
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [guestUser, setGuestUser] = useState<any>(null);
  const [games, setGames] = useState<GameState[]>([]);
  const { socket, isConnected } = useSocket();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check-auth');
        const data = await response.json();
        
        if (!data.authenticated) {
          // User is not authenticated, redirect to login
          window.location.href = '/login';
          return;
        }
        
        // User is authenticated, get user data
        const userResponse = await fetch('/api/auth/user');
        const userData = await userResponse.json();
        
        if (userResponse.ok) {
          setUser(userData.user);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login';
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    // Check if this is a new user by looking at the user data
    // If the user has exactly 5,000,000 coins, they are likely a new user
    const isNewUserByCoins = user?.coins === 5000000;
    
    // Show welcome modal for new users
    if (isNewUserByCoins) {
      console.log("New user detected, showing welcome modal");
      setShowWelcomeModal(true);
    }
  }, [user]);

  useEffect(() => {
    // Check for guest user in localStorage
    const storedGuest = localStorage.getItem('guestUser');
    if (storedGuest) {
      setGuestUser(JSON.parse(storedGuest));
    }
  }, []);

  // Clean up any lingering game connections when component mounts
  useEffect(() => {
    if (!socket) return;
    
    // Clean up any lingering game connections when component mounts
    const userId = user?.id || guestUser?.id;
    if (userId) {
      console.log("Cleaning up previous connections for user:", userId);
      socket.emit("close_previous_connections", { userId });
    }

    // Listen for game updates
    const handleGamesUpdate = (updatedGames: GameState[]) => {
      setGames(updatedGames);
      
      if (currentGame) {
        const updatedGame = updatedGames.find(g => g.id === currentGame.id);
        if (updatedGame) {
          // Compare currentPlayer before and after update to see if it changed
          if (currentGame.currentPlayer !== updatedGame.currentPlayer) {
            console.log(`Game ${updatedGame.id} turn changed: ${currentGame.currentPlayer} -> ${updatedGame.currentPlayer}`);
          }
          
          // Check if any player's bid changed
          currentGame.players.forEach((oldPlayer, index) => {
            const newPlayer = updatedGame.players[index];
            if (newPlayer && oldPlayer.bid !== newPlayer.bid) {
              console.log(`Player ${newPlayer.name} bid changed: ${oldPlayer.bid} -> ${newPlayer.bid}`);
            }
          });
          
          // Update the game state
          setCurrentGame(updatedGame);
        } else {
          // If game no longer exists, return to lobby
          console.log(`Game ${currentGame.id} no longer exists, returning to lobby`);
          setCurrentGame(null);
        }
      }
    };

    // Set up socket event listeners
    socket.on('games_update', handleGamesUpdate);
    
    // Request initial games list
    socket.emit('get_games');

    // Clean up event listeners
    return () => {
      socket.off('games_update', handleGamesUpdate);
    };
  }, [socket, currentGame, user?.id, guestUser?.id]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Allow access if user is either authenticated via NextAuth or has guest data
  if (!user && !guestUser) {
    window.location.href = "/";
    return null;
  }

  const handleGameSelect = (game: GameState) => {
    setCurrentGame(game);
  };

  const handleLeaveTable = () => {
    console.log("Leaving table, resetting current game");
    // Reset the current game to return to the lobby
    setCurrentGame(null);
  };

  // Create wrapper functions to match old API
  const createGame = (user: any, rules?: any) => {
    if (socket) socketApi.createGame(socket, user, rules);
  };

  const joinGame = (gameId: string, userId: string, options?: any) => {
    if (socket) socketApi.joinGame(socket, gameId, userId, options);
  };

  const startGame = (gameId: string, userId?: string) => {
    if (!socket) return Promise.reject("No socket connection");
    return socketApi.startGame(socket, gameId, userId || user?.id);
  };

  const closeAllPreviousConnections = (userId: string) => {
    if (socket) socket.emit("close_previous_connections", { userId });
  };

  // Create onGamesUpdate with same API as before to avoid changing GameLobby
  const onGamesUpdate = (callback: (games: GameState[]) => void) => {
    if (!socket) return () => {};
    
    // Initial callback with current games
    callback(games);
    
    // Set up listener
    socket.on('games_update', callback);
    
    // Return cleanup function
    return () => {
      socket.off('games_update', callback);
    };
  };
  
  // Create a type-casting wrapper to fix incompatibility
  function wrapSetGames(updater: React.Dispatch<React.SetStateAction<GameState[]>>) {
    return (games: GameState[]) => {
      updater(games);
    };
  }

  return (
    <>
      <main className="container mx-auto p-4 min-h-screen overflow-y-auto">
        {currentGame ? (
          <GameTable 
            game={currentGame} 
            socket={socket}
            createGame={createGame}
            joinGame={joinGame}
            onGamesUpdate={setGames}
            onLeaveTable={handleLeaveTable}
            startGame={startGame}
            user={user || guestUser}
          />
        ) : (
          <GameLobby 
            onGameSelect={handleGameSelect} 
            user={user || guestUser}
            socket={socket}
            createGame={createGame}
            joinGame={joinGame}
            onGamesUpdate={onGamesUpdate}
          />
        )}
      </main>
      <WelcomeModal 
        isOpen={showWelcomeModal} 
        onClose={() => setShowWelcomeModal(false)} 
      />
    </>
  );
} 