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
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-4 w-[500px] mx-4 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 text-center">Hand Summary</h2>
        
        <div className="flex gap-4">
          {/* Team 1 */}
          <div className="flex-1 bg-gray-700/50 rounded-lg p-3">
            <h3 className="text-lg font-semibold text-red-500 mb-2">Team 1</h3>
            <div className="text-white text-sm">
              <div>Bid: {team1Score.bid}</div>
              <div>Tricks: {team1Score.tricks}</div>
              <div>Bags: {team1Score.bags}</div>
              <div className="text-lg font-bold mt-1">
                Score: {team1Score.score >= 0 ? '+' : ''}{team1Score.score}
              </div>
            </div>
          </div>

          {/* Team 2 */}
          <div className="flex-1 bg-gray-700/50 rounded-lg p-3">
            <h3 className="text-lg font-semibold text-blue-500 mb-2">Team 2</h3>
            <div className="text-white text-sm">
              <div>Bid: {team2Score.bid}</div>
              <div>Tricks: {team2Score.tricks}</div>
              <div>Bags: {team2Score.bags}</div>
              <div className="text-lg font-bold mt-1">
                Score: {team2Score.score >= 0 ? '+' : ''}{team2Score.score}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
        >
          Continue
        </button>
      </div>
    </div>
  );
} 