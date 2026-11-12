import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, X, Zap, Minus, Plus, Users, Clock, Trophy, Volume2, VolumeX, Plane } from 'lucide-react';
import type { CrashHistory } from '@/types';
import { db, ref, onValue, push, set, update, remove } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { addTransaction } from '@/lib/localStorage';
import { AviatorSound } from '@/lib/aviatorSound';
import { generateSimBetsWithTiming, type SimBetWithTiming } from '@/lib/simBets';

interface FlyXGameProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  fullscreen?: boolean;
}

type GameState = 'waiting' | 'running' | 'crashed';
type PanelMode = 'bet' | 'auto';
type LiveTab = 'all' | 'my' | 'top';

const QUICK_AMOUNTS = [5, 10, 50, 100];
const WAITING_DURATION = 5000;
const CRASH_DURATION = 3000;

interface CrashConfig {
  early_crash_ratio: number;
  min_crash_mult: number;
  max_early_crash: number;
  max_late_crash: number;
}

const defaultConfig: CrashConfig = {
  early_crash_ratio: 0.8,
  min_crash_mult: 1.01,
  max_early_crash: 1.50,
  max_late_crash: 9.50,
};

interface PanelState {
  amount: number;
  hasActiveBet: boolean;
  cashOutValue: number | null;
  lastWin: number | null;
  autoCashoutEnabled: boolean;
  autoCashoutValue: number;
  mode: PanelMode;
  autoBetEnabled: boolean;
}

function createInitialPanel(): PanelState {
  return {
    amount: 50,
    hasActiveBet: false,
    cashOutValue: null,
    lastWin: null,
    autoCashoutEnabled: false,
    autoCashoutValue: 2.0,
    mode: 'bet',
    autoBetEnabled: false,
  };
}

function getCrashMultiplier(config: CrashConfig, rtp: number): number {
  const rtpFactor = Math.max(0.1, Math.min(1.0, rtp / 100));
  const adjustedEarlyRatio = config.early_crash_ratio + (1 - rtpFactor) * 0.15;
  const isEarlyCrash = Math.random() < Math.min(0.98, adjustedEarlyRatio);
  if (isEarlyCrash) {
    const range = config.max_early_crash - config.min_crash_mult;
    return parseFloat((config.min_crash_mult + Math.random() * range).toFixed(2));
  }
  const lateRange = config.max_late_crash - config.max_early_crash;
  const adjustedLateMax = config.max_early_crash + lateRange * rtpFactor;
  return parseFloat((config.max_early_crash + Math.random() * (adjustedLateMax - config.max_early_crash)).toFixed(2));
}

function getCrashColor(mult: number): string {
  if (mult < 1.5) return '#ff3366';
  if (mult < 2) return '#ff9500';
  if (mult < 5) return '#00ff88';
  return '#ffd700';
}

interface LiveBet {
  id: string;
  user: string;
  amount: number;
  multiplier: number | null;
  cashedOut: boolean;
  win: number | null;
  isMe: boolean;
}

interface MyBetRecord {
  round: number;
  amount: number;
  multiplier: number | null;
  win: number | null;
}

