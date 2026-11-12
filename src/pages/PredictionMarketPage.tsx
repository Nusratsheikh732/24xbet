import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, TrendingUp, Clock, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeMarkets,
  subscribeUserBets,
  fetchMarket,
  placePredictionBet,
  settlePredictionBet,
  type PredictionMarket,
  type PredictionBet,
} from '@/lib/predictionMarket';

interface PredictionMarketPageProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  onBack: () => void;
}

export default function PredictionMarketPage({ balance, onBetPlaced, onWin, onBack }: PredictionMarketPageProps) {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [betSide, setBetSide] = useState<'yes' | 'no' | null>(null);
  const [betStatus, setBetStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({ kind: 'idle', text: '' });
  const paidBetIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeMarkets((list) => {
      setMarkets(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Settle the user's pending bets once their market resolves
  useEffect(() => {
    if (!user) return;
    let bets: PredictionBet[] = [];

    const settle = async () => {
      for (const bet of bets) {
        if (bet.status !== 'pending' || paidBetIdsRef.current.has(bet.id)) continue;
        try {
          const market = await fetchMarket(bet.market_id);
          if (!market || market.status !== 'resolved' || !market.resolution) continue;
          const payout = await settlePredictionBet(bet, market.resolution);
          if (payout === null) continue;
          paidBetIdsRef.current.add(bet.id);
          if (payout > 0) onWin(payout);
        } catch {
          // will retry on the next market or bet change
        }
      }
    };

    const unsubBets = subscribeUserBets(user.uid, (list) => {
      bets = list;
      settle();
    });
    const unsubMarkets = subscribeMarkets(() => settle());

    return () => {
      unsubBets();
      unsubMarkets();
    };
  }, [user, onWin]);


  const handlePlaceBet = async () => {
    if (!selectedMarket || !betSide) {
      setBetStatus({ kind: 'error', text: 'Select a market and outcome' });
      return;
    }
    const amt = parseFloat(betAmount);
    if (!amt || amt < 1) {
      setBetStatus({ kind: 'error', text: 'Minimum bet is ৳1' });
      return;
    }
    if (amt > balance) {
      setBetStatus({ kind: 'error', text: 'Insufficient balance' });
      return;
    }
    const market = markets.find((m) => m.id === selectedMarket);
    if (!market) return;
    const odds = betSide === 'yes' ? market.odds_yes : market.odds_no;
    const shares = amt / odds;
    onBetPlaced(amt);

    if (user) {
      try {
        await placePredictionBet({
          market_id: market.id,
          user_uid: user.uid,
          side: betSide,
          amount: amt,
          odds,
        });
      } catch {
        // bet still placed locally even if DB write fails
      }
    }

    setBetStatus({ kind: 'success', text: `Bet placed: ৳${amt.toFixed(2)} on ${betSide === 'yes' ? market.option_yes_label : market.option_no_label} · Potential: ৳${shares.toFixed(2)}` });
    setBetAmount('');
    setBetSide(null);
    setTimeout(() => setBetStatus({ kind: 'idle', text: '' }), 4000);
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const timeLeft = (d: string) => {
    const diff = new Date(d).getTime() - Date.now();
    if (diff < 0) return 'Ended';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const activeMarkets = markets.filter((m) => m.status === 'active');
  const resolvedMarkets = markets.filter((m) => m.status === 'resolved');
  const expandedMarket = markets.find((m) => m.id === selectedMarket);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-dark-bg text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-border px-4 py-3 bg-dark-card2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rounded-full p-1.5 active:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-neon-blue" />
            <span className="text-base font-bold">Prediction Market</span>
          </div>
        </div>
        <div className="rounded-full border border-dark-border bg-dark-card px-3 py-1 text-sm font-semibold text-neon-gold">
          ৳{balance.toFixed(2)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-semibold">No prediction markets yet</p>
            <p className="text-xs text-gray-600 mt-1">Check back soon for new events.</p>
          </div>
        ) : (
          <>
            {/* Active markets */}
            {activeMarkets.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={13} className="text-neon-green" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Active Markets</span>
                </div>
                {activeMarkets.map((m) => {
                  const yesPct = Math.round(m.odds_yes * 100);
                  const noPct = 100 - yesPct;
                  const isExpanded = selectedMarket === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isExpanded ? 'border-neon-blue/40 bg-dark-card' : 'border-dark-border bg-dark-card'
                      }`}
                    >
                      {/* Market header */}
                      <button
                        onClick={() => {
                          setSelectedMarket(isExpanded ? null : m.id);
                          setBetSide(null);
                          setBetStatus({ kind: 'idle', text: '' });
                        }}
                        className="w-full text-left p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-neon-blue bg-neon-blue/10 px-1.5 py-0.5 rounded-full">
                              {m.category}
                            </span>
                            <p className="text-sm font-bold text-white mt-1.5 leading-snug">{m.title}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock size={10} className="text-gray-500" />
                            <span className="text-[10px] text-gray-500 font-semibold">{timeLeft(m.end_date)}</span>
                          </div>
                        </div>

                        {/* Odds bar */}
                        <div className="mt-2.5">
                          <div className="flex h-7 rounded-lg overflow-hidden">
                            <div
                              className="flex items-center justify-center text-[11px] font-bold text-dark-bg bg-neon-green"
                              style={{ width: `${yesPct}%` }}
                            >
                              {yesPct > 12 && `${yesPct}%`}
                            </div>
                            <div
                              className="flex items-center justify-center text-[11px] font-bold text-white bg-neon-red"
                              style={{ width: `${noPct}%` }}
                            >
                              {noPct > 12 && `${noPct}%`}
                            </div>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-neon-green font-bold">{m.option_yes_label} {yesPct}¢</span>
                            <span className="text-[10px] text-neon-red font-bold">{m.option_no_label} {noPct}¢</span>
                          </div>
                        </div>
                      </button>

                      {/* Expanded betting panel */}
                      {isExpanded && (
                        <div className="border-t border-dark-border p-3 space-y-3 bg-dark-card2">
                          <p className="text-[11px] text-gray-500">
                            Buy shares of <span className="text-neon-green font-bold">{m.option_yes_label}</span> or{' '}
                            <span className="text-neon-red font-bold">{m.option_no_label}</span>. Each share pays ৳1 if correct.
                          </p>

                          {/* Outcome buttons */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setBetSide('yes')}
                              className={`rounded-lg py-2.5 text-center transition-all active:scale-95 ${
                                betSide === 'yes'
                                  ? 'bg-neon-green text-dark-bg font-bold'
                                  : 'bg-dark-card border border-dark-border text-neon-green font-semibold'
                              }`}
                            >
                              <div className="text-xs">{m.option_yes_label}</div>
                              <div className="text-[10px] opacity-80">{Math.round(m.odds_yes * 100)}¢ / share</div>
                            </button>
                            <button
                              onClick={() => setBetSide('no')}
                              className={`rounded-lg py-2.5 text-center transition-all active:scale-95 ${
                                betSide === 'no'
                                  ? 'bg-neon-red text-white font-bold'
                                  : 'bg-dark-card border border-dark-border text-neon-red font-semibold'
                              }`}
                            >
                              <div className="text-xs">{m.option_no_label}</div>
                              <div className="text-[10px] opacity-80">{Math.round(m.odds_no * 100)}¢ / share</div>
                            </button>
                          </div>

                          {/* Bet amount input */}
                          <div>
                            <label className="text-[10px] text-gray-500 font-semibold uppercase">Bet Amount</label>
                            <div className="flex items-center bg-dark-card border border-dark-border rounded-lg px-3 py-2.5 mt-1">
                              <span className="text-neon-gold font-bold text-sm mr-1">৳</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                placeholder="0.00"
                                className="bg-transparent text-white text-sm w-full outline-none"
                              />
                              {betSide && betAmount && parseFloat(betAmount) > 0 && (() => {
                                const odds = betSide === 'yes' ? m.odds_yes : m.odds_no;
                                const shares = parseFloat(betAmount) / odds;
                                return (
                                  <span className="text-[10px] text-gray-400 font-bold shrink-0">
                                    {shares.toFixed(1)} shares
                                  </span>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Quick bet amounts */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {[10, 50, 100, 500].map((v) => (
                              <button
                                key={v}
                                onClick={() => setBetAmount(String(v))}
                                className="text-[10px] font-bold py-1.5 rounded-md bg-dark-card border border-dark-border text-gray-300 hover:bg-dark-border active:scale-95 transition-all"
                              >
                                ৳{v}
                              </button>
                            ))}
                          </div>

                          {/* Status message */}
                          {betStatus.kind !== 'idle' && (
                            <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                              betStatus.kind === 'success' ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
                            }`}>
                              {betStatus.text}
                            </div>
                          )}

                          {/* Place bet button */}
                          <button
                            onClick={handlePlaceBet}
                            disabled={!betSide || !betAmount || parseFloat(betAmount) < 1}
                            className="w-full bg-neon-blue text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            style={{ boxShadow: '0 0 12px rgba(0,212,255,0.3)' }}
                          >
                            Place Prediction
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resolved markets */}
            {resolvedMarkets.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={13} className="text-gray-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Resolved</span>
                </div>
                {resolvedMarkets.map((m) => (
                  <div key={m.id} className="rounded-xl border border-dark-border bg-dark-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-gray-500 bg-dark-card2 px-1.5 py-0.5 rounded-full">
                          {m.category}
                        </span>
                        <p className="text-sm font-semibold text-gray-400 mt-1.5 leading-snug">{m.title}</p>
                      </div>
                      {m.resolution === 'yes' ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={14} className="text-neon-green" />
                          <span className="text-[11px] font-bold text-neon-green">{m.option_yes_label}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <XCircle size={14} className="text-neon-red" />
                          <span className="text-[11px] font-bold text-neon-red">{m.option_no_label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
