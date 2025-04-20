"use client";

import { useState, useEffect, TouchEvent } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import type { GameState } from "@/types/game";
import type { Socket } from "socket.io-client";
import GameRulesModal, { GameRules } from './GameRulesModal';
import LobbyChat from './LobbyChat';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Add avatar constants at the top of the file
const GUEST_AVATAR = "/guest-avatar.png";
const BOT_AVATAR = "/guest-avatar.png";

// Add coin icon constant
const COIN_ICON = "/coin-svgrepo-com.svg";

interface GameLobbyProps {
  onGameSelect: (game: GameState) => void;
  user: {
    id: string;
    name?: string | null;
    isGuest?: boolean;
    image?: string | null;
    coins?: number;
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
    maxPoints: 500,
    coinAmount: 100000
  });
  const [showChat, setShowChat] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const router = useRouter();

  // Minimum swipe distance for gesture detection (in pixels)
  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      setShowChat(true);
    }
    if (isRightSwipe) {
      setShowChat(false);
    }
  };

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

  const handleSignIn = () => {
    router.push('/login');
  };

  const handleLogout = async () => {
    try {
      // Call our logout API endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      // Sign out from NextAuth
      await signOut({ redirect: true, callbackUrl: "/login" });
    } catch (error) {
      console.error('Logout error:', error);
    }
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
    <div className="h-[100vh] flex flex-col overflow-hidden bg-gray-900">
      {/* Header - fixed height */}
      <div className="flex-none h-16 px-4 bg-gray-800 shadow-md">
        <div className="flex justify-between items-center h-full">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white">Spades Lobby</h1>
          </div>

          <div className="flex items-center space-x-4">
            {user.id && !user.isGuest ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <Image
                      src={user.image || GUEST_AVATAR}
                      alt={user.name || "User"}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-medium hidden sm:block">
                      {user.name}
                    </span>
                    <div className="flex items-center space-x-1 text-yellow-400 text-sm font-bold hidden sm:block">
                      <Image 
                        src={COIN_ICON} 
                        alt="Coins" 
                        width={16} 
                        height={16} 
                        className="inline-block"
                      />
                      <span>{user.coins ? ((user.coins >= 1000000) ? `${Math.floor(user.coins / 1000000)} mil` : user.coins.toLocaleString()) : '0'}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <Image
                      src={GUEST_AVATAR}
                      alt={user.name || "Guest"}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-white font-medium hidden sm:block">
                    {user.name || "Guest"}
                  </span>
                </div>
                <button
                  onClick={handleSignIn}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  title="Sign In / Register"
                >
                  Sign In / Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Toggle - Only visible on mobile */}
      <div className="lg:hidden flex-none h-12 flex items-center justify-center bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-3">
          <span className={`text-sm font-medium ${!showChat ? 'text-white' : 'text-gray-400'}`}>Games</span>
          <div className="flex items-center bg-gray-700 rounded-full p-0.5">
            <button
              onClick={() => setShowChat(false)}
              className={`w-8 h-5 rounded-full text-sm font-medium transition-colors ${
                !showChat 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300'
              }`}
            />
            <button
              onClick={() => setShowChat(true)}
              className={`w-8 h-5 rounded-full text-sm font-medium transition-colors ${
                showChat 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300'
              }`}
            />
          </div>
          <span className={`text-sm font-medium ${showChat ? 'text-white' : 'text-gray-400'}`}>Chat</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0">
        <div 
          className="h-full p-4 flex space-x-4 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Games List Section */}
          <div className={`flex-1 flex flex-col min-w-0 ${showChat ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex-none flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Available Games</h2>
                <p className="text-gray-400 text-sm">{games.length} games available</p>
              </div>
              <button
                onClick={() => setShowRulesModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Game
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pr-2">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="border border-gray-700 rounded-lg p-4 bg-gray-800 shadow-md"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-white">
                        {(() => {
                          const rules = game.rules;
                          let max = 500, min = -150, nil = '❌N', bn = '❌BN';
                          let gameType = 'REG';
                          if (rules) {
                            max = rules.maxPoints;
                            min = rules.minPoints;
                            nil = rules.allowNil ? '✅N' : '❌N';
                            bn = rules.allowBlindNil ? '✅BN' : '❌BN';
                            // Map game type to display value
                            switch (rules.gameType) {
                              case 'REGULAR':
                                gameType = 'REG';
                                break;
                              case 'WHIZ':
                                gameType = 'WHIZ';
                                break;
                              case 'SOLO':
                                gameType = 'SOLO';
                                break;
                              case 'MIRROR':
                                gameType = 'MIRR';
                                break;
                              default:
                                gameType = 'REG';
                            }
                          }
                          return (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{gameType}</span>
                                <span className="text-sm">{max}/{min}</span>
                                {(rules?.gameType === 'REGULAR' || rules?.gameType === 'SOLO') && (
                                  <>
                                    <span className="text-sm">{nil}</span>
                                    <span className="text-sm">{bn}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-yellow-400 text-sm font-bold">
                                <Image 
                                  src={COIN_ICON} 
                                  alt="Coins" 
                                  width={14} 
                                  height={14} 
                                  className="inline-block"
                                />
                                <span>{rules?.coinAmount ? `${(rules.coinAmount / 1000)}k` : '100k'}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {game.players.length}/4
                      </div>
                    </div>

                    {/* Table visualization */}
                    <div className="relative mb-3 mx-auto" style={{ 
                      width: "320px", 
                      height: "200px",
                      maxWidth: "100%" 
                    }}>
                      {/* Table background */}
                      <div className="absolute inset-[15%] rounded-full bg-[#316785] border-4 border-[#855f31]"></div>
                      
                      {/* North position */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16">
                        {game.players.find(p => p.position === 2) ? (
                          <div className={`w-full h-full rounded-full overflow-hidden border-3 ${
                            getTeamForPosition(2) === 1 ? 'border-red-500' : 'border-blue-500'
                          } flex items-center justify-center bg-white`}>
                            <Image 
                              src={getPlayerAvatar(game.players.find(p => p.position === 2))} 
                              alt="Player avatar" 
                              className="w-full h-full object-cover"
                              width={64}
                              height={64}
                            />
                            <div className="absolute bottom-0 w-full bg-black bg-opacity-60 text-white text-[10px] py-0.5 text-center truncate">
                              {game.players.find(p => p.position === 2)?.name}
                            </div>
                          </div>
                        ) : (
                          game.status === "WAITING" && (
                            <button 
                              onClick={() => handleJoinGame(game.id, getTeamForPosition(2), 2)}
                              className={`w-full h-full rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xs font-medium border-3 ${
                                getTeamForPosition(2) === 1 ? 'border-red-500' : 'border-blue-500'
                              } text-white`}
                            >
                              Join
                            </button>
                          )
                        )}
                      </div>
                      
                      {/* East position */}
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 w-16 h-16">
                        {game.players.find(p => p.position === 3) ? (
                          <div className={`w-full h-full rounded-full overflow-hidden border-3 ${
                            getTeamForPosition(3) === 1 ? 'border-red-500' : 'border-blue-500'
                          } flex items-center justify-center bg-white`}>
                            <Image 
                              src={getPlayerAvatar(game.players.find(p => p.position === 3))} 
                              alt="Player avatar" 
                              className="w-full h-full object-cover"
                              width={64}
                              height={64}
                            />
                            <div className="absolute bottom-0 w-full bg-black bg-opacity-60 text-white text-[10px] py-0.5 text-center truncate">
                              {game.players.find(p => p.position === 3)?.name}
                            </div>
                          </div>
                        ) : (
                          game.status === "WAITING" && (
                            <button 
                              onClick={() => handleJoinGame(game.id, getTeamForPosition(3), 3)}
                              className={`w-full h-full rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xs font-medium border-3 ${
                                getTeamForPosition(3) === 1 ? 'border-red-500' : 'border-blue-500'
                              } text-white`}
                            >
                              Join
                            </button>
                          )
                        )}
                      </div>
                      
                      {/* South position */}
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16">
                        {game.players.find(p => p.position === 0) ? (
                          <div className={`w-full h-full rounded-full overflow-hidden border-3 ${
                            getTeamForPosition(0) === 1 ? 'border-red-500' : 'border-blue-500'
                          } flex items-center justify-center bg-white`}>
                            <Image 
                              src={getPlayerAvatar(game.players.find(p => p.position === 0))} 
                              alt="Player avatar" 
                              className="w-full h-full object-cover"
                              width={64}
                              height={64}
                            />
                            <div className="absolute bottom-0 w-full bg-black bg-opacity-60 text-white text-[10px] py-0.5 text-center truncate">
                              {game.players.find(p => p.position === 0)?.name}
                            </div>
                          </div>
                        ) : (
                          game.status === "WAITING" && (
                            <button 
                              onClick={() => handleJoinGame(game.id, getTeamForPosition(0), 0)}
                              className={`w-full h-full rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xs font-medium border-3 ${
                                getTeamForPosition(0) === 1 ? 'border-red-500' : 'border-blue-500'
                              } text-white`}
                            >
                              Join
                            </button>
                          )
                        )}
                      </div>
                      
                      {/* West position */}
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 w-16 h-16">
                        {game.players.find(p => p.position === 1) ? (
                          <div className={`w-full h-full rounded-full overflow-hidden border-3 ${
                            getTeamForPosition(1) === 1 ? 'border-red-500' : 'border-blue-500'
                          } flex items-center justify-center bg-white`}>
                            <Image 
                              src={getPlayerAvatar(game.players.find(p => p.position === 1))} 
                              alt="Player avatar" 
                              className="w-full h-full object-cover"
                              width={64}
                              height={64}
                            />
                            <div className="absolute bottom-0 w-full bg-black bg-opacity-60 text-white text-[10px] py-0.5 text-center truncate">
                              {game.players.find(p => p.position === 1)?.name}
                            </div>
                          </div>
                        ) : (
                          game.status === "WAITING" && (
                            <button 
                              onClick={() => handleJoinGame(game.id, getTeamForPosition(1), 1)}
                              className={`w-full h-full rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-xs font-medium border-3 ${
                                getTeamForPosition(1) === 1 ? 'border-red-500' : 'border-blue-500'
                              } text-white`}
                            >
                              Join
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Game actions buttons */}
                    <div className="flex gap-2">
                      {/* Show Join Game button if the player has already joined the game */}
                      {game.status !== "WAITING" && game.players.some(p => isControlledByThisBrowser(p.id, p.browserSessionId)) && (
                        <button
                          onClick={() => onGameSelect(game)}
                          className="flex-1 px-2 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                        >
                          Join Game
                        </button>
                      )}
                      
                      {/* Watch button for spectators */}
                      <button
                        onClick={() => onGameSelect(game)}
                        className="flex-1 px-2 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
                      >
                        Watch
                      </button>
                    </div>
                  </div>
                ))}
                {games.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-400 bg-gray-800 rounded-lg border border-gray-700">
                    No games available. Create one to start playing!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div className={`w-full lg:w-96 ${showChat ? 'flex' : 'hidden lg:block'}`}>
            <LobbyChat
              socket={socket}
              userId={user.id}
              userName={user.name || "Guest"}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        onSave={handleSaveRules}
        initialRules={gameRules}
        userCoins={user.coins || 0}
      />

      {showNameInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-white">Enter Your Name</h2>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded mb-4"
              placeholder="Your name"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNameInput(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleNameSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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