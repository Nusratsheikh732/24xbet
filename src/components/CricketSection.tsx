import { useState, useEffect } from 'react';
import { openModal, closeModal } from '@/hooks/useModalState';
import { Clock, ChevronRight, CheckCircle2, History, MapPin, Radio, Lock } from 'lucide-react';
import { useSportsMatches } from '@/hooks/useSportsMatches';
import { useLanguage } from '@/context/LanguageContext';
import { teamLogos } from '@/data/teamLogos';
import type { CricketMatch, Prediction } from '@/types';

function toCricketMatch(m: ReturnType<typeof useSportsMatches>['matches'][number]): CricketMatch {
  return {
    id: m.id,
    league: m.league,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeOdds: m.homeOdds,
    drawOdds: m.drawOdds,
    awayOdds: m.awayOdds,
    time: m.matchTime,
    date: m.matchDate,
    format: m.format || '',
    venue: m.venue || '',
    status: m.status,
    result: m.result,
  };
}

interface CricketSectionProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  predictions: Prediction[];
  onAddPrediction: (p: Prediction) => void;
  onOpenHistory: () => void;
}

const teamColors: Record<string, { bg: string; fg: string; abbr: string }> = {
  'Bangladesh': { bg: '#006A4E', fg: '#F42A41', abbr: 'BAN' },
  'India': { bg: '#0F4D92', fg: '#FF9933', abbr: 'IND' },
  'Australia': { bg: '#FFCD00', fg: '#00843D', abbr: 'AUS' },
  'England': { bg: '#012169', fg: '#FFFFFF', abbr: 'ENG' },
  'Pakistan': { bg: '#01411C', fg: '#FFFFFF', abbr: 'PAK' },
  'Sri Lanka': { bg: '#1E4D9B', fg: '#FFB000', abbr: 'SL' },
  'New Zealand': { bg: '#000000', fg: '#FFFFFF', abbr: 'NZ' },
  'South Africa': { bg: '#007749', fg: '#FFD700', abbr: 'SA' },
  'West Indies': { bg: '#7B0040', fg: '#FFD700', abbr: 'WI' },
  'Afghanistan': { bg: '#0072CE', fg: '#FFFFFF', abbr: 'AFG' },
};

function CricketTeamLogo({ team, size = 40 }: { team: string; size?: number }) {
  const logoUrl = teamLogos[team];
  if (logoUrl) {
    return (
      <div
        className="rounded-full overflow-hidden bg-white/95 flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <img src={logoUrl} alt={team} className="w-full h-full object-contain" loading="lazy" />
      </div>
    );
  }
  const info = teamColors[team] || { bg: '#333', fg: '#fff', abbr: '??' };
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: info.bg,
        color: info.fg,
        fontSize: size * 0.28,
        border: `2px solid ${info.fg}40`,
      }}
    >
      {info.abbr}
    </div>
  );
}

