import { useState, useRef, useCallback, useEffect } from 'react';
import { Minus, Plus, Zap, Sparkles, Gift, Crown, Star, Flame } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { addTransaction } from '@/lib/localStorage';
import { db, ref, get, onValue, push, set } from '@/lib/firebase';
import AutoSpinModal from './AutoSpinModal';

type SeSymbol = 'FIRE' | 'WATER' | 'EARTH' | 'AIR' | 'LIGHTNING' | 'WILD' | 'SCATTER' | 'GOLDEN';

interface Cell {
  symbol: SeSymbol;
  id: number;
  isGolden?: boolean;
  isScatter?: boolean;
  transformedFromGolden?: boolean;
}

interface SuperElementsGameProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
}

const REEL_ROWS = [4, 5, 5, 5, 4];
const NUM_REELS = 5;
const TOTAL_CELLS = REEL_ROWS.reduce((a, b) => a + b, 0);
const WAYS_TO_WIN = 4 * 5 * 5 * 5 * 4;

const BASE_SYMBOLS: SeSymbol[] = ['FIRE', 'WATER', 'EARTH', 'AIR', 'LIGHTNING'];
const ALL_SYMBOLS: SeSymbol[] = [...BASE_SYMBOLS, 'WILD', 'SCATTER', 'GOLDEN'];

const SCATTER_WEIGHT = 0.035;
const GOLDEN_WEIGHT = 0.05;
const WILD_WEIGHT = 0.03;

const BASE_CASCADE_MULTIPLIERS = [1, 2, 3, 5, 10];
const EXTRA_BET_CASCADE_MULTIPLIERS = [2, 4, 6, 10, 15];
const FREE_GAME_CASCADE_MULTIPLIERS = [3, 6, 9, 15, 30];

const QUICK_BETS = [1, 5, 10, 50, 100, 500];

interface SymbolStyle {
  label: string;
  payout: number;
  images: string[];
  color: string;
  glowColor: string;
  gradient: string;
  borderColor: string;
}

const SYMBOL_STYLES: Record<SeSymbol, SymbolStyle> = {
  FIRE: {
    label: 'Fire',
    payout: 5,
    images: [
      'https://i.postimg.cc/J4DLGmpD/IMG-20260926-132217.png',
      'https://i.postimg.cc/R0rfjMDq/IMG-20260926-131641.png',
    ],
    color: '#ff5722',
    glowColor: 'rgba(255,87,34,0.7)',
    gradient: 'linear-gradient(160deg, #3d2010 0%, #2a1408 50%, #1a0a04 100%)',
    borderColor: '#ff5722',
  },
  WATER: {
    label: 'Water',
    payout: 4,
    images: [
      'https://i.postimg.cc/wMzwHX4G/IMG-20260926-132157.png',
      'https://i.postimg.cc/d1wCV5vt/IMG-20260926-131556.png',
    ],
    color: '#29b6f6',
    glowColor: 'rgba(41,182,246,0.7)',
    gradient: 'linear-gradient(160deg, #0d3045 0%, #082030 50%, #041018 100%)',
    borderColor: '#29b6f6',
  },
  EARTH: {
    label: 'Earth',
    payout: 3,
    images: [
      'https://i.postimg.cc/52ynxNgw/IMG-20260926-132117.png',
      'https://i.postimg.cc/KzfMktvq/IMG-20260926-131534.png',
    ],
    color: '#66bb6a',
    glowColor: 'rgba(102,187,106,0.7)',
    gradient: 'linear-gradient(160deg, #1a3020 0%, #102015 50%, #081008 100%)',
    borderColor: '#66bb6a',
  },
  AIR: {
    label: 'Air',
    payout: 2.5,
    images: [
      'https://i.postimg.cc/mgnVhfp0/IMG-20260926-132054.png',
      'https://i.postimg.cc/1XzNp485/IMG-20260926-131454.png',
    ],
    color: '#b39ddb',
    glowColor: 'rgba(179,157,219,0.7)',
    gradient: 'linear-gradient(160deg, #252040 0%, #181530 50%, #0c0a18 100%)',
    borderColor: '#b39ddb',
  },
  LIGHTNING: {
    label: 'Lightning',
    payout: 2,
    images: [
      'https://i.postimg.cc/3JJZBJsr/IMG-20260926-132028.png',
      'https://i.postimg.cc/L4yPmkbr/IMG-20260926-131309.png',
    ],
    color: '#ffca28',
    glowColor: 'rgba(255,202,40,0.7)',
    gradient: 'linear-gradient(160deg, #3a2e10 0%, #251d08 50%, #15100a 100%)',
    borderColor: '#ffca28',
  },
  WILD: {
    label: 'Wild',
    payout: 10,
    images: [
      'https://i.postimg.cc/52Dqb56V/IMG-20260926-131932.png',
      'https://i.postimg.cc/gknZjX93/IMG-20260926-131240.png',
    ],
    color: '#ffd700',
    glowColor: 'rgba(255,215,0,0.8)',
    gradient: 'linear-gradient(160deg, #3a2e0a 0%, #251d05 50%, #15100a 100%)',
    borderColor: '#ffd700',
  },
  SCATTER: {
    label: 'Scatter',
    payout: 0,
    images: [
      'https://i.postimg.cc/GpYP2By6/IMG-20260926-131844.png',
    ],
    color: '#ff6f00',
    glowColor: 'rgba(255,111,0,0.8)',
    gradient: 'linear-gradient(160deg, #3d2200 0%, #2a1500 50%, #1a0a00 100%)',
    borderColor: '#ff6f00',
  },
  GOLDEN: {
    label: 'Golden',
    payout: 0,
    images: [
      'https://i.postimg.cc/PrR1Qbbm/IMG-20260926-131742.png',
    ],
    color: '#ffb300',
    glowColor: 'rgba(255,179,0,0.8)',
    gradient: 'linear-gradient(160deg, #3a2a00 0%, #251a00 50%, #15100a 100%)',
    borderColor: '#ffb300',
  },
};

export type SuperElementsDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

interface DifficultyConfig {
  label: string;
  payoutMin: number;
  payoutMax: number;
  scatterMin: number;
  scatterMax: number;
  winRate: number;
  deadSpinPercent: number;
}

