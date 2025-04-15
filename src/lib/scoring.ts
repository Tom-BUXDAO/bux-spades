import type { Player } from '@/types/game';

export interface TeamScore {
  bid: number;
  tricks: number;
  nilBids: number;
  madeNils: number;
  score: number;
  bags: number;
  team?: 1 | 2;  // Optional to maintain compatibility
}

export function calculateHandScore(players: Player[]): { team1: TeamScore; team2: TeamScore } {
  const team1Players = players.filter(p => p.team === 1);
  const team2Players = players.filter(p => p.team === 2);

  const team1 = {
    bid: team1Players.reduce((sum, p) => sum + (p.bid || 0), 0),
    tricks: team1Players.reduce((sum, p) => sum + (p.tricks || 0), 0),
    nilBids: team1Players.filter(p => p.bid === 0).length,
    madeNils: team1Players.filter(p => p.bid === 0 && p.tricks === 0).length,
    score: 0,
    bags: 0,
    team: 1 as const
  };

  const team2 = {
    bid: team2Players.reduce((sum, p) => sum + (p.bid || 0), 0),
    tricks: team2Players.reduce((sum, p) => sum + (p.tricks || 0), 0),
    nilBids: team2Players.filter(p => p.bid === 0).length,
    madeNils: team2Players.filter(p => p.bid === 0 && p.tricks === 0).length,
    score: 0,
    bags: 0,
    team: 2 as const
  };

  // Handle nil bids first
  team1.score += team1.madeNils * 100;
  team1.score -= (team1.nilBids - team1.madeNils) * 100;
  
  team2.score += team2.madeNils * 100;
  team2.score -= (team2.nilBids - team2.madeNils) * 100;

  // Calculate tricks taken by non-nil bidders
  const team1NonNilTricks = team1Players
    .filter(p => p.bid !== 0)
    .reduce((sum, p) => sum + (p.tricks || 0), 0);
  
  const team2NonNilTricks = team2Players
    .filter(p => p.bid !== 0)
    .reduce((sum, p) => sum + (p.tricks || 0), 0);

  const team1NonNilBid = team1Players
    .filter(p => p.bid !== 0)
    .reduce((sum, p) => sum + (p.bid || 0), 0);
  
  const team2NonNilBid = team2Players
    .filter(p => p.bid !== 0)
    .reduce((sum, p) => sum + (p.bid || 0), 0);

  // Score regular bids
  if (team1NonNilTricks >= team1NonNilBid) {
    team1.score += team1NonNilBid * 10;  // Points for making bid
    if (team1NonNilTricks > team1NonNilBid) {
      const overbooks = team1NonNilTricks - team1NonNilBid;
      team1.bags += overbooks;  // Each overbook is a bag
      team1.score += overbooks; // Each overbook is a point
      
      // Handle bag overflow - deduct 100 points for every 10 bags
      while (team1.bags >= 10) {
        team1.score -= 100;
        team1.bags -= 10;
      }
    }
  } else {
    team1.score -= team1NonNilBid * 10;  // Penalty for not making bid
  }

  if (team2NonNilTricks >= team2NonNilBid) {
    team2.score += team2NonNilBid * 10;  // Points for making bid
    if (team2NonNilTricks > team2NonNilBid) {
      const overbooks = team2NonNilTricks - team2NonNilBid;
      team2.bags += overbooks;  // Each overbook is a bag
      team2.score += overbooks; // Each overbook is a point
      
      // Handle bag overflow - deduct 100 points for every 10 bags
      while (team2.bags >= 10) {
        team2.score -= 100;
        team2.bags -= 10;
      }
    }
  } else {
    team2.score -= team2NonNilBid * 10;  // Penalty for not making bid
  }

  return { team1, team2 };
}

export function isGameOver(team1Score: number, team2Score: number, minPoints: number, maxPoints: number): { isOver: boolean; winner: 1 | 2 | null } {
  // If both teams are below min points, highest score wins
  if (team1Score < minPoints && team2Score < minPoints) {
    return {
      isOver: true,
      winner: team1Score > team2Score ? 1 : 2
    };
  }

  // If both teams are above max points, highest score wins
  if (team1Score > maxPoints && team2Score > maxPoints) {
    return {
      isOver: true,
      winner: team1Score > team2Score ? 1 : 2
    };
  }

  // If one team is below min and other is above min, game continues
  if ((team1Score < minPoints && team2Score >= minPoints) || 
      (team2Score < minPoints && team1Score >= minPoints)) {
    return {
      isOver: false,
      winner: null
    };
  }

  // If one team is above max and other is below max, game continues
  if ((team1Score > maxPoints && team2Score <= maxPoints) || 
      (team2Score > maxPoints && team1Score <= maxPoints)) {
    return {
      isOver: false,
      winner: null
    };
  }

  // If scores are equal, play another round
  if (team1Score === team2Score) {
    return {
      isOver: false,
      winner: null
    };
  }

  // If one team is below min or above max, they lose
  if (team1Score < minPoints || team1Score > maxPoints) {
    return {
      isOver: true,
      winner: 2
    };
  }
  if (team2Score < minPoints || team2Score > maxPoints) {
    return {
      isOver: true,
      winner: 1
    };
  }

  return {
    isOver: false,
    winner: null
  };
} 