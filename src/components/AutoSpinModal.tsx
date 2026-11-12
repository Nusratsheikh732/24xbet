import { X } from 'lucide-react';

interface AutoSpinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (count: number) => void;
  betAmount: number;
  balance: number;
}

const SPIN_OPTIONS = [10, 25, 50, 100];

export default function AutoSpinModal({ isOpen, onClose, onStart, betAmount, balance }: AutoSpinModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-dark-card rounded-2xl border border-neon-gold/30 p-5 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-neon-gold">Auto Spin</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 bg-dark-card2 rounded-xl border border-dark-border p-3 text-center">
          <p className="text-xs text-gray-500">Current Bet</p>
          <p className="text-lg font-bold text-white">৳{betAmount.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 mt-1">Balance: ৳{balance.toFixed(2)}</p>
        </div>

        <p className="text-xs text-gray-400 font-semibold mb-2">Select number of spins</p>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {SPIN_OPTIONS.map((count) => {
            const cost = betAmount * count;
            const affordable = balance >= cost;
            return (
              <button
                key={count}
                onClick={() => {
                  onStart(count);
                  onClose();
                }}
                disabled={!affordable}
                className="bg-dark-card2 rounded-xl border border-dark-border p-3 text-center transition-all active:scale-95 hover:border-neon-gold/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <p className="text-2xl font-bold text-neon-gold">{count}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Spins</p>
                <p className="text-[9px] text-gray-600 mt-1">Cost: ৳{cost.toFixed(2)}</p>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            const maxSpins = Math.floor(balance / betAmount);
            if (maxSpins > 0) {
              onStart(maxSpins);
              onClose();
            }
          }}
          disabled={balance < betAmount}
          className="w-full bg-neon-gold/15 text-neon-gold font-bold text-sm py-2.5 rounded-xl border border-neon-gold/30 transition-all active:scale-95 hover:bg-neon-gold/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Max Spins ({Math.floor(balance / betAmount) || 0})
        </button>

        {balance < betAmount && (
          <p className="text-[10px] text-neon-red text-center mt-2">Insufficient balance for auto spin</p>
        )}
      </div>
    </div>
  );
}