const DIFFICULTY_CONFIGS: Record<SuperElementsDifficulty, DifficultyConfig> = {
  easy: { label: 'Easy', payoutMin: 50, payoutMax: 100, scatterMin: 5, scatterMax: 15, winRate: 90, deadSpinPercent: 10 },
  medium: { label: 'Medium', payoutMin: 5, payoutMax: 10, scatterMin: 15, scatterMax: 30, winRate: 80, deadSpinPercent: 20 },
  hard: { label: 'Hard', payoutMin: 0.1, payoutMax: 1.5, scatterMin: 50, scatterMax: 100, winRate: 70, deadSpinPercent: 30 },
  impossible: { label: 'Impossible', payoutMin: 0.1, payoutMax: 0.7, scatterMin: 500, scatterMax: 1000, winRate: 60, deadSpinPercent: 40 },
};

interface SuperElementsSettings {
  rtp: number;
  winRate: number;
  overrideEnabled: boolean;
  forceOutcome: 'none' | 'win' | 'loss';
  difficulty: SuperElementsDifficulty;
}

const DEFAULT_SETTINGS: SuperElementsSettings = {
  rtp: 85,
  winRate: 40,
  overrideEnabled: false,
  forceOutcome: 'none',
  difficulty: 'medium',
};

let scatterSpinCounter = 0;
let nextScatterAt = -1;

function randomSymbol(): SeSymbol {
  const roll = Math.random();
  if (roll < SCATTER_WEIGHT) return 'SCATTER';
  if (roll < SCATTER_WEIGHT + GOLDEN_WEIGHT) return 'GOLDEN';
  if (roll < SCATTER_WEIGHT + GOLDEN_WEIGHT + WILD_WEIGHT) return 'WILD';
  return BASE_SYMBOLS[Math.floor(Math.random() * BASE_SYMBOLS.length)];
}

function randomNonScatterSymbol(): SeSymbol {
  const roll = Math.random();
  if (roll < GOLDEN_WEIGHT) return 'GOLDEN';
  if (roll < GOLDEN_WEIGHT + WILD_WEIGHT) return 'WILD';
  return BASE_SYMBOLS[Math.floor(Math.random() * BASE_SYMBOLS.length)];
}

function randomInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDifficultyPayout(diff: SuperElementsDifficulty, betAmount: number): number {
  const cfg = DIFFICULTY_CONFIGS[diff];
  const multiplier = cfg.payoutMin + Math.random() * (cfg.payoutMax - cfg.payoutMin);
  return parseFloat((betAmount * multiplier).toFixed(2));
}

function shouldTriggerScatter(diff: SuperElementsDifficulty): boolean {
  if (nextScatterAt < 0) {
    const cfg = DIFFICULTY_CONFIGS[diff];
    const maxScatter = diff === 'easy' ? 10 : cfg.scatterMax;
    nextScatterAt = randomInclusive(cfg.scatterMin, maxScatter);
  }
  scatterSpinCounter++;
  if (scatterSpinCounter >= nextScatterAt) {
    const cfg = DIFFICULTY_CONFIGS[diff];
    const maxScatter = diff === 'easy' ? 10 : cfg.scatterMax;
    nextScatterAt = randomInclusive(cfg.scatterMin, maxScatter);
    scatterSpinCounter = 0;
    return true;
  }
  // Easy mode hard guarantee: trigger by spin 10 no matter what
  if (diff === 'easy' && scatterSpinCounter >= 10) {
    const cfg = DIFFICULTY_CONFIGS[diff];
    nextScatterAt = randomInclusive(cfg.scatterMin, 10);
    scatterSpinCounter = 0;
    return true;
  }
  return false;
}

function getReelStart(reelIdx: number): number {
  let start = 0;
  for (let i = 0; i < reelIdx; i++) start += REEL_ROWS[i];
  return start;
}

function generateGrid(): Cell[] {
  return Array.from({ length: TOTAL_CELLS }, (_, i) => ({
    symbol: randomSymbol(),
    id: i,
    isScatter: false,
    isGolden: false,
  }));
}

function generateNonScatterGrid(): Cell[] {
  return Array.from({ length: TOTAL_CELLS }, (_, i) => ({
    symbol: randomNonScatterSymbol(),
    id: i,
    isScatter: false,
    isGolden: false,
  }));
}

function generateNoMatchGrid(): Cell[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const testGrid = generateNonScatterGrid();
    const { matched } = findWayMatches(testGrid);
    if (matched.size === 0) return testGrid;
  }
  return Array.from({ length: TOTAL_CELLS }, (_, i) => {
    const reelIdx = Math.floor(i / 5);
    return {
      symbol: BASE_SYMBOLS[reelIdx % BASE_SYMBOLS.length] as SeSymbol,
      id: i,
      isScatter: false,
      isGolden: false,
    };
  });
}

function countScatters(grid: Cell[]): number {
  return grid.filter((c) => c.symbol === 'SCATTER' || c.isScatter).length;
}

function getEffectiveSymbol(cell: Cell): SeSymbol | 'WILD' {
  if (cell.symbol === 'WILD') return 'WILD';
  if (cell.symbol === 'GOLDEN' || cell.isGolden) return 'WILD';
  if (cell.transformedFromGolden) return 'WILD';
  return cell.symbol;
}

