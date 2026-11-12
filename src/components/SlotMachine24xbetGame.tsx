import { useState, useRef, useCallback, useEffect } from 'react';
import { Minus, Plus, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { addTransaction } from '@/lib/localStorage';
import { db, ref, get, onValue, push, set } from '@/lib/firebase';
import AutoSpinModal from './AutoSpinModal';
import { SlotMachineSound } from '@/lib/slotMachineSound';

interface SlotMachineGameProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
}

interface SlotSymbol {
  image: string;
  name: string;
  payout3: number;
  payout2: number;
  weight: number;
  color: string;
  isScatter?: boolean;
}

const SYMBOLS: SlotSymbol[] = [
  { image: 'https://i.postimg.cc/Nfw3yvVp/Chat-GPT-Image-Sep-27-2026-02-49-47-PM.png', name: 'Sym1', payout3: 50, payout2: 5, weight: 1, color: '#00d4ff' },
  { image: 'https://i.postimg.cc/d3GgW57t/IMG-20260927-145022.png', name: 'Sym2', payout3: 30, payout2: 4, weight: 2, color: '#ffd700' },
  { image: 'https://i.postimg.cc/bJD7nypL/IMG-20260927-145037.png', name: 'Sym3', payout3: 20, payout2: 3, weight: 3, color: '#ff9500' },
  { image: 'https://i.postimg.cc/6Q3J9VPj/IMG-20260927-145100.png', name: 'Sym4', payout3: 15, payout2: 3, weight: 3, color: '#00ff88' },
  { image: 'https://i.postimg.cc/mgVWfpmF/IMG-20260927-145125.png', name: 'Sym5', payout3: 12, payout2: 2, weight: 4, color: '#ff3366' },
  { image: 'https://i.postimg.cc/yYmzn89M/IMG-20260927-145143.png', name: 'Scatter', payout3: 0, payout2: 0, weight: 3, color: '#ff44aa', isScatter: true },
  { image: 'https://i.postimg.cc/zXZrngLj/IMG-20260927-145216.png', name: 'Sym7', payout3: 10, payout2: 2, weight: 5, color: '#ffdd00' },
  { image: 'https://i.postimg.cc/rytT0Jp2/IMG-20260927-145312.png', name: 'Sym8', payout3: 8, payout2: 0, weight: 6, color: '#e67e22' },
  { image: 'https://i.postimg.cc/sXbRHBTx/IMG-20260927-145339.png', name: 'Sym9', payout3: 6, payout2: 0, weight: 7, color: '#2ecc71' },
  { image: 'https://i.postimg.cc/TwK6cjqB/IMG-20260927-145505.png', name: 'Sym10', payout3: 5, payout2: 0, weight: 8, color: '#f1c40f' },
  { image: 'https://i.postimg.cc/3wShpfpk/IMG-20260927-145519.png', name: 'Sym11', payout3: 4, payout2: 0, weight: 9, color: '#e74c3c' },
  { image: 'https://i.postimg.cc/6pht6ppn/IMG-20260927-145613.png', name: 'Sym12', payout3: 3, payout2: 0, weight: 10, color: '#3498db' },
];

let activeSymbols: SlotSymbol[] = SYMBOLS;
let activePaylineSymbols: SlotSymbol[] = SYMBOLS.filter((s) => !s.isScatter);
let activeScatterSymbol: SlotSymbol = SYMBOLS.find((s) => s.isScatter)!;

function updateActiveSymbols(multipliers?: SymbolMultipliers) {
  if (!multipliers) {
    activeSymbols = SYMBOLS;
  } else {
    activeSymbols = SYMBOLS.map((s) => {
      const o = multipliers[s.name];
      if (o && typeof o.payout3 === 'number' && typeof o.payout2 === 'number') {
        return { ...s, payout3: o.payout3, payout2: o.payout2 };
      }
      return s;
    });
  }
  activePaylineSymbols = activeSymbols.filter((s) => !s.isScatter);
  activeScatterSymbol = activeSymbols.find((s) => s.isScatter) || SCATTER_SYMBOL;
}

const REEL_LENGTH = 20;
const VISIBLE_ROWS = 3;
const ROW_HEIGHT = 80;

type Reel = SlotSymbol[];

