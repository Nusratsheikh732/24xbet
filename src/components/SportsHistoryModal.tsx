import { useEffect } from 'react';
import { Clock, History, X } from 'lucide-react';
import { closeModal, openModal } from '@/hooks/useModalState';
import { useSportsMatches, type SportsMatch } from '@/hooks/useSportsMatches';
import type { Prediction } from '@/types';

interface SportsHistoryModalProps {
  predictions: Prediction[];
  onClose: () => void;
}

function getDisplayStatus(prediction: Prediction, match?: SportsMatch): 'Processing' | 'Win' | 'Loss' {
  if (!match || match.result === 'pending' || match.status !== 'finished') return 'Processing';
  return match.result === prediction.selection ? 'Win' : 'Loss';
}

function getStatusClass(status: 'Processing' | 'Win' | 'Loss'): string {
  if (status === 'Win') return 'text-neon-green bg-neon-green/10 border-neon-green/30';
  if (status === 'Loss') return 'text-neon-red bg-neon-red/10 border-neon-red/30';
  return 'text-neon-gold bg-neon-gold/10 border-neon-gold/30';
}

export default function SportsHistoryModal({ predictions, onClose }: SportsHistoryModalProps) {
  const { matches } = useSportsMatches();

  useEffect(() => {
    openModal();
    return () => closeModal();
  }, []);

  const entries = predictions
    .map((prediction) => {
      const match = matches.find((item) => item.id === prediction.matchId);
      const status = getDisplayStatus(prediction, match);
      const createdAt = Number(prediction.id.split('-')[0]) || 0;
      return { prediction, match, status, createdAt };
    })
    .sort((a, b) => {
      const aFinished = a.match?.status === 'finished';
      const bFinished = b.match?.status === 'finished';
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-dark-card w-full max-w-md max-h-[82vh] rounded-t-2xl sm:rounded-2xl border border-dark-border overflow-hidden animate-fade-in-up" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <History size={18} className="text-neon-gold" />
            <h3 className="font-display text-lg font-bold text-white">Bet History</h3>
          </div>
          <button onClick={onClose} aria-label="Close history" className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-3 overflow-y-auto max-h-[calc(82vh-58px)] space-y-2.5">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No sports bets yet</div>
          ) : entries.map(({ prediction, match, status }) => (
            <div key={prediction.id} className="rounded-xl border border-dark-border bg-dark-card2/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-neon-blue font-semibold truncate">
                    {match?.league || 'Sports'}
                  </p>
                  <p className="text-sm font-semibold text-white mt-1 truncate">
                    {match ? `${match.homeTeam} vs ${match.awayTeam}` : prediction.team}
                  </p>
                  {match && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                      <Clock size={10} />
                      {match.matchDate} · {match.matchTime}
                    </div>
                  )}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${getStatusClass(status)}`}>
                  {status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-dark-border/70 pt-2 text-[11px]">
                <span className="text-gray-400">Bet: <b className="text-white">৳{prediction.amount.toFixed(2)}</b></span>
                <span className="text-gray-400">Pick: <b className="text-white">{prediction.team}</b></span>
                {status === 'Win' && <span className="text-neon-green font-bold">Win: ৳{(prediction.payout || prediction.amount * prediction.odds).toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