// Ways-to-win matching: for each symbol, check consecutive reels left-to-right.
// On each reel, at least one position must have the symbol (or wild).
// Count ways = product of matching positions per reel.
function findWayMatches(grid: Cell[]): {
  matched: Set<number>;
  goldenInMatch: number[];
  winSymbol: SeSymbol | null;
  ways: number;
  winAmount: number;
} {
  const matched = new Set<number>();
  const goldenInMatch: number[] = [];
  let bestSymbol: SeSymbol | null = null;
  let bestWays = 0;
  let bestWinAmount = 0;

  const isClusterable = (cell: Cell): boolean => cell.symbol !== 'SCATTER' && !cell.isScatter;

  for (const sym of BASE_SYMBOLS) {
    const reelCounts: number[] = [];
    const reelPositions: number[][] = [];

    for (let r = 0; r < NUM_REELS; r++) {
      const start = getReelStart(r);
      const rows = REEL_ROWS[r];
      const positions: number[] = [];
      for (let row = 0; row < rows; row++) {
        const idx = start + row;
        const cell = grid[idx];
        if (!isClusterable(cell)) continue;
        const eff = getEffectiveSymbol(cell);
        if (eff === sym || eff === 'WILD') {
          positions.push(idx);
        }
      }
      if (positions.length === 0) {
        reelCounts.push(0);
        reelPositions.push([]);
      } else {
        reelCounts.push(positions.length);
        reelPositions.push(positions);
      }
    }

    let consecutiveReels = 0;
    for (let r = 0; r < NUM_REELS; r++) {
      if (reelCounts[r] > 0) consecutiveReels++;
      else break;
    }

    if (consecutiveReels < 3) continue;

    let ways = 1;
    for (let r = 0; r < consecutiveReels; r++) ways *= reelCounts[r];

    const payout = SYMBOL_STYLES[sym].payout * consecutiveReels * ways / 100;
    if (payout > bestWinAmount) {
      bestWinAmount = payout;
      bestSymbol = sym;
      bestWays = ways;
      for (let r = 0; r < consecutiveReels; r++) {
        reelPositions[r].forEach((idx) => {
          matched.add(idx);
          if (grid[idx].symbol === 'GOLDEN' || grid[idx].isGolden) goldenInMatch.push(idx);
        });
      }
    }
  }

  if (bestSymbol === null) {
    let wildWays = 1;
    let wildReels = 0;
    const wildReelPositions: number[][] = [];
    for (let r = 0; r < NUM_REELS; r++) {
      const start = getReelStart(r);
      const rows = REEL_ROWS[r];
      const positions: number[] = [];
      for (let row = 0; row < rows; row++) {
        const idx = start + row;
        const cell = grid[idx];
        if (!isClusterable(cell)) continue;
        const eff = getEffectiveSymbol(cell);
        if (eff === 'WILD') positions.push(idx);
      }
      if (positions.length > 0) {
        wildReels++;
        wildWays *= positions.length;
        wildReelPositions.push(positions);
      } else break;
    }
    if (wildReels >= 3) {
      const payout = SYMBOL_STYLES.WILD.payout * wildReels * wildWays / 100;
      bestSymbol = 'WILD';
      bestWays = wildWays;
      bestWinAmount = payout;
      for (let r = 0; r < wildReels; r++) {
        wildReelPositions[r].forEach((idx) => {
          matched.add(idx);
          if (grid[idx].symbol === 'GOLDEN' || grid[idx].isGolden) goldenInMatch.push(idx);
        });
      }
    }
  }

  return { matched, goldenInMatch, winSymbol: bestSymbol, ways: bestWays, winAmount: bestWinAmount };
}

