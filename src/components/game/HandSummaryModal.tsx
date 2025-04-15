import { calculateHandScore, isGameOver } from '@/lib/scoring';
import { Player, HandSummary } from '@/types/game';
import WinnerModal from './WinnerModal';
import LoserModal from './LoserModal';
import { useEffect } from 'react';
import Image from 'next/image';

interface HandSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  handScores: HandSummary | null;
  minPoints: number;
  maxPoints: number;
  onGameOver: (winner: 1 | 2) => void;
}

export default function HandSummaryModal({
  isOpen,
  onClose,
  handScores,
  minPoints = 500,
  maxPoints = -500,
  onGameOver
}: HandSummaryModalProps) {
  // Add null checks for handScores
  const team1Score = handScores?.team1Score?.score || 0;
  const team2Score = handScores?.team2Score?.score || 0;
  const team1Bid = handScores?.team1Score?.bid || 0;
  const team2Bid = handScores?.team2Score?.bid || 0;
  const team1Tricks = handScores?.team1Score?.tricks || 0;
  const team2Tricks = handScores?.team2Score?.tricks || 0;
  // Calculate bags as tricks over bid
  const team1Bags = team1Tricks > team1Bid ? team1Tricks - team1Bid : 0;
  const team2Bags = team2Tricks > team2Bid ? team2Tricks - team2Bid : 0;
  const team1NilBids = handScores?.team1Score?.nilBids || 0;
  const team2NilBids = handScores?.team2Score?.nilBids || 0;
  const team1MadeNils = handScores?.team1Score?.madeNils || 0;
  const team2MadeNils = handScores?.team2Score?.madeNils || 0;
  
  // Check if game is over
  const isGameOver = team1Score >= minPoints || team2Score >= minPoints || 
                     team1Score <= maxPoints || team2Score <= maxPoints;
  
  // Determine winner
  const winner = team1Score >= minPoints ? 1 : 
                 team2Score >= minPoints ? 2 : 
                 team1Score <= maxPoints ? 2 : 
                 team2Score <= maxPoints ? 1 : null;
  
  // Call onGameOver if game is over
  useEffect(() => {
    if (isGameOver && winner && onGameOver) {
      onGameOver(winner);
    }
  }, [isGameOver, winner, onGameOver]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900/75 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Hand Summary</h2>
        
        <div className="grid grid-cols-2 gap-6">
          {/* Team 1 (Red) */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-white/5">
            <div className="flex items-center mb-3">
              <div className="bg-red-500 rounded-full w-3 h-3 mr-2"></div>
              <h3 className="text-lg font-semibold text-white">Team 1</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Score</span>
                <span className="font-medium text-white">{team1Score}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Bags</span>
                <div className="text-yellow-300 font-medium flex items-center">
                  <Image src="/bag.svg" width={14} height={14} alt="Bags" className="mr-1" priority={true} />
                  {team1Bags}
                </div>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Bid</span>
                <span className="font-medium text-white">{team1Bid}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Tricks</span>
                <span className="font-medium text-white">{team1Tricks}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Nil Bids</span>
                <span className="font-medium text-white">{team1NilBids}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Made Nils</span>
                <span className="font-medium text-white">{team1MadeNils}</span>
              </div>
            </div>
          </div>
          
          {/* Team 2 (Blue) */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-white/5">
            <div className="flex items-center mb-3">
              <div className="bg-blue-500 rounded-full w-3 h-3 mr-2"></div>
              <h3 className="text-lg font-semibold text-white">Team 2</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Score</span>
                <span className="font-medium text-white">{team2Score}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Bags</span>
                <div className="text-yellow-300 font-medium flex items-center">
                  <Image src="/bag.svg" width={14} height={14} alt="Bags" className="mr-1" priority={true} />
                  {team2Bags}
                </div>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Bid</span>
                <span className="font-medium text-white">{team2Bid}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Tricks</span>
                <span className="font-medium text-white">{team2Tricks}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Nil Bids</span>
                <span className="font-medium text-white">{team2NilBids}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Made Nils</span>
                <span className="font-medium text-white">{team2MadeNils}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex justify-center">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-medium rounded-lg shadow-lg hover:from-blue-700 hover:to-blue-900 transition-all"
          >
            {isGameOver ? "Continue" : "Next Hand"}
          </button>
        </div>
      </div>
    </div>
  );
} 