function buildReelStrip(): Reel {
  const strip: Reel = [];
  const pool: SlotSymbol[] = [];
  activeSymbols.forEach((s) => {
    for (let i = 0; i < s.weight; i++) pool.push(s);
  });
  for (let i = 0; i < REEL_LENGTH; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return strip;
}

function pickWeightedSymbol(): SlotSymbol {
  const pool: SlotSymbol[] = [];
  activeSymbols.forEach((s) => {
    for (let i = 0; i < s.weight; i++) pool.push(s);
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickPaylineSymbol(): SlotSymbol {
  const pool: SlotSymbol[] = [];
  activePaylineSymbols.forEach((s) => {
    for (let i = 0; i < s.weight; i++) pool.push(s);
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

export type SlotDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

interface SlotDifficultyConfig {
  scatterMin: number;
  scatterMax: number;
}

const SLOT_DIFFICULTY_CONFIGS: Record<SlotDifficulty, SlotDifficultyConfig> = {
  easy: { scatterMin: 5, scatterMax: 10 },
  medium: { scatterMin: 15, scatterMax: 30 },
  hard: { scatterMin: 50, scatterMax: 100 },
  impossible: { scatterMin: 500, scatterMax: 1000 },
};

let slotScatterSpinCounter = 0;
let slotNextScatterAt = -1;

function slotShouldTriggerScatter(diff: SlotDifficulty): boolean {
  if (slotNextScatterAt < 0) {
    const cfg = SLOT_DIFFICULTY_CONFIGS[diff];
    const maxScatter = diff === 'easy' ? 10 : cfg.scatterMax;
    slotNextScatterAt = randomInclusive(cfg.scatterMin, maxScatter);
  }
  slotScatterSpinCounter++;
  if (slotScatterSpinCounter >= slotNextScatterAt) {
    const cfg = SLOT_DIFFICULTY_CONFIGS[diff];
    const maxScatter = diff === 'easy' ? 10 : cfg.scatterMax;
    slotNextScatterAt = randomInclusive(cfg.scatterMin, maxScatter);
    slotScatterSpinCounter = 0;
    return true;
  }
  if (diff === 'easy' && slotScatterSpinCounter >= 10) {
    const cfg = SLOT_DIFFICULTY_CONFIGS[diff];
    slotNextScatterAt = randomInclusive(cfg.scatterMin, 10);
    slotScatterSpinCounter = 0;
    return true;
  }
  return false;
}

function randomInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateScatterReels(): SlotSymbol[][] {
  const positions = new Set<string>();
  while (positions.size < 3) {
    const reel = Math.floor(Math.random() * 3);
    const row = Math.floor(Math.random() * 3);
    positions.add(`${reel},${row}`);
  }
  const reels: SlotSymbol[][] = [
    [pickWeightedSymbol(), pickPaylineSymbol(), pickWeightedSymbol()],
    [pickWeightedSymbol(), pickPaylineSymbol(), pickWeightedSymbol()],
    [pickWeightedSymbol(), pickPaylineSymbol(), pickWeightedSymbol()],
  ];
  positions.forEach((pos) => {
    const [r, row] = pos.split(',').map(Number);
    reels[r][row] = activeScatterSymbol;
  });
  return reels;
}

interface SymbolMultiplier {
  payout3: number;
  payout2: number;
}

type SymbolMultipliers = Record<string, SymbolMultiplier>;

interface SlotSettings {
  rtp: number;
  overrideEnabled: boolean;
  forceOutcome: 'none' | 'win' | 'loss';
  difficulty: SlotDifficulty;
  symbolMultipliers?: SymbolMultipliers;
}

const DEFAULT_SETTINGS: SlotSettings = {
  rtp: 92,
  overrideEnabled: false,
  forceOutcome: 'none',
  difficulty: 'medium',
};

function getActiveSymbols(symbolMultipliers?: SymbolMultipliers): SlotSymbol[] {
  if (!symbolMultipliers) return SYMBOLS;
  return SYMBOLS.map((s) => {
    const override = symbolMultipliers[s.name];
    if (override && typeof override.payout3 === 'number' && typeof override.payout2 === 'number') {
      return { ...s, payout3: override.payout3, payout2: override.payout2 };
    }
    return s;
  });
}

const QUICK_BETS = [1, 5, 10, 50, 100, 500];

function evaluateWin(reels: SlotSymbol[][]): { win: number; lines: string[] } {
  const payline = [reels[0][1], reels[1][1], reels[2][1]];
  let win = 0;
  const lines: string[] = [];

  if (payline[0].name === payline[1].name && payline[1].name === payline[2].name) {
    win = payline[0].payout3;
    lines.push(`${payline[0].name}x3 x${payline[0].payout3}`);
  } else if (payline[0].name === payline[1].name && payline[0].payout2 > 0) {
    win = payline[0].payout2;
    lines.push(`${payline[0].name}x2 x${payline[0].payout2}`);
  }

  return { win, lines };
}

function countScatters(reels: SlotSymbol[][]): number {
  let count = 0;
  for (let r = 0; r < reels.length; r++) {
    for (let row = 0; row < reels[r].length; row++) {
      if (reels[r][row].isScatter) count++;
    }
  }
  return count;
}

function generateForcedReels(forceWin: boolean): SlotSymbol[][] {
  if (forceWin) {
    const sym = pickPaylineSymbol();
    return [
      [pickWeightedSymbol(), sym, pickWeightedSymbol()],
      [pickWeightedSymbol(), sym, pickWeightedSymbol()],
      [pickWeightedSymbol(), sym, pickWeightedSymbol()],
    ];
  }
  let payline: SlotSymbol[];
  do {
    payline = [pickPaylineSymbol(), pickPaylineSymbol(), pickPaylineSymbol()];
  } while (
    payline[0].name === payline[1].name ||
    payline[1].name === payline[2].name
  );
  return [
    [pickWeightedSymbol(), payline[0], pickWeightedSymbol()],
    [pickWeightedSymbol(), payline[1], pickWeightedSymbol()],
    [pickWeightedSymbol(), payline[2], pickWeightedSymbol()],
  ];
}

function generateRtpReels(rtp: number): SlotSymbol[][] {
  const shouldWin = Math.random() < rtp / 100;
  if (shouldWin) {
    const sym = pickPaylineSymbol();
    return [
      [pickWeightedSymbol(), sym, pickWeightedSymbol()],
      [pickWeightedSymbol(), sym, pickWeightedSymbol()],
      [pickWeightedSymbol(), sym, pickWeightedSymbol()],
    ];
  }
  return generateForcedReels(false);
}

function ReelSymbol({ sym }: { sym: SlotSymbol }) {
  return (
    <img
      src={sym.image}
      alt={sym.name}
      className="max-w-[72px] max-h-[72px] object-contain"
      style={{ filter: 'drop-shadow(0 0 6px ' + sym.color + '44)' }}
      draggable={false}
    />
  );
}

export default function SlotMachineGame({ balance, onBetPlaced, onWin }: SlotMachineGameProps) {
  const [betAmount, setBetAmount] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[][]>([
    [SYMBOLS[4], SYMBOLS[0], SYMBOLS[5]],
    [SYMBOLS[2], SYMBOLS[1], SYMBOLS[6]],
    [SYMBOLS[3], SYMBOLS[2], SYMBOLS[7]],
  ]);
  const [reelStrips, setReelStrips] = useState<Reel[]>([
    buildReelStrip(), buildReelStrip(), buildReelStrip(),
  ]);
  const [reelOffsets, setReelOffsets] = useState<number[]>([0, 0, 0]);
  const [history, setHistory] = useState<{ images: string[]; win: number }[]>([]);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<SlotSettings>(DEFAULT_SETTINGS);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [showFreeSpinTrigger, setShowFreeSpinTrigger] = useState(false);

  const [showAutoSpin, setShowAutoSpin] = useState(false);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState(0);
  const settingsRef = useRef<SlotSettings>(DEFAULT_SETTINGS);
  const spinTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const freeSpinsRef = useRef(0);
  const spinRef = useRef<() => void>(() => {});
  const autoSpinRef = useRef<() => void>(() => {});
  const autoSpinRemainingRef = useRef(0);
  const soundRef = useRef<SlotMachineSound | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);

  const { user, deductBalance, addBalance } = useAuth();
  const { t, bn } = useLanguage();

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { autoSpinRemainingRef.current = autoSpinRemaining; }, [autoSpinRemaining]);

  useEffect(() => {
    soundRef.current = new SlotMachineSound();
    setSoundMuted(soundRef.current.isMuted());
    return () => { soundRef.current?.stopSpin(); };
  }, []);

  const toggleMute = () => {
    const s = soundRef.current;
    if (!s) return;
    s.unlock();
    const muted = s.toggleMute();
    setSoundMuted(muted);
  };

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/slots'));
        if (snap.exists()) {
          const s = snap.val();
          setSettings({
            rtp: s.rtp ?? 92,
            overrideEnabled: s.overrideEnabled ?? false,
            forceOutcome: s.forceOutcome ?? 'none',
            difficulty: (s.difficulty as SlotDifficulty) ?? 'medium',
            symbolMultipliers: s.symbolMultipliers ?? undefined,
          });
          updateActiveSymbols(s.symbolMultipliers);
        }
      } catch { /* rtdb unavailable */ }
      unsub = onValue(ref(db, 'game_settings/slots'), (snap) => {
        if (snap.exists()) {
          const s = snap.val();
          setSettings({
            rtp: s.rtp ?? 92,
            overrideEnabled: s.overrideEnabled ?? false,
            forceOutcome: s.forceOutcome ?? 'none',
            difficulty: (s.difficulty as SlotDifficulty) ?? 'medium',
            symbolMultipliers: s.symbolMultipliers ?? undefined,
          });
          updateActiveSymbols(s.symbolMultipliers);
        }
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    return () => { spinTimeouts.current.forEach(clearTimeout); };
  }, []);

  const spin = useCallback(() => {
    if (spinning) return;
    const isFreeSpin = freeSpinsRef.current > 0;
    if (!isFreeSpin && balance < betAmount) {
      if (autoSpinRemainingRef.current > 0) setAutoSpinRemaining(0);
      setResultMsg(t('slots.insufficientBalance'));
      return;
    }

    setSpinning(true);
    setResultMsg(null);
    setWinAmount(null);
    soundRef.current?.unlock();
    soundRef.current?.playLever();
    if (!isFreeSpin) {
      deductBalance(betAmount);
      onBetPlaced(betAmount);
      addTransaction({ id: `${Date.now()}-slots-bet`, type: 'bet', amount: betAmount, timestamp: Date.now() });
      if (autoSpinRemainingRef.current > 0) {
        setAutoSpinRemaining((prev) => prev - 1);
      }
    }

    const currentSettings = settingsRef.current;
    let resultReels: SlotSymbol[][];

    const forceScatter = !isFreeSpin && slotShouldTriggerScatter(currentSettings.difficulty);

    if (currentSettings.overrideEnabled && currentSettings.forceOutcome === 'win') {
      resultReels = generateForcedReels(true);
    } else if (currentSettings.overrideEnabled && currentSettings.forceOutcome === 'loss') {
      resultReels = generateForcedReels(false);
    } else if (forceScatter) {
      resultReels = generateScatterReels();
    } else {
      resultReels = generateRtpReels(currentSettings.rtp);
    }

    const newStrips = [0, 1, 2].map((reelIdx) => {
      const strip = buildReelStrip();
      strip[15] = resultReels[reelIdx][0];
      strip[16] = resultReels[reelIdx][1];
      strip[17] = resultReels[reelIdx][2];
      return strip;
    });

    setReelStrips(newStrips);

    for (let i = 0; i < 3; i++) {
      const targetOffset = 15 * ROW_HEIGHT;

      const timeout = setTimeout(() => {
        setReelOffsets((prev) => {
          const updated = [...prev];
          updated[i] = targetOffset;
          return updated;
        });
      }, 50);
      spinTimeouts.current.push(timeout);
    }

    const evalTimeout = setTimeout(() => {
      setReels(resultReels);
      setReelOffsets([0, 0, 0]);
      setReelStrips([buildReelStrip(), buildReelStrip(), buildReelStrip()]);
      setSpinning(false);

      const { win } = evaluateWin(resultReels);
      const totalWin = win * betAmount;

      if (totalWin > 0) {
        addBalance(totalWin);
        onWin(totalWin);
        addTransaction({ id: `${Date.now()}-slots-win`, type: 'win', amount: totalWin, timestamp: Date.now() });
        setWinAmount(totalWin);
        setResultMsg(`${t('slots.win')} ৳${bn(totalWin.toFixed(2))}`);
        if (totalWin >= betAmount * 10) {
          soundRef.current?.playWin();
        } else {
          soundRef.current?.playSmallWin();
        }
      } else {
        setWinAmount(0);
        setResultMsg(t('slots.lose'));
        soundRef.current?.playLose();
      }

      // Check for scatter free spin trigger
      const scatterCount = countScatters(resultReels);
      if (scatterCount >= 3 && freeSpinsRef.current === 0) {
        // Start free spins from base game
        freeSpinsRef.current = 5;
        setFreeSpinsRemaining(5);
        setShowFreeSpinTrigger(true);
      } else if (scatterCount >= 3 && freeSpinsRef.current > 0) {
        // Retrigger during free spins: add extra spins, capped
        const extra = 5;
        freeSpinsRef.current = Math.min(freeSpinsRef.current + extra, 50);
        setFreeSpinsRemaining(freeSpinsRef.current);
        setShowFreeSpinTrigger(true);
      } else if (freeSpinsRef.current > 0) {
        // Consume one free spin
        const newCount = freeSpinsRef.current - 1;
        freeSpinsRef.current = newCount;
        setFreeSpinsRemaining(newCount);
        if (newCount === 0) {
          // Free spins exhausted — return to base game immediately
          setShowFreeSpinTrigger(false);
        }
      }

      setHistory((prev) => [
        { images: resultReels.map((r) => r[1].image), win: totalWin },
        ...prev,
      ].slice(0, 10));

      if (user) {
        const betRef = push(ref(db, 'slots_bets'));
        set(betRef, {
          userId: user.uid,
          userName: user.name,
          betAmount: isFreeSpin ? 0 : betAmount,
          payout: totalWin,
          reels: resultReels.map((r) => r[1].name),
          isFreeSpin,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    }, 3200);
    spinTimeouts.current.push(evalTimeout);
  }, [spinning, betAmount, balance, deductBalance, onBetPlaced, onWin, addBalance, user, bn, t]);

  useEffect(() => { spinRef.current = spin; }, [spin]);

  useEffect(() => { autoSpinRef.current = spin; }, [spin]);

  useEffect(() => {
    if (!spinning && autoSpinRemaining > 0 && freeSpinsRemaining === 0 && balance >= betAmount) {
      const timer = setTimeout(() => autoSpinRef.current(), 1000);
      return () => clearTimeout(timer);
    }
    if (!spinning && autoSpinRemaining > 0 && balance < betAmount) {
      setAutoSpinRemaining(0);
    }
  }, [spinning, autoSpinRemaining, freeSpinsRemaining, balance, betAmount]);

  // Auto-spin during free spins — guarded to prevent duplicate timers
  useEffect(() => {
    if (!spinning && freeSpinsRemaining > 0) {
      const timer = setTimeout(() => spinRef.current(), 800);
      return () => clearTimeout(timer);
    }
  }, [spinning, freeSpinsRemaining]);

  // Safety net: ensure free spin state is fully reset when exhausted
  useEffect(() => {
    if (freeSpinsRemaining === 0 && freeSpinsRef.current !== 0) {
      freeSpinsRef.current = 0;
    }
  }, [freeSpinsRemaining]);

  // Hide free spin trigger message
  useEffect(() => {
    if (showFreeSpinTrigger) {
      const timer = setTimeout(() => setShowFreeSpinTrigger(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showFreeSpinTrigger]);

  const adjustBet = (delta: number) => {
    if (spinning || freeSpinsRemaining > 0) return;
    setBetAmount((prev) => Math.max(1, parseFloat((prev + delta).toFixed(2))));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* History bar */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-dark-card border-b border-dark-border overflow-x-auto">
        <span className="text-[10px] text-gray-500 font-semibold uppercase shrink-0">{t('slots.history')}</span>
        {history.length === 0 ? (
          <span className="text-[10px] text-gray-600">{t('slots.noHistory')}</span>
        ) : (
          history.map((h, i) => (
            <div
              key={i}
              className={`shrink-0 px-2 py-1 rounded-lg flex items-center gap-1 ${
                h.win > 0
                  ? 'bg-neon-green/15 border border-neon-green/30'
                  : 'bg-dark-card2 border border-dark-border'
              }`}
            >
              {h.images.map((img, j) => (
                <img key={j} src={img} alt="" className="w-5 h-5 object-contain" draggable={false} />
              ))}
              {h.win > 0 && (
                <span className="text-[9px] text-neon-green font-bold">৳{bn(h.win.toFixed(0))}</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Slot machine area -- luxury casino environment background */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 pt-2 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a0808 0%, #0d0303 40%, #2a0a0a 70%, #1a0505 100%)' }}>

        {/* Casino interior -- layered background */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          {/* Deep red carpet with subtle pattern */}
          <div className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 100%, rgba(80,20,20,0.6) 0%, transparent 50%), radial-gradient(ellipse at 30% 80%, rgba(120,30,30,0.3) 0%, transparent 40%), radial-gradient(ellipse at 70% 80%, rgba(120,30,30,0.3) 0%, transparent 40%)',
            }}
          />

          {/* Warm golden ambient lighting from above */}
          <div className="absolute inset-x-0 top-0 h-1/2"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(255,200,100,0.18) 0%, rgba(255,180,80,0.08) 30%, transparent 60%)',
            }}
          />

          {/* Chandelier 1 -- center */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2"
            style={{ width: '180px', height: '100px' }}>
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-[30px] bg-gradient-to-b from-yellow-300/40 to-yellow-500/20" />
            <div className="absolute top-[28px] left-1/2 -translate-x-1/2"
              style={{
                width: '160px', height: '50px',
                background: 'radial-gradient(ellipse at center, rgba(255,220,120,0.25) 0%, rgba(255,200,80,0.1) 40%, transparent 70%)',
              }}
            />
            {/* Chandelier crystals */}
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="absolute top-[35px]"
                style={{
                  left: `${20 + i * 30}px`,
                  width: '3px', height: '18px',
                  background: 'linear-gradient(180deg, rgba(255,235,150,0.5), rgba(255,200,80,0.15))',
                  borderRadius: '0 0 2px 2px',
                }}
              />
            ))}
          </div>

          {/* Chandelier 2 -- left */}
          <div className="absolute left-[15%] top-0"
            style={{ width: '120px', height: '80px' }}>
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-[20px] bg-gradient-to-b from-yellow-300/30 to-yellow-500/15" />
            <div className="absolute top-[18px] left-1/2 -translate-x-1/2"
              style={{
                width: '100px', height: '40px',
                background: 'radial-gradient(ellipse at center, rgba(255,220,120,0.18) 0%, transparent 70%)',
              }}
            />
          </div>

          {/* Chandelier 3 -- right */}
          <div className="absolute right-[15%] top-0"
            style={{ width: '120px', height: '80px' }}>
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-[20px] bg-gradient-to-b from-yellow-300/30 to-yellow-500/15" />
            <div className="absolute top-[18px] left-1/2 -translate-x-1/2"
              style={{
                width: '100px', height: '40px',
                background: 'radial-gradient(ellipse at center, rgba(255,220,120,0.18) 0%, transparent 70%)',
              }}
            />
          </div>

          {/* Slot machines in background -- left */}
          <div className="absolute left-0 top-[30%]"
            style={{
              width: '100px', height: '160px',
              background: 'linear-gradient(180deg, rgba(40,15,15,0.7), rgba(20,8,8,0.5))',
              borderRadius: '10px',
              border: '1px solid rgba(255,200,80,0.08)',
              transform: 'perspective(300px) rotateY(15deg)',
            }}>
            <div className="absolute top-[20px] left-1/2 -translate-x-1/2 flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-5 h-10 rounded"
                  style={{ background: 'rgba(255,200,80,0.06)', border: '1px solid rgba(255,200,80,0.1)' }} />
              ))}
            </div>
          </div>

          {/* Slot machines in background -- right */}
          <div className="absolute right-0 top-[35%]"
            style={{
              width: '100px', height: '160px',
              background: 'linear-gradient(180deg, rgba(40,15,15,0.7), rgba(20,8,8,0.5))',
              borderRadius: '10px',
              border: '1px solid rgba(255,200,80,0.08)',
              transform: 'perspective(300px) rotateY(-15deg)',
            }}>
            <div className="absolute top-[20px] left-1/2 -translate-x-1/2 flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-5 h-10 rounded"
                  style={{ background: 'rgba(255,200,80,0.06)', border: '1px solid rgba(255,200,80,0.1)' }} />
              ))}
            </div>
          </div>

          {/* Casino table hint -- left bottom */}
          <div className="absolute left-[-30px] bottom-[5%]"
            style={{
              width: '140px', height: '60px',
              background: 'linear-gradient(180deg, rgba(60,20,20,0.4), rgba(30,10,10,0.2))',
              borderRadius: '50%',
            }}
          />
          {/* Casino chips stack -- left */}
          <div className="absolute left-[5%] bottom-[12%]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-full"
                style={{
                  width: '24px', height: '8px',
                  marginTop: '-4px',
                  background: i === 0 ? 'rgba(200,50,50,0.3)' : i === 1 ? 'rgba(50,50,50,0.3)' : 'rgba(200,50,50,0.3)',
                  border: '1px solid rgba(255,200,80,0.1)',
                }}
              />
            ))}
          </div>

          {/* Casino table hint -- right bottom */}
          <div className="absolute right-[-30px] bottom-[5%]"
            style={{
              width: '140px', height: '60px',
              background: 'linear-gradient(180deg, rgba(60,20,20,0.4), rgba(30,10,10,0.2))',
              borderRadius: '50%',
            }}
          />
          {/* Casino chips stack -- right */}
          <div className="absolute right-[5%] bottom-[12%]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-full"
                style={{
                  width: '24px', height: '8px',
                  marginTop: '-4px',
                  background: i === 0 ? 'rgba(200,50,50,0.3)' : i === 1 ? 'rgba(50,50,50,0.3)' : 'rgba(200,50,50,0.3)',
                  border: '1px solid rgba(255,200,80,0.1)',
                }}
              />
            ))}
          </div>

          {/* Soft glowing casino lights -- scattered bokeh */}
          {[
            { x: '10%', y: '15%', s: 40, o: 0.12 },
            { x: '85%', y: '20%', s: 35, o: 0.10 },
            { x: '20%', y: '50%', s: 30, o: 0.08 },
            { x: '75%', y: '55%', s: 45, o: 0.10 },
            { x: '50%', y: '85%', s: 50, o: 0.06 },
            { x: '5%', y: '65%', s: 25, o: 0.07 },
            { x: '92%', y: '70%', s: 30, o: 0.08 },
          ].map((l, i) => (
            <div key={i} className="absolute rounded-full"
              style={{
                left: l.x, top: l.y,
                width: `${l.s}px`, height: `${l.s}px`,
                background: 'radial-gradient(circle, rgba(255,210,100,' + l.o + ') 0%, transparent 70%)',
              }}
            />
          ))}

          {/* Gold decorative arch frame -- top */}
          <div className="absolute inset-x-0 top-0 h-[3px]"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,200,80,0.3) 20%, rgba(255,220,120,0.5) 50%, rgba(255,200,80,0.3) 80%, transparent 100%)',
            }}
          />

          {/* Subtle edge vignette for depth -- no blur */}
          <div className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(10,3,3,0.3) 85%, rgba(5,1,1,0.5) 100%)',
            }}
          />

          {/* Warm golden floor reflection glow */}
          <div className="absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(255,180,60,0.04) 50%, rgba(255,160,40,0.08) 100%)',
            }}
          />
        </div>

        {/* Decorative golden glow behind machine */}
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ zIndex: 1 }}>
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.5), transparent 60%)' }}
          />
        </div>

        {/* Sound mute toggle */}
        <button
          onClick={toggleMute}
          className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-all"
        >
          {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Free spins counter */}
        {freeSpinsRemaining > 0 && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-gold/15 border border-neon-gold/40">
            <Sparkles size={12} className="text-neon-gold" />
            <span className="text-[10px] font-bold text-neon-gold uppercase tracking-wider">
              Free Spins: {freeSpinsRemaining}
            </span>
          </div>
        )}

        {/* Free spin trigger animation */}
        {showFreeSpinTrigger && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="animate-scale-in text-center">
              <div
                className="font-display text-3xl font-extrabold tracking-wide"
                style={{
                  background: 'linear-gradient(135deg, #fff5b0, #ffd700, #ffaa00)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 8px rgba(255,180,0,0.6))',
                }}
              >
                5 FREE SPINS!
              </div>
              <div className="text-xs text-neon-gold font-bold mt-1 uppercase tracking-widest">
                Bonus Triggered
              </div>
            </div>
          </div>
        )}

        {/* Machine frame */}
        <div className="relative w-full max-w-[340px] -mt-6" style={{ zIndex: 5 }}>
          {/* Reels container */}
          <div className="relative rounded-2xl border-4 border-neon-gold/40 bg-gradient-to-b from-dark-card to-dark-bg p-3 shadow-[0_0_40px_rgba(255,215,0,0.12)] overflow-hidden">
            {/* Payline indicator */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
              <div className="h-[80px] border-y-2 border-neon-red/50 bg-neon-red/[0.04]" />
            </div>

            {/* Reels */}
            <div className="relative flex gap-2 justify-center">
              {[0, 1, 2].map((reelIdx) => (
                <div
                  key={reelIdx}
                  className="relative w-[88px] h-[240px] overflow-hidden rounded-xl bg-gradient-to-b from-dark-card2 to-dark-bg border border-dark-border"
                >
                  {/* Reel strip */}
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      transform: `translateY(-${reelOffsets[reelIdx]}px)`,
                      transition: spinning
                        ? `transform ${1.5 + reelIdx * 0.4}s cubic-bezier(0.25, 0.1, 0.2, 1)`
                        : 'none',
                    }}
                  >
                    {spinning
                      ? reelStrips[reelIdx].map((sym, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-center"
                            style={{ height: `${ROW_HEIGHT}px` }}
                          >
                            <ReelSymbol sym={sym} />
                          </div>
                        ))
                      : reels[reelIdx].map((sym, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-center"
                            style={{ height: `${ROW_HEIGHT}px` }}
                          >
                            <ReelSymbol sym={sym} />
                          </div>
                        ))}
                  </div>

                  {/* Top/bottom fade */}
                  <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-dark-bg to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-dark-bg to-transparent pointer-events-none" />
                </div>
              ))}
            </div>

            {/* Win highlight overlay */}
            {winAmount !== null && winAmount > 0 && !spinning && (
              <div className="absolute inset-0 pointer-events-none animate-pulse-glow rounded-2xl border-2 border-neon-green/60" />
            )}
          </div>

          {/* Result message */}
          {resultMsg && !spinning && (
            <div className="mt-3 flex items-center justify-center animate-scale-in">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${
                  winAmount && winAmount > 0
                    ? 'bg-neon-green/15 border-neon-green/40'
                    : 'bg-dark-card2 border-dark-border'
                }`}
              >
                <span className={`text-sm font-bold ${winAmount && winAmount > 0 ? 'text-neon-green' : 'text-gray-400'}`}>
                  {resultMsg}
                </span>
              </div>
            </div>
          )}

          {/* Paytable hint */}
          <div className="mt-1.5 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[9px] text-gray-600 font-semibold uppercase">{t('slots.paytable')}</span>
            {activePaylineSymbols.slice(0, 5).map((s) => (
              <div key={s.name} className="flex items-center gap-0.5 bg-dark-card2 border border-dark-border rounded-md px-1.5 py-0.5">
                <img src={s.image} alt={s.name} className="w-4 h-4 object-contain" draggable={false} />
                <span className="text-[8px] text-gray-500">x3</span>
                <span className="text-[9px] text-neon-gold font-bold">x{s.payout3}</span>
              </div>
            ))}
            {/* Scatter hint */}
            <div className="flex items-center gap-0.5 bg-neon-gold/10 border border-neon-gold/30 rounded-md px-1.5 py-0.5">
              <img src={activeScatterSymbol.image} alt="Scatter" className="w-4 h-4 object-contain" draggable={false} />
              <span className="text-[8px] text-neon-gold font-bold">x3 &rarr; 5 FREE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Betting panel */}
      <div className="shrink-0 relative z-50 bg-dark-card border-t border-dark-border p-2.5 pb-1 space-y-1 -mt-[96px]">
        {/* Balance + bet info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">{t('slots.balance')}</span>
            <span className="text-sm font-bold text-neon-gold tabular-nums">৳{bn(balance.toFixed(2))}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 font-semibold uppercase">{t('slots.bet')}</span>
            <span className="text-sm font-bold text-neon-green tabular-nums">৳{bn(betAmount.toFixed(2))}</span>
          </div>
        </div>

        {/* Bet amount stepper */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { soundRef.current?.unlock(); soundRef.current?.playClick(); adjustBet(-1); }}
            disabled={spinning || freeSpinsRemaining > 0}
            className="w-10 h-10 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-all disabled:opacity-40 shrink-0"
          >
            <Minus size={16} />
          </button>
          <div className="flex-1 flex items-center justify-center bg-dark-card2 rounded-lg border border-dark-border h-10">
            <span className="text-neon-gold font-bold text-sm mr-1">৳</span>
            <span className="text-white font-bold text-base tabular-nums">{bn(betAmount.toFixed(2))}</span>
          </div>
          <button
            onClick={() => { soundRef.current?.unlock(); soundRef.current?.playClick(); adjustBet(1); }}
            disabled={spinning || freeSpinsRemaining > 0}
            className="w-10 h-10 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-all disabled:opacity-40 shrink-0"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Quick bet buttons */}
        <div className="flex gap-1.5">
          {QUICK_BETS.map((amt) => (
            <button
              key={amt}
              onClick={() => { soundRef.current?.unlock(); soundRef.current?.playClick(); setBetAmount(amt); }}
              disabled={spinning || freeSpinsRemaining > 0}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-all disabled:opacity-40 ${
                betAmount === amt
                  ? 'bg-neon-green/15 text-neon-green border border-neon-green/40'
                  : 'bg-dark-card2 text-gray-400 border border-dark-border'
              }`}
            >
              ৳{bn(amt)}
            </button>
          ))}
        </div>

        {/* Spin button + Auto Spin button */}
        <div className="flex items-center justify-center gap-3">
          {autoSpinRemaining > 0 && freeSpinsRemaining === 0 && (
            <button
              onClick={() => setAutoSpinRemaining(0)}
              className="transition-all active:scale-[0.97] flex flex-col items-center justify-center gap-1 bg-transparent border-0 p-0"
            >
              <div className="w-12 h-12 rounded-full bg-neon-red/20 border border-neon-red/40 flex items-center justify-center">
                <span className="text-[10px] font-bold text-neon-red">{autoSpinRemaining}</span>
              </div>
              <span className="text-[7px] text-neon-red font-bold">STOP</span>
            </button>
          )}
          <button
            onClick={spin}
            disabled={spinning || freeSpinsRemaining > 0 || balance < betAmount}
            className="transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 bg-transparent border-0 p-0"
          >
            <img
              src="https://i.postimg.cc/GtLKd56H/generated-image.png"
              alt="Spin"
              className={`w-24 h-24 object-contain ${spinning ? 'animate-spin-slow' : ''}`}
            />
            <span className="text-[8px] leading-tight text-center font-bold text-gray-400">
              {spinning
                ? t('slots.spinning')
                : freeSpinsRemaining > 0
                  ? `FREE (${freeSpinsRemaining})`
                  : t('slots.spin')}
            </span>
            <span className="text-[7px] opacity-80 font-semibold text-gray-400">৳{bn(betAmount.toFixed(2))}</span>
          </button>
          {autoSpinRemaining === 0 && freeSpinsRemaining === 0 && (
            <button
              onClick={() => setShowAutoSpin(true)}
              disabled={spinning || balance < betAmount}
              className="transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 bg-transparent border-0 p-0"
            >
              <img
                src="https://i.postimg.cc/2544x7xz/0e9a8b40-f518-4d42-8627-9528533325e5.png"
                alt="Auto Spin"
                className="w-12 h-12 object-contain opacity-80 hover:opacity-100 transition-opacity"
              />
              <span className="text-[7px] text-gray-400 font-bold">AUTO</span>
            </button>
          )}
        </div>
      </div>

      <AutoSpinModal
        isOpen={showAutoSpin}
        onClose={() => setShowAutoSpin(false)}
        onStart={(count) => {
          setAutoSpinRemaining(count);
          autoSpinRef.current = spin;
          setTimeout(() => spin(), 100);
        }}
        betAmount={betAmount}
        balance={balance}
      />
    </div>
  );
}
