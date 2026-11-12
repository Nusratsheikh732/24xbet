import { useState, useRef, useEffect, useCallback } from 'react';
import { Rocket, Play, X, Zap, Minus, Plus, Users, Clock, Trophy } from 'lucide-react';
import type { CrashHistory } from '@/types';
import { db } from '@/lib/firebase';
import { ref, get, onValue, update, push, set, remove } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { loadGameHistory, saveGameHistory, loadBetAmount, saveBetAmount, addTransaction } from '@/lib/localStorage';
import { generateSimBetsWithTiming, type SimBetWithTiming } from '@/lib/simBets';

interface AviatorGameProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  isMuted: boolean;
  fullscreen?: boolean;
}

type GameState = 'waiting' | 'running' | 'crashed';
type PanelMode = 'bet' | 'auto';
type LiveTab = 'all' | 'previous' | 'top';

const QUICK_STEPS = [5, 10, 50, 100];
const WAITING_DURATION = 2000;
const CRASH_DURATION = 2500;

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

function createInitialPanel(defaultAmount: number): PanelState {
  return {
    amount: defaultAmount,
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
  // RTP adjusts early crash ratio: lower RTP = more early crashes = higher house edge
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

const MAX_VISUAL_MULT = 10;

// Maps the current multiplier to a 0–1 position along the flight path using a
// fixed logarithmic scale. This is independent of the crash point, so the
// plane always moves at the same speed for any given multiplier regardless of
// when the round will end.
function multToProgress(mult: number): number {
  if (mult <= 1) return 0;
  return Math.min(Math.log(mult) / Math.log(MAX_VISUAL_MULT), 1);
}

// Real live bet data synced via Firebase
interface LiveBet {
  id: string;
  user: string;
  amount: number;
  multiplier: number | null;
  cashedOut: boolean;
  win: number | null;
  isMe?: boolean;
}

interface HistoryEntry {
  roundId: number;
  multiplier: number;
  color: string;
  timestamp: number;
}

export default function AviatorGame({ balance, onBetPlaced, onWin, isMuted, fullscreen = false }: AviatorGameProps) {
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [history, setHistory] = useState<CrashHistory[]>(loadGameHistory);
  const [panels, setPanels] = useState<PanelState[]>(() => {
    const saved = loadBetAmount();
    return [createInitialPanel(saved), createInitialPanel(saved)];
  });
  const [countdown, setCountdown] = useState(WAITING_DURATION / 1000);
  const [liveTab, setLiveTab] = useState<LiveTab>('all');
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [roundHistory, setRoundHistory] = useState<HistoryEntry[]>([]);
  const [simBets, setSimBets] = useState<SimBetWithTiming[]>([]);
  const simBetsRef = useRef<SimBetWithTiming[]>([]);
  const simCashedRef = useRef<Set<string>>(new Set());

  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(1.0);
  const planeImgRef = useRef<SVGImageElement | null>(null);
  const planeGlowRef = useRef<SVGCircleElement | null>(null);
  const trailPathRef = useRef<SVGPathElement | null>(null);
  const trailFillRef = useRef<SVGPathElement | null>(null);
  const planeGroupRef = useRef<SVGGElement | null>(null);
  const crashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crashConfigRef = useRef<CrashConfig>(defaultConfig);
  const rtpRef = useRef<number>(85);
  const multiplierRef = useRef(1.0);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const crashSoundRef = useRef<HTMLAudioElement | null>(null);
  const cashoutSoundRef = useRef<HTMLAudioElement | null>(null);
  const aviatorSettingsRef = useRef<{ active: boolean; crashSequence: number[] }>({ active: true, crashSequence: [] });
  const roundDataRef = useRef<{ phase: string; crashPoint: number; roundStartTime: number; roundId: number; updatedAt: number }>({ phase: 'waiting', crashPoint: 0, roundStartTime: 0, roundId: 0, updatedAt: 0 });
  const currentRoundIdRef = useRef<number>(0);
  const myBetIdsRef = useRef<Record<number, string>>({});

  useEffect(() => {
    const audio = new Audio('/Aviator_Run_Plane.mp3');
    audio.loop = true;
    audio.volume = 1;
    audio.muted = isMuted;
    bgMusicRef.current = audio;
    const crashAudio = new Audio('/Aviator_Crash_sound.mp3');
    crashAudio.volume = 0.8;
    crashAudio.muted = isMuted;
    crashSoundRef.current = crashAudio;
    const cashoutAudio = new Audio('/Aviator_Cashout_sound.mp3');
    cashoutAudio.volume = 0.7;
    cashoutAudio.muted = isMuted;
    cashoutSoundRef.current = cashoutAudio;
    return () => {
      audio.pause(); audio.currentTime = 0; bgMusicRef.current = null;
      crashAudio.pause(); crashAudio.currentTime = 0; crashSoundRef.current = null;
      cashoutAudio.pause(); cashoutAudio.currentTime = 0; cashoutSoundRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play background music while the plane is flying, stop at crash/waiting
  useEffect(() => {
    const audio = bgMusicRef.current;
    if (!audio) return;
    if (gameState === 'running') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [gameState]);

  useEffect(() => {
    if (bgMusicRef.current) bgMusicRef.current.muted = isMuted;
    if (crashSoundRef.current) crashSoundRef.current.muted = isMuted;
    if (cashoutSoundRef.current) cashoutSoundRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => { multiplierRef.current = multiplier; }, [multiplier]);

  const { user, deductBalance, addBalance } = useAuth();
  const { t, bn } = useLanguage();

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/config'));
        if (snap.exists()) {
          const s = snap.val() as CrashConfig;
        crashConfigRef.current = {
          early_crash_ratio: s.early_crash_ratio ?? 0.8,
          min_crash_mult: s.min_crash_mult ?? 1.01,
          max_early_crash: s.max_early_crash ?? 1.50,
          max_late_crash: s.max_late_crash ?? 9.50,
        };
      }
      } catch { /* defaults */ }
    })();

    const settingsUnsub = onValue(ref(db, 'game_settings/aviator'), (snap) => {
      if (snap.exists()) {
        const v = snap.val();
        aviatorSettingsRef.current = {
          active: v.active ?? true,
          crashSequence: Array.isArray(v.crashSequence) ? v.crashSequence : [],
        };
        if (typeof v.rtp === 'number') rtpRef.current = v.rtp;
      } else {
        aviatorSettingsRef.current = { active: true, crashSequence: [] };
        rtpRef.current = 85;
      }
    });

    return () => { settingsUnsub(); };
  }, []);

  // Subscribe to aviator_history for Previous and Top tabs
  useEffect(() => {
    const histRef = ref(db, 'aviator_history');
    const unsub = onValue(histRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Record<string, any>;
        const entries: HistoryEntry[] = Object.entries(val).map(([id, data]) => ({
          roundId: data.roundId ?? 0,
          multiplier: data.multiplier ?? 1.0,
          color: getCrashColor(data.multiplier ?? 1.0),
          timestamp: data.timestamp ?? 0,
        }));
        entries.sort((a, b) => b.timestamp - a.timestamp);
        setRoundHistory(entries.slice(0, 50));
      } else {
        setRoundHistory([]);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to current round bets for All Bets tab
  useEffect(() => {
    const roundId = currentRoundIdRef.current;
    if (!roundId) {
      setLiveBets([]);
      return;
    }
    const betsRef = ref(db, `aviator_bets/${roundId}`);
    const unsub = onValue(betsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Record<string, any>;
        const bets: LiveBet[] = Object.entries(val).map(([id, data]) => ({
          id,
          user: data.userName || 'Player',
          amount: data.betAmount || 0,
          multiplier: data.multiplier ?? null,
          cashedOut: data.cashedOut ?? false,
          win: data.payout ?? null,
          isMe: data.userId === user?.uid,
        }));
        bets.sort((a, b) => b.amount - a.amount);
        setLiveBets(bets);
      } else {
        setLiveBets([]);
      }
    });
    return () => unsub();
  }, [currentRoundIdRef.current, user?.uid]);

  const cashOutPanel = useCallback((index: number, atMultiplier: number) => {
    const cashAudio = cashoutSoundRef.current;
    if (cashAudio) { cashAudio.currentTime = 0; cashAudio.play().catch(() => {}); }
    setPanels((prev) => {
      const panel = prev[index];
      if (!panel.hasActiveBet || panel.cashOutValue !== null) return prev;
      const winAmount = parseFloat((panel.amount * atMultiplier).toFixed(2));
      addBalance(winAmount);
      addTransaction({ id: `${Date.now()}-win-${index}`, type: 'win', amount: winAmount, timestamp: Date.now() });
      onWin(winAmount);
      const updated = [...prev];
      updated[index] = { ...panel, cashOutValue: atMultiplier, lastWin: winAmount };
      // Update Firebase bet record with cashout info
      const roundId = currentRoundIdRef.current;
      const betId = myBetIdsRef.current[index];
      if (roundId && betId) {
        update(ref(db, `aviator_bets/${roundId}/${betId}`), {
          multiplier: parseFloat(atMultiplier.toFixed(2)),
          cashedOut: true,
          payout: winAmount,
        }).catch(() => {});
      }
      return updated;
    });
  }, [addBalance, onWin]);

  // Auto-cashout check
  useEffect(() => {
    if (gameState !== 'running') return;
    panels.forEach((panel, i) => {
      if (panel.hasActiveBet && panel.cashOutValue === null && panel.autoCashoutEnabled && multiplier >= panel.autoCashoutValue) {
        cashOutPanel(i, panel.autoCashoutValue);
      }
    });
  }, [multiplier, gameState, panels, cashOutPanel]);

  // Sync history pills from Firebase round history
  useEffect(() => {
    if (roundHistory.length > 0) {
      setHistory(roundHistory.slice(0, 20).map(h => ({
        multiplier: h.multiplier,
        color: h.color,
      })));
    }
  }, [roundHistory]);

  // Compute crash point: use the first entry from the admin pre-set sequence, else random
  const computeCrashPoint = useCallback((): number => {
    const settings = aviatorSettingsRef.current;
    if (settings.crashSequence.length > 0) {
      return settings.crashSequence[0];
    }
    return getCrashMultiplier(crashConfigRef.current, rtpRef.current);
  }, []);

  // Consume the first entry of the crash sequence in Firebase so the next round uses the next value
  const consumeCrashSequence = useCallback(async () => {
    const settings = aviatorSettingsRef.current;
    if (settings.crashSequence.length > 0) {
      const remaining = settings.crashSequence.slice(1);
      aviatorSettingsRef.current = { ...settings, crashSequence: remaining };
      await update(ref(db, 'game_settings/aviator'), { crashSequence: remaining }).catch(() => {});
    }
  }, []);

  // Write a round transition to Firestore (shared state for all players)
  const writeRound = useCallback(async (phase: 'waiting' | 'running' | 'crashed', crashPoint?: number) => {
    const now = Date.now();
    const updateData: Record<string, unknown> = { phase, updatedAt: now };
    if (phase === 'running') {
      updateData.crashPoint = crashPoint ?? computeCrashPoint();
      updateData.roundStartTime = now;
      updateData.roundId = now;
      currentRoundIdRef.current = now;
      setLiveBets([]);
    } else if (phase === 'waiting') {
      updateData.roundId = now;
      updateData.crashPoint = 0;
      updateData.roundStartTime = 0;
    } else if (phase === 'crashed') {
      const crashMult = crashPoint ?? crashPointRef.current;
      if (crashMult && crashMult > 1) {
        const histRef = push(ref(db, 'aviator_history'));
        await set(histRef, {
          roundId: currentRoundIdRef.current,
          multiplier: parseFloat(crashMult.toFixed(2)),
          timestamp: now,
        }).catch(() => {});
        setTimeout(() => {
          remove(ref(db, `aviator_bets/${currentRoundIdRef.current}`)).catch(() => {});
        }, 5000);
      }
    }
    await update(ref(db, 'aviator_rounds/current'), updateData);
  }, [computeCrashPoint]);

  // Flight path — quadratic Bezier from lower-left to upper-right
  const FLIGHT_START_X = 4;
  const FLIGHT_START_Y = 88;
  const FLIGHT_CP_X = 38;
  const FLIGHT_CP_Y = 72;
  const FLIGHT_END_X = 78;
  const FLIGHT_END_Y = 8;
  const TRAIL_SAMPLES = 40;

  const bezierPoint = (t: number, p0: number, p1: number, p2: number) =>
    (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;

  const buildTrailPath = (progress: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= TRAIL_SAMPLES; i++) {
      const st = (i / TRAIL_SAMPLES) * progress;
      const sx = bezierPoint(st, FLIGHT_START_X, FLIGHT_CP_X, FLIGHT_END_X);
      const sy = bezierPoint(st, FLIGHT_START_Y, FLIGHT_CP_Y, FLIGHT_END_Y);
      pts.push(`${i === 0 ? 'M' : 'L'} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
    }
    return pts.join(' ');
  };

  const updateFlightVisuals = (progress: number) => {
    const px = bezierPoint(progress, FLIGHT_START_X, FLIGHT_CP_X, FLIGHT_END_X);
    const py = bezierPoint(progress, FLIGHT_START_Y, FLIGHT_CP_Y, FLIGHT_END_Y);
    const tp = buildTrailPath(progress);
    const fp = `${tp} L ${px.toFixed(2)} 100 L ${FLIGHT_START_X} 100 Z`;

    if (planeGroupRef.current) planeGroupRef.current.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
    if (planeGlowRef.current) { planeGlowRef.current.setAttribute('cx', px.toFixed(2)); planeGlowRef.current.setAttribute('cy', py.toFixed(2)); }
    if (trailPathRef.current) trailPathRef.current.setAttribute('d', tp);
    if (trailFillRef.current) trailFillRef.current.setAttribute('d', fp);
  };

  // Local animation loop — multiplier derived from elapsed time, crash point computed locally
  const startAnimation = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    startTimeRef.current = Date.now();
    // Reset visuals to start position immediately
    updateFlightVisuals(0);

    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const k = 0.35;
      const currentMult = Math.pow(Math.E, k * elapsed);

      if (currentMult >= crashPointRef.current) {
        setMultiplier(crashPointRef.current);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        // Freeze at the position that corresponds to the crash multiplier on the
        // fixed visual scale — not at the end of the path.
        updateFlightVisuals(multToProgress(crashPointRef.current));

        const crashMult = crashPointRef.current;
        setGameState('crashed');
        setHistory((prev) => [
          { multiplier: crashMult, color: getCrashColor(crashMult) },
          ...prev,
        ].slice(0, 20));
        saveGameHistory([{ multiplier: crashMult, color: getCrashColor(crashMult) }, ...loadGameHistory().slice(0, 19)]);

        writeRound('crashed', crashMult).catch(() => {});
        return;
      }

      setMultiplier(parseFloat(currentMult.toFixed(2)));

      // Progressive bot cash-outs
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
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

      // Visual progress is derived solely from the current multiplier via a
      // fixed logarithmic scale — completely independent of the crash point.
      updateFlightVisuals(multToProgress(currentMult));

      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeRound]);

  // Local state machine — drives all phase transitions via timers, no RTDB dependency
  useEffect(() => {
    if (gameState === 'waiting') {
      // Set round ID for this upcoming round so bets can be written during waiting
      if (currentRoundIdRef.current === 0) {
        currentRoundIdRef.current = Date.now();
      }
      let remaining = WAITING_DURATION / 1000;
      setCountdown(remaining);

      countdownRef.current = setInterval(() => {
        remaining -= 0.1;
        if (remaining <= 0) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          setCountdown(0);
          const cp = computeCrashPoint();
          crashPointRef.current = cp;
          consumeCrashSequence();
          const newSimBets = generateSimBetsWithTiming(cp);
          simBetsRef.current = newSimBets;
          simCashedRef.current = new Set();
          setSimBets(newSimBets);
          setGameState('running');
          writeRound('running', cp).catch(() => {});
        } else {
          setCountdown(parseFloat(remaining.toFixed(1)));
        }
      }, 100);

      return () => {
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      };
    }

    if (gameState === 'running') {
      startAnimation();
      return () => {
        if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
      };
    }

    if (gameState === 'crashed') {
      const crashAudio = crashSoundRef.current;
      if (crashAudio) { crashAudio.currentTime = 0; crashAudio.play().catch(() => {}); }
      setPanels((prev) => prev.map((p) => ({ ...p, hasActiveBet: false, cashOutValue: null, lastWin: null })));

      crashTimerRef.current = setTimeout(() => {
        setMultiplier(1.0);
        setGameState('waiting');
        writeRound('waiting').catch(() => {});
      }, CRASH_DURATION);

      return () => {
        if (crashTimerRef.current) { clearTimeout(crashTimerRef.current); crashTimerRef.current = null; }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, startAnimation, computeCrashPoint, consumeCrashSequence, writeRound]);

  const handlePlaceBet = (index: number) => {
    const panel = panels[index];
    if (gameState !== 'waiting' || panel.hasActiveBet || balance < panel.amount || panel.amount <= 0) return;
    saveBetAmount(panel.amount);
    deductBalance(panel.amount);
    onBetPlaced(panel.amount);
    addTransaction({ id: `${Date.now()}-bet-${index}`, type: 'bet', amount: panel.amount, timestamp: Date.now() });
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...panel, hasActiveBet: true, cashOutValue: null, lastWin: null };
      return updated;
    });
    // Write bet to Firebase for live bets list
    const roundId = currentRoundIdRef.current || Date.now();
    if (user) {
      const betRef = push(ref(db, `aviator_bets/${roundId}`));
      set(betRef, {
        userId: user.uid,
        userName: user.name,
        betAmount: panel.amount,
        multiplier: null,
        cashedOut: false,
        payout: null,
        panelIndex: index,
        timestamp: Date.now(),
      }).catch(() => {});
      myBetIdsRef.current[index] = betRef.key!;
    }
  };

  const handleCancelBet = (index: number) => {
    const panel = panels[index];
    if (gameState !== 'waiting' || !panel.hasActiveBet) return;
    addBalance(panel.amount);
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...panel, hasActiveBet: false, cashOutValue: null, lastWin: null };
      return updated;
    });
    // Remove bet from Firebase
    const roundId = currentRoundIdRef.current;
    const betId = myBetIdsRef.current[index];
    if (roundId && betId) {
      remove(ref(db, `aviator_bets/${roundId}/${betId}`)).catch(() => {});
      delete myBetIdsRef.current[index];
    }
  };

  const handleCashOut = (index: number) => {
    const panel = panels[index];
    if (gameState !== 'running' || !panel.hasActiveBet || panel.cashOutValue !== null) return;
    cashOutPanel(index, multiplierRef.current);
  };

  const updatePanelAmount = (index: number, amount: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount: Math.max(1, amount) };
      return updated;
    });
  };

  const adjustAmount = (index: number, delta: number) => {
    setPanels((prev) => {
      const updated = [...prev];
      const newAmt = Math.max(1, updated[index].amount + delta);
      updated[index] = { ...updated[index], amount: newAmt };
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

  const multColor =
    gameState === 'crashed' ? '#ff3366' : multiplier >= 2 ? '#00ff88' : '#ffd700';

  const mergedLiveBets: LiveBet[] = [...liveBets, ...simBets.map(b => ({ ...b, isMe: false }))];
  const allBetsCount = mergedLiveBets.length;

  const liveTabConfig: { id: LiveTab; label: string; icon: typeof Users; count: number }[] = [
    { id: 'all', label: 'All Bets', icon: Users, count: allBetsCount },
    { id: 'previous', label: 'Previous', icon: Clock, count: roundHistory.length },
    { id: 'top', label: 'Top', icon: Trophy, count: roundHistory.filter(h => h.multiplier >= 2).length },
  ];

  const displayedBets: LiveBet[] = liveTab === 'top'
    ? [...roundHistory].sort((a, b) => b.multiplier - a.multiplier).slice(0, 20).map(h => ({
        id: `hist-${h.roundId}`,
        user: `Round ${h.multiplier.toFixed(2)}x`,
        amount: 0,
        multiplier: h.multiplier,
        cashedOut: true,
        win: null,
      }))
    : liveTab === 'previous'
    ? roundHistory.slice(0, 20).map(h => ({
        id: `prev-${h.roundId}`,
        user: `Round ${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        amount: 0,
        multiplier: h.multiplier,
        cashedOut: true,
        win: null,
      }))
    : [...mergedLiveBets].sort((a, b) => {
        if (a.cashedOut && !b.cashedOut) return -1;
        if (!a.cashedOut && b.cashedOut) return 1;
        return b.amount - a.amount;
      });

  const cashedOutBets = displayedBets.filter((bet) => bet.cashedOut && bet.win !== null).slice(0, 8);

  return (
    <div className="flex-1 flex flex-col overflow-visible overscroll-contain min-h-0">
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
      </div>

      {/* Crash graph canvas */}
      <div
        className={`relative ${gameState === 'waiting' ? 'flex-1' : 'flex-[1.5]'} min-h-[240px] shrink-0 overflow-hidden bg-[#08090b] bg-cover bg-center`}
        style={{ backgroundImage: "url('https://i.postimg.cc/SK9NWzmY/1793039934730.jpg')" }}
      >
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,255,136,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Multiplier display center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {gameState === 'waiting' && (
            <div className="absolute inset-0 animate-fade-in-up overflow-hidden bg-[#101113]">
              <img
                src="https://i.postimg.cc/C1zFf1sw/1793039469997.jpg"
                alt="Aviator loading screen"
                className="absolute inset-0 h-full w-full object-contain"
              />
              <div className="absolute inset-0 bg-black/20" />
              <div
                className="absolute left-1/2 top-[48%] h-1.5 w-[33%] -translate-x-1/2 overflow-hidden rounded-full bg-[#242a35] shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                aria-label={`Next round in ${countdown.toFixed(1)} seconds`}
              >
                <div
                  className="h-full rounded-full bg-[#ed2939] transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, ((WAITING_DURATION / 1000 - countdown) / (WAITING_DURATION / 1000)) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {gameState === 'running' && (
            <div className="text-center">
              <div
                className="font-display text-6xl font-bold transition-colors leading-none"
                style={{ color: multColor, textShadow: `0 0 30px ${multColor}60` }}
              >
                {multiplier.toFixed(2)}x
              </div>
            </div>
          )}

          {gameState === 'crashed' && (
            <div className="text-center animate-shake">
              <div className="font-display text-6xl font-bold text-neon-red leading-none" style={{ textShadow: '0 0 30px rgba(255,51,102,0.5)' }}>
                {multiplier.toFixed(2)}x
              </div>
              <p className="text-neon-red text-xs font-bold mt-2 tracking-widest uppercase">Flew Away!</p>
            </div>
          )}


        </div>

        {/* Flight SVG — plane and trail, updated via refs during running state */}
        {gameState === 'running' && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="trailGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff3655" stopOpacity="0" />
                <stop offset="45%" stopColor="#ff3655" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#ff3655" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="trailFill" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff183d" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#ff3655" stopOpacity="0.28" />
              </linearGradient>
              <filter id="trailGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="planeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff3655" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#ff3655" stopOpacity="0" />
              </radialGradient>
            </defs>

            <path
              ref={trailFillRef}
              fill="url(#trailFill)"
              stroke="none"
            />

            <path
              ref={trailPathRef}
              fill="none"
              stroke="url(#trailGradient)"
              strokeWidth="1.7"
              strokeLinecap="round"
              filter="url(#trailGlow)"
            />

            <circle ref={planeGlowRef} r="6" fill="url(#planeGlow)" />

            <g ref={planeGroupRef}>
              <image
                ref={planeImgRef}
                href="https://i.postimg.cc/J7BFCVj9/Red-Propeller-Plane-Logo.png"
                x="-19.845"
                y="-9.9225"
                width="39.69"
                height="19.845"
                preserveAspectRatio="xMidYMid meet"
                style={{ filter: 'drop-shadow(0 0 4px rgba(255,54,85,0.95))' }}
              />
            </g>
          </svg>
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

        {/* Cashout notifications */}
        {panels.map((p, i) => (
          p.cashOutValue !== null && p.lastWin !== null && (
            <div
              key={`win-${i}`}
              className="absolute left-1/2 z-20 flex w-[calc(100%-24px)] max-w-[270px] -translate-x-1/2 items-center gap-2 rounded-2xl border border-neon-green/60 bg-[#183d2c]/90 px-3 py-2 text-white shadow-[0_0_18px_rgba(0,255,136,0.2)] backdrop-blur-md animate-slide-in-right"
              style={{ top: `${10 + i * 58}px`, animationDelay: `${i * 120}ms` }}
            >
              <div className="min-w-0 flex-1 text-center leading-tight">
                <p className="text-[11px] font-semibold text-white/85">You have cashed out!</p>
                <p className="mt-0.5 text-base font-black tabular-nums text-white">{p.cashOutValue.toFixed(2)}x</p>
              </div>
              <div className="min-w-[88px] rounded-xl bg-neon-green/25 px-2.5 py-1 text-center shadow-inner shadow-neon-green/20">
                <p className="text-[10px] font-bold text-white/90">Win BDT</p>
                <p className="text-base font-black leading-tight tabular-nums text-white">{bn(p.lastWin.toFixed(2))}</p>
              </div>
              <X size={18} className="shrink-0 text-white/90" aria-hidden="true" />
            </div>
          )
        ))}

      </div>

      {/* Dual betting panels — stacked */}
      <div className="shrink-0 space-y-1 p-1.5 bg-dark-card border-t border-dark-border">
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
                  ? 'border-neon-green/30'
                  : isCashedOut
                  ? 'border-neon-green/20'
                  : 'border-dark-border'
              }`}
            >
              {/* Bet/Auto tabs — top center spanning */}
              <div className="flex items-center justify-center mb-2">
                <div className="flex rounded-lg overflow-hidden border border-dark-border">
                  <button
                    onClick={() => setPanelMode(index, 'bet')}
                    className={`text-[11px] font-bold px-6 py-1 transition-colors ${
                      panel.mode === 'bet'
                        ? 'bg-dark-card text-neon-green'
                        : 'bg-dark-bg/50 text-gray-500'
                    }`}
                  >
                    Bet
                  </button>
                  <div className="w-px bg-dark-border" />
                  <button
                    onClick={() => setPanelMode(index, 'auto')}
                    className={`text-[11px] font-bold px-6 py-1 transition-colors ${
                      panel.mode === 'auto'
                        ? 'bg-dark-card text-neon-green'
                        : 'bg-dark-bg/50 text-gray-500'
                    }`}
                  >
                    Auto
                  </button>
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
                      value={panel.amount || ''}
                      onChange={(e) => updatePanelAmount(index, parseFloat(e.target.value) || 1)}
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

                  {/* 2x2 quick bet grid */}
                  <div className="grid grid-cols-2 gap-1">
                    {QUICK_STEPS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => updatePanelAmount(index, amt)}
                        disabled={panel.hasActiveBet}
                        className="text-[10px] font-bold py-1.5 rounded-md bg-dark-bg/50 text-gray-300 border border-dark-border hover:bg-dark-border active:scale-95 transition-all disabled:opacity-40"
                      >
                        {bn(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right side: action button */}
                <div className="w-[4.9cm] h-[2.4cm] shrink-0 flex ml-auto">
                  {/* Place Bet */}
                  {gameState === 'waiting' && !panel.hasActiveBet && (
                    <button
                      onClick={() => handlePlaceBet(index)}
                      disabled={!canPlace}
                      className="w-full bg-neon-green text-dark-bg font-bold rounded-lg transition-all active:scale-[0.97] hover:bg-neon-green/90 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5 neon-green-glow"
                    >
                      <span className="text-base font-bold leading-tight tracking-wide">{t('aviator.betBtn')}</span>
                      <span className="text-sm font-bold leading-tight opacity-90">৳{bn(panel.amount.toFixed(2))}</span>
                    </button>
                  )}

                  {/* Cancel */}
                  {canCancel && (
                    <button
                      onClick={() => handleCancelBet(index)}
                      className="w-full bg-neon-red/15 text-neon-red font-bold rounded-lg transition-all active:scale-[0.97] hover:bg-neon-red/25 border border-neon-red/30 flex flex-col items-center justify-center gap-0.5"
                    >
                      <span className="text-base font-bold leading-tight">{t('aviator.cancelBtn')}</span>
                      <span className="text-sm font-bold leading-tight opacity-80">৳{bn(panel.amount.toFixed(2))}</span>
                    </button>
                  )}

                  {/* Cash Out */}
                  {canCashOut && (
                    <button
                      onClick={() => handleCashOut(index)}
                      className="w-full bg-neon-gold text-dark-bg font-bold rounded-lg transition-all active:scale-[0.97] hover:bg-neon-gold/90 neon-gold-glow flex flex-col items-center justify-center gap-0.5 animate-pulse-glow"
                    >
                      <span className="text-base font-bold leading-tight">{t('aviator.cashOut')}</span>
                      <span className="text-sm font-bold leading-tight opacity-80">৳{bn((panel.amount * multiplier).toFixed(2))}</span>
                    </button>
                  )}

                  {/* Waiting */}
                  {gameState === 'running' && !panel.hasActiveBet && (
                    <div className="w-full bg-dark-bg/50 text-gray-600 font-bold text-sm rounded-lg flex items-center justify-center text-center border border-dark-border px-1">
                      Wait next round
                    </div>
                  )}

                  {/* Cashed out */}
                  {(gameState === 'running' || gameState === 'crashed') && isCashedOut && (
                    <div className="w-full bg-neon-green/10 text-neon-green font-bold rounded-lg flex flex-col items-center justify-center gap-0.5 border border-neon-green/20">
                      <span className="text-sm font-bold leading-tight">{t('aviator.cashedOut')}</span>
                      <span className="text-base font-bold leading-tight">৳{bn(panel.lastWin?.toFixed(2))}</span>
                    </div>
                  )}

                  {/* Lost */}
                  {gameState === 'crashed' && isLost && (
                    <div className="w-full bg-neon-red/10 text-neon-red font-bold rounded-lg flex flex-col items-center justify-center gap-0.5 border border-neon-red/20">
                      <span className="text-sm font-bold leading-tight">{t('aviator.lost')}</span>
                      <span className="text-base font-bold leading-tight">৳{bn(panel.amount.toFixed(2))}</span>
                    </div>
                  )}

                  {/* No bet */}
                  {gameState === 'crashed' && !panel.hasActiveBet && (
                    <div className="w-full bg-dark-bg/50 text-gray-600 font-bold text-sm rounded-lg flex items-center justify-center text-center border border-dark-border">
                      No bet
                    </div>
                  )}
                </div>
              </div>

              {/* Auto mode controls — below the main panel */}
              {panel.mode === 'auto' && (
                <div className="mt-2 pt-2 border-t border-dark-border/50 space-y-1.5">
                  {/* Auto Bet toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAutoBet(index)}
                      disabled={panel.hasActiveBet}
                      className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-all disabled:opacity-50 ${
                        panel.autoBetEnabled
                          ? 'bg-neon-green/15 text-neon-green border border-neon-green/40'
                          : 'bg-dark-bg/50 text-gray-500 border border-dark-border'
                      }`}
                    >
                      <Play size={10} fill={panel.autoBetEnabled ? 'currentColor' : 'none'} />
                      Auto Bet
                    </button>
                  </div>

                  {/* Auto Cash Out toggle + input */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAutoCashout(index)}
                      disabled={panel.hasActiveBet}
                      className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-all disabled:opacity-50 shrink-0 ${
                        panel.autoCashoutEnabled
                          ? 'bg-neon-blue/15 text-neon-blue border border-neon-blue/40'
                          : 'bg-dark-bg/50 text-gray-500 border border-dark-border'
                      }`}
                    >
                      <Zap size={10} fill={panel.autoCashoutEnabled ? 'currentColor' : 'none'} />
                      Auto Cash Out
                    </button>
                    {panel.autoCashoutEnabled && (
                      <div className="flex items-center bg-dark-bg/60 rounded-md border border-dark-border px-2 py-1 flex-1">
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
                </div>
              )}

              {/* Status badges */}
              {(isCashedOut || isLost) && (
                <div className="flex justify-end mt-1">
                  {isCashedOut && (
                    <span className="text-[9px] font-bold text-neon-green bg-neon-green/15 px-1.5 py-0.5 rounded-full">
                      +৳{bn(panel.lastWin?.toFixed(2))}
                    </span>
                  )}
                  {isLost && (
                    <span className="text-[9px] font-bold text-neon-red bg-neon-red/15 px-1.5 py-0.5 rounded-full">
                      LOST
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom tabs: All Bets / Previous / Top */}
      <div className={`${gameState === 'waiting' ? 'shrink-0' : 'flex-[0.25] min-h-[200px] shrink-0 flex flex-col'} bg-dark-card border-t border-dark-border`}>
        <div className="flex border-b border-dark-border">
          {liveTabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setLiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold transition-colors relative ${
                  liveTab === tab.id
                    ? 'text-neon-green'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                <Icon size={12} />
                {tab.label}
                <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                  liveTab === tab.id ? 'bg-neon-green/15 text-neon-green' : 'bg-dark-bg/50 text-gray-600'
                }`}>
                  {tab.count}
                </span>
                {liveTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-green" />
                )}
              </button>
            );
          })}
        </div>

        {liveTab === 'all' && cashedOutBets.length > 0 && (
          <div className="border-b border-dark-border bg-[#101d16] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neon-green">Cashout players</span>
              <span className="text-[9px] font-semibold text-gray-500">{cashedOutBets.length} cashed out</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {cashedOutBets.map((bet) => (
                <div key={`cashout-${bet.id}`} className="flex min-w-[116px] items-center gap-1.5 rounded-lg border border-neon-green/20 bg-dark-card2/70 px-2 py-1.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neon-green/15 text-[9px] font-black text-neon-green">
                    {bet.user.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[10px] font-bold text-gray-200">{bet.user}</p>
                    <p className="text-[9px] font-bold text-neon-green">৳{bn((bet.win ?? 0).toFixed(0))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live bets list — compact scrollable */}
        <div className={`${gameState === 'waiting' ? 'max-h-[50px]' : 'flex-1 min-h-0'} overflow-y-auto no-scrollbar`}>
          {/* Column headers */}
          <div className="flex items-center px-3 py-1.5 text-[9px] text-gray-600 font-bold uppercase border-b border-dark-border/50">
            <span className="w-24">Player</span>
            <span className="w-16 text-right">Bet</span>
            <span className="w-16 text-right">Mult</span>
            <span className="flex-1 text-right">Win</span>
          </div>
          {displayedBets.slice(0, 12).map((bet, i) => (
            <div
              key={i}
              className="flex items-center px-3 py-1.5 text-[10px] border-b border-dark-border/30 hover:bg-dark-card2/50 transition-colors"
            >
              <span className="w-24 text-gray-400 font-semibold truncate">{bet.user}</span>
              <span className="w-16 text-right text-gray-300 font-medium tabular-nums">
                {bet.amount > 0 ? `৳${bn(bet.amount.toFixed(0))}` : '—'}
              </span>
              <span className="w-16 text-right font-bold tabular-nums" style={{ color: bet.multiplier ? getCrashColor(bet.multiplier) : '#666' }}>
                {bet.multiplier ? `${bet.multiplier.toFixed(2)}x` : '—'}
              </span>
              <span className="flex-1 text-right tabular-nums font-bold" style={{ color: bet.win ? '#00ff88' : '#666' }}>
                {bet.win ? `৳${bn(bet.win.toFixed(0))}` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
