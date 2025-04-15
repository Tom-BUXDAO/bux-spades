import { calculateHandScore, isGameOver } from '@/lib/scoring';
import { Player, HandSummary } from '@/types/game';
import WinnerModal from './WinnerModal';
import LoserModal from './LoserModal';

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
  minPoints,
  maxPoints,
  onGameOver
}: HandSummaryModalProps) {
  if (!isOpen || !handScores) return null;

  const { team1Score, team2Score } = handScores;
  
  const { isOver, winner } = isGameOver(team1Score.score, team2Score.score, minPoints, maxPoints);

  const handleClose = () => {
    if (isOver && winner) {
      onGameOver(winner);
    }
    onClose();
  };

  if (isOver && winner) {
    return (
      <>
        <WinnerModal
          isOpen={isOpen}
          onClose={handleClose}
          team1Score={team1Score.score}
          team2Score={team2Score.score}
          winningTeam={winner}
        />
        <LoserModal
          isOpen={isOpen}
          onClose={handleClose}
          team1Score={team1Score.score}
          team2Score={team2Score.score}
          winningTeam={winner}
        />
      </>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[380px] md:w-[360px] sm:w-[320px] max-sm:w-[280px] backdrop-blur-md bg-gray-900/75 border border-white/10 rounded-2xl p-6 max-sm:p-4 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Hand Summary</h2>
        
        <div className="space-y-4">
          {/* Team 1 */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-white/5">
            <h3 className="text-lg font-semibold text-red-500 mb-3">Team 1</h3>
            <div className="text-white space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Bid</span>
                <span className="font-medium">{team1Score.bid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tricks</span>
                <span className="font-medium">{team1Score.tricks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bags</span>
                <span className="font-medium">{team1Score.bags}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-gray-400">Score</span>
                <span className="text-xl font-bold text-red-500">
                  {team1Score.score >= 0 ? '+' : ''}{team1Score.score}
                </span>
              </div>
            </div>
          </div>

          {/* Team 2 */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-white/5">
            <h3 className="text-lg font-semibold text-blue-500 mb-3">Team 2</h3>
            <div className="text-white space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Bid</span>
                <span className="font-medium">{team2Score.bid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tricks</span>
                <span className="font-medium">{team2Score.tricks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bags</span>
                <span className="font-medium">{team2Score.bags}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-gray-400">Score</span>
                <span className="text-xl font-bold text-blue-500">
                  {team2Score.score >= 0 ? '+' : ''}{team2Score.score}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="w-full mt-6 bg-gradient-to-br from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
} 