import { useState } from 'react';

export type GameType = 'REGULAR' | 'WHIZ' | 'SOLO' | 'MIRROR';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: GameRules) => void;
  initialRules?: GameRules;
  userCoins: number;
}

export interface GameRules {
  gameType: GameType;
  allowNil: boolean;
  allowBlindNil: boolean;
  minPoints: number;
  maxPoints: number;
  coinAmount: number;
}

const defaultRules: GameRules = {
  gameType: 'REGULAR',
  allowNil: true,
  allowBlindNil: false,
  minPoints: -250,
  maxPoints: 500,
  coinAmount: 100000
};

export default function GameRulesModal({ isOpen, onClose, onSave, initialRules, userCoins }: GameRulesModalProps) {
  const [rules, setRules] = useState<GameRules>(initialRules || defaultRules);

  if (!isOpen) return null;

  const handleSave = () => {
    if (rules.coinAmount > userCoins) {
      alert("You don't have enough coins for this table!");
      return;
    }
    onSave(rules);
    onClose();
  };

  const handlePointsChange = (type: 'min' | 'max', delta: number) => {
    const currentValue = type === 'min' ? rules.minPoints : rules.maxPoints;
    const newValue = currentValue + delta;
    
    // Validate ranges
    if (type === 'min' && newValue >= -250 && newValue <= -100) {
      setRules({ ...rules, minPoints: newValue });
    } else if (type === 'max' && newValue >= 100 && newValue <= 650) {
      setRules({ ...rules, maxPoints: newValue });
    }
  };

  const handleCoinAmountChange = (delta: number) => {
    const currentAmount = rules.coinAmount;
    const newAmount = currentAmount + delta;
    
    // Validate ranges (minimum 10k, maximum user's coins)
    if (newAmount >= 10000 && newAmount <= userCoins) {
      setRules({ ...rules, coinAmount: newAmount });
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

          {/* Coin Amount */}
          <div>
            <label className="text-white block mb-2">Coin Amount (per player)</label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleCoinAmountChange(-10000)}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                -10k
              </button>
              <span className="text-white flex-1 text-center">{rules.coinAmount.toLocaleString()}</span>
              <button
                onClick={() => handleCoinAmountChange(10000)}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                +10k
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Prize pool: {(rules.coinAmount * 4 * 0.9).toLocaleString()} (after 10% house fee)
            </p>
            <p className="text-sm text-gray-400">
              Winners get: {(rules.coinAmount * 4 * 0.9 / 2).toLocaleString()} each
            </p>
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