export default function FlyXGame({ balance, onBetPlaced, onWin, fullscreen = false }: FlyXGameProps) {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [history, setHistory] = useState<CrashHistory[]>([]);
  const [panels, setPanels] = useState<PanelState[]>(() => [createInitialPanel(), createInitialPanel()]);
  const [countdown, setCountdown] = useState(WAITING_DURATION / 1000);
  const [liveTab, setLiveTab] = useState<LiveTab>('all');
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [myBets, setMyBets] = useState<MyBetRecord[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [simBets, setSimBets] = useState<SimBetWithTiming[]>([]);
  const simBetsRef = useRef<SimBetWithTiming[]>([]);
  const simCashedRef = useRef<Set<string>>(new Set());

  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(1.0);
  const crashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crashConfigRef = useRef<CrashConfig>(defaultConfig);
  const rtpRef = useRef<number>(80);
  const multiplierRef = useRef(1.0);
  const soundRef = useRef<AviatorSound | null>(null);
  const roundNumberRef = useRef(1);
  const myBetIdsRef = useRef<Record<number, string>>({});
  const liveBetsUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const sound = new AviatorSound();
    soundRef.current = sound;
    setIsMuted(sound.isMuted());
    return () => { sound.destroy(); soundRef.current = null; };
  }, []);

  useEffect(() => { multiplierRef.current = multiplier; }, [multiplier]);

  const { user, deductBalance, addBalance } = useAuth();
  const { t, bn } = useLanguage();

  useEffect(() => {
    const unsub = onValue(ref(db, 'game_settings/flyx'), (snap) => {
      if (snap.exists()) {
        const s = snap.val() as CrashConfig;
        crashConfigRef.current = {
          early_crash_ratio: s.early_crash_ratio ?? 0.8,
          min_crash_mult: s.min_crash_mult ?? 1.01,
          max_early_crash: s.max_early_crash ?? 1.50,
          max_late_crash: s.max_late_crash ?? 9.50,
        };
        if (typeof s.rtp === 'number') rtpRef.current = s.rtp;
      }
    });
    return () => unsub();
  }, []);

  const cashOutPanel = useCallback((index: number, atMultiplier: number) => {
    const winAmount = parseFloat((panels[index].amount * atMultiplier).toFixed(2));
    setPanels((prev) => {
      const panel = prev[index];
      if (!panel.hasActiveBet || panel.cashOutValue !== null) return prev;
      addBalance(winAmount);
      addTransaction({ id: `${Date.now()}-flyx-win-${index}`, type: 'win', amount: winAmount, timestamp: Date.now() });
      onWin(winAmount);
      soundRef.current?.playCashout();
      const updated = [...prev];
      updated[index] = { ...panel, cashOutValue: atMultiplier, lastWin: winAmount };
      return updated;
    });
    const betId = myBetIdsRef.current[index];
    const round = roundNumberRef.current;
    if (betId) {
      update(ref(db, `flyx_live_bets/${round}/${betId}`), {
        multiplier: atMultiplier,
        cashedOut: true,
        win: winAmount,
      }).catch(() => {});
    }
    if (user) {
      const betRef = push(ref(db, 'flyx_bets'));
      set(betRef, {
        userId: user.uid,
        userName: user.name,
        betAmount: panels[index].amount,
        multiplier: atMultiplier,
        payout: winAmount,
        timestamp: Date.now(),
      }).catch(() => {});
    }
  }, [addBalance, onWin, user, panels]);

  useEffect(() => {
    if (gameState !== 'running') return;
    panels.forEach((panel, i) => {
      if (panel.hasActiveBet && panel.cashOutValue === null && panel.autoCashoutEnabled && multiplier >= panel.autoCashoutValue) {
        cashOutPanel(i, panel.autoCashoutValue);
      }
    });
  }, [multiplier, gameState, panels, cashOutPanel]);

  const subscribeLiveBets = useCallback((round: number) => {
    if (liveBetsUnsubRef.current) {
      liveBetsUnsubRef.current();
      liveBetsUnsubRef.current = null;
    }
    const unsub = onValue(ref(db, `flyx_live_bets/${round}`), (snap) => {
      const bets: LiveBet[] = [];
      if (snap.exists()) {
        const val = snap.val();
        for (const id in val) {
          const b = val[id];
          bets.push({
            id,
            user: b.userName || 'Player',
            amount: b.amount || 0,
            multiplier: b.multiplier ?? null,
            cashedOut: !!b.cashedOut,
            win: b.win ?? null,
            isMe: b.isMe ?? false,
          });
        }
      }
      setLiveBets(bets.sort((a, b) => b.amount - a.amount));
    });
    liveBetsUnsubRef.current = unsub;
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, 'flyx_history'), (snap) => {
      const items: { multiplier: number; color: string; ts: number }[] = [];
      if (snap.exists()) {
        const val = snap.val();
        for (const id in val) {
          const r = val[id];
          if (typeof r.multiplier === 'number') {
            items.push({ multiplier: r.multiplier, color: getCrashColor(r.multiplier), ts: r.timestamp || 0 });
          }
        }
      }
      items.sort((a, b) => b.ts - a.ts);
      setHistory(items.slice(0, 20).map(({ multiplier, color }) => ({ multiplier, color })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    subscribeLiveBets(roundNumberRef.current);
  }, [subscribeLiveBets]);

  const startRound = useCallback(() => {
    setGameState('running');
    startTimeRef.current = performance.now();
    crashPointRef.current = getCrashMultiplier(crashConfigRef.current, rtpRef.current);
    const newSimBets = generateSimBetsWithTiming(crashPointRef.current);
    simBetsRef.current = newSimBets;
    simCashedRef.current = new Set();
    setSimBets(newSimBets);
    soundRef.current?.startEngine();

    const animate = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000;
      const k = 0.35;
      const currentMult = Math.pow(Math.E, k * elapsed);

      if (currentMult >= crashPointRef.current) {
        setMultiplier(crashPointRef.current);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        soundRef.current?.stopEngine();
        soundRef.current?.playCrash();
        setGameState('crashed');

        const crashMult = crashPointRef.current;
        const histRef = push(ref(db, 'flyx_history'));
        set(histRef, {
          multiplier: crashMult,
          timestamp: Date.now(),
        }).catch(() => {});

        setPanels((prev) => {
          prev.forEach((p, i) => {
            if (p.hasActiveBet && p.cashOutValue === null) {
              setMyBets((mb) => [{
                round: roundNumberRef.current,
                amount: p.amount,
                multiplier: null,
                win: null,
              }, ...mb].slice(0, 20));
            } else if (p.hasActiveBet && p.cashOutValue !== null) {
              setMyBets((mb) => [{
                round: roundNumberRef.current,
                amount: p.amount,
                multiplier: p.cashOutValue,
                win: p.lastWin,
              }, ...mb].slice(0, 20));
            }
          });
          return prev;
        });

        crashTimerRef.current = setTimeout(() => {
          const finishedRound = roundNumberRef.current;
          myBetIdsRef.current = {};
          setPanels((prev) => prev.map((p) => ({ ...p, hasActiveBet: false, cashOutValue: null, lastWin: null })));
          setMultiplier(1.0);
          setGameState('waiting');
          setCountdown(WAITING_DURATION / 1000);
          setRoundNumber((n) => { roundNumberRef.current = n + 1; return n + 1; });
          subscribeLiveBets(roundNumberRef.current);
          remove(ref(db, `flyx_live_bets/${finishedRound}`)).catch(() => {});
          startWaitingPhase();
        }, CRASH_DURATION);
        return;
      }

      setMultiplier(parseFloat(currentMult.toFixed(2)));
      soundRef.current?.updateEngine(currentMult);

      // Progressive bot cash-outs
      const elapsedSec = (now - startTimeRef.current) / 1000;
      let cashed = false;
      for (const b of simBetsRef.current) {
        if (b.cashOutDelay > 0 && !simCashedRef.current.has(b.id) && elapsedSec >= b.cashOutDelay) {
          simCashedRef.current.add(b.id);
          cashed = true;
        }
      }
      if (cashed) {
        setSimBets(prev => prev.map(b =>
          simCashedRef.current.has(b.id) && !b.cashedOut
            ? { ...b, cashedOut: true, multiplier: b.multiplier, win: b.win }
            : b
        ));
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const startWaitingPhase = useCallback(() => {
    let remaining = WAITING_DURATION / 1000;
    setCountdown(remaining);

    countdownRef.current = setInterval(() => {
      remaining -= 0.1;
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(0);
      } else {
        setCountdown(parseFloat(remaining.toFixed(1)));
      }
    }, 100);

    waitingTimerRef.current = setTimeout(() => {
      startRound();
    }, WAITING_DURATION);
  }, [startRound]);

  useEffect(() => {
    startWaitingPhase();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (crashTimerRef.current) clearTimeout(crashTimerRef.current);
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (liveBetsUnsubRef.current) liveBetsUnsubRef.current();
    };
  }, [startWaitingPhase, subscribeLiveBets]);

  const handlePlaceBet = (index: number) => {
    const panel = panels[index];
    if (gameState !== 'waiting' || panel.hasActiveBet || balance < panel.amount || panel.amount <= 0) return;
    soundRef.current?.unlock();
    deductBalance(panel.amount);
    onBetPlaced(panel.amount);
    addTransaction({ id: `${Date.now()}-flyx-bet-${index}`, type: 'bet', amount: panel.amount, timestamp: Date.now() });
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...panel, hasActiveBet: true, cashOutValue: null, lastWin: null };
      return updated;
    });
    const round = roundNumberRef.current;
    const betRef = push(ref(db, `flyx_live_bets/${round}`));
    set(betRef, {
      userName: user?.name || 'You',
      userId: user?.uid || null,
      amount: panel.amount,
      multiplier: null,
      cashedOut: false,
      win: null,
      isMe: true,
      timestamp: Date.now(),
    }).then(() => {
      myBetIdsRef.current[index] = betRef.key!;
    }).catch(() => {});
  };

  const handleCancelBet = (index: number) => {
    const panel = panels[index];
    if (gameState !== 'waiting' || !panel.hasActiveBet) return;
    soundRef.current?.unlock();
    addBalance(panel.amount);
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...panel, hasActiveBet: false, cashOutValue: null, lastWin: null };
      return updated;
    });
    const betId = myBetIdsRef.current[index];
    const round = roundNumberRef.current;
    if (betId) {
      remove(ref(db, `flyx_live_bets/${round}/${betId}`)).catch(() => {});
      delete myBetIdsRef.current[index];
    }
  };

  const handleCashOut = (index: number) => {
    const panel = panels[index];
    if (gameState !== 'running' || !panel.hasActiveBet || panel.cashOutValue !== null) return;
    soundRef.current?.unlock();
    cashOutPanel(index, multiplierRef.current);
  };

  const updatePanelAmount = (index: number, amount: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount: Math.max(0.5, parseFloat(amount.toFixed(2))) };
      return updated;
    });
  };

  const adjustAmount = (index: number, delta: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      const newAmt = Math.max(0.5, parseFloat((updated[index].amount + delta).toFixed(2)));
      updated[index] = { ...updated[index], amount: newAmt };
      return updated;
    });
  };

  const setMaxAmount = (index: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount: parseFloat(balance.toFixed(2)) };
      return updated;
    });
  };

  const setPanelMode = (index: number, mode: PanelMode) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], mode };
      return updated;
    });
  };

  const toggleAutoCashout = (index: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], autoCashoutEnabled: !updated[index].autoCashoutEnabled };
      return updated;
    });
  };

  const toggleAutoBet = (index: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], autoBetEnabled: !updated[index].autoBetEnabled };
      return updated;
    });
  };

  const setAutoCashoutValue = (index: number, value: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], autoCashoutValue: Math.max(1.01, value) };
      return updated;
    });
  };

  const handleToggleMute = () => {
    const muted = soundRef.current?.toggleMute() ?? false;
    setIsMuted(muted);
  };

  const multColor =
    gameState === 'crashed' ? '#ff3366' : multiplier >= 2 ? '#00ff88' : '#ffd700';

  const mergedLiveBets: LiveBet[] = [...liveBets, ...simBets.map(b => ({ ...b, isMe: false }))];
  const allBetsCount = mergedLiveBets.length;

  const liveTabConfig: { id: LiveTab; labelKey: string; icon: typeof Users; count: number }[] = [
    { id: 'all', labelKey: 'flyx.allBets', icon: Users, count: allBetsCount },
    { id: 'my', labelKey: 'flyx.myBets', icon: Clock, count: myBets.length },
    { id: 'top', labelKey: 'flyx.top', icon: Trophy, count: mergedLiveBets.filter(b => b.cashedOut && (b.multiplier ?? 0) >= 2).length },
  ];

  const displayedBets: LiveBet[] = liveTab === 'top'
    ? [...mergedLiveBets].filter(b => b.cashedOut).sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0))
    : liveTab === 'my'
    ? myBets.map((mb) => ({ id: `my-${mb.round}`, user: `Round ${mb.round}`, amount: mb.amount, multiplier: mb.multiplier, cashedOut: mb.multiplier !== null, win: mb.win, isMe: true }))
    : [...mergedLiveBets].sort((a, b) => {
        if (a.cashedOut && !b.cashedOut) return -1;
        if (!a.cashedOut && b.cashedOut) return 1;
        return b.amount - a.amount;
      });

  // Superman flight curve positions — 0-100 coordinate space
  const startX = 12;
  const startY = 80;
  const endXMax = 90;
  const endYMax = 10;
  const cpX = 50;
  const cpY = 30;
  // progress goes 0 → 1 as multiplier goes 1.00 → 8.00; freezes at crash value
  const progress = gameState === 'crashed' ? Math.min((multiplier - 1) / 7, 1) : Math.min((multiplier - 1) / 7, 1);
  const ct = progress;
  const heroX = (1 - ct) * (1 - ct) * startX + 2 * (1 - ct) * ct * cpX + ct * ct * endXMax;
  const heroY = (1 - ct) * (1 - ct) * startY + 2 * (1 - ct) * ct * cpY + ct * ct * endYMax;
  const dx = 2 * (1 - ct) * (cpX - startX) + 2 * ct * (endXMax - cpX);
  const dy = 2 * (1 - ct) * (cpY - startY) + 2 * ct * (endYMax - cpY);
  const heroAngle = Math.atan2(-dy, dx) * (180 / Math.PI);
  // Sub-curve control point: scales with progress so the trail never extends ahead of the character.
  // At ct=0 the trail is a single point; as ct grows the trail matches the full curve exactly.
  const subCpX = startX + ct * (cpX - startX);
  const subCpY = startY + ct * (cpY - startY);
  const trailPath = `M ${startX} ${startY} Q ${subCpX} ${subCpY} ${heroX} ${heroY}`;
  const fullPath = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endXMax} ${endYMax}`;

  // Character image URL — Image 2 character
  const characterImg = 'https://i.postimg.cc/NG70P2JW/Chat-GPT-Image-Sep-26-2026-03-37-58-AM.png';

  // Cloud positions for background
  const clouds = [
    { x: 15, y: 25, size: 12, opacity: 0.08 },
    { x: 55, y: 18, size: 16, opacity: 0.06 },
    { x: 75, y: 45, size: 10, opacity: 0.07 },
    { x: 30, y: 55, size: 14, opacity: 0.05 },
    { x: 65, y: 65, size: 11, opacity: 0.06 },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* History pills bar */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar bg-dark-card border-b border-dark-border">
        {history.length === 0 && (
          <span className="text-[11px] text-gray-600 italic">Waiting for first round...</span>
        )}
        {history.map((h, i) => (
          <button
            key={i}
            className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap transition-transform active:scale-95"
            style={{
              color: h.color,
              backgroundColor: `${h.color}18`,
              border: `1px solid ${h.color}30`,
            }}
          >
            {h.multiplier.toFixed(2)}x
          </button>
        ))}
        <button
          onClick={handleToggleMute}
          className="shrink-0 ml-auto w-7 h-7 flex items-center justify-center rounded-md bg-dark-card2 border border-dark-border text-gray-400 active:scale-90 transition-all"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </div>

      {/* Flight area — Image 2 scene style */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-[#0a0e1a] via-[#0d1424] to-[#060810]">
        {/* Scene background — dark sky gradient, always visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a] via-[#0d1424] to-[#060810]" />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Clouds — always visible, drifting */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {clouds.map((c, i) => (
            <g key={i} opacity={c.opacity * 1.5} style={{ animation: `floatCloud ${20 + i * 5}s ease-in-out infinite`, animationDelay: `${i * 3}s` }}>
              <ellipse cx={c.x} cy={c.y} rx={c.size} ry={c.size * 0.5} fill="#ffffff" />
              <ellipse cx={c.x + c.size * 0.5} cy={c.y + 2} rx={c.size * 0.7} ry={c.size * 0.4} fill="#ffffff" />
              <ellipse cx={c.x - c.size * 0.5} cy={c.y + 1} rx={c.size * 0.6} ry={c.size * 0.35} fill="#ffffff" />
            </g>
          ))}
        </svg>

        {/* Multiplier display center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
          {gameState === 'waiting' && (
            <div className="w-full h-full flex flex-col items-center justify-center px-6 animate-fade-in-up">
              {/* Waiting text */}
              <div className="text-center relative z-10">
                <p className="text-gray-300 text-sm font-bold tracking-wider uppercase mb-3">
                  {t('flyx.waiting')}
                </p>

                {/* Progress bar */}
                <div className="relative w-56 h-2.5 rounded-full bg-dark-card2 border border-dark-border overflow-hidden mx-auto">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: `${((WAITING_DURATION / 1000 - countdown) / (WAITING_DURATION / 1000)) * 100}%`,
                      background: 'linear-gradient(90deg, #ff6b1a, #ffd700)',
                      boxShadow: '0 0 8px rgba(255,140,50,0.6)',
                    }}
                  />
                  {/* Shimmer overlay */}
                  <div
                    className="absolute top-0 h-full w-8 rounded-full opacity-40"
                    style={{
                      left: `${((WAITING_DURATION / 1000 - countdown) / (WAITING_DURATION / 1000)) * 100 - 4}%`,
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                      transition: 'left 0.1s linear',
                    }}
                  />
                </div>

                {/* Countdown number */}
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <Clock size={13} className="text-orange-400" />
                  <span className="text-orange-400 font-bold text-sm tabular-nums">{countdown.toFixed(1)}s</span>
                </div>
              </div>
            </div>
          )}

          {gameState === 'running' && (
            <div className="text-center relative z-10">
              <div
                className="font-display text-6xl font-bold transition-colors leading-none"
                style={{ color: multColor, textShadow: `0 0 30px ${multColor}60, 0 0 8px rgba(0,0,0,0.9)` }}
              >
                {multiplier.toFixed(2)}x
              </div>
            </div>
          )}

          {gameState === 'crashed' && (
            <div className="text-center animate-shake relative z-10">
              <div className="font-display text-6xl font-bold text-neon-red leading-none" style={{ textShadow: '0 0 30px rgba(255,51,102,0.5), 0 0 8px rgba(0,0,0,0.9)' }}>
                {multiplier.toFixed(2)}x
              </div>
              <p className="text-neon-red text-xs font-bold mt-2 tracking-widest uppercase">{t('flyx.flewAway')}</p>
            </div>
          )}
        </div>

        {/* Hero flight trajectory — orange curve like Image 3 */}
        {gameState === 'running' && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="flyxTrail" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff6b1a" stopOpacity="0" />
                <stop offset="30%" stopColor="#ff6b1a" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ff8c1a" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="flyxFill" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff6b1a" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#ff8c1a" stopOpacity="0.2" />
              </linearGradient>
              <filter id="flyxGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="flyxHeroGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff8c1a" stopOpacity="0.7" />
                <stop offset="50%" stopColor="#ff6b1a" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ff6b1a" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Filled orange flight area — only behind the character */}
            <path
              d={`${trailPath} L ${heroX} 100 L ${startX} 100 Z`}
              fill="url(#flyxFill)"
              stroke="none"
            />

            {/* Glowing active trail — from start to character's current position */}
            <path
              d={trailPath}
              fill="none"
              stroke="url(#flyxTrail)"
              strokeWidth="2.5"
              strokeLinecap="round"
              filter="url(#flyxGlow)"
            />

            {/* Outer glow halo behind character */}
            <circle cx={heroX} cy={heroY} r="8" fill="url(#flyxHeroGlow)" />
          </svg>
        )}

        {/* Character — Image 2 orange character flying along the curve */}
        {gameState === 'running' && (
          <div
            className="absolute pointer-events-none z-15"
            style={{
              left: `${heroX}%`,
              top: `${heroY}%`,
              transform: `translate(-50%, -50%)`,
              transition: 'left 0.08s linear, top 0.08s linear',
            }}
          >
            {/* Glowing aura ring behind character */}
            <div
              className="absolute rounded-full"
              style={{
                width: 'clamp(70px, 30vw, 130px)',
                height: 'clamp(70px, 30vw, 130px)',
                transform: 'translate(-50%, -50%)',
                left: '50%',
                top: '50%',
                background: 'radial-gradient(circle, rgba(255,140,26,0.4) 0%, rgba(255,107,26,0.15) 50%, transparent 70%)',
                filter: 'blur(6px)',
              }}
            />
            {/* Character image — Image 2, upright, at the tip of the trajectory */}
            <img
              src={characterImg}
              alt="FlyX hero"
              className="relative object-contain pointer-events-none"
              style={{
                width: 'clamp(48px, 20vw, 82px)',
                height: 'auto',
                filter: gameState === 'crashed' ? 'grayscale(0.5) brightness(0.6)' : 'drop-shadow(0 0 8px rgba(255,140,26,0.6))',
                opacity: gameState === 'crashed' ? 0.5 : 1,
              }}
            />
            {/* Spark trail particles behind character */}
            {gameState === 'running' && (
              <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%' }}>
                <div
                  className="absolute rounded-full"
                  style={{
                    width: '6px', height: '6px',
                    background: '#ff8c1a', opacity: 0.6,
                    transform: `translate(${-dx * 3}px, ${-dy * 3}px)`,
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: '4px', height: '4px',
                    background: '#ff6b1a', opacity: 0.4,
                    transform: `translate(${-dx * 6}px, ${-dy * 6}px)`,
                  }}
                />
                <div
                  className="absolute rounded-full"
                  style={{
                    width: '2px', height: '2px',
                    background: '#ff4500', opacity: 0.25,
                    transform: `translate(${-dx * 9}px, ${-dy * 9}px)`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Character at rest during waiting — bottom-left position */}
        {gameState === 'waiting' && (
          <div
            className="absolute pointer-events-none z-15"
            style={{
              left: `${startX}%`,
              top: `${startY}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Glowing aura ring behind character */}
            <div
              className="absolute rounded-full"
              style={{
                width: 'clamp(70px, 30vw, 130px)',
                height: 'clamp(70px, 30vw, 130px)',
                transform: 'translate(-50%, -50%)',
                left: '50%',
                top: '50%',
                background: 'radial-gradient(circle, rgba(255,140,26,0.3) 0%, transparent 70%)',
                filter: 'blur(6px)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            {/* Character image — Image 2 at rest */}
            <img
              src={characterImg}
              alt="FlyX hero"
              className="relative object-contain pointer-events-none animate-float"
              style={{
                width: 'clamp(50px, 22vw, 90px)',
                height: 'auto',
                filter: 'drop-shadow(0 0 8px rgba(255,140,26,0.5))',
                opacity: 0.7,
              }}
            />
          </div>
        )}

        {/* Active bet badges */}
        {panels.map((p, i) => (
          p.hasActiveBet && p.cashOutValue === null && (
            <div key={`bet-${i}`} className={`absolute top-2.5 ${i === 0 ? 'left-2.5' : 'right-2.5'} bg-dark-card2/80 backdrop-blur-sm border border-neon-gold/40 rounded-lg px-2 py-1`}>
              <p className="text-neon-gold text-[10px] font-bold">
                ৳{bn(p.amount.toFixed(2))}
              </p>
            </div>
          )
        ))}

        {/* Cashout badges */}
        {panels.map((p, i) => (
          p.cashOutValue !== null && p.lastWin !== null && (
            <div key={`win-${i}`} className={`absolute top-2.5 ${i === 0 ? 'left-2.5' : 'right-2.5'} bg-neon-green/15 backdrop-blur-sm border border-neon-green/40 rounded-lg px-2 py-1 animate-scale-in`}>
              <p className="text-neon-green text-[10px] font-bold">
                +৳{bn(p.lastWin.toFixed(2))}
              </p>
            </div>
          )
        ))}

        {/* Active players stat overlay */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 bg-dark-card2/70 backdrop-blur-sm rounded-lg px-2 py-1">
          <Users size={11} className="text-neon-red" />
          <span className="text-[10px] text-gray-400 font-semibold">{allBetsCount} {t('flyx.playing')}</span>
        </div>
      </div>

      {/* Dual betting panels */}
      <div className="shrink-0 space-y-1.5 p-2.5 bg-dark-card border-t border-dark-border">
        {panels.map((panel, index) => {
          const canPlace = gameState === 'waiting' && !panel.hasActiveBet && balance >= panel.amount && panel.amount > 0;
          const canCancel = gameState === 'waiting' && panel.hasActiveBet;
          const canCashOut = gameState === 'running' && panel.hasActiveBet && panel.cashOutValue === null;
          const isCashedOut = panel.cashOutValue !== null;
          const isLost = gameState === 'crashed' && panel.hasActiveBet && panel.cashOutValue === null;

          return (
            <div
              key={index}
              className={`bg-dark-card2 rounded-xl border p-2 ${
                panel.hasActiveBet && !isCashedOut
                  ? 'border-neon-red/30'
                  : isCashedOut
                  ? 'border-neon-green/20'
                  : 'border-dark-border'
              }`}
            >
              {/* Bet/Auto tabs */}
              <div className="flex items-center gap-0 mb-1.5">
                <button
                  onClick={() => setPanelMode(index, 'bet')}
                  className={`text-[11px] font-bold px-3 py-1 rounded-l-lg transition-colors ${
                    panel.mode === 'bet'
                      ? 'bg-dark-card text-neon-red border border-neon-red/30 border-r-0'
                      : 'bg-dark-bg/50 text-gray-500 border border-dark-border border-r-0'
                  }`}
                >
                  {t('flyx.betBtn')}
                </button>
                <button
                  onClick={() => setPanelMode(index, 'auto')}
                  className={`text-[11px] font-bold px-3 py-1 rounded-r-lg transition-colors ${
                    panel.mode === 'auto'
                      ? 'bg-dark-card text-neon-red border border-neon-red/30 border-l-0'
                      : 'bg-dark-bg/50 text-gray-500 border border-dark-border border-l-0'
                  }`}
                >
                  Auto
                </button>

                <div className="ml-auto flex items-center gap-1">
                  {isCashedOut && (
                    <span className="text-[9px] font-bold text-neon-green bg-neon-green/15 px-1.5 py-0.5 rounded-full">
                      +৳{bn(panel.lastWin?.toFixed(2) ?? '0')}
                    </span>
                  )}
                  {isLost && (
                    <span className="text-[9px] font-bold text-neon-red bg-neon-red/15 px-1.5 py-0.5 rounded-full">
                      {t('flyx.lost')}
                    </span>
                  )}
                </div>
              </div>

              {/* Main controls: left (amount + quick bets) | right (action button) */}
              <div className="flex gap-2">
                {/* Left side: amount stepper + 2x2 quick bet grid */}
                <div className="flex-1 h-[2.4cm] flex flex-col gap-1 min-w-0">
                  {/* Amount stepper */}
                  <div className="flex items-center bg-dark-bg/60 rounded-lg border border-dark-border overflow-hidden h-8">
                    <button
                      onClick={() => adjustAmount(index, -1)}
                      disabled={panel.hasActiveBet}
                      className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={panel.amount || ''}
                      onChange={(e) => updatePanelAmount(index, parseFloat(e.target.value) || 0.5)}
                      placeholder="0"
                      disabled={panel.hasActiveBet}
                      className="bg-transparent text-white font-bold text-xs flex-1 text-center outline-none disabled:opacity-50 tabular-nums min-w-0"
                    />
                    <button
                      onClick={() => adjustAmount(index, 1)}
                      disabled={panel.hasActiveBet}
                      className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-white active:scale-90 transition-all disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Quick amount buttons */}
                  <div className="grid grid-cols-2 gap-1">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => updatePanelAmount(index, amt)}
                        disabled={panel.hasActiveBet}
                        className="text-[10px] font-bold py-1.5 rounded-md bg-dark-bg/50 text-gray-300 border border-dark-border hover:bg-dark-border active:scale-95 transition-all disabled:opacity-40 tabular-nums"
                      >
                        {bn(amt.toFixed(2))}
                      </button>
                    ))}
                    <button
                      onClick={() => setMaxAmount(index)}
                      disabled={panel.hasActiveBet}
                      className="text-[10px] font-bold py-1.5 rounded-md bg-neon-red/10 text-neon-red border border-neon-red/30 hover:bg-neon-red/20 active:scale-95 transition-all disabled:opacity-40 col-span-2"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Right side: action button */}
                <div className="w-[4.9cm] h-[2.4cm] shrink-0 flex ml-auto">
                  {/* Place Bet */}
                  {gameState === 'waiting' && !panel.hasActiveBet && (
                    <button
                      onClick={() => handlePlaceBet(index)}
                      disabled={!canPlace}
                      className="w-full bg-neon-red text-white font-bold rounded-lg transition-all active:scale-[0.97] hover:bg-neon-red/90 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5"
                      style={{ boxShadow: '0 0 10px rgba(255,51,102,0.4), 0 0 20px rgba(255,51,102,0.2)' }}
                    >
                      <span className="text-base font-bold leading-tight tracking-wide flex items-center gap-1.5">
                        <Play size={14} strokeWidth={2.5} fill="currentColor" />
                        {t('flyx.betBtn')}
                      </span>
                      <span className="text-sm font-bold leading-tight opacity-90">৳{bn(panel.amount.toFixed(2))}</span>
                    </button>
                  )}

                  {/* Cancel */}
                  {canCancel && (
                    <button
                      onClick={() => handleCancelBet(index)}
                      className="w-full bg-neon-red/15 text-neon-red font-bold rounded-lg transition-all active:scale-[0.97] hover:bg-neon-red/25 border border-neon-red/30 flex flex-col items-center justify-center gap-0.5"
                    >
                      <span className="text-base font-bold leading-tight flex items-center gap-1.5">
                        <X size={14} strokeWidth={2.5} />
                        {t('flyx.cancelBtn')}
                      </span>
                      <span className="text-sm font-bold leading-tight opacity-80">৳{bn(panel.amount.toFixed(2))}</span>
                    </button>
                  )}

                  {/* Cash Out */}
                  {canCashOut && (
                    <button
                      onClick={() => handleCashOut(index)}
                      className="w-full bg-neon-gold text-dark-bg font-bold rounded-lg transition-all active:scale-[0.97] hover:bg-neon-gold/90 neon-gold-glow flex flex-col items-center justify-center gap-0.5 animate-pulse-glow"
                    >
                      <span className="text-base font-bold leading-tight flex items-center gap-1.5">
                        <Plane size={14} strokeWidth={2.5} style={{ transform: 'rotate(-45deg)' }} />
                        {t('flyx.cashOut')}
                      </span>
                      <span className="text-sm font-bold leading-tight opacity-80">৳{bn((panel.amount * multiplier).toFixed(2))}</span>
                    </button>
                  )}

                  {/* Waiting */}
                  {gameState === 'running' && !panel.hasActiveBet && (
                    <div className="w-full bg-dark-bg/50 text-gray-600 font-bold text-sm rounded-lg flex items-center justify-center text-center border border-dark-border px-1">
                      {t('flyx.waiting')}
                    </div>
                  )}

                  {/* Cashed out */}
                  {(gameState === 'running' || gameState === 'crashed') && isCashedOut && (
                    <div className="w-full bg-neon-green/10 text-neon-green font-bold rounded-lg flex flex-col items-center justify-center gap-0.5 border border-neon-green/20">
                      <span className="text-sm font-bold leading-tight">{t('flyx.cashedOut')}</span>
                      <span className="text-base font-bold leading-tight">৳{bn(panel.lastWin?.toFixed(2) ?? '0')}</span>
                    </div>
                  )}

                  {/* Lost */}
                  {gameState === 'crashed' && isLost && (
                    <div className="w-full bg-neon-red/10 text-neon-red font-bold rounded-lg flex flex-col items-center justify-center gap-0.5 border border-neon-red/20">
                      <span className="text-sm font-bold leading-tight">{t('flyx.lost')}</span>
                      <span className="text-base font-bold leading-tight">৳{bn(panel.amount.toFixed(2))}</span>
                    </div>
                  )}

                  {/* No bet */}
                  {gameState === 'crashed' && !panel.hasActiveBet && (
                    <div className="w-full bg-dark-bg/50 text-gray-600 font-bold text-sm rounded-lg flex items-center justify-center text-center border border-dark-border">
                      —
                    </div>
                  )}
                </div>
              </div>

              {/* Auto mode controls */}
              {panel.mode === 'auto' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <button
                    onClick={() => toggleAutoCashout(index)}
                    disabled={panel.hasActiveBet}
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-md transition-all disabled:opacity-50 ${
                      panel.autoCashoutEnabled
                        ? 'bg-neon-blue/15 text-neon-blue border border-neon-blue/40'
                        : 'bg-dark-bg/50 text-gray-500 border border-dark-border'
                    }`}
                  >
                    <Zap size={10} fill={panel.autoCashoutEnabled ? 'currentColor' : 'none'} />
                    {t('flyx.autoCashout')}
                  </button>
                  {panel.autoCashoutEnabled && (
                    <div className="flex items-center bg-dark-bg/60 rounded-md border border-dark-border px-1.5 py-1 flex-1">
                      <input
                        type="number"
                        step="0.1"
                        value={panel.autoCashoutValue || ''}
                        onChange={(e) => setAutoCashoutValue(index, parseFloat(e.target.value) || 1.01)}
                        disabled={panel.hasActiveBet}
                        className="bg-transparent text-neon-blue font-bold w-full outline-none text-[11px] disabled:opacity-50 tabular-nums"
                      />
                      <span className="text-neon-blue text-[10px] font-bold ml-0.5">x</span>
                    </div>
                  )}
                </div>
              )}

              {panel.mode === 'auto' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <button
                    onClick={() => toggleAutoBet(index)}
                    disabled={panel.hasActiveBet}
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-md transition-all disabled:opacity-50 ${
                      panel.autoBetEnabled
                        ? 'bg-neon-green/15 text-neon-green border border-neon-green/40'
                        : 'bg-dark-bg/50 text-gray-500 border border-dark-border'
                    }`}
                  >
                    <Play size={9} fill="currentColor" />
                    {t('flyx.autoBet')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom tabs: All Bets / My Bets / Top */}
      <div className="shrink-0 bg-dark-card border-t border-dark-border">
        <div className="flex border-b border-dark-border">
          {liveTabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setLiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold transition-colors relative ${
                  liveTab === tab.id
                    ? 'text-neon-red'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                <Icon size={12} />
                {t(tab.labelKey)}
                <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                  liveTab === tab.id ? 'bg-neon-red/15 text-neon-red' : 'bg-dark-bg/50 text-gray-600'
                }`}>
                  {tab.count}
                </span>
                {liveTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-red" />
                )}
              </button>
            );
          })}
        </div>

        {/* Live bets list */}
        <div className="max-h-[120px] overflow-y-auto no-scrollbar">
          <div className="flex items-center px-3 py-1.5 text-[9px] text-gray-600 font-bold uppercase border-b border-dark-border/50">
            <span className="w-24">{t('flyx.player')}</span>
            <span className="w-16 text-right">{t('flyx.bet')}</span>
            <span className="w-16 text-right">{t('flyx.mult')}</span>
            <span className="flex-1 text-right">{t('flyx.win')}</span>
          </div>
          {displayedBets.length === 0 && (
            <div className="px-3 py-3 text-center text-[10px] text-gray-600 italic">No bets yet</div>
          )}
          {displayedBets.slice(0, 12).map((bet, i) => (
            <div
              key={i}
              className={`flex items-center px-3 py-1.5 text-[10px] border-b border-dark-border/30 hover:bg-dark-card2/50 transition-colors ${
                bet.isMe ? 'bg-neon-red/5' : ''
              }`}
            >
              <span className={`w-24 font-semibold truncate ${bet.isMe ? 'text-neon-red' : 'text-gray-400'}`}>{bet.user}</span>
              <span className="w-16 text-right text-gray-300 font-medium tabular-nums">
                {bet.amount > 0 ? `৳${bn(bet.amount.toFixed(2))}` : '—'}
              </span>
              <span className="w-16 text-right font-bold tabular-nums" style={{ color: bet.multiplier ? getCrashColor(bet.multiplier) : '#666' }}>
                {bet.multiplier ? `${bn(bet.multiplier.toFixed(2))}x` : '—'}
              </span>
              <span className="flex-1 text-right tabular-nums font-bold" style={{ color: bet.win ? '#00ff88' : '#666' }}>
                {bet.win ? `৳${bn(bet.win.toFixed(2))}` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes floatCloud {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
