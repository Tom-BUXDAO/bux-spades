import { useState } from 'react';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: GameRules) => void;
}

export interface GameRules {
  allowNil: boolean;
  allowBlindNil: boolean;
  minPoints: number;
  maxPoints: number;
}

export default function GameRulesModal({ isOpen, onClose, onSave }: GameRulesModalProps) {
  const [rules, setRules] = useState<GameRules>({
    allowNil: true,
    allowBlindNil: false,
    minPoints: -250,
    maxPoints: 500
  });

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(rules);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold text-white mb-4">Game Rules</h2>
        
        <div className="space-y-4">
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
          
          <div>
            <label className="text-white block mb-2">Minimum Points</label>
            <select
              value={rules.minPoints}
              onChange={(e) => setRules({ ...rules, minPoints: parseInt(e.target.value) })}
              className="w-full bg-gray-700 text-white rounded p-2"
            >
              <option value="-250">-250</option>
              <option value="-200">-200</option>
              <option value="-150">-150</option>
              <option value="-100">-100</option>
            </select>
          </div>
          
          <div>
            <label className="text-white block mb-2">Maximum Points</label>
            <select
              value={rules.maxPoints}
              onChange={(e) => setRules({ ...rules, maxPoints: parseInt(e.target.value) })}
              className="w-full bg-gray-700 text-white rounded p-2"
            >
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="300">300</option>
              <option value="400">400</option>
              <option value="500">500</option>
              <option value="600">600</option>
              <option value="650">650</option>
            </select>
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
            Save Rules
          </button>
        </div>
      </div>
    </div>
  );
} 