"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import type { GameState } from "@/types/game";
import type { Socket } from "socket.io-client";
import GameRulesModal, { GameRules } from './GameRulesModal';
import LobbyChat from './LobbyChat';

interface GameLobbyProps {
  onGameSelect: (game: GameState) => void;
  user: {
    id: string;
    name?: string | null;
    isGuest?: boolean;
    image?: string | null;
  };
  socket: typeof Socket | null;
  createGame: (user: { id: string; name?: string | null; image?: string | null }, rules: GameRules) => void;
  joinGame: (gameId: string, userId: string, testPlayer?: { 
    name: string; 
    team: 1 | 2; 
    browserSessionId?: string; 
    position?: number; 
    image?: string;
  }) => void;
  onGamesUpdate: (callback: (games: GameState[]) => void) => () => void;
}

// Add avatar constants at the top of the file
const GUEST_AVATAR = "/guest-avatar.png";
const BOT_AVATAR = "/guest-avatar.png";

export default function GameLobby({ 
  onGameSelect, 
  user, 
  socket, 
  createGame, 
  joinGame, 
  onGamesUpdate 
}: GameLobbyProps) {
  const [games, setGames] = useState<GameState[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [selectedGame, setSelectedGame] = useState<{ gameId: string; team: 1 | 2; position?: number } | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [testPlayerName, setTestPlayerName] = useState("");
  const [browserSessionId] = useState(() => {
    // Get or create a unique browser session ID
    let sessionId = localStorage.getItem('browserSessionId');
    if (!sessionId) {
      sessionId = `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('browserSessionId', sessionId);
    }
    return sessionId;
  });
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [gameRules, setGameRules] = useState<GameRules>({
    gameType: 'REGULAR',
    allowNil: true,
    allowBlindNil: false,
    minPoints: -250,
    maxPoints: 500
  });

  useEffect(() => {
    // Track if this effect has run to prevent duplicate handlers
    let isEffectActive = true;
    
    const unsubscribe = onGamesUpdate(setGames);

    // Keep track of games list requests - use ref to maintain state between renders
    const requestState = {
      hasRequested: false,
      timeoutId: null as NodeJS.Timeout | null
    };

    // Clean up function to ensure we don't have memory leaks
    const cleanup = () => {
      if (requestState.timeoutId) {
        clearTimeout(requestState.timeoutId);
        requestState.timeoutId = null;
      }
    };

    // Ensure the socket is connected and emit 'get_games'
    if (socket && isEffectActive) {
      // Throttled games request function
      const requestGames = () => {
        cleanup(); // Clear any existing timeout
        
        console.log("Requesting games list");
        socket.emit("get_games");
        
        // Set a flag to prevent multiple requests
        requestState.hasRequested = true;
        
        // Reset the flag after some time to allow future requests, if needed
        requestState.timeoutId = setTimeout(() => {
          requestState.hasRequested = false;
          requestState.timeoutId = null;
        }, 10000); // 10 second cooldown
      };

      // Connect event handler
      const handleConnect = () => {
        console.log("Connected with socket ID:", socket.id);
        // Emit a custom event to close previous connections
        socket.emit("close_previous_connections", { userId: user.id });
        
        // Request games list once on connection if needed
        if (!requestState.hasRequested) {
          requestGames();
        }
      };

      // One-time initialize
      console.log("Setting up socket event handlers");
      
      // Remove any existing listeners first to prevent duplicates
      socket.off("connect");
      socket.off("error");
      socket.off("game_created");
      socket.off("game_update");
      
      // Set up event listeners
      socket.on("connect", handleConnect);
      
      // Set up error event handler
      const handleError = ({ message }: { message: string }) => {
        console.error("Game error:", message);
        
        // If the error is that the user already has a game, find and join it
        if (message === 'You already have a game') {
          console.log("User already has a game, looking for it in the games list");
          
          const existingGame = games.find(game => 
            game.players.some(player => player.id === user.id)
          );
          
          if (existingGame) {
            console.log("Found existing game, selecting it:", existingGame.id);
            setCurrentPlayerId(user.id);
            onGameSelect(existingGame);
          } else {
            console.log("Could not find existing game, requesting games update once");
            // Request an update of the games list, but only once
            if (!requestState.hasRequested) {
              console.log("Requesting games list after error");
              requestGames();
            }
          }
        }
      };
      
      // Set up game creation handler
      const handleGameCreated = ({ gameId, game }: { gameId: string; game: GameState }) => {
        console.log("Game created:", gameId);
        setCurrentPlayerId(user.id);
        
        // Explicitly join the game after creation
        console.log("Explicitly joining game after creation:", gameId);
        socket.emit("join_game", { 
          gameId, 
          userId: user.id, 
          testPlayer: { 
            name: user.name || "Unknown Player", 
            team: 1 
          } 
        });
        
        onGameSelect(game);
      };
      
      // Set up game update handler
      const handleGameUpdate = (game: GameState) => {
        console.log("Received game_update for game:", game.id, "with players:", game.players);
        onGameSelect(game);
      };
      
      // Register event handlers
      socket.on("error", handleError);
      socket.on("game_created", handleGameCreated);
      socket.on("game_update", handleGameUpdate);
      
      // Initial connection handling
      if (socket.connected) {
        handleConnect();
      }

      // Clean up 
      return () => {
        // Mark effect as inactive
        isEffectActive = false;
        
        cleanup(); // Clear any timeouts
        
        // Remove all event listeners
        socket.off("connect", handleConnect);
        socket.off("error", handleError);
        socket.off("game_created", handleGameCreated);
        socket.off("game_update", handleGameUpdate);
      };
    }

    // Clean up the effects
    return () => {
      unsubscribe();
      cleanup();
    };
  }, [onGamesUpdate, socket, user.id, onGameSelect]);

  const handleCreateGame = () => {
    setShowRulesModal(true);
  };

  const handleSaveRules = (rules: GameRules) => {
    setGameRules(rules);
    if (user) {
      createGame(user, rules);
    }
  };

  const handleJoinGame = async (gameId: string, team: 1 | 2, position?: number) => {
    if (!user?.id) return;

    if (!user.name) {
      setShowNameInput(true);
      setSelectedGame({ gameId, team, position });
      return;
    }

    // Get the game to check if the position is already taken
    const game = games.find(g => g.id === gameId);
    
    // Log everything about this join attempt
    console.log("JOIN ATTEMPT:", {
      gameId,
      userId: user.id,
      userName: user.name,
      requestedPosition: position,
      requestedTeam: team
    });
    
    // Force position to be respected - server will place player at exactly this position
    console.log(`Attempting to join game with EXPLICIT position ${position}`);
    
    // Join as the user with team selection 
    joinGame(gameId, user.id, { 
      name: user.name, 
      team,
      browserSessionId,
      position, // This is the key part - we're passing the exact position
      image: user.image || undefined
    });
    
    setTestPlayerName("");
    setSelectedGame(null);
  };

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      setShowNameInput(false);
      if (selectedGame) {
        console.log(`Guest player ${playerName} joining with EXPLICIT position ${selectedGame.position}`);
        
        joinGame(
          selectedGame.gameId, 
          user.id, 
          { 
            name: playerName, 
            team: selectedGame.team,
            browserSessionId,
            position: selectedGame.position // Make sure position is passed
          }
        );
      }
      setPlayerName("");
      setSelectedGame(null);
    }
  };

  const handleLogout = () => {
    signOut({ 
      callbackUrl: "/login"
    });
  };

  // Function to check if a player is controlled by this browser
  const isControlledByThisBrowser = (playerId: string, browserSessionId?: string) => {
    return user.id === playerId || browserSessionId === browserSessionId;
  };

  // Determine team based on position - North/South (0,2) are Team 1, East/West (1,3) are Team 2
  const getTeamForPosition = (position: number): 1 | 2 => {
    // North/South (positions 0,2) are Team 1
    // East/West (positions 1,3) are Team 2
    return position % 2 === 0 ? 1 : 2;
  };

  // Get a player's avatar
  const getPlayerAvatar = (player: any): string => {
    // If player has their own image property, use that first
    if (player && player.image) {
      return player.image;
    }
    
    // Discord user ID (numeric string)
    if (player && player.id && /^\d+$/.test(player.id)) {
      // For Discord users without an avatar hash or with invalid avatar, use the default Discord avatar
      return `https://cdn.discordapp.com/embed/avatars/${parseInt(player.id) % 5}.png`;
    }
    
    // Guest user, use default avatar
    if (player && player.id && player.id.startsWith('guest_')) {
      return GUEST_AVATAR;
    }
    
    // Fallback to bot avatar
    return BOT_AVATAR;
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none p-4 bg-white shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Spades Lobby</h1>
          <div className="flex items-center space-x-4">
            {user.isGuest ? (
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 flex space-x-4 overflow-hidden">
        {/* Games List Section */}
        <div className="flex-1 flex flex-col space-y-4 min-w-0">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowRulesModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create Game
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
            {games.map((game) => (
              <div
                key={game.id}
                className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold">Game #{game.id.slice(-4)}</h3>
                    <p className="text-sm text-gray-600">
                      {game.rules.gameType} • {game.rules.allowNil ? '✅N' : '❌N'} • {game.rules.minPoints} to {game.rules.maxPoints}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[1, 2, 3, 4].map((position) => {
                    const player = game.players.find((p) => p.position === position);
                    const team = getTeamForPosition(position);
                    return (
                      <div
                        key={position}
                        className={`p-2 rounded ${
                          team === 1 ? 'bg-blue-50' : 'bg-red-50'
                        }`}
                      >
                        {player ? (
                          <div className="flex items-center space-x-2">
                            <Image
                              src={getPlayerAvatar(player)}
                              alt={player.name}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                            <span className="text-sm truncate">
                              {player.name}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleJoinGame(game.id, team, position)}
                            className="w-full text-sm text-gray-500 hover:text-gray-700"
                          >
                            Join (Team {team})
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {game.players.some((p) => p.id === user.id) && (
                  <div className="text-center">
                    <button
                      onClick={() => onGameSelect(game)}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full"
                    >
                      Return to Game
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Section */}
        <div className="w-96 hidden lg:block">
          <LobbyChat
            socket={socket}
            userId={user.id}
            userName={user.name || "Guest"}
          />
        </div>
      </div>

      {/* Modals */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        onSave={handleSaveRules}
        initialRules={gameRules}
      />

      {showNameInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h2 className="text-xl font-bold mb-4">Enter Your Name</h2>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-2 border rounded mb-4"
              placeholder="Your name"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNameInput(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleNameSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 