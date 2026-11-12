import { Ticket, TrendingUp, Clock, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import ModalShell from '@/components/ModalShell';
import type { Prediction } from '@/types';

interface MyPredictionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  predictions: Prediction[];
}

export default function MyPredictionsModal({ isOpen, onClose, predictions }: MyPredictionsModalProps) {
  const activePredictions = predictions.filter((p) => p.status === 'pending');
  const totalPotential = activePredictions.reduce((sum, p) => sum + p.amount * p.odds, 0);
  const totalStaked = activePredictions.reduce((sum, p) => sum + p.amount, 0);
  const totalWon = predictions.filter((p) => p.status === 'won').reduce((sum, p) => sum + p.payout, 0);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="My Predictions"
      icon={<Ticket size={20} className="text-neon-green" />}
    >
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-dark-card2 rounded-xl border border-dark-border p-3 text-center">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Bets</p>
          <p className="font-display text-xl font-bold text-white mt-1">{predictions.length}</p>
        </div>
        <div className="bg-dark-card2 rounded-xl border border-dark-border p-3 text-center">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Staked</p>
          <p className="font-display text-xl font-bold text-neon-gold mt-1">৳{totalStaked.toFixed(0)}</p>
        </div>
        <div className="bg-dark-card2 rounded-xl border border-dark-border p-3 text-center">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Won</p>
          <p className="font-display text-xl font-bold text-neon-green mt-1">৳{totalWon.toFixed(0)}</p>
        </div>
      </div>

      {predictions.length === 0 ? (
        <div className="text-center py-10">
          <Ticket size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-semibold">No predictions yet</p>
          <p className="text-xs text-gray-600 mt-1">Place a bet from the sports section to see it here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {predictions.map((p, i) => (
            <div
              key={i}
              className="bg-dark-card2 rounded-xl border border-dark-border p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  p.status === 'won'
                    ? 'bg-neon-green/10'
                    : p.status === 'lost'
                    ? 'bg-neon-red/10'
                    : 'bg-neon-gold/10'
                }`}>
                  {p.status === 'won' ? (
                    <CheckCircle2 size={18} className="text-neon-green" />
                  ) : p.status === 'lost' ? (
                    <XCircle size={18} className="text-neon-red" />
                  ) : (
                    <Hourglass size={18} className="text-neon-gold" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{p.team}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={11} className="text-gray-500" />
                    <span className="text-xs text-gray-500">Odds {p.odds.toFixed(2)} · ৳{p.amount}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                {p.status === 'pending' && (
                  <>
                    <p className="text-[10px] text-gray-500 uppercase">Potential</p>
                    <p className="text-sm font-bold text-neon-green">৳{(p.amount * p.odds).toFixed(2)}</p>
                  </>
                )}
                {p.status === 'won' && (
                  <>
                    <p className="text-[10px] text-neon-green uppercase">Won</p>
                    <p className="text-sm font-bold text-neon-green">৳{p.payout.toFixed(2)}</p>
                  </>
                )}
                {p.status === 'lost' && (
                  <>
                    <p className="text-[10px] text-neon-red uppercase">Lost</p>
                    <p className="text-sm font-bold text-neon-red">-৳{p.amount}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
