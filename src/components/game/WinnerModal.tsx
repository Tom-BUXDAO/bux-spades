interface WinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  team1Score: number;
  team2Score: number;
  winningTeam: 1 | 2;
}

export default function WinnerModal({
  isOpen,
  onClose,
  team1Score,
  team2Score,
  winningTeam
}: WinnerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[380px] md:w-[360px] sm:w-[320px] max-sm:w-[280px] backdrop-blur-md bg-gray-900/75 border border-white/10 rounded-2xl p-6 max-sm:p-4 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">Game Over!</h2>
        
        <div className={`text-4xl font-bold mb-8 text-center ${winningTeam === 1 ? 'text-red-500' : 'text-blue-500'}`}>
          Team {winningTeam} Wins!
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-white/5 mb-6">
          <div className="flex justify-between items-center">
            <div className="text-center">
              <div className="text-red-500 font-semibold mb-2">Team 1</div>
              <div className="text-3xl font-bold text-white">{team1Score}</div>
            </div>
            <div className="text-gray-500 font-bold text-2xl">vs</div>
            <div className="text-center">
              <div className="text-blue-500 font-semibold mb-2">Team 2</div>
              <div className="text-3xl font-bold text-white">{team2Score}</div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gradient-to-br from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg"
        >
          New Game
        </button>
      </div>
    </div>
  );
} 