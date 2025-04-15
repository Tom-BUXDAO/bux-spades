"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import GameLobby from "@/components/lobby/GameLobby";
import GameTable from "@/components/game/GameTable";
import type { GameState } from "@/types/game";
import { useSocket } from "@/lib/socket";
import * as socketApi from "@/lib/socket";

export default function GamePage() {
  const { data: session, status } = useSession();
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [guestUser, setGuestUser] = useState<any>(null);
  const [games, setGames] = useState<GameState[]>([]);
  const { socket, isConnected } = useSocket("");

  useEffect(() => {
    // Check for guest user in localStorage
    const storedGuest = localStorage.getItem('guestUser');
    if (storedGuest) {
      setGuestUser(JSON.parse(storedGuest));
    }
  }, []);

  // Clean up any lingering game connections when component mounts
  useEffect(() => {
    if (socket && (session?.user?.id || guestUser?.id)) {
      const userId = session?.user?.id || guestUser?.id;
      if (userId) {
        console.log("Cleaning up previous connections for user:", userId);
        socket.emit("close_previous_connections", { userId });
      }
    }
  }, [socket, session?.user?.id, guestUser?.id]);

  useEffect(() => {
    if (!socket) return;
    
    // Listen for game updates
    const cleanup = socketApi.getGames(socket, (updatedGames) => {
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
      
      console.log("Available games:", updatedGames.length);
    });

    return cleanup;
  }, [socket, currentGame]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  // Allow access if user is either authenticated via NextAuth or has guest data
  if (status === "unauthenticated" && !guestUser) {
    redirect("/");
  }

  const handleGameSelect = (game: GameState) => {
    setCurrentGame(game);
  };

  const handleLeaveTable = () => {
    console.log("Leaving table, resetting current game");
    // Reset the current game to return to the lobby
    setCurrentGame(null);
  };

  // Use either NextAuth session or guest user data
  const user = session?.user || guestUser;

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
          user={user}
        />
      ) : (
        <GameLobby 
          onGameSelect={handleGameSelect} 
          user={user}
          socket={socket}
          createGame={createGame}
          joinGame={joinGame}
          onGamesUpdate={onGamesUpdate}
        />
      )}
    </main>
  );
} 