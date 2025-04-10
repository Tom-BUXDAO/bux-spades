"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import type { GameState, Card, Suit } from "@/types/game";
import type { Socket } from "socket.io-client";
import { useSocket } from "@/lib/socket";
import Chat from './Chat';
import HandSummaryModal from './HandSummaryModal';
import WinnerModal from './WinnerModal';
import BiddingInterface from './BiddingInterface';
import { calculateHandScore } from '@/lib/scoring';
import LandscapePrompt from '@/components/LandscapePrompt';

interface GameTableProps {
  game: GameState;
  socket: typeof Socket | null;
  createGame: (user: { id: string; name?: string | null }) => void;
  joinGame: (gameId: string, userId: string, options?: any) => void;
  onGamesUpdate: React.Dispatch<React.SetStateAction<GameState[]>>;
  onLeaveTable: () => void;
  startGame: (gameId: string, userId?: string) => Promise<void>;
  user?: any;
}

// Fallback avatars 
const GUEST_AVATAR = "/guest-avatar.png";
const BOT_AVATAR = "/guest-avatar.png";

// Helper function to get card image filename
function getCardImage(card: Card): string {
  const rankMap: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };
  return `${rankMap[card.rank]}${card.suit}.png`;
}

// Helper function to get card rank value
function getCardValue(rank: string): number {
  const rankMap: { [key: string]: number } = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return rankMap[rank];
}

// Helper function to get suit order
function getSuitOrder(suit: string): number {
  const suitOrder: { [key: string]: number } = {
    '♣': 1, // Clubs first
    '♥': 2, // Hearts second
    '♦': 3, // Diamonds third
    '♠': 4  // Spades last
  };
  return suitOrder[suit];
}

// Helper function to sort cards
function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitOrder: Record<Suit, number> = { 'D': 0, 'C': 1, 'H': 2, 'S': 3 };
    if (a.suit !== b.suit) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return a.rank - b.rank;
  });
}

// Add new helper functions after the existing ones
function getLeadSuit(trick: Card[]): Suit | null {
  return trick[0]?.suit || null;
}

function hasSpadeBeenPlayed(game: GameState): boolean {
  // Check if any completed trick contained a spade
  return game.completedTricks?.some((trick: Card[]) => 
    trick.some((card: Card) => card.suit === 'S')
  ) || false;
}

function canLeadSpades(game: GameState, hand: Card[]): boolean {
  // Can lead spades if:
  // 1. Spades have been broken, or
  // 2. Player only has spades left
  return hasSpadeBeenPlayed(game) || hand.every(card => card.suit === 'S');
}

function getPlayableCards(game: GameState, hand: Card[], isLeadingTrick: boolean): Card[] {
  if (!hand.length) return [];

  // If leading the trick
  if (isLeadingTrick) {
    // If spades haven't been broken, filter out spades unless only spades remain
    if (!canLeadSpades(game, hand)) {
      const nonSpades = hand.filter(card => card.suit !== 'S');
      return nonSpades.length > 0 ? nonSpades : hand;
    }
    return hand;
  }

  // If following
  const leadSuit = getLeadSuit(game.currentTrick);
  if (!leadSuit) return [];

  // Must follow suit if possible
  const suitCards = hand.filter(card => card.suit === leadSuit);
  return suitCards.length > 0 ? suitCards : hand;
}

function determineWinningCard(trick: Card[]): number {
  if (!trick.length) return -1;

  const leadSuit = trick[0].suit;
  let highestSpade: Card | null = null;
  let highestLeadSuit: Card | null = null;

  trick.forEach((card, index) => {
    if (card.suit === 'S') {
      if (!highestSpade || card.rank > highestSpade.rank) {
        highestSpade = card;
      }
    } else if (card.suit === leadSuit) {
      if (!highestLeadSuit || card.rank > highestLeadSuit.rank) {
        highestLeadSuit = card;
      }
    }
  });

  // If any spades were played, highest spade wins
  if (highestSpade) {
    return trick.findIndex(card => 
      card.suit === highestSpade!.suit && card.rank === highestSpade!.rank
    );
  }

  // Otherwise, highest card of lead suit wins
  return trick.findIndex(card => 
    card.suit === highestLeadSuit!.suit && card.rank === highestLeadSuit!.rank
  );
}

// Add a new interface to track which player played each card
interface TrickCard extends Card {
  playedBy?: string; // Player ID who played this card
}

