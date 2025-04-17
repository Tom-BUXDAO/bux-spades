import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FaTrophy } from 'react-icons/fa';

interface LoserModalProps {
  isOpen: boolean;
  onClose: () => void;
  team1Score: number;
  team2Score: number;
  winningTeam: number;
  onPlayAgain?: () => void;
}

export default function LoserModal({ isOpen, onClose, team1Score, team2Score, winningTeam, onPlayAgain }: LoserModalProps) {
  const [showPlayAgainPrompt, setShowPlayAgainPrompt] = useState(false);

  const handlePlayAgain = () => {
    setShowPlayAgainPrompt(true);
    onPlayAgain?.();
  };

  return (
    <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-gray-500">
              <FaTrophy className="h-8 w-8" />
              <Dialog.Title className="text-xl font-bold">Team {winningTeam} Wins!</Dialog.Title>
            </div>
            
            <div className="text-center">
              <p className="text-lg">Final Scores:</p>
              <p>Team 1: {team1Score}</p>
              <p>Team 2: {team2Score}</p>
            </div>

            {!showPlayAgainPrompt ? (
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={handlePlayAgain}
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Play Again
                </button>
                <button
                  onClick={onClose}
                  className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Leave Table
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-lg font-bold">Waiting for other players...</p>
                <p className="text-sm text-gray-600">You can leave the table if you don't want to wait</p>
                <button
                  onClick={onClose}
                  className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Leave Table
                </button>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 