import { useState } from 'react';

export type GameType = 'REGULAR' | 'WHIZ' | 'SOLO' | 'MIRROR';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: GameRules) => void;
}

export interface GameRules {
  gameType: GameType;
  allowNil: boolean;
  allowBlindNil: boolean;
  minPoints: number;
  maxPoints: number;
}

export default function GameRulesModal({ isOpen, onClose, onSave }: GameRulesModalProps) {
  const [rules, setRules] = useState<GameRules>({
    gameType: 'REGULAR',
    allowNil: true,
    allowBlindNil: false,
    minPoints: -250,
    maxPoints: 500
  });

  if (!isOpen) return null;

  const handleSave = () => {
    // Validate rules before saving
    if (typeof rules.minPoints !== 'number' || typeof rules.maxPoints !== 'number') {
      console.error('Invalid game rules: minPoints and maxPoints must be numbers');
      return;
    }

    // Log the rules being saved
    console.log('Saving game rules:', rules);
    
    onSave(rules);
    onClose();
  };

  const handlePointsChange = (type: 'min' | 'max', delta: number) => {
    const currentValue = type === 'min' ? rules.minPoints : rules.maxPoints;
    const newValue = currentValue + delta;
    
    // Allow the default values to be used without restriction
    if (type === 'min' && newValue >= -250 && newValue <= 0) {
      setRules({ ...rules, minPoints: newValue });
    } else if (type === 'max' && newValue >= 100 && newValue <= 1000) {
      setRules({ ...rules, maxPoints: newValue });
    }
  };

  const showNilOptions = rules.gameType === 'REGULAR' || rules.gameType === 'SOLO';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold text-white mb-4">Game Rules</h2>
        
        <div className="space-y-4">
          {/* Game Type Selection */}
          <div>
            <label className="text-white block mb-2">Game Type</label>
            <select
              value={rules.gameType}
              onChange={(e) => setRules({ ...rules, gameType: e.target.value as GameType })}
              className="w-full bg-gray-700 text-white rounded p-2"
            >
              <option value="REGULAR">Regular</option>
              <option value="WHIZ">Whiz</option>
              <option value="SOLO">Solo</option>
              <option value="MIRROR">Mirror</option>
            </select>
          </div>

          {/* Nil Options - Only show for REGULAR and SOLO */}
          {showNilOptions && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-white">Allow Nil Bids</label>
                <input
                  type="checkbox"
                  checked={rules.allowNil}
                  onChange={(e) => setRules({ ...rules, allowNil: e.target.checked })}
                  className="w-5 h-5"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-white">Allow Blind Nil</label>
                <input
                  type="checkbox"
                  checked={rules.allowBlindNil}
                  onChange={(e) => setRules({ ...rules, allowBlindNil: e.target.checked })}
                  className="w-5 h-5"
                />
              </div>
            </>
          )}
          
          {/* Points Controls */}
          <div>
            <label className="text-white block mb-2">Minimum Points</label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePointsChange('min', -50)}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                -
              </button>
              <span className="text-white flex-1 text-center">{rules.minPoints}</span>
              <button
                onClick={() => handlePointsChange('min', 50)}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                +
              </button>
            </div>
          </div>
          
          <div>
            <label className="text-white block mb-2">Maximum Points</label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePointsChange('max', -50)}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                -
              </button>
              <span className="text-white flex-1 text-center">{rules.maxPoints}</span>
              <button
                onClick={() => handlePointsChange('max', 50)}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
} 