export default function CricketSection({
  balance,
  onBetPlaced,
  predictions,
  onAddPrediction,
  onOpenHistory,
}: CricketSectionProps) {
  const { matches, loading } = useSportsMatches();
  const { t } = useLanguage();
  const cricketMatches = matches.filter((m) => m.category === 'cricket').map(toCricketMatch);
  const [selectedMatch, setSelectedMatch] = useState<CricketMatch | null>(null);
  const [selectedPick, setSelectedPick] = useState<'home' | 'draw' | 'away' | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!selectedMatch) return;
    openModal();
    return () => closeModal();
  }, [selectedMatch]);

  const handleOpenMatch = (match: CricketMatch) => {
    setSelectedMatch(match);
    setSelectedPick(null);
    setBetAmount(100);
  };

  const handlePlaceBet = () => {
    if (!selectedMatch || !selectedPick || balance < betAmount) return;
    const odds =
      selectedPick === 'home'
        ? selectedMatch.homeOdds
        : selectedPick === 'draw'
        ? selectedMatch.drawOdds
        : selectedMatch.awayOdds;
    const team =
      selectedPick === 'home'
        ? selectedMatch.homeTeam
        : selectedPick === 'draw'
        ? 'Draw'
        : selectedMatch.awayTeam;

    onAddPrediction({
      id: `${Date.now()}-pred`,
      matchId: selectedMatch.id,
      selection: selectedPick,
      amount: betAmount,
      odds,
      team,
      status: 'pending',
      payout: 0,
    });
    onBetPlaced(betAmount);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setSelectedMatch(null);
    }, 1800);
  };

  const getPickOdds = (pick: 'home' | 'draw' | 'away') => {
    if (!selectedMatch) return 0;
    return pick === 'home'
      ? selectedMatch.homeOdds
      : pick === 'draw'
      ? selectedMatch.drawOdds
      : selectedMatch.awayOdds;
  };

  const potentialWin =
    selectedPick && betAmount > 0
      ? (betAmount * getPickOdds(selectedPick)).toFixed(2)
      : '0.00';

  return (
    <div>
      <div className="flex items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white ring-1 ring-neon-blue/50 shrink-0">
          <img
            src="https://i.postimg.cc/9QMGdwn0/images-(16).jpg"
            alt="Cricket"
            className="w-full h-full object-cover"
          />
        </div>
        <h2 className="font-display text-lg font-bold text-white">{t('sports.cricket')} {t('sports.predictions')}</h2>
        </div>
        <button onClick={onOpenHistory} aria-label="Bet history" className="flex items-center gap-1.5 rounded-lg border border-neon-gold/30 bg-neon-gold/10 px-2.5 py-1.5 text-[10px] font-bold text-neon-gold hover:bg-neon-gold/20 transition-colors">
          <History size={13} />
          <span>History</span>
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-sm text-gray-500 py-8">{t('sports.loadingMatches')}</p>
        ) : cricketMatches.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">{t('sports.noCricket')}</p>
        ) : null}
        {cricketMatches.map((match) => {
          const userPick = predictions.find((p) => p.matchId === match.id);
          return (
            <div
              key={match.id}
              className="bg-dark-card rounded-xl border border-dark-border p-3 hover:border-neon-blue/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {match.status === 'live' && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-neon-red bg-neon-red/15 px-1.5 py-0.5 rounded-full border border-neon-red/30">
                      <Radio size={8} fill="currentColor" className="animate-pulse" />
                      {t('sports.live')}
                    </span>
                  )}
                  <span className="text-[10px] text-neon-blue font-semibold uppercase tracking-wider">
                    {match.league}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                  <Clock size={11} />
                  {match.date} · {match.time}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <CricketTeamLogo team={match.homeTeam} size={40} />
                  <span className="text-sm font-semibold text-white truncate">
                    {match.homeTeam}
                  </span>
                </div>
                <span className="text-xs text-gray-600 font-bold px-2">{t('sports.vs')}</span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-sm font-semibold text-white truncate text-right">
                    {match.awayTeam}
                  </span>
                  <CricketTeamLogo team={match.awayTeam} size={40} />
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2 text-[9px] text-gray-500">
                <MapPin size={9} />
                <span>{match.venue}</span>
                <span className="text-gray-700">·</span>
                <span className="font-semibold text-gray-400">{match.format}</span>
              </div>

              {userPick && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neon-green">
                  <CheckCircle2 size={12} />
                  {t('sports.yourPick')}: {userPick.team} @ {userPick.odds.toFixed(2)}
                </div>
              )}

              {match.status === 'finished' ? (
                <div className="w-full mt-2 flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 rounded-xl bg-gray-700/40 text-gray-500 border border-gray-700/40 cursor-not-allowed">
                  <Lock size={14} />
                  Match Finished
                </div>
              ) : (
                <button
                  onClick={() => handleOpenMatch(match)}
                  className="w-full mt-2 flex items-center justify-center gap-1 text-sm font-bold py-2.5 rounded-xl bg-neon-gold text-dark-bg active:scale-95 hover:bg-neon-gold/90 transition-all"
                >
                  {t('sports.placePrediction')}
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedMatch && (
        <div
          className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => !showSuccess && setSelectedMatch(null)}
        >
          <div
            className="bg-dark-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-dark-border animate-fade-in-up max-h-[calc(85vh-7rem)] mb-28 sm:mb-0 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {showSuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={40} className="text-neon-green" />
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-1">
                  {t('sports.predictionPlaced')}
                </h3>
                <p className="text-sm text-gray-400">
                  {t('sports.predictionConfirmed')}
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-dark-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      {selectedMatch.status === 'live' && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-neon-red bg-neon-red/15 px-1.5 py-0.5 rounded-full border border-neon-red/30">
                          <Radio size={8} fill="currentColor" className="animate-pulse" />
                          {t('sports.live')}
                        </span>
                      )}
                      <span className="text-[10px] text-neon-blue font-semibold uppercase tracking-wider">
                        {selectedMatch.league}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedMatch(null)}
                      className="text-gray-500 hover:text-white text-xl leading-none"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <CricketTeamLogo team={selectedMatch.homeTeam} size={48} />
                      <span className="text-xs font-semibold text-white text-center">
                        {selectedMatch.homeTeam}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 font-bold px-2">{t('sports.vs')}</span>
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <CricketTeamLogo team={selectedMatch.awayTeam} size={48} />
                      <span className="text-xs font-semibold text-white text-center">
                        {selectedMatch.awayTeam}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-gray-500">
                    <MapPin size={10} />
                    {selectedMatch.venue} · {selectedMatch.format}
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-xs text-gray-400 font-semibold mb-2">{t('sports.selectPrediction')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['home', 'draw', 'away'] as const).map((pick) => {
                      const odds = getPickOdds(pick);
                      const label =
                        pick === 'home'
                          ? selectedMatch.homeTeam
                          : pick === 'draw'
                          ? 'Draw'
                          : selectedMatch.awayTeam;
                      const isActive = selectedPick === pick;
                      return (
                        <button
                          key={pick}
                          onClick={() => setSelectedPick(pick)}
                          className={`rounded-xl p-2.5 text-center transition-all border ${
                            isActive
                              ? 'bg-neon-blue/15 border-neon-blue'
                              : 'bg-dark-card2 border-dark-border hover:border-gray-600'
                          }`}
                        >
                          <div className={`text-[10px] truncate ${isActive ? 'text-neon-blue' : 'text-gray-400'}`}>
                            {label}
                          </div>
                          <div className={`text-sm font-bold mt-0.5 ${isActive ? 'text-neon-blue' : 'text-white'}`}>
                            {odds.toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedPick && (
                    <div className="mt-4 animate-fade-in-up">
                      <p className="text-xs text-gray-400 font-semibold mb-2">Bet Amount</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-dark-card2 rounded-xl border border-dark-border px-3 py-2.5 flex items-center">
                          <span className="text-neon-gold font-bold mr-1">৳</span>
                          <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="bg-transparent text-white font-semibold w-full outline-none text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {[100, 200, 500, 1000].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setBetAmount(amt)}
                            className="flex-1 bg-dark-card2 hover:bg-dark-border text-xs text-gray-300 font-semibold py-1.5 rounded-lg transition-colors"
                          >
                            ৳{amt}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-3 px-1">
                        <span className="text-xs text-gray-500">Potential Win</span>
                        <span className="font-display text-lg font-bold text-neon-blue">
                          ৳{potentialWin}
                        </span>
                      </div>

                      <button
                        onClick={handlePlaceBet}
                        disabled={balance < betAmount || betAmount <= 0}
                        className="w-full mt-3 bg-neon-blue text-white font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {balance < betAmount ? 'Insufficient Balance' : `Place Bet ৳${betAmount}`}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