export default function SuperElementsGame({ balance, onBetPlaced, onWin }: SuperElementsGameProps) {
  const [grid, setGrid] = useState<Cell[]>(() => generateGrid());
  const [bet, setBet] = useState(10);
  const [extraBet, setExtraBet] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [matchedCells, setMatchedCells] = useState<Set<number>>(new Set());
  const [cascadeLevel, setCascadeLevel] = useState(0);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [totalWin, setTotalWin] = useState(0);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [settings, setSettings] = useState<SuperElementsSettings>(DEFAULT_SETTINGS);

  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinsTotal, setFreeSpinsTotal] = useState(0);
  const [inFreeGame, setInFreeGame] = useState(false);
  const [freeGameWin, setFreeGameWin] = useState(0);
  const [scatterTrigger, setScatterTrigger] = useState(false);
  const [goldenTransforming, setGoldenTransforming] = useState<Set<number>>(new Set());
  const [showWinBanner, setShowWinBanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAutoSpin, setShowAutoSpin] = useState(false);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState(0);

  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<SuperElementsSettings>(DEFAULT_SETTINGS);
  const freeSpinsRemainingRef = useRef<number>(0);
  const targetPayoutRef = useRef<number>(0);
  const autoSpinRef = useRef<() => void>(() => {});
  const autoSpinRemainingRef = useRef(0);

  const { user, deductBalance, addBalance } = useAuth();
  const { t, bn } = useLanguage();

  const effectiveBet = extraBet ? parseFloat((bet * 1.5).toFixed(2)) : bet;
  const activeMults = inFreeGame
    ? FREE_GAME_CASCADE_MULTIPLIERS
    : extraBet
    ? EXTRA_BET_CASCADE_MULTIPLIERS
    : BASE_CASCADE_MULTIPLIERS;

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { freeSpinsRemainingRef.current = freeSpinsRemaining; }, [freeSpinsRemaining]);
  useEffect(() => { autoSpinRemainingRef.current = autoSpinRemaining; }, [autoSpinRemaining]);

  // Auto-spin: trigger next spin when previous finishes
  useEffect(() => {
    if (!spinning && autoSpinRemaining > 0 && !inFreeGame && balance >= effectiveBet) {
      const timer = setTimeout(() => autoSpinRef.current(), 1000);
      return () => clearTimeout(timer);
    }
    if (!spinning && autoSpinRemaining > 0 && balance < effectiveBet) {
      setAutoSpinRemaining(0);
    }
  }, [spinning, autoSpinRemaining, inFreeGame, balance, effectiveBet]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const snap = await get(ref(db, 'game_settings/superelements'));
      if (snap.exists()) {
        const s = snap.val();
        setSettings({
          rtp: s.rtp ?? 85,
          winRate: s.winRate ?? 40,
          overrideEnabled: s.overrideEnabled ?? false,
          forceOutcome: s.forceOutcome ?? 'none',
          difficulty: (s.difficulty as SuperElementsDifficulty) ?? 'medium',
        });
      }
    })();
    unsub = onValue(ref(db, 'game_settings/superelements'), (snap) => {
      if (snap.exists()) {
        const s = snap.val();
        setSettings({
          rtp: s.rtp ?? 85,
          winRate: s.winRate ?? 40,
          overrideEnabled: s.overrideEnabled ?? false,
          forceOutcome: s.forceOutcome ?? 'none',
          difficulty: (s.difficulty as SuperElementsDifficulty) ?? 'medium',
        });
      }
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const processCascade = useCallback((
    currentGrid: Cell[],
    level: number,
    accumulatedWin: number,
    mults: number[],
    isFree: boolean,
    freeAccumulated: number,
  ) => {
    const { matched, goldenInMatch, winSymbol, ways, winAmount } = findWayMatches(currentGrid);

    if (matched.size === 0 || level >= mults.length) {
      setSpinning(false);
      setMatchedCells(new Set());
      setCascadeLevel(0);

      const scatters = countScatters(currentGrid);

      if (accumulatedWin > 0) {
        let finalWin = accumulatedWin;
        if (!isFree) {
          finalWin = targetPayoutRef.current;
        }
        addBalance(finalWin);
        onWin(finalWin);
        addTransaction({ id: `${Date.now()}-superelements-win`, type: 'win', amount: finalWin, timestamp: Date.now() });
        setLastWin(finalWin);
        setTotalWin(finalWin);
        setResultMsg(`${t('superElements.totalWin')}: ৳${bn(finalWin.toFixed(2))}`);
        setShowWinBanner(true);
        setTimeout(() => setShowWinBanner(false), 4000);

        if (isFree) {
          const newFreeWin = parseFloat((freeAccumulated + accumulatedWin).toFixed(2));
          setFreeGameWin(newFreeWin);
        }

        if (user) {
          const betRef = push(ref(db, 'superelements_bets'));
          set(betRef, {
            userId: user.uid,
            userName: user.name,
            betAmount: isFree ? 0 : effectiveBet,
            payout: finalWin,
            freeGame: isFree,
            timestamp: Date.now(),
          }).catch(() => {});
        }
      } else {
        setResultMsg(t('superElements.noMatch'));
        setLastWin(null);
        setTotalWin(0);
        if (user) {
          const betRef = push(ref(db, 'superelements_bets'));
          set(betRef, {
            userId: user.uid,
            userName: user.name,
            betAmount: isFree ? 0 : effectiveBet,
            payout: 0,
            freeGame: isFree,
            timestamp: Date.now(),
          }).catch(() => {});
        }
      }

      const currentDiff = settingsRef.current.difficulty;
      if (scatters >= 3 && !isFree) {
        const maxFreeSpins = currentDiff === 'impossible' ? 1 : (scatters === 3 ? 10 : scatters === 4 ? 15 : 20);
        setFreeSpinsRemaining(maxFreeSpins);
        setFreeSpinsTotal(maxFreeSpins);
        setInFreeGame(true);
        setFreeGameWin(0);
        setScatterTrigger(true);
        setResultMsg(`${scatters} ${t('superElements.scatter')}! ${maxFreeSpins} ${t('superElements.freeSpin')}!`);
        setTimeout(() => setScatterTrigger(false), 3000);
      } else if (scatters >= 3 && isFree && currentDiff !== 'impossible') {
        const extra = scatters === 3 ? 5 : scatters === 4 ? 10 : 15;
        setFreeSpinsRemaining((prev) => Math.min(prev + extra, 50));
        setFreeSpinsTotal((prev) => Math.min(prev + extra, 50));
        setResultMsg(`${scatters} ${t('superElements.scatter')}! +${extra} ${t('superElements.freeSpin')}!`);
        setScatterTrigger(true);
        setTimeout(() => setScatterTrigger(false), 3000);
      }

      if (isFree && freeSpinsRemainingRef.current <= 0) {
        setInFreeGame(false);
        setFreeSpinsRemaining(0);
        setFreeSpinsTotal(0);
        if (freeAccumulated + (accumulatedWin || 0) > 0) {
          const totalFree = parseFloat((freeAccumulated + (accumulatedWin || 0)).toFixed(2));
          setResultMsg(`${t('superElements.freeGamesComplete')} ৳${totalFree.toFixed(2)}`);
          setShowWinBanner(true);
          setTimeout(() => setShowWinBanner(false), 5000);
        }
      }

      return;
    }

    const mult = mults[level];
    const roundWin = isFree
      ? parseFloat((effectiveBet * winAmount * mult).toFixed(2))
      : parseFloat((targetPayoutRef.current * mult / mults.reduce((a, b) => a + b, 0)).toFixed(2));
    const newAccumulated = parseFloat((accumulatedWin + roundWin).toFixed(2));

    setMatchedCells(new Set(matched));
    setCascadeLevel(level + 1);
    setLastWin(roundWin);
    const symLabel = winSymbol ? SYMBOL_STYLES[winSymbol].label : '';
    setResultMsg(`${symLabel} x${ways} ${t('superElements.waysToWin')} — ${t('superElements.cascade')} ${level + 1}: ${mult}x! +৳${roundWin.toFixed(2)}`);

    if (goldenInMatch.length > 0) {
      const transforming = new Set(goldenInMatch);
      setGoldenTransforming(transforming);
      setResultMsg(`${t('superElements.goldenToWild')} +৳${roundWin.toFixed(2)}`);

      chainTimeoutRef.current = setTimeout(() => {
        const transformedGrid = currentGrid.map((cell, idx) =>
          transforming.has(idx)
            ? { ...cell, symbol: 'WILD' as SeSymbol, isGolden: false, transformedFromGolden: true, id: cell.id + 5000 }
            : cell
        );
        setGrid(transformedGrid);
        setGoldenTransforming(new Set());

        chainTimeoutRef.current = setTimeout(() => {
          const newGrid = transformedGrid.map((cell, idx) =>
            matched.has(idx)
              ? { symbol: randomNonScatterSymbol(), id: cell.id + 1000, isScatter: false, isGolden: false }
              : cell
          );
          setGrid(newGrid);
          setMatchedCells(new Set());
          chainTimeoutRef.current = setTimeout(() => {
            processCascade(newGrid, level + 1, newAccumulated, mults, isFree, freeAccumulated);
          }, 300);
        }, 600);
      }, 800);
    } else {
      chainTimeoutRef.current = setTimeout(() => {
        const newGrid = currentGrid.map((cell, idx) =>
          matched.has(idx)
            ? { symbol: randomNonScatterSymbol(), id: cell.id + 1000, isScatter: false, isGolden: false }
            : cell
        );
        setGrid(newGrid);
        setMatchedCells(new Set());
        chainTimeoutRef.current = setTimeout(() => {
          processCascade(newGrid, level + 1, newAccumulated, mults, isFree, freeAccumulated);
        }, 300);
      }, 800);
    }
  }, [effectiveBet, addBalance, onWin, user, t, bn]);

  const spin = useCallback(() => {
    if (spinning || (!inFreeGame && balance < effectiveBet) || effectiveBet <= 0) {
      if (autoSpinRemainingRef.current > 0) setAutoSpinRemaining(0);
      return;
    }

    setSpinning(true);
    setResultMsg(null);
    setLastWin(null);
    setTotalWin(0);
    setCascadeLevel(0);
    setMatchedCells(new Set());
    setGoldenTransforming(new Set());

    if (!inFreeGame) {
      deductBalance(effectiveBet);
      onBetPlaced(effectiveBet);
      addTransaction({ id: `${Date.now()}-superelements-bet`, type: 'bet', amount: effectiveBet, timestamp: Date.now() });
      if (autoSpinRemainingRef.current > 0) {
        setAutoSpinRemaining((prev) => prev - 1);
      }
    } else {
      setFreeSpinsRemaining((prev) => prev - 1);
    }

    const currentSettings = settingsRef.current;
    const mults = inFreeGame
      ? FREE_GAME_CASCADE_MULTIPLIERS
      : extraBet
      ? EXTRA_BET_CASCADE_MULTIPLIERS
      : BASE_CASCADE_MULTIPLIERS;

    const diffCfg = DIFFICULTY_CONFIGS[currentSettings.difficulty];

    let shouldWin: boolean;
    if (currentSettings.overrideEnabled && currentSettings.forceOutcome !== 'none') {
      shouldWin = currentSettings.forceOutcome === 'win';
    } else if (inFreeGame) {
      shouldWin = Math.random() < 0.65;
    } else {
      const isDeadSpin = Math.random() < diffCfg.deadSpinPercent / 100;
      shouldWin = !isDeadSpin;
    }

    if (!inFreeGame) {
      targetPayoutRef.current = shouldWin ? getDifficultyPayout(currentSettings.difficulty, effectiveBet) : 0;
    }

    const forceScatters = !inFreeGame && shouldTriggerScatter(currentSettings.difficulty);
    const forceScatterCount = forceScatters ? 3 : 0;

    const generateOutcomeGrid = (): Cell[] => {
      if (!shouldWin) {
        const baseGrid = generateNoMatchGrid();
        if (forceScatterCount > 0) {
          const positions = new Set<number>();
          while (positions.size < forceScatterCount) {
            positions.add(Math.floor(Math.random() * TOTAL_CELLS));
          }
          positions.forEach((pos) => {
            baseGrid[pos] = { ...baseGrid[pos], symbol: 'SCATTER' as SeSymbol, isScatter: true };
          });
        }
        return baseGrid;
      }

      const grid = Array.from({ length: TOTAL_CELLS }, (_, i) => ({
        symbol: randomNonScatterSymbol(),
        id: i,
        isScatter: false,
        isGolden: false,
      }));

      if (forceScatterCount > 0) {
        const positions = new Set<number>();
        while (positions.size < forceScatterCount) {
          positions.add(Math.floor(Math.random() * TOTAL_CELLS));
        }
        positions.forEach((pos) => {
          grid[pos] = { ...grid[pos], symbol: 'SCATTER' as SeSymbol, isScatter: true };
        });
      }

      const sym = BASE_SYMBOLS[Math.floor(Math.random() * BASE_SYMBOLS.length)];
      const startReel = 0;
      const startRow = Math.floor(Math.random() * REEL_ROWS[0]);
      const startIdx = getReelStart(startReel) + startRow;
      if (grid[startIdx].symbol !== 'SCATTER')
        grid[startIdx] = { symbol: sym, id: grid[startIdx].id };
      const idx2 = getReelStart(1) + Math.floor(Math.random() * REEL_ROWS[1]);
      if (grid[idx2].symbol !== 'SCATTER')
        grid[idx2] = { symbol: sym, id: grid[idx2].id };
      const idx3 = getReelStart(2) + Math.floor(Math.random() * REEL_ROWS[2]);
      if (grid[idx3].symbol !== 'SCATTER')
        grid[idx3] = { symbol: sym, id: grid[idx3].id };

      if (Math.random() < 0.4) {
        const goldReel = 3;
        const goldIdx = getReelStart(goldReel) + Math.floor(Math.random() * REEL_ROWS[goldReel]);
        if (grid[goldIdx].symbol !== 'SCATTER') {
          grid[goldIdx] = { ...grid[goldIdx], symbol: 'GOLDEN' as SeSymbol, isGolden: true };
        }
      }

      return grid;
    };

    let ticks = 0;
    spinIntervalRef.current = setInterval(() => {
      setGrid(generateGrid());
      ticks++;
      if (ticks > 12) {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
        const finalGrid = generateOutcomeGrid();
        setGrid(finalGrid);
        const currentFreeAccumulated = inFreeGame ? freeGameWin : 0;
        processCascade(finalGrid, 0, 0, mults, inFreeGame, currentFreeAccumulated);
      }
    }, 80);
  }, [spinning, balance, effectiveBet, inFreeGame, freeGameWin, deductBalance, onBetPlaced, processCascade, extraBet]);

  useEffect(() => {
    if (inFreeGame && freeSpinsRemaining > 0 && !spinning) {
      const timer = setTimeout(() => { spin(); }, 1000);
      return () => clearTimeout(timer);
    }
  }, [inFreeGame, freeSpinsRemaining, spinning, spin]);

  useEffect(() => {
    if (inFreeGame && freeSpinsRemaining === 0 && !spinning) {
      setInFreeGame(false);
      setFreeSpinsTotal(0);
    }
  }, [inFreeGame, freeSpinsRemaining, spinning]);

  const adjustBet = (delta: number) => {
    setBet((prev) => Math.max(1, parseFloat((prev + delta).toFixed(2))));
  };

  const renderReel = (reelIdx: number) => {
    const start = getReelStart(reelIdx);
    const rows = REEL_ROWS[reelIdx];
    const cells = [];
    for (let row = 0; row < rows; row++) {
      const idx = start + row;
      const cell = grid[idx];
      if (!cell) continue;
      const style = SYMBOL_STYLES[cell.symbol];
      const isMatched = matchedCells.has(idx);
      const isGolden = cell.symbol === 'GOLDEN' || cell.isGolden;
      const isScatter = cell.symbol === 'SCATTER' || cell.isScatter;
      const isWild = cell.symbol === 'WILD' || cell.transformedFromGolden;
      const isTransforming = goldenTransforming.has(idx);

      cells.push(
        <div
          key={cell.id}
          className={`aspect-square rounded-[10px] relative overflow-hidden border-2 transition-all duration-300 ${
            isMatched
              ? 'scale-110 animate-pulse-soft z-10'
              : isTransforming
              ? 'scale-125 z-20 animate-pulse-glow'
              : spinning
              ? 'opacity-70'
              : 'hover:-translate-y-0.5'
          }`}
          style={{
            background: style.gradient,
            borderColor: isMatched
              ? style.color
              : isScatter
              ? '#ff6f00'
              : isGolden
              ? '#ffb300'
              : style.borderColor,
            boxShadow: isMatched
              ? `0 0 18px ${style.glowColor}, inset 0 0 10px ${style.glowColor}`
              : isScatter
              ? `0 0 12px rgba(255,111,0,0.5), inset 0 0 8px rgba(255,111,0,0.3)`
              : isGolden
              ? `0 0 12px rgba(255,179,0,0.5), inset 0 0 8px rgba(255,179,0,0.3)`
              : isWild
              ? `0 0 10px rgba(255,215,0,0.4), inset 0 0 6px rgba(255,215,0,0.2)`
              : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.4)',
          }}
        >
          {/* Stone texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.15) 0%, transparent 50%)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center p-1">
            <img
              src={style.images[idx % style.images.length]}
              alt={style.label}
              className="w-full h-full object-contain"
              style={{
                filter: isMatched
                  ? `drop-shadow(0 0 6px ${style.glowColor}) brightness(1.25)`
                  : isScatter
                  ? 'drop-shadow(0 0 4px rgba(255,111,0,0.7)) brightness(1.15)'
                  : isGolden
                  ? 'drop-shadow(0 0 4px rgba(255,179,0,0.7)) brightness(1.15)'
                  : isWild
                  ? 'drop-shadow(0 0 4px rgba(255,215,0,0.6)) brightness(1.15)'
                  : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
              }}
            />
          </div>

          {isScatter && (
            <div className="absolute top-0.5 right-0.5 bg-[#ff6f00] text-[#1a0a00] text-[6px] font-bold px-1 py-0.5 rounded-full">
              {t('superElements.scatter')}
            </div>
          )}
          {isGolden && (
            <div className="absolute top-0.5 right-0.5 bg-[#ffb300] text-[#1a0a00] text-[6px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5">
              <Crown size={6} fill="currentColor" />
              {t('superElements.golden')}
            </div>
          )}
          {isWild && !isScatter && !isGolden && (
            <div className="absolute top-0.5 left-0.5 bg-[#ffd700]/30 text-[#ffd700] text-[6px] font-bold px-1 py-0.5 rounded-full border border-[#ffd700]/50">
              {t('superElements.wild')}
            </div>
          )}
          {isTransforming && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <Sparkles size={20} className="text-[#ffd700] animate-ping" />
            </div>
          )}

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.15) 100%)',
            }}
          />
          {isMatched && (
            <div
              className="absolute inset-0 pointer-events-none border-2 rounded-[10px] animate-pulse"
              style={{ borderColor: style.color }}
            />
          )}
        </div>
      );
    }
    return cells;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-end"
          style={{
            backgroundImage: 'url(https://i.postimg.cc/g0shr1DK/Screenshot-2026-09-26-13-50-57-373-com-android-chrome.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-10 flex flex-col items-center gap-3 pb-12">
            <div className="w-10 h-10 rounded-full border-3 border-white/20 border-t-[#ff5722] animate-spin" style={{ animationDuration: '0.8s' }} />
            <p className="text-white/90 text-xs font-bold tracking-widest uppercase" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>Loading Super Elements</p>
          </div>
        </div>
      )}
      {/* Free Game banner */}
      {inFreeGame && (
        <div className="shrink-0 bg-gradient-to-r from-[#ff9500] to-[#ffd700] py-2 px-3 flex items-center justify-between animate-pulse-soft">
          <div className="flex items-center gap-1.5">
            <Gift size={14} className="text-[#1a1f2e]" fill="currentColor" />
            <span className="text-[#1a1f2e] font-bold text-xs">{t('superElements.freeGames')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#1a1f2e] font-bold text-xs">
              {bn(freeSpinsRemaining)}/{bn(freeSpinsTotal)} {t('superElements.freeSpinsLeft')}
            </span>
            <span className="text-[#1a1f2e] font-bold text-xs">
              {t('superElements.totalWon')}: ৳{bn(freeGameWin.toFixed(2))}
            </span>
          </div>
        </div>
      )}

      {/* Game area: cascade multipliers + game grid on top of page background image */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">

      {/* Cascade multiplier indicators — compact premium bar */}
      <div className="relative z-10 shrink-0 flex items-center justify-center gap-1 py-1.5 px-2"
        style={{ background: 'linear-gradient(180deg, rgba(26,16,8,0.85) 0%, rgba(14,8,4,0.7) 100%)', borderBottom: '1px solid rgba(255,215,0,0.15)' }}
      >
        {activeMults.map((mult, i) => (
          <div
            key={i}
            className={`flex items-center gap-0.5 px-2 py-1 rounded-md border transition-all duration-300 ${
              cascadeLevel > i
                ? inFreeGame
                  ? 'bg-[#ff6f00] border-[#ff6f00] text-[#1a0a00] shadow-[0_0_10px_rgba(255,111,0,0.6)]'
                  : extraBet
                  ? 'bg-[#ffd700] border-[#ffd700] text-[#1a0a00] shadow-[0_0_10px_rgba(255,215,0,0.6)]'
                  : 'bg-[#00ff88] border-[#00ff88] text-[#0a1a0e] shadow-[0_0_10px_rgba(0,255,136,0.6)]'
                : cascadeLevel === i && spinning
                ? inFreeGame
                  ? 'bg-[#ff6f00]/20 border-[#ff6f00]/60 text-[#ff6f00] animate-pulse-soft'
                  : extraBet
                  ? 'bg-[#ffd700]/20 border-[#ffd700]/60 text-[#ffd700] animate-pulse-soft'
                  : 'bg-[#00ff88]/20 border-[#00ff88]/60 text-[#00ff88] animate-pulse-soft'
                : 'bg-[#1a1208]/90 border-[#5a3a1a]/50 text-[#8a6a4a]'
            }`}
          >
            {cascadeLevel > i && <Sparkles size={8} fill="currentColor" />}
            <span className="text-[10px] font-display font-bold tracking-wide">x{mult}</span>
          </div>
        ))}
        <div className="flex items-center gap-0.5 px-2 py-1 rounded-md border border-[#5a3a1a]/50 bg-[#1a1208]/90 text-[#ffd700] ml-0.5">
          <Zap size={8} fill="currentColor" />
          <span className="text-[9px] font-bold">{bn(WAYS_TO_WIN)}</span>
        </div>
      </div>

      {/* Game grid */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center p-3">

        {scatterTrigger && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-[#ff9500]/90 backdrop-blur-sm rounded-2xl px-6 py-4 border-2 border-[#ffaa00] animate-scale-in shadow-[0_0_30px_rgba(255,149,0,0.6)]">
              <div className="flex items-center gap-2 mb-1">
                <Star size={32} className="text-[#1a1f2e]" fill="currentColor" />
                <div>
                  <p className="text-[#1a1f2e] font-display font-bold text-lg">{t('superElements.freeSpinsBanner')}</p>
                  <p className="text-[#1a1f2e] text-xs font-bold">{t('superElements.scatterTriggered')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative w-full max-w-sm" style={{ marginTop: '-96px' }}>
          {/* Outer ornate frame */}
          <div className="rounded-[20px] p-[3px] shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,215,0,0.1)]"
            style={{ background: 'linear-gradient(145deg, #5a4220 0%, #3a2a10 30%, #2a1c08 50%, #3a2a10 70%, #5a4220 100%)' }}
          >
          {/* Inner frame */}
          <div className="rounded-[17px] p-1.5"
            style={{ background: 'linear-gradient(160deg, #1a1208 0%, #0e0804 50%, #1a1208 100%)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,215,0,0.08)' }}
          >
          <div
            className="grid gap-1.5 rounded-[14px] p-2"
            style={{
              gridTemplateColumns: `repeat(${NUM_REELS}, 1fr)`,
              background: 'linear-gradient(160deg, #2a1c12 0%, #1a1208 50%, #100a05 100%)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
            }}
          >
            {Array.from({ length: NUM_REELS }, (_, reelIdx) => (
              <div key={reelIdx} className="flex flex-col gap-1.5">
                {renderReel(reelIdx)}
              </div>
            ))}
          </div>
          </div>
          </div>

          {lastWin !== null && lastWin > 0 && !showWinBanner && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
              <div className="bg-dark-bg/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-neon-green/40 animate-scale-in">
                <p className="text-neon-green font-display text-2xl font-bold text-center neon-text-green">
                  +৳{bn(lastWin.toFixed(2))}
                </p>
                {cascadeLevel > 0 && (
                  <p className="text-neon-gold text-[10px] font-bold text-center mt-0.5">
                    {t('superElements.cascade')} x{cascadeLevel}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Win banner */}
      {showWinBanner && totalWin > 0 && (
        <div className="shrink-0 px-3 py-2 border-t border-[#5a3a1a]"
          style={{ background: 'rgba(10,6,4,0.55)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-[#ffd700] shrink-0 bg-black/40 flex items-center justify-center">
              <Flame size={24} className="text-[#ff5722]" />
            </div>
            <div className="flex-1 bg-gradient-to-r from-neon-green/15 to-neon-gold/15 rounded-lg border border-neon-green/40 px-3 py-2 animate-scale-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{t('superElements.totalWon')}</span>
                <span className="text-neon-green font-display text-lg font-bold tabular-nums">
                  ৳{bn(totalWin.toFixed(2))}
                </span>
              </div>
              {freeGameWin > 0 && (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-[#ff6f00] font-bold uppercase">{t('superElements.freeGameWon')}</span>
                  <span className="text-[#ff6f00] font-bold text-sm tabular-nums">
                    ৳{bn(freeGameWin.toFixed(2))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result message */}
      {resultMsg && !showWinBanner && (
        <div className="shrink-0 px-3 py-1.5 border-t border-[#5a3a1a]/50"
          style={{ background: 'rgba(10,6,4,0.55)' }}>
          <p className={`text-xs font-bold text-center ${lastWin ? 'text-neon-green' : 'text-gray-500'}`}>
            {resultMsg}
          </p>
        </div>
      )}

      {/* Bottom control panel — premium slot machine console */}
      <div className="shrink-0 px-2.5 pt-2 pb-3"
        style={{
          background: 'rgba(10,6,4,0.55)',
          borderTop: '2px solid',
          borderImage: 'linear-gradient(90deg, #5a4220, #ffd700/30, #5a4220) 1',
          boxShadow: '0 -8px 20px rgba(0,0,0,0.5)',
        }}
      >
        {inFreeGame && (
          <div className="flex items-center justify-center gap-1.5 mb-2 rounded-lg py-1 px-2"
            style={{ background: 'rgba(255,111,0,0.08)', border: '1px solid rgba(255,111,0,0.25)' }}
          >
            <span className="text-[9px] text-[#ff6f00] font-bold uppercase">{t('superElements.freeGameWon')}</span>
            <span className="text-[11px] text-[#ff6f00] font-bold tabular-nums">৳{bn(freeGameWin.toFixed(2))}</span>
          </div>
        )}

        {/* Quick bet chips */}
        {!inFreeGame && (
          <div className="flex gap-1 mb-2">
            {QUICK_BETS.map((amt) => (
              <button
                key={amt}
                onClick={() => setBet(amt)}
                disabled={spinning}
                className={`flex-1 text-[9px] font-bold py-1 rounded-md transition-all disabled:opacity-40 ${
                  bet === amt
                    ? 'text-[#ffd700] border'
                    : 'text-[#8a6a4a] border'
                }`}
                style={bet === amt
                  ? { background: 'linear-gradient(145deg, rgba(255,215,0,0.15), rgba(255,111,0,0.05))', borderColor: 'rgba(255,215,0,0.4)', boxShadow: '0 0 8px rgba(255,215,0,0.15)' }
                  : { background: 'linear-gradient(145deg, #2a1c12, #1a1208)', borderColor: 'rgba(90,58,26,0.5)' }
                }
              >
                ৳{bn(amt)}
              </button>
            ))}
          </div>
        )}

        {/* Bet control row: [-] [BET] [+] [PAYTABLE] */}
        <div className="flex items-center gap-1.5 mb-2">
          <button
            onClick={() => adjustBet(-1)}
            disabled={spinning || inFreeGame}
            className="w-11 rounded-xl flex items-center justify-center text-[#ffd700] active:scale-90 transition-all disabled:opacity-40 shrink-0"
            style={{ background: 'linear-gradient(145deg, #2a1c12, #1a1208)', border: '1px solid rgba(255,215,0,0.15)', boxShadow: 'inset 0 1px 0 rgba(255,215,0,0.08), 0 2px 6px rgba(0,0,0,0.4)' }}
          >
            <Minus size={18} strokeWidth={2.5} />
          </button>

          <div className="flex-1 flex items-center justify-center rounded-xl h-11"
            style={{ background: 'linear-gradient(145deg, #2a1c12, #1a1208)', border: '1px solid rgba(255,215,0,0.15)' }}
          >
            <span className="text-[#ffd700] font-bold text-sm mr-1">৳</span>
            <span className="text-white font-bold text-base tabular-nums">{bn(effectiveBet.toFixed(2))}</span>
          </div>

          <button
            onClick={() => adjustBet(1)}
            disabled={spinning || inFreeGame}
            className="w-11 rounded-xl flex items-center justify-center text-[#ffd700] active:scale-90 transition-all disabled:opacity-40 shrink-0"
            style={{ background: 'linear-gradient(145deg, #2a1c12, #1a1208)', border: '1px solid rgba(255,215,0,0.15)', boxShadow: 'inset 0 1px 0 rgba(255,215,0,0.08), 0 2px 6px rgba(0,0,0,0.4)' }}
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => setShowPaytable(true)}
            disabled={spinning}
            className="w-11 rounded-xl flex items-center justify-center text-[#8a6a4a] active:scale-95 transition-all disabled:opacity-40 shrink-0"
            style={{ background: 'linear-gradient(145deg, #2a1c12, #1a1208)', border: '1px solid rgba(90,58,26,0.5)', boxShadow: 'inset 0 1px 0 rgba(255,215,0,0.05), 0 2px 6px rgba(0,0,0,0.4)' }}
          >
            <Star size={16} />
          </button>
        </div>

        {/* Spin button + Auto Spin button */}
        <div className="flex items-center justify-center gap-3">
          {autoSpinRemaining > 0 && (
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
            disabled={spinning || inFreeGame ? false : (balance < effectiveBet || effectiveBet <= 0)}
            className="transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 bg-transparent border-0 p-0"
          >
            {inFreeGame ? (
              <>
                <Gift size={24} strokeWidth={2.5} fill="currentColor" className={`text-[#ff9500] ${spinning ? 'animate-spin-slow' : ''}`} />
                <span className="text-[8px] leading-tight text-center text-[#ff9500] font-bold">{spinning ? t('superElements.spinning') : `${t('superElements.freeSpin')}`}</span>
                <span className="text-[7px] opacity-80 text-[#ff9500]">{bn(freeSpinsRemaining)}</span>
              </>
            ) : (
              <>
                <img
                  src="https://i.postimg.cc/GtLKd56H/generated-image.png"
                  alt="Spin"
                  className={`w-24 h-24 object-contain ${spinning ? 'animate-spin-slow' : ''}`}
                />
                <span className="text-[8px] leading-tight text-center font-bold text-gray-400">{spinning ? t('superElements.spinning') : `${t('superElements.spin')}`}</span>
                <span className="text-[7px] opacity-80 font-semibold text-gray-400">৳{bn(effectiveBet.toFixed(2))}</span>
              </>
            )}
          </button>
          {autoSpinRemaining === 0 && !inFreeGame && (
            <button
              onClick={() => setShowAutoSpin(true)}
              disabled={spinning || balance < effectiveBet}
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

      {/* Paytable modal */}
      {showPaytable && (
        <div
          className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPaytable(false)}
        >
          <div
            className="bg-dark-card rounded-2xl border border-dark-border p-4 max-w-sm w-full max-h-[80%] overflow-y-auto"
            style={{ background: 'linear-gradient(160deg, #2a1c12 0%, #1a1208 50%, #100a05 100%)', borderColor: '#5a3a1a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold text-white">{t('superElements.paytable')}</h3>
              <button onClick={() => setShowPaytable(false)} className="text-[#8a6a4a] text-xl leading-none">✕</button>
            </div>

            <div className="mb-4">
              <p className="text-[10px] text-[#8a6a4a] font-bold uppercase mb-1.5">{t('superElements.cascadeMultipliers')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#2a1c12] rounded-lg border border-[#5a3a1a] p-2">
                  <p className="text-[10px] text-[#8a6a4a] font-bold">{t('superElements.baseGame')}</p>
                  <p className="text-xs text-neon-green font-bold">x1 x2 x3 x5 x10</p>
                </div>
                <div className="bg-[#2a1c12] rounded-lg border border-neon-gold/30 p-2">
                  <p className="text-[10px] text-neon-gold font-bold">{t('superElements.extraBet')}</p>
                  <p className="text-xs text-neon-gold font-bold">x2 x4 x6 x10 x15</p>
                </div>
                <div className="bg-[#2a1c12] rounded-lg border border-[#ff6f00]/30 p-2 col-span-2">
                  <p className="text-[10px] text-[#ff6f00] font-bold">{t('superElements.freeGame')}</p>
                  <p className="text-xs text-[#ff6f00] font-bold">x3 x6 x9 x15 x30</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {(['WILD', 'FIRE', 'WATER', 'EARTH', 'AIR', 'LIGHTNING', 'SCATTER', 'GOLDEN'] as SeSymbol[]).map((sym) => {
                const style = SYMBOL_STYLES[sym];
                return (
                  <div key={sym} className="flex items-center gap-3 bg-[#2a1c12] rounded-lg border border-[#5a3a1a] p-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center border-2 shrink-0 overflow-hidden"
                      style={{ background: style.gradient, borderColor: style.borderColor }}
                    >
                      <img src={style.images[0]} alt={style.label} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">{style.label}</p>
                      <p className="text-[10px] text-[#8a6a4a]">
                        {sym === 'SCATTER'
                          ? `3+ = ${t('superElements.freeGames')}`
                          : sym === 'GOLDEN'
                          ? t('superElements.goldenToWild')
                          : sym === 'WILD'
                          ? `${t('superElements.wild')} — ${style.payout}x`
                          : `${style.payout}x per reel`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 bg-[#2a1c12] rounded-lg border border-[#5a3a1a] p-2.5">
              <p className="text-[10px] text-[#8a6a4a] leading-relaxed">{t('superElements.description')}</p>
            </div>
          </div>
        </div>
      )}

      <AutoSpinModal
        isOpen={showAutoSpin}
        onClose={() => setShowAutoSpin(false)}
        onStart={(count) => {
          setAutoSpinRemaining(count);
          autoSpinRef.current = spin;
          setTimeout(() => spin(), 100);
        }}
        betAmount={effectiveBet}
        balance={balance}
      />
    </div>
  );
}