export default function GameTable({ 
  game, 
  socket, 
  createGame, 
  joinGame, 
  onGamesUpdate,
  onLeaveTable,
  startGame,
  user: propUser
}: GameTableProps) {
  const { data: session } = useSession();
  const regularSocket = !socket ? useSocket("") : { playCard: () => {}, makeBid: () => {} };
  const [selectedBid, setSelectedBid] = useState<number | null>(null);
  const [showHandSummary, setShowHandSummary] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [handScores, setHandScores] = useState<ReturnType<typeof calculateHandScore> | null>(null);
  
  // Add state to directly track which player played which card
  const [cardPlayers, setCardPlayers] = useState<Record<number, string>>({});
  const [lastTrickLength, setLastTrickLength] = useState(0);
  
  const user = propUser || session?.user;
  
  // Add state to store player positions for the current trick
  const [trickCardPositions, setTrickCardPositions] = useState<Record<number, number>>({});

  // Find the current player's ID
  const currentPlayerId = user?.id;
  
  // Find the current player's position and team
  const currentPlayer = game.players.find(p => p.id === currentPlayerId);
  const currentTeam = currentPlayer?.team;

  // Add state to force component updates when the current player changes
  const [lastCurrentPlayer, setLastCurrentPlayer] = useState<string>(game.currentPlayer);
  
  // Track all game state changes that would affect the UI
  useEffect(() => {
    if (lastCurrentPlayer !== game.currentPlayer) {
      console.log(`Current player changed: ${lastCurrentPlayer} -> ${game.currentPlayer} (my ID: ${currentPlayerId})`);
      setLastCurrentPlayer(game.currentPlayer);
      
      // Force a component state update to trigger re-renders of children
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('gameStateChanged'));
      }
    }
  }, [game.currentPlayer, lastCurrentPlayer, currentPlayerId]);

  // Add effect to force re-render when current trick changes
  useEffect(() => {
    // Force UI update when cards are played
    if (game.currentTrick && game.currentTrick.length > 0) {
      console.log(`Current trick updated: ${game.currentTrick.length} cards played`);

      // If this is a new trick (length was 0 before), or continuing the same trick (length increased)
      if (lastTrickLength === 0 || game.currentTrick.length > lastTrickLength) {
        // Update positions for new cards only
        const updatedPositions = { ...trickCardPositions };
        
        // Simple approach - there are exactly 4 players, with positions 0-3
        // Sandra should have position 2 (across from player 0)
        // Bob should have position 3 (to the right of player 0)
        // Find the trick leader first
        const leadingPlayer = game.players.find(p => {
          // The player who played the first card in the trick
          return p.id === game.players[(game.players.findIndex(p => p.id === game.currentPlayer) - game.currentTrick.length + 4) % 4]?.id;
        });
        
        if (leadingPlayer && leadingPlayer.position !== undefined && currentPlayer?.position !== undefined) {
          console.log(`Leading player is ${leadingPlayer.name} at position ${leadingPlayer.position}`);
          
          // For each new card in the trick, determine who played it
          for (let i = lastTrickLength; i < game.currentTrick.length; i++) {
            // Calculate whose turn it was to play this card
            // Start with lead player and go clockwise
            const playerPositionWhoPlayed = (leadingPlayer.position + i) % 4;
            const playerWhoPlayed = game.players.find(p => p.position === playerPositionWhoPlayed);
            
            if (playerWhoPlayed) {
              // Calculate relative position from current player's view
              // We know current player is at position 0, so the relative position is:
              // 0 = current player (bottom/South)
              // 1 = player to the left (West)
              // 2 = player across (North)
              // 3 = player to the right (East)
              const relativePosition = (playerPositionWhoPlayed - currentPlayer.position + 4) % 4;
              updatedPositions[i] = relativePosition;
              
              console.log(`Card ${i} played by ${playerWhoPlayed.name} at position ${playerPositionWhoPlayed}, showing at fixed relative position ${relativePosition}`);
            }
          }
        }
        
        // Update state with new positions
        setTrickCardPositions(updatedPositions);
      }
      
      // Update the last trick length
      setLastTrickLength(game.currentTrick.length);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('gameStateChanged'));
      }
    } else {
      // Reset positions when a new trick starts (current trick is empty)
      setTrickCardPositions({});
      setLastTrickLength(0);
    }
  }, [game.currentTrick?.length, game.players, game.currentPlayer, currentPlayer?.position]);

  // Use the explicit position property if available, otherwise fall back to array index
  // @ts-ignore - position property might not be on the type yet
  const currentPlayerPosition = currentPlayer?.position !== undefined ? currentPlayer.position : game.players.findIndex(p => p.id === currentPlayerId);

  // FIXED ROTATION: Always put current player at bottom (South)
  const rotatePlayersForCurrentView = () => {
    // If we can't find the current player, don't rotate
    if (currentPlayerPosition === -1) {
      // Create a placeholder array for 4 positions
      const positions = Array(4).fill(null);
      
      // Place each player at their explicit position
      game.players.forEach(p => {
        // @ts-ignore - position property might not be on the type yet
        const pos = p.position !== undefined ? p.position : game.players.indexOf(p);
        positions[pos] = p;
      });
      
      return positions;
    }

    // Create a rotated array where current player is at position 0 (South)
    // Create a new array with 4 positions
    const rotated = Array(4).fill(null);
    
    // Place each player at their rotated position based on their explicit position
    game.players.forEach(player => {
      if (!player || !player.id) return;
      
      // Get the player's explicit position, or fall back to array index
      // @ts-ignore - position property might not be on the type yet
      const originalPos = player.position !== undefined ? player.position : game.players.indexOf(player);
      
      // Calculate new position relative to current player
      // Formula: (4 + originalPos - currentPlayerPosition) % 4
      // This ensures current player is at position 0
      const newPos = (4 + originalPos - currentPlayerPosition) % 4;
      rotated[newPos] = player;
    });
    
    return rotated;
  };

  // Preserve original positions in the array so the server knows where everyone sits
  const orderedPlayers = rotatePlayersForCurrentView();

  // Determine player team color based on their ACTUAL team, not position
  const getTeamColor = (player: typeof orderedPlayers[number]): 1 | 2 => {
    if (!player) return 1;
    return player.team || 1;
  };

  const isCurrentPlayersTurn = game.currentPlayer === currentPlayerId;

  const handleBid = (bid: number) => {
    if (!currentPlayerId) {
      console.error('Cannot bid: No current player ID');
      return;
    }
    
    // Validate that it's actually this player's turn
    if (game.currentPlayer !== currentPlayerId) {
      console.error(`Cannot bid: Not your turn. Current player is ${game.currentPlayer}`);
      return;
    }
    
    // Validate game state
    if (game.status !== 'BIDDING') {
      console.error(`Cannot bid: Game is not in bidding state (${game.status})`);
      return;
    }
    
    console.log(`Submitting bid: ${bid} for player ${currentPlayerId} in game ${game.id}`);
    socket?.emit("make_bid", { gameId: game.id, userId: currentPlayerId, bid });
    console.log('Game status:', game.status, 'Current player:', game.currentPlayer);
    console.log('Socket connected:', socket?.connected);
  };

  // A completely simple approach to tracking cards
  useEffect(() => {
    // When the currentPlayer changes, that means someone played a card
    // The previous player (who just finished their turn) played the last card
    
    // Get the length of the current trick
    const trickLength = game.currentTrick.length;
    
    // If the trick just started, reset our tracking
    if (trickLength === 0) {
      setCardPlayers({});
      return;
    }
    
    // Skip if we have already recorded this card (the last one played)
    const lastCardIndex = trickLength - 1;
    if (lastCardIndex in cardPlayers) {
      return;
    }
    
    // Get the previous player who just played (the player before current player)
    const playerIds = game.players.map(p => p.id);
    const currentIndex = playerIds.indexOf(game.currentPlayer);
    
    // The player who just played is always the one right before the current player
    const previousIndex = (currentIndex - 1 + playerIds.length) % playerIds.length;
    const previousPlayerId = playerIds[previousIndex];
    
    // Log who played what
    const previousPlayer = game.players.find(p => p.id === previousPlayerId);
    const card = game.currentTrick[lastCardIndex];
    console.log(`TRACKED: ${previousPlayer?.name} (${previousPlayerId}) played ${card?.rank}${card?.suit} as card ${lastCardIndex}`);
    
    // Update our tracking
    setCardPlayers(prev => ({ ...prev, [lastCardIndex]: previousPlayerId }));
  }, [game.currentPlayer, game.currentTrick.length]);

  // Additional effect to ensure all cards are tracked
  // This is a safety net to make sure all cards have players assigned
  useEffect(() => {
    // Skip if trick is empty
    if (game.currentTrick.length === 0) return;
    
    // For each card, ensure we have a player assigned
    let needsUpdate = false;
    const updatedCardPlayers = { ...cardPlayers };
    
    for (let i = 0; i < game.currentTrick.length; i++) {
      // If this card position isn't assigned to a player yet
      if (!(i in cardPlayers)) {
        const playerIds = game.players.map(p => p.id);
        // If we're at the first position and first player is Tom
        if (i === 0 && currentPlayerId === playerIds[0]) {
          // This means Tom played the first card
          console.log(`SAFETY: Assigning first card to Tom (${playerIds[0]})`);
          updatedCardPlayers[i] = currentPlayerId;
          needsUpdate = true;
        } else {
          // Otherwise count backward from current player
          const currentIndex = playerIds.indexOf(game.currentPlayer);
          const playerIndex = (currentIndex - (game.currentTrick.length - i) + playerIds.length) % playerIds.length;
          const playerId = playerIds[playerIndex];
          console.log(`SAFETY: Assigning card ${i} to ${playerId}`);
          updatedCardPlayers[i] = playerId;
          needsUpdate = true;
        }
      }
    }
    
    // Only update if we made changes
    if (needsUpdate) {
      console.log('SAFETY: Updating card players', updatedCardPlayers);
      setCardPlayers(updatedCardPlayers);
    }
  }, [game.currentTrick, game.players, game.currentPlayer]);

  // When WE play a card, we need to record that immediately
  const handlePlayCard = (card: Card) => {
    if (!socket || !currentPlayerId || !currentPlayer) return;

    // Validate if it's player's turn
    if (game.currentPlayer !== currentPlayerId) {
      console.error(`Cannot play card: Not your turn`);
      return;
    }
    
    // Check if card is playable
    const isLeadingTrick = game.currentTrick.length === 0;
    const playableCards = getPlayableCards(game, currentPlayer.hand, isLeadingTrick);
    if (!playableCards.some(c => c.suit === card.suit && c.rank === card.rank)) {
      console.error('This card is not playable in the current context');
      return;
    }

    console.log(`Playing card: ${card.rank}${card.suit} as player ${currentPlayer.name}`);
    
    // Record that I am playing this card at this position
    const cardPosition = game.currentTrick.length;
    console.log(`I'm playing card at position ${cardPosition}`);
    
    setCardPlayers(prev => {
      const updated = { ...prev, [cardPosition]: currentPlayerId };
      console.log('Updated cardPlayers:', updated);
      return updated;
    });
    
    // Send the play to the server
    socket.emit("play_card", { 
      gameId: game.id, 
      userId: currentPlayerId, 
      card 
    });
  };

  // Render cards based directly on the event data from the server
  const renderTrickCards = () => {
    if (!game.currentTrick || game.currentTrick.length === 0) {
      return null;
    }
    
    // Scale the card size for the trick
    const trickCardWidth = Math.floor(60 * scaleFactor); 
    const trickCardHeight = Math.floor(84 * scaleFactor);
    
    // Get the position of the current player
    const myPosition = currentPlayer?.position ?? 0;
    
    // Position classes for the four card positions
    const positionClasses = [
      "absolute bottom-0 left-1/2 -translate-x-1/2",  // Bottom (User's position)
      "absolute left-0 top-1/2 -translate-y-1/2",     // Left  
      "absolute top-0 left-1/2 -translate-x-1/2",     // Top
      "absolute right-0 top-1/2 -translate-y-1/2"     // Right
    ];
    
    console.log("RENDERING TRICK CARDS WITH SERVER DATA");
    console.log("Current trick:", game.currentTrick.map(c => `${c.rank}${c.suit}`).join(", "));
    console.log("My position:", myPosition);
    
    // Use the cardPlayers state to get who played each card
    const playerPositions = game.players.reduce((acc, player) => {
      if (player.position !== undefined) {
        acc[player.id] = player.position;
      }
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate which player played which card by using the server's turn order
    // The game.currentPlayer is the next player to play
    // We can work backwards from there to identify who played each card
    const cardPlayerInfo = game.currentTrick.map((card, index) => {
      const playerIds = game.players.map(p => p.id);
      const currentPlayerIndex = playerIds.indexOf(game.currentPlayer);
      
      // The player who played this card is (currentPlayerIndex - (remaining cards) + player count) % player count
      const cardsRemaining = game.currentTrick.length - index;
      const playerIndex = (currentPlayerIndex - cardsRemaining + playerIds.length) % playerIds.length;
      const playerId = playerIds[playerIndex];
      const player = game.players.find(p => p.id === playerId);
      
      return {
        card,
        playerId,
        playerName: player?.name || "Unknown",
        playerPosition: player?.position
      };
    });
    
    console.log("Card player info:", cardPlayerInfo);
    
    return (
      <div className="relative" style={{ 
        width: `${Math.floor(200 * scaleFactor)}px`, 
        height: `${Math.floor(200 * scaleFactor)}px` 
      }}>
        {cardPlayerInfo.map((info, index) => {
          // Calculate the relative position (0-3) for this card
          // This is the player's position relative to the current player
          const playerPos = info.playerPosition !== undefined ? info.playerPosition : 0;
          const relativePos = (playerPos - myPosition + 4) % 4;
          
          console.log(`Card ${index} (${info.card.rank}${info.card.suit}) played by ${info.playerName} at position ${playerPos}, showing at relative position ${relativePos}`);
          
          return (
            <div 
              key={`trick-card-${index}`} 
              className={positionClasses[relativePos]}
              data-testid={`trick-card-${index}`}
              style={{
                zIndex: 10 + index,
                transform: `translate(${index * 3}px, ${index * 3}px)`
              }}
            >
              <Image
                src={`/cards/${getCardImage(info.card)}`}
                alt={`${info.card.rank}${info.card.suit}`}
                width={trickCardWidth}
                height={trickCardHeight}
                className="rounded-lg shadow-md"
              />
            </div>
          );
        })}
        
        {/* Leading suit indicator */}
        {game.currentTrick[0] && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-1 rounded"
               style={{ fontSize: `${Math.floor(12 * scaleFactor)}px` }}>
            Lead: {game.currentTrick[0].suit}
          </div>
        )}
      </div>
    );
  };

  const handleLeaveTable = () => {
    if (currentPlayerId && socket) {
      socket.emit("leave_game", { gameId: game.id, userId: currentPlayerId });
    }
    // Always call onLeaveTable even if we couldn't emit the event
    onLeaveTable();
  };

  const handleStartGame = async () => {
    if (!currentPlayerId) return;
    
    // Make sure the game is in the WAITING state
    if (game.status !== "WAITING") {
      console.error(`Cannot start game: game is in ${game.status} state, not WAITING`);
      return;
    }
    
    // Make sure the game has enough players
    if (game.players.length < 4) {
      console.error(`Cannot start game: only ${game.players.length}/4 players joined`);
      return;
    }
    
    // Make sure current user is the creator (first player)
    if (game.players[0]?.id !== currentPlayerId) {
      console.error(`Cannot start game: current user ${currentPlayerId} is not the creator ${game.players[0]?.id}`);
      return;
    }
    
    try {
      console.log(`Starting game ${game.id} as user ${currentPlayerId}, creator: ${game.players[0]?.id}`);
      await startGame(game.id, currentPlayerId);
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  };

  const handleWinnerClose = () => {
    setShowWinner(false);
    setHandScores(null);
    // Emit event to end game and return to lobby
    socket?.emit("end_game", { gameId: game.id });
    onLeaveTable();
  };

  // Add responsive sizing state
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  // Listen for screen size changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Calculate scale factor for responsive sizing
  const getScaleFactor = () => {
    // Base scale on the screen width compared to a reference size
    const referenceWidth = 1200; // Reference width for desktop
    let scale = Math.min(1, screenSize.width / referenceWidth);
    
    // Minimum scale to ensure things aren't too small
    return Math.max(0.6, scale);
  };
  
  const scaleFactor = getScaleFactor();
  
  // Scale dimensions for card images
  const cardWidth = Math.floor(96 * scaleFactor);
  const cardHeight = Math.floor(144 * scaleFactor);
  const avatarSize = Math.floor(64 * scaleFactor);

  // Add back these missing functions
  const renderPlayerPosition = (position: number) => {
    const player = orderedPlayers[position];
    if (!player) {
      // Empty seat
      return null;
    }

    const isActive = game.currentPlayer === player.id;
    
    // Determine if we're on mobile
    const isMobile = screenSize.width < 640;
    
    // Adjust positioning for responsive layout
    const getPositionClasses = (pos: number): string => {
      // Base positioning
      const basePositions = [
        'bottom-2 left-1/2 -translate-x-1/2 flex-row',  // South (bottom)
        'left-8 top-1/2 -translate-y-1/2 flex-col',     // West (left)
        'top-2 left-1/2 -translate-x-1/2 flex-row',     // North (top)
        'right-8 top-1/2 -translate-y-1/2 flex-col'     // East (right)
      ];
      
      // Apply responsive adjustments
      if (screenSize.width < 768) {
        // Tighter positioning for smaller screens
        const mobilePositions = [
          'bottom-1 left-1/2 -translate-x-1/2 flex-row',  // South
          'left-2 top-1/2 -translate-y-1/2 flex-col',     // West
          'top-1 left-1/2 -translate-x-1/2 flex-row',     // North
          'right-2 top-1/2 -translate-y-1/2 flex-col'     // East
        ];
        return mobilePositions[pos];
      }
      
      return basePositions[pos];
    };

    // Get player avatar
    const getPlayerAvatar = (player: any): string => {
      // If player has their own image property, use that first
      if (player.image) {
        return player.image;
      }
      
      // If player matches the current user and we have their image
      if (player.id === currentPlayerId && propUser?.image) {
        return propUser.image;
      }
      
      // Discord user ID (numeric string)
      if (player.id && /^\d+$/.test(player.id)) {
        // For Discord users without an avatar hash or with invalid avatar, use the default Discord avatar
        return `https://cdn.discordapp.com/embed/avatars/${parseInt(player.id) % 5}.png`;
      }
      
      // Guest user, use default avatar
      if (player.id && player.id.startsWith('guest_')) {
        return GUEST_AVATAR;
      }
      
      // Fallback to bot avatar
      return BOT_AVATAR;
    };

    const isHorizontal = position === 0 || position === 2;
    
    // Calculate font sizes based on scale
    const nameSize = Math.max(14, Math.floor(16 * scaleFactor));
    const infoSize = Math.max(12, Math.floor(14 * scaleFactor));
    
    // Smaller sizes for mobile
    const mobileNameSize = isMobile ? 12 : nameSize;
    const mobileInfoSize = isMobile ? 10 : infoSize;
    const mobileAvatarSize = isMobile ? Math.floor(avatarSize * 0.75) : avatarSize;
    const mobileDealerSize = isMobile ? 16 : Math.floor(24 * scaleFactor);

    return (
      <div className={`absolute ${getPositionClasses(position)} flex items-center gap-${Math.max(2, Math.floor(4 * scaleFactor))}`}>
        <div className="relative">
          <div className={`rounded-full overflow-hidden ring-4 ${
            isActive ? 'ring-yellow-400 animate-pulse' : player.team === 1 ? 'ring-red-500' : 'ring-blue-500'
          }`} style={{ 
            width: screenSize.width < 640 ? '48px' : `${avatarSize}px`, 
            height: screenSize.width < 640 ? '48px' : `${avatarSize}px` 
          }}>
            <Image
              src={getPlayerAvatar(player)}
              alt="Player avatar"
              width={screenSize.width < 640 ? 48 : avatarSize}
              height={screenSize.width < 640 ? 48 : avatarSize}
              className="w-full h-full object-cover"
            />
          </div>
          {player.isDealer && (
            <div className="absolute -right-6 top-1/2 -translate-y-1/2 bg-yellow-400 rounded-full flex items-center justify-center text-black font-bold shadow-lg border-2 border-black"
                 style={{ 
                   width: screenSize.width < 640 ? '18px' : `${Math.floor(24 * scaleFactor)}px`, 
                   height: screenSize.width < 640 ? '18px' : `${Math.floor(24 * scaleFactor)}px`, 
                   fontSize: screenSize.width < 640 ? '10px' : `${Math.floor(14 * scaleFactor)}px` 
                 }}>
              D
            </div>
          )}
        </div>
        <div className={`rounded-lg ${
          player.team === 1 ? 'bg-red-500' : 'bg-blue-500'
        } text-white text-center`} style={{
          padding: screenSize.width < 640 ? '2px 6px' : '4px 12px'
        }}>
          <div className="font-semibold" style={{ 
            fontSize: screenSize.width < 640 ? '12px' : `${Math.floor(16 * scaleFactor)}px` 
          }}>{player.name}</div>
          {player.bid !== undefined && (
            <div className="text-yellow-200" style={{ 
              fontSize: screenSize.width < 640 ? '10px' : `${Math.floor(14 * scaleFactor)}px` 
            }}>Bid: {player.bid}</div>
          )}
          {game.status === "PLAYING" && (
            <div className="text-yellow-200" style={{ 
              fontSize: screenSize.width < 640 ? '10px' : `${Math.floor(14 * scaleFactor)}px` 
            }}>Tricks: {player.tricks}</div>
          )}
        </div>
      </div>
    );
  };

  const renderPlayerHand = () => {
    const currentPlayer = orderedPlayers[0];
    if (!currentPlayer?.hand?.length) return null;

    // Sort the cards before rendering
    const sortedHand = sortCards(currentPlayer.hand);

    // Determine playable cards
    const isLeadingTrick = game.currentTrick.length === 0;
    const playableCards = game.status === "PLAYING" ? 
      getPlayableCards(game, currentPlayer.hand, isLeadingTrick) : 
      [];
      
    // Calculate card width based on screen size
    const cardUIWidth = Math.floor(84 * scaleFactor);
    const cardUIHeight = Math.floor(120 * scaleFactor);
    const overlapOffset = Math.floor(-32 * scaleFactor); // How much cards overlap

    return (
      <div className="absolute bottom-[-1rem] left-1/2 -translate-x-1/2 flex p-2">
        {sortedHand.map((card: Card, index: number) => {
          const isPlayable = game.status === "PLAYING" && 
            game.currentPlayer === currentPlayerId &&
            playableCards.some(c => c.suit === card.suit && c.rank === card.rank);

          return (
            <div
              key={`${card.suit}${card.rank}`}
              className={`relative transition-transform hover:-translate-y-6 hover:z-10 ${
                isPlayable ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
              style={{ 
                width: `${cardUIWidth}px`, 
                height: `${cardUIHeight}px`,
                marginLeft: index > 0 ? `${overlapOffset}px` : '0' 
              }}
              onClick={() => isPlayable && handlePlayCard(card)}
            >
              <div className="relative">
                <Image
                  src={`/cards/${getCardImage(card)}`}
                  alt={`${card.rank}${card.suit}`}
                  width={cardUIWidth}
                  height={cardUIHeight}
                  className={`rounded-lg shadow-[4px_4px_12px_rgba(0,0,0,0.8)] ${
                    isPlayable ? 'hover:shadow-[8px_8px_16px_rgba(0,0,0,0.9)]' : ''
                  }`}
                  style={{ width: 'auto', height: 'auto' }}
                />
                {!isPlayable && (
                  <div className="absolute inset-0 bg-gray-600/40 rounded-lg" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Add the missing handleHandSummaryClose function
  const handleHandSummaryClose = () => {
    setShowHandSummary(false);
    if (socket && handScores) {
      socket.emit("update_scores", {
        gameId: game.id,
        team1Score: handScores.team1.score,
        team2Score: handScores.team2.score,
        startNewHand: true
      });
      setHandScores(null);
    }
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (showHandSummary) {
      timeoutId = setTimeout(handleHandSummaryClose, 5000);
    }
    return () => clearTimeout(timeoutId);
  }, [showHandSummary]);

  return (
    <>
      <LandscapePrompt />
      <div className="flex flex-col h-screen bg-gray-900">
        {/* Empty div for padding above header */}
        <div className="h-8"></div>
        
        {/* Header */}
        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center mb-2"
             style={{ fontSize: `${Math.floor(16 * scaleFactor)}px` }}>
          <div className="flex items-center space-x-4">
            <h2 className="font-bold" style={{ fontSize: `${Math.floor(18 * scaleFactor)}px` }}>Game #{game.id}</h2>
            <div className="flex space-x-2">
              <div>Status: {game.status}</div>
              <div className="text-red-500">Score: {game.team1Score}</div>
              <div className="text-blue-500">Score: {game.team2Score}</div>
            </div>
          </div>
          <button
            onClick={handleLeaveTable}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
            style={{ fontSize: `${Math.floor(14 * scaleFactor)}px` }}
          >
            Leave Table
          </button>
        </div>

        {/* Main content area with added padding */}
        <div className="flex flex-1 min-h-0 pt-1">
          {/* Game table area - add padding on top and bottom */}
          <div className="w-[70%] p-2 flex flex-col">
            {/* Game table with more space at the top and bottom */}
            <div className="relative flex-1 mb-3 mt-2" style={{ 
              background: 'radial-gradient(circle at center, #316785 0%, #1a3346 100%)',
              borderRadius: `${Math.floor(64 * scaleFactor)}px`,
              border: `${Math.floor(2 * scaleFactor)}px solid #855f31`
            }}>
              {/* Players around the table */}
              {[0, 1, 2, 3].map((position) => (
                <div key={`player-position-${position}`}>
                  {renderPlayerPosition(position)}
                </div>
              ))}

              {/* Center content */}
              <div className="absolute inset-0 flex items-center justify-center">
                {game.status === "WAITING" && game.players.length === 4 && game.players[0]?.id === currentPlayerId ? (
                  <button
                    onClick={handleStartGame}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all"
                    style={{ fontSize: `${Math.floor(16 * scaleFactor)}px` }}
                  >
                    Start Game
                  </button>
                ) : game.status === "WAITING" && game.players.length < 4 ? (
                  <div className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-center"
                       style={{ fontSize: `${Math.floor(14 * scaleFactor)}px` }}>
                    <div className="font-bold">Waiting for Players</div>
                    <div className="text-sm mt-1">{game.players.length}/4 joined</div>
                  </div>
                ) : game.status === "WAITING" && game.players[0]?.id !== currentPlayerId ? (
                  <div className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-center"
                       style={{ fontSize: `${Math.floor(14 * scaleFactor)}px` }}>
                    <div className="font-bold">Waiting for Host</div>
                    <div className="text-sm mt-1">Only {game.players[0]?.name} can start</div>
                  </div>
                ) : game.status === "BIDDING" && game.currentPlayer !== currentPlayerId ? (
                  <div className="px-4 py-2 bg-gray-700 text-white rounded-lg text-center animate-pulse"
                       style={{ fontSize: `${Math.floor(14 * scaleFactor)}px` }}>
                    <div className="font-bold">Waiting for {game.players.find(p => p.id === game.currentPlayer)?.name} to bid</div>
                  </div>
                ) : game.status === "PLAYING" && game.currentTrick && game.currentTrick.length > 0 ? (
                  renderTrickCards()
                ) : game.status === "PLAYING" && game.currentTrick?.length === 0 ? (
                  <div className="px-4 py-2 bg-gray-700/70 text-white rounded-lg text-center"
                       style={{ fontSize: `${Math.floor(14 * scaleFactor)}px` }}>
                    <div className="text-sm">
                      Waiting for {game.players.find(p => p.id === game.currentPlayer)?.name} to play
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Bidding interface */}
              {game.status === "BIDDING" && (
                <BiddingInterface
                  onBid={handleBid}
                  currentBid={orderedPlayers[0]?.bid}
                  gameId={game.id}
                  playerId={currentPlayerId || ''}
                  currentPlayerTurn={game.currentPlayer}
                />
              )}
            </div>

            {/* Cards area with more space */}
            <div className="bg-gray-800/50 rounded-lg relative mt-2" 
                 style={{ 
                   height: `${Math.floor(120 * scaleFactor)}px`, 
                   clipPath: 'inset(-100% 0 0 0)'
                 }}>
              {renderPlayerHand()}
            </div>
          </div>

          {/* Chat area - 30% */}
          <div className="w-[30%] p-2">
            <Chat 
              socket={socket}
              gameId={game.id}
              userId={currentPlayerId || ''}
              userName={currentPlayer?.name || 'Unknown'}
              players={game.players}
            />
          </div>
        </div>

        {/* Hand Summary Modal */}
        {showHandSummary && handScores && (
          <HandSummaryModal
            onClose={handleHandSummaryClose}
            players={game.players}
            team1Score={handScores.team1}
            team2Score={handScores.team2}
          />
        )}

        {/* Winner Modal */}
        {showWinner && handScores && (
          <WinnerModal
            isOpen={showWinner}
            onClose={handleWinnerClose}
            team1Score={game.team1Score + handScores.team1.score}
            team2Score={game.team2Score + handScores.team2.score}
            winningTeam={game.team1Score + handScores.team1.score > game.team2Score + handScores.team2.score ? 1 : 2}
          />
        )}
      </div>
    </>
  );
} 