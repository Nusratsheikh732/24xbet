import { useState, useRef, useCallback, useEffect } from 'react';
import { Zap, Sparkles, Gift, Crown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { addTransaction } from '@/lib/localStorage';
import { db, ref, get, onValue, push, set } from '@/lib/firebase';
import AutoSpinModal from './AutoSpinModal';
import { FreeGameIntroOverlay, FreeGameWinOverlay } from './SuperAceFreeGameOverlay';
import { superAceVoice, type WinSound } from '@/lib/superAceVoice';
import betClickSoundSrc from '@/lib/Super_ace_Bet_Icon_Click_Sound.mp3';

type CardSymbol = 'A' | 'K' | 'Q' | 'J' | 'S' | 'SCATTER' | 'GOLD' | 'CLUBS' | 'SPADES' | 'DIAMONDS' | 'HEARTS';

interface CardCell {
  symbol: CardSymbol;
  id: number;
  isGolden?: boolean;
  isScatter?: boolean;
  transformedFromGolden?: boolean;
  isDropping?: boolean;
  isShufflingOut?: boolean;
}

interface SuperAceGameProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  loaded?: boolean;
}

const ROWS = 4;
const COLS = 5;
const GRID_SIZE = ROWS * COLS;

const BASE_SYMBOLS: CardSymbol[] = ['A', 'K', 'Q', 'J', 'S', 'CLUBS', 'SPADES', 'DIAMONDS', 'HEARTS'];
const ALL_SYMBOLS: CardSymbol[] = [...BASE_SYMBOLS, 'SCATTER', 'GOLD'];

// Scatter image
const SCATTER_IMAGE = 'https://i.postimg.cc/HLBwSBdk/Screenshot-2026-09-23-22-56-50-864-com-android-chrome-edit.jpg';
// Golden Card image
const GOLDEN_CARD_IMAGE = 'https://i.postimg.cc/v81KV6t8/IMG-20260923-123931.jpg';
// Payment method logo (for win banner placement)
const PAYMENT_LOGO_IMAGE = 'https://i.postimg.cc/bNcmSVvD/images-(5).jpg';

interface CardStyle {
  label: string;
  payout: number;
  suitChar: string;
  rankChar: string;
  suitColor: string;
  glowColor: string;
  gradient: string;
  borderColor: string;
  image: string;
}

const SYMBOL_STYLES: Record<CardSymbol, CardStyle> = {
  A: {
    label: 'ACE',
    payout: 5,
    suitChar: '★',
    rankChar: 'A',
    suitColor: '#ffd700',
    glowColor: 'rgba(255,215,0,0.6)',
    gradient: '#fffdf5',
    borderColor: '#e6b800',
    image: 'https://i.postimg.cc/2jcpykzX/IMG-20260923-123618.jpg',
  },
  K: {
    label: 'KING',
    payout: 4,
    suitChar: '♠',
    rankChar: 'K',
    suitColor: '#a8c8ff',
    glowColor: 'rgba(168,200,255,0.6)',
    gradient: '#f8fbff',
    borderColor: '#4384c6',
    image: 'https://i.postimg.cc/J45kZ22d/IMG-20260923-123604.jpg',
  },
  Q: {
    label: 'QUEEN',
    payout: 3,
    suitChar: '♥',
    rankChar: 'Q',
    suitColor: '#ff6b9d',
    glowColor: 'rgba(255,107,157,0.6)',
    gradient: '#fff8fa',
    borderColor: '#d84b72',
    image: 'https://i.postimg.cc/x17TzGnp/IMG-20260923-123742.jpg',
  },
  J: {
    label: 'JACK',
    payout: 2.5,
    suitChar: '♣',
    rankChar: 'J',
    suitColor: '#4ade80',
    glowColor: 'rgba(74,222,128,0.6)',
    gradient: '#f7fff9',
    borderColor: '#38a866',
    image: 'https://i.postimg.cc/VsDwt9FD/IMG-20260923-123729.jpg',
  },
  S: {
    label: 'WILD',
    payout: 2,
    suitChar: '♦',
    rankChar: 'S',
    suitColor: '#e879f9',
    glowColor: 'rgba(232,121,249,0.6)',
    gradient: '#fcf8ff',
    borderColor: '#9b55bd',
    image: 'https://i.postimg.cc/xC1xVmN3/IMG-20260923-123822.jpg',
  },
  SCATTER: {
    label: 'SCATTER',
    payout: 0,
    suitChar: '✦',
    rankChar: '★',
    suitColor: '#ff9500',
    glowColor: 'rgba(255,149,0,0.7)',
    gradient: '#fff5e6',
    borderColor: '#cc7700',
    image: SCATTER_IMAGE,
  },
  GOLD: {
    label: 'GOLD CARD',
    payout: 0,
    suitChar: '♛',
    rankChar: 'G',
    suitColor: '#ffaa00',
    glowColor: 'rgba(255,170,0,0.7)',
    gradient: '#fffaf0',
    borderColor: '#cc8800',
    image: GOLDEN_CARD_IMAGE,
  },
  CLUBS: {
    label: 'CLUBS',
    payout: 1.5,
    suitChar: '♣',
    rankChar: 'C',
    suitColor: '#2dd4bf',
    glowColor: 'rgba(45,212,191,0.6)',
    gradient: '#f0fdfb',
    borderColor: '#0f9b8b',
    image: 'https://i.postimg.cc/vThp1tC1/IMG-20261025-172347.png',
  },
  SPADES: {
    label: 'SPADES',
    payout: 1.8,
    suitChar: '♠',
    rankChar: 'P',
    suitColor: '#94a3b8',
    glowColor: 'rgba(148,163,184,0.6)',
    gradient: '#f8fafc',
    borderColor: '#475569',
    image: 'https://i.postimg.cc/J45kZ22d/IMG-20260923-123604.jpg',
  },
  DIAMONDS: {
    label: 'DIAMONDS',
    payout: 1.6,
    suitChar: '♦',
    rankChar: 'D',
    suitColor: '#38bdf8',
    glowColor: 'rgba(56,189,248,0.6)',
    gradient: '#f0f9ff',
    borderColor: '#0284c7',
    image: 'https://i.postimg.cc/3NYsJcfQ/IMG-20261025-172446.png',
  },
  HEARTS: {
    label: 'HEARTS',
    payout: 1.7,
    suitChar: '♥',
    rankChar: 'H',
    suitColor: '#fb7185',
    glowColor: 'rgba(251,113,133,0.6)',
    gradient: '#fff1f2',
    borderColor: '#e11d48',
    image: 'https://i.postimg.cc/ZnH19xXv/IMG-20261025-172423.png',
  },
};

const BASE_MULTIPLIERS = [1, 2, 3, 5];
const FREE_GAME_MULTIPLIERS = [2, 4, 6, 10];
const BET_OPTIONS = [1000, 50, 5, 500, 40, 3, 200, 30, 2, 100, 20, 1, 80, 10, 0.5];
const SCATTER_WEIGHT = 0.04;
const GOLD_WEIGHT = 0.06;
const KING_CARD_SOUND_SRC = '/Super_Ace_King_card_sound.mp3';
const HEARTS_WIN_SOUND_SRC = '/Super_Ace_Hearts_Card_sound.mp3';
const SPIN_SOUND_SRC = '/Super_Ace_Spin_sound.mp3';
const DOUBLE_SOUND_SRC = '/Super_Ace_Double_Sound.mp3';
const THIRD_TIME_SOUND_SRC = '/Super_Ace_third_time_sound.mp3';
const FOURTH_TIME_SOUND_SRC = '/Super_Ace_Fourth_time_sound.mp3';
const FOUR_TIME_SOUND_SRC = '/Super_Ace_Four_time.mp3';
const SIX_TIME_SOUND_SRC = '/Super_Ace_6_time.mp3';
const TEN_TIME_SOUND_SRC = '/Super_Ace_Ten_time.mp3';
const JACK_WIN_SOUND_SRC = '/Super_Ace_jack_Card_Sound copy.mp3';
const ACE_WIN_SOUND_SRC = '/Super_Ace_ace_card_sound.mp3';
const CLUB_WIN_SOUND_SRC = '/Super_Ace_Club.mp3';
const WILD_WIN_SOUND_SRC = '/Super_Ace_Wild_card_Sound.mp3';
const QUEEN_WIN_SOUND_SRC = '/Super_Ace_Queen_Sound.mp3';
const DIAMONDS_WIN_SOUND_SRC = '/Super_Ace_Diamonds_sound.mp3';
const SPADES_WIN_SOUND_SRC = '/Super_Ace_Gold_card_sound.mp3';
const CARD_DROP_SOUND_SRC = '/Super_Ace_Broard_Load_Sound_.mp3';

const CARD_SOUND_MAP: Partial<Record<CardSymbol, string>> = {
  K: KING_CARD_SOUND_SRC,
  J: JACK_WIN_SOUND_SRC,
  A: ACE_WIN_SOUND_SRC,
  CLUBS: CLUB_WIN_SOUND_SRC,
  Q: QUEEN_WIN_SOUND_SRC,
  HEARTS: HEARTS_WIN_SOUND_SRC,
  DIAMONDS: DIAMONDS_WIN_SOUND_SRC,
  SPADES: SPADES_WIN_SOUND_SRC,
  S: WILD_WIN_SOUND_SRC,
};

const MULTIPLIER_SOUND_SRC: Partial<Record<number, string>> = {
  2: DOUBLE_SOUND_SRC,
  3: THIRD_TIME_SOUND_SRC,
  4: FOUR_TIME_SOUND_SRC,
  5: FOURTH_TIME_SOUND_SRC,
  6: SIX_TIME_SOUND_SRC,
  10: TEN_TIME_SOUND_SRC,
};

// Persistent scatter spin counter — survives across renders
let scatterSpinCounter = 0;
let nextScatterAt = -1;

function randomSymbol(): CardSymbol {
  const roll = Math.random();
  if (roll < SCATTER_WEIGHT) return 'SCATTER';
  if (roll < SCATTER_WEIGHT + GOLD_WEIGHT) return 'GOLD';
  return BASE_SYMBOLS[Math.floor(Math.random() * BASE_SYMBOLS.length)];
}

function randomNonScatterSymbol(): CardSymbol {
  const roll = Math.random();
  if (roll < GOLD_WEIGHT) return 'GOLD';
  return BASE_SYMBOLS[Math.floor(Math.random() * BASE_SYMBOLS.length)];
}

function randomInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDifficultyPayout(diff: SuperAceDifficulty, betAmount: number): number {
  const cfg = DIFFICULTY_CONFIGS[diff];
  const multiplier = cfg.payoutMin + Math.random() * (cfg.payoutMax - cfg.payoutMin);
  return parseFloat((betAmount * multiplier).toFixed(2));
}

function shouldTriggerScatter(diff: SuperAceDifficulty): boolean {
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

function generateGrid(): CardCell[] {
  return Array.from({ length: GRID_SIZE }, (_, i) => ({
    symbol: randomSymbol(),
    id: i,
    isScatter: false,
    isGolden: false,
    isDropping: true,
  }));
}

function generateInitialGrid(): CardCell[] {
  const columnSymbols: CardSymbol[] = ['A', 'K', 'Q', 'J', 'S'];
  return Array.from({ length: GRID_SIZE }, (_, i) => ({
    symbol: columnSymbols[i % COLS],
    id: i,
    isScatter: false,
    isGolden: false,
    isDropping: true,
  }));
}

function generateNonScatterGrid(): CardCell[] {
  return Array.from({ length: GRID_SIZE }, (_, i) => ({
    symbol: randomNonScatterSymbol(),
    id: i,
    isScatter: false,
    isGolden: false,
    isDropping: true,
  }));
}

function generateNoMatchGrid(): CardCell[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const testGrid = Array.from({ length: GRID_SIZE }, (_, i) => ({
      symbol: randomNonScatterSymbol(),
      id: i,
      isScatter: false,
      isGolden: false,
    }));
    const { matched } = findMatches(testGrid);
    if (matched.size === 0) return testGrid;
  }
  return Array.from({ length: GRID_SIZE }, (_, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    return {
      symbol: BASE_SYMBOLS[(row * 2 + col) % BASE_SYMBOLS.length] as CardSymbol,
      id: i,
      isScatter: false,
      isGolden: false,
    };
  });
}

function refillGrid(grid: CardCell[], matched: Set<number>): CardCell[] {
  const nextGrid: CardCell[] = Array.from({ length: GRID_SIZE }, (_, index) => ({
    ...grid[index],
    isDropping: false,
    isShufflingOut: false,
  }));

  for (let col = 0; col < COLS; col++) {
    const survivors: CardCell[] = [];
    for (let row = ROWS - 1; row >= 0; row--) {
      const index = row * COLS + col;
      if (!matched.has(index)) survivors.push({ ...grid[index], isDropping: false, isShufflingOut: false });
    }

    for (let row = ROWS - 1; row >= 0; row--) {
      const index = row * COLS + col;
      const survivor = survivors[ROWS - 1 - row];
      nextGrid[index] = survivor ?? {
        symbol: randomNonScatterSymbol(),
        id: Date.now() + index + Math.random(),
        isScatter: false,
        isGolden: false,
        isDropping: true,
        isShufflingOut: false,
      };
    }
  }

  return nextGrid;
}

function countScatters(grid: CardCell[]): number {
  return grid.filter((c) => c.symbol === 'SCATTER' || c.isScatter).length;
}

function findGoldenCards(grid: CardCell[]): number[] {
  const golden: number[] = [];
  grid.forEach((c, i) => {
    if (c.symbol === 'GOLD' || c.isGolden) golden.push(i);
  });
  return golden;
}

// Find all matching groups of 3+ adjacent (horizontally or vertically) cards.
// Wilds (S) match with any symbol. Golden Cards in a match transform into Wilds.
function findMatches(grid: CardCell[]): { matched: Set<number>; goldenInMatch: number[] } {
  const matched = new Set<number>();
  const visited = new Set<number>();
  const goldenInMatch: number[] = [];

  const getNeighbors = (idx: number): number[] => {
    const row = Math.floor(idx / COLS);
    const col = idx % COLS;
    const neighbors: number[] = [];
    if (row > 0) neighbors.push(idx - COLS);
    if (row < ROWS - 1) neighbors.push(idx + COLS);
    if (col > 0) neighbors.push(idx - 1);
    if (col < COLS - 1) neighbors.push(idx + 1);
    return neighbors;
  };

  const getEffectiveSymbol = (cell: CardCell): CardSymbol | 'WILD' => {
    if (cell.symbol === 'S') return 'WILD';
    if (cell.symbol === 'GOLD' || cell.isGolden) return 'WILD';
    if (cell.transformedFromGolden) return 'WILD';
    return cell.symbol;
  };

  // Scatter and Gold don't form normal clusters — they're special
  const isClusterable = (cell: CardCell): boolean => {
    return cell.symbol !== 'SCATTER' && !cell.isScatter;
  };

  for (let i = 0; i < GRID_SIZE; i++) {
    if (visited.has(i) || !isClusterable(grid[i])) continue;

    const effectiveSym = getEffectiveSymbol(grid[i]);
    if (effectiveSym === 'WILD') {
      // Wilds start their own cluster — match with any adjacent non-wild, non-special
      // We'll handle wild-containing clusters separately
    }

    const cluster: number[] = [i];
    const queue = [i];
    visited.add(i);
    let clusterSymbol: CardSymbol | 'WILD' = effectiveSym;

    // If the seed is a wild, find the dominant adjacent symbol
    if (effectiveSym === 'WILD') {
      // Find first non-wild neighbor to determine cluster symbol
      for (const n of getNeighbors(i)) {
        const nSym = getEffectiveSymbol(grid[n]);
        if (nSym !== 'WILD' && isClusterable(grid[n])) {
          clusterSymbol = nSym as CardSymbol;
          break;
        }
      }
    }

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const n of getNeighbors(cur)) {
        if (visited.has(n) || !isClusterable(grid[n])) continue;
        const nSym = getEffectiveSymbol(grid[n]);
        // Match if same symbol, or either is wild
        if (nSym === clusterSymbol || nSym === 'WILD' || clusterSymbol === 'WILD') {
          if (clusterSymbol === 'WILD' && nSym !== 'WILD') {
            clusterSymbol = nSym;
          }
          visited.add(n);
          cluster.push(n);
          queue.push(n);
        }
      }
    }

    if (cluster.length >= 3) {
      cluster.forEach((idx) => matched.add(idx));
      // Track golden cards in the match
      grid.forEach((cell, idx) => {
        if (matched.has(idx) && (cell.symbol === 'GOLD' || cell.isGolden)) {
          goldenInMatch.push(idx);
        }
      });
    }
  }
  return { matched, goldenInMatch };
}

export type SuperAceDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

interface DifficultyConfig {
  label: string;
  payoutMin: number;
  payoutMax: number;
  scatterMin: number;
  scatterMax: number;
  winRate: number;
  deadSpinPercent: number;
}

export const DIFFICULTY_CONFIGS: Record<SuperAceDifficulty, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    payoutMin: 50,
    payoutMax: 100,
    scatterMin: 5,
    scatterMax: 15,
    winRate: 90,
    deadSpinPercent: 10,
  },
  medium: {
    label: 'Medium',
    payoutMin: 5,
    payoutMax: 10,
    scatterMin: 15,
    scatterMax: 30,
    winRate: 80,
    deadSpinPercent: 20,
  },
  hard: {
    label: 'Hard',
    payoutMin: 0.1,
    payoutMax: 1.5,
    scatterMin: 50,
    scatterMax: 100,
    winRate: 70,
    deadSpinPercent: 30,
  },
  impossible: {
    label: 'Impossible',
    payoutMin: 0.1,
    payoutMax: 0.7,
    scatterMin: 500,
    scatterMax: 1000,
    winRate: 60,
    deadSpinPercent: 40,
  },
};

interface SuperAceSettings {
  rtp: number;
  winRate: number;
  multX1: number;
  multX2: number;
  multX3: number;
  multX5: number;
  overrideEnabled: boolean;
  forceOutcome: 'none' | 'win' | 'loss';
  difficulty: SuperAceDifficulty;
}

const DEFAULT_SETTINGS: SuperAceSettings = {
  rtp: 85,
  winRate: 40,
  multX1: 1,
  multX2: 2,
  multX3: 3,
  multX5: 5,
  overrideEnabled: false,
  forceOutcome: 'none',
  difficulty: 'medium',
};

export default function SuperAceGame({ balance, onBetPlaced, onWin, loaded = true }: SuperAceGameProps) {
  const [grid, setGrid] = useState<CardCell[]>(loaded ? () => generateInitialGrid() : []);
  const [bet, setBet] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [matchedCells, setMatchedCells] = useState<Set<number>>(new Set());
  const [winningCells, setWinningCells] = useState<Set<number>>(new Set());
  const [chainLevel, setChainLevel] = useState(0);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [totalWin, setTotalWin] = useState(0);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [bonusTriggered, setBonusTriggered] = useState(false);
  const [settings, setSettings] = useState<SuperAceSettings>(DEFAULT_SETTINGS);

  // Free Game state
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinsTotal, setFreeSpinsTotal] = useState(0);
  const [inFreeGame, setInFreeGame] = useState(false);
  const [freeGameWin, setFreeGameWin] = useState(0);
  const [scatterTrigger, setScatterTrigger] = useState(false);
  const [freeGameIntro, setFreeGameIntro] = useState<{ spins: number } | null>(null);
  const [freeGameSummary, setFreeGameSummary] = useState<number | null>(null);

  // Golden card transform animation
  const [goldenTransforming, setGoldenTransforming] = useState<Set<number>>(new Set());

  // Win banner display
  const [showWinBanner, setShowWinBanner] = useState(false);
  const [displayWin, setDisplayWin] = useState(0);
  const [showAutoSpin, setShowAutoSpin] = useState(false);
  const [showBetMenu, setShowBetMenu] = useState(false);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState(0);

  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<SuperAceSettings>(DEFAULT_SETTINGS);
  const freeSpinsRemainingRef = useRef<number>(0);
  const targetPayoutRef = useRef<number>(0);
  const tenSpinCountRef = useRef(0);
  const tenSpinWinRef = useRef(0);
  const autoSpinRef = useRef<() => void>(() => {});
  const autoSpinRemainingRef = useRef(0);
  const winCountIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const winBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const cardDropSoundRef = useRef<HTMLAudioElement | null>(null);
  const betClickSoundRef = useRef<HTMLAudioElement | null>(null);

  const { user } = useAuth();
  const { t, bn } = useLanguage();

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { freeSpinsRemainingRef.current = freeSpinsRemaining; }, [freeSpinsRemaining]);
  useEffect(() => { autoSpinRemainingRef.current = autoSpinRemaining; }, [autoSpinRemaining]);

  useEffect(() => {
    superAceVoice.preloadWinSounds([...Object.values(CARD_SOUND_MAP), ...Object.values(MULTIPLIER_SOUND_SRC)].filter((src): src is string => Boolean(src)));
  }, []);

  useEffect(() => {
    const audio = new Audio(SPIN_SOUND_SRC);
    audio.preload = 'auto';
    spinSoundRef.current = audio;

    const dropAudio = new Audio(CARD_DROP_SOUND_SRC);
    dropAudio.preload = 'auto';
    cardDropSoundRef.current = dropAudio;

    const betAudio = new Audio(betClickSoundSrc);
    betAudio.preload = 'auto';
    betClickSoundRef.current = betAudio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      spinSoundRef.current = null;
      dropAudio.pause();
      dropAudio.currentTime = 0;
      cardDropSoundRef.current = null;
      betAudio.pause();
      betAudio.currentTime = 0;
      betClickSoundRef.current = null;
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      if (chainTimeoutRef.current) clearTimeout(chainTimeoutRef.current);
      if (winCountIntervalRef.current) clearInterval(winCountIntervalRef.current);
      if (winBannerTimeoutRef.current) clearTimeout(winBannerTimeoutRef.current);
    };
  }, []);

  // When loading finishes, drop the initial grid
  useEffect(() => {
    if (loaded && grid.length === 0) {
      setGrid(generateInitialGrid());
      if (cardDropSoundRef.current) {
        cardDropSoundRef.current.currentTime = 0;
        cardDropSoundRef.current.play().catch(() => {});
      }
    }
  }, [loaded, grid.length]);

  const animateWinAmount = useCallback((amount: number) => {
    if (winCountIntervalRef.current) clearInterval(winCountIntervalRef.current);
    setDisplayWin(0);
    const duration = Math.min(1200, Math.max(450, amount * 18));
    const startedAt = Date.now();
    winCountIntervalRef.current = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayWin(parseFloat((amount * eased).toFixed(2)));
      if (progress >= 1 && winCountIntervalRef.current) {
        clearInterval(winCountIntervalRef.current);
        winCountIntervalRef.current = null;
      }
    }, 16);
  }, []);

  // Auto-spin: trigger next spin when previous finishes
  useEffect(() => {
    if (spinning || autoSpinRemaining <= 0 || inFreeGame || freeGameIntro || freeGameSummary !== null) return;
    if (balance >= bet) {
      const timer = setTimeout(() => autoSpinRef.current(), 1000);
      return () => clearTimeout(timer);
    }
    setAutoSpinRemaining(0);
  }, [spinning, autoSpinRemaining, inFreeGame, freeGameIntro, freeGameSummary, balance, bet]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const snap = await get(ref(db, 'game_settings/superace'));
      if (snap.exists()) {
        const s = snap.val();
        setSettings({
          rtp: s.rtp ?? 85,
          winRate: s.winRate ?? 40,
          multX1: s.multX1 ?? 1,
          multX2: s.multX2 ?? 2,
          multX3: s.multX3 ?? 3,
          multX5: s.multX5 ?? 5,
          overrideEnabled: s.overrideEnabled ?? false,
          forceOutcome: s.forceOutcome ?? 'none',
          difficulty: (s.difficulty as SuperAceDifficulty) ?? 'medium',
        });
      }
    })();
    // Live listener so admin changes take effect immediately
    unsub = onValue(ref(db, 'game_settings/superace'), (snap) => {
      if (snap.exists()) {
        const s = snap.val();
        setSettings({
          rtp: s.rtp ?? 85,
          winRate: s.winRate ?? 40,
          multX1: s.multX1 ?? 1,
          multX2: s.multX2 ?? 2,
          multX3: s.multX3 ?? 3,
          multX5: s.multX5 ?? 5,
          overrideEnabled: s.overrideEnabled ?? false,
          forceOutcome: s.forceOutcome ?? 'none',
          difficulty: (s.difficulty as SuperAceDifficulty) ?? 'medium',
        });
      }
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const activeMults = inFreeGame ? FREE_GAME_MULTIPLIERS : [settings.multX1, settings.multX2, settings.multX3, settings.multX5];

  const processChain = useCallback((
    currentGrid: CardCell[],
    level: number,
    accumulatedWin: number,
    mults: number[],
    isFree: boolean,
    freeAccumulated: number,
  ) => {
    const { matched, goldenInMatch } = findMatches(currentGrid);

    if (matched.size === 0 || level >= mults.length) {
      setSpinning(false);
      setMatchedCells(new Set());
      setWinningCells(new Set());
      setChainLevel(0);

      // Check for scatters after chain resolves
    const scatters = countScatters(currentGrid);

    if (accumulatedWin > 0) {
      let finalWin = accumulatedWin;
      if (!isFree) {
        finalWin = targetPayoutRef.current;
      }
      onWin(finalWin);
      setLastWin(finalWin);
      setTotalWin(finalWin);
      animateWinAmount(finalWin);
      setResultMsg(`${t('superAce.totalWin')}: ৳${bn(finalWin.toFixed(2))}`);
      setShowWinBanner(true);
      if (winBannerTimeoutRef.current) clearTimeout(winBannerTimeoutRef.current);
      winBannerTimeoutRef.current = setTimeout(() => setShowWinBanner(false), 4000);

      if (isFree) {
        const newFreeWin = parseFloat((freeAccumulated + accumulatedWin).toFixed(2));
        setFreeGameWin(newFreeWin);
      }

      if (user) {
        const betRef = push(ref(db, 'superace_bets'));
        set(betRef, {
          userId: user.uid,
          userName: user.name,
          betAmount: isFree ? 0 : bet,
          payout: finalWin,
          freeGame: isFree,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    } else {
      setResultMsg('No match — try again!');
      setLastWin(null);
      setTotalWin(0);
      setDisplayWin(0);
      if (user) {
        const betRef = push(ref(db, 'superace_bets'));
        set(betRef, {
          userId: user.uid,
          userName: user.name,
          betAmount: isFree ? 0 : bet,
          payout: 0,
          freeGame: isFree,
          timestamp: Date.now(),
        }).catch(() => {});
      }
    }

    // Trigger free spins if 3+ scatters — gated by difficulty
    const currentDiff = settingsRef.current.difficulty;
    if (scatters >= 3) superAceVoice.cancelPending();
    if (scatters >= 3 && !isFree) {
      const maxFreeSpins = currentDiff === 'impossible' ? 1 : (scatters === 3 ? 10 : scatters === 4 ? 15 : 20);
      setFreeSpinsRemaining(maxFreeSpins);
      setFreeSpinsTotal(maxFreeSpins);
      setInFreeGame(true);
      setFreeGameWin(0);
      setScatterTrigger(true);
      setFreeGameIntro({ spins: maxFreeSpins });
      setResultMsg(`${scatters} Scatters! ${maxFreeSpins} Free Spin${maxFreeSpins > 1 ? 's' : ''}!`);
      setTimeout(() => setScatterTrigger(false), 3000);
    } else if (scatters >= 3 && isFree && currentDiff !== 'impossible') {
      const extra = scatters === 3 ? 5 : scatters === 4 ? 10 : 15;
      setFreeSpinsRemaining((prev) => Math.min(prev + extra, 50));
      setFreeSpinsTotal((prev) => Math.min(prev + extra, 50));
      setResultMsg(`${scatters} Scatters! +${extra} Free Spins!`);
      setScatterTrigger(true);
      setTimeout(() => setScatterTrigger(false), 3000);
    }

    // If in free game and no more free spins, end it with Big Win
    if (isFree && freeSpinsRemainingRef.current <= 0) {
      setInFreeGame(false);
      setFreeSpinsRemaining(0);
      setFreeSpinsTotal(0);
      const totalFree = parseFloat((freeAccumulated + (accumulatedWin || 0)).toFixed(2));
      if (totalFree > 0) {
        setResultMsg(`Free Games Complete! Won ৳${bn(totalFree.toFixed(2))}`);
        setFreeGameSummary(totalFree);
        setShowWinBanner(true);
        if (winBannerTimeoutRef.current) clearTimeout(winBannerTimeoutRef.current);
        winBannerTimeoutRef.current = setTimeout(() => setShowWinBanner(false), 5000);
      }
    }

    // 10-spin accumulation: show combined total with Big Win
    if (!isFree) {
      tenSpinCountRef.current += 1;
      const spinWin = accumulatedWin > 0 ? (targetPayoutRef.current || 0) : 0;
      tenSpinWinRef.current = parseFloat((tenSpinWinRef.current + spinWin).toFixed(2));
      if (tenSpinCountRef.current >= 10) {
        const totalTen = tenSpinWinRef.current;
        tenSpinCountRef.current = 0;
        tenSpinWinRef.current = 0;
        if (totalTen > 0) {
          setResultMsg(`10 Spin Total: ৳${bn(totalTen.toFixed(2))}`);
          setShowWinBanner(true);
          if (winBannerTimeoutRef.current) clearTimeout(winBannerTimeoutRef.current);
          winBannerTimeoutRef.current = setTimeout(() => setShowWinBanner(false), 5000);
        }
      }
    }

      return;
    }

    const mult = mults[level];
    const matchCount = matched.size;

    // Find dominant symbol in matches for payout calc
    const symbolCounts: Record<string, number> = {};
    matched.forEach((idx) => {
      const sym = currentGrid[idx].symbol;
      if (sym === 'SCATTER' || sym === 'GOLD') return;
      symbolCounts[sym] = (symbolCounts[sym] || 0) + 1;
    });

    let bestSymbol: CardSymbol = 'S';
    let bestPayout = 0;
    Object.entries(symbolCounts).forEach(([sym, count]) => {
      const payout = SYMBOL_STYLES[sym as CardSymbol].payout * count * mult;
      if (payout > bestPayout) {
        bestPayout = payout;
        bestSymbol = sym as CardSymbol;
      }
    });

    // If no standard symbols matched (all wilds), use wild payout
    if (bestPayout === 0 && matchCount >= 3) {
      bestSymbol = 'S';
      bestPayout = SYMBOL_STYLES.S.payout * matchCount * mult;
    }

    const totalMultSum = mults.reduce((a, b) => a + b, 0);
    let roundWin = isFree
      ? parseFloat((bet * bestPayout / 10).toFixed(2))
      : parseFloat((targetPayoutRef.current * mult / totalMultSum).toFixed(2));
    const newAccumulated = parseFloat((accumulatedWin + roundWin).toFixed(2));

    setMatchedCells(new Set(matched));
    setWinningCells(new Set(matched));
    setChainLevel(level + 1);
    setLastWin(roundWin);
    const winSounds: WinSound[] = [];
    const cardSound = bestSymbol !== 'S' ? CARD_SOUND_MAP[bestSymbol] : undefined;
    if (cardSound && level + 1 <= 4) {
      winSounds.push({ file: cardSound });
    }
    const multiplierSound = MULTIPLIER_SOUND_SRC[mult];
    if (multiplierSound) {
      winSounds.push({ file: multiplierSound });
    } else if (level + 1 >= 5) {
      winSounds.push(superAceVoice.ordinalSpeech(level + 1));
    }
    if (winSounds.length > 0) {
      spinSoundRef.current?.pause();
      superAceVoice.playWinSequence(winSounds);
    }
    setResultMsg(`${SYMBOL_STYLES[bestSymbol].label} x${matchCount} — ${mult}x multiplier! +৳${roundWin.toFixed(2)}`);

    // Handle Golden Card transformation
    if (goldenInMatch.length > 0) {
      const transforming = new Set(goldenInMatch);
      setGoldenTransforming(transforming);
      setResultMsg(`Golden Card → Wild! +৳${roundWin.toFixed(2)}`);

      // After showing the golden transform, convert them to wilds in the grid
      chainTimeoutRef.current = setTimeout(() => {
        const transformedGrid = currentGrid.map((cell, idx) =>
          transforming.has(idx)
            ? { ...cell, symbol: 'S' as CardSymbol, isGolden: false, transformedFromGolden: true, id: cell.id + 5000 }
            : cell
        );
        setGrid(transformedGrid);
        setGoldenTransforming(new Set());

        // After transformation, remove matched cards and drop new ones
        chainTimeoutRef.current = setTimeout(() => {
          const newGrid = refillGrid(transformedGrid, matched);
          setGrid(newGrid);
          setMatchedCells(new Set());
          setWinningCells(new Set());
          chainTimeoutRef.current = setTimeout(() => {
            processChain(newGrid, level + 1, newAccumulated, mults, isFree, freeAccumulated);
          }, 300);
        }, 600);
      }, 800);
    } else {
      // Normal flow — remove matched cards and drop new ones
      chainTimeoutRef.current = setTimeout(() => {
        const newGrid = refillGrid(currentGrid, matched);
        setGrid(newGrid);
        setMatchedCells(new Set());
        setWinningCells(new Set());
        chainTimeoutRef.current = setTimeout(() => {
          processChain(newGrid, level + 1, newAccumulated, mults, isFree, freeAccumulated);
        }, 300);
      }, 800);
    }
  }, [bet, onWin, user]);

  const spin = useCallback(() => {
    if (spinning || freeGameSummary !== null || (!inFreeGame && balance < bet) || bet <= 0) {
      if (autoSpinRemainingRef.current > 0) setAutoSpinRemaining(0);
      return;
    }

    setSpinning(true);
    if (spinSoundRef.current) {
      spinSoundRef.current.currentTime = 0;
      spinSoundRef.current.play().catch(() => {});
    }
    setGrid(generateGrid);
    setResultMsg(null);
    setLastWin(null);
    setTotalWin(0);
    setBonusTriggered(false);
    setChainLevel(0);
    setMatchedCells(new Set());
    setWinningCells(new Set());
    setGoldenTransforming(new Set());

    if (!inFreeGame) {
      onBetPlaced(bet);
      addTransaction({ id: `${Date.now()}-superace-bet`, type: 'bet', amount: bet, timestamp: Date.now() });
      if (autoSpinRemainingRef.current > 0) {
        setAutoSpinRemaining((prev) => prev - 1);
      }
    } else {
      setFreeSpinsRemaining((prev) => prev - 1);
    }

    const currentSettings = settingsRef.current;
    const mults = inFreeGame ? FREE_GAME_MULTIPLIERS : [currentSettings.multX1, currentSettings.multX2, currentSettings.multX3, currentSettings.multX5];

    const diffCfg = DIFFICULTY_CONFIGS[currentSettings.difficulty];

    let shouldWin: boolean;
    if (currentSettings.overrideEnabled && currentSettings.forceOutcome !== 'none') {
      shouldWin = currentSettings.forceOutcome === 'win';
    } else if (inFreeGame) {
      shouldWin = Math.random() < 0.65;
    } else {
      // RTP controls win probability: higher RTP = more wins, lower RTP = more dead spins
      const rtpWinChance = currentSettings.rtp / 100;
      const difficultyDeadSpin = diffCfg.deadSpinPercent / 100;
      // Blend RTP-controlled chance with difficulty dead-spin rate
      const effectiveDeadSpin = Math.max(difficultyDeadSpin, 1 - rtpWinChance);
      const isDeadSpin = Math.random() < effectiveDeadSpin;
      shouldWin = !isDeadSpin;
    }

    // Pre-determine the difficulty-based payout for this spin
    if (!inFreeGame) {
      targetPayoutRef.current = shouldWin ? getDifficultyPayout(currentSettings.difficulty, bet) : 0;
    }

    // Scatter frequency controlled by difficulty
    const forceScatters = !inFreeGame && shouldTriggerScatter(currentSettings.difficulty);
    const forceScatterCount = forceScatters ? 3 : 0;

    const generateOutcomeGrid = (): CardCell[] => {
      if (!shouldWin) {
        const baseGrid = generateNoMatchGrid();
        if (forceScatterCount > 0) {
          const positions = new Set<number>();
          while (positions.size < forceScatterCount) {
            positions.add(Math.floor(Math.random() * GRID_SIZE));
          }
          positions.forEach((pos) => {
            baseGrid[pos] = { ...baseGrid[pos], symbol: 'SCATTER' as CardSymbol, isScatter: true };
          });
        }
        return baseGrid;
      }

      const grid = Array.from({ length: GRID_SIZE }, (_, i) => ({
        symbol: randomNonScatterSymbol(),
        id: i,
        isScatter: false,
        isGolden: false,
      }));

      if (forceScatterCount > 0) {
        const positions = new Set<number>();
        while (positions.size < forceScatterCount) {
          positions.add(Math.floor(Math.random() * GRID_SIZE));
        }
        positions.forEach((pos) => {
          grid[pos] = { ...grid[pos], symbol: 'SCATTER' as CardSymbol, isScatter: true };
        });
      }

      const sym = BASE_SYMBOLS[Math.floor(Math.random() * BASE_SYMBOLS.length)];
      const startRow = Math.floor(Math.random() * ROWS);
      const startCol = Math.floor(Math.random() * (COLS - 2));
      const startIdx = startRow * COLS + startCol;
      if (grid[startIdx].symbol !== 'SCATTER')
        grid[startIdx] = { symbol: sym, id: grid[startIdx].id };
      if (grid[startIdx + 1].symbol !== 'SCATTER')
        grid[startIdx + 1] = { symbol: sym, id: grid[startIdx + 1].id };
      if (grid[startIdx + 2].symbol !== 'SCATTER')
        grid[startIdx + 2] = { symbol: sym, id: grid[startIdx + 2].id };

      if (Math.random() < 0.4) {
        const goldPos = startIdx + 3 < GRID_SIZE && grid[startIdx + 3].symbol !== 'SCATTER'
          ? startIdx + 3
          : startIdx - 1 >= 0 && grid[startIdx - 1].symbol !== 'SCATTER'
          ? startIdx - 1
          : -1;
        if (goldPos >= 0) {
          grid[goldPos] = { ...grid[goldPos], symbol: 'GOLD' as CardSymbol, isGolden: true };
        }
      }

      return grid;
    };

    const dropTimer = setTimeout(() => {
      spinIntervalRef.current = null;
      const finalGrid = generateOutcomeGrid().map((cell) => ({ ...cell, isDropping: false, isShufflingOut: false }));
      setGrid(finalGrid);
      const currentFreeAccumulated = inFreeGame ? freeGameWin : 0;
      processChain(finalGrid, 0, 0, mults, inFreeGame, currentFreeAccumulated);
    }, 700);
    spinIntervalRef.current = dropTimer;
  }, [spinning, balance, bet, inFreeGame, freeGameWin, freeGameSummary, onBetPlaced, processChain]);

  useEffect(() => {
    if (inFreeGame && freeSpinsRemaining > 0 && !spinning && !freeGameIntro && freeGameSummary === null) {
      const timer = setTimeout(() => {
        spin();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [inFreeGame, freeSpinsRemaining, spinning, freeGameIntro, freeGameSummary, spin]);

  // Safety net: force-end free game if spins are exhausted
  useEffect(() => {
    if (inFreeGame && freeSpinsRemaining === 0 && !spinning) {
      setInFreeGame(false);
      setFreeSpinsTotal(0);
    }
  }, [inFreeGame, freeSpinsRemaining, spinning]);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden min-h-0 relative bg-black"
    >
      <style>{`
        @keyframes super-ace-card-shuffle {
          0% { transform: perspective(700px) rotateY(0deg) translateY(0) scale(1); }
          35% { transform: perspective(700px) rotateY(90deg) translateY(-3px) scale(.96); }
          65% { transform: perspective(700px) rotateY(180deg) translateY(1px) scale(.98); }
          100% { transform: perspective(700px) rotateY(360deg) translateY(0) scale(1); }
        }
        @keyframes super-ace-card-drop {
          0% { opacity: 0; transform: translateY(-145%) scale(.82); filter: brightness(1.45); }
          70% { opacity: 1; transform: translateY(7%) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: brightness(1); }
        }
        @keyframes super-ace-card-clear {
          0% { opacity: 1; transform: scale(1); filter: brightness(1.25) saturate(1.1); box-shadow: 0 0 12px rgba(255,215,0,.55), inset 0 0 8px rgba(255,246,170,.35); }
          45% { opacity: 1; transform: scale(1.075); filter: brightness(1.65) saturate(1.25); box-shadow: 0 0 30px rgba(255,215,0,.98), inset 0 0 18px rgba(255,246,170,.85); }
          78% { opacity: 1; transform: scale(1.045); filter: brightness(1.45) saturate(1.2); box-shadow: 0 0 24px rgba(255,215,0,.85), inset 0 0 14px rgba(255,246,170,.65); }
          100% { opacity: 0; transform: scale(.72); filter: brightness(1.9) saturate(1.3); box-shadow: 0 0 34px rgba(255,215,0,.95), inset 0 0 18px rgba(255,246,170,.85); }
        }
        @keyframes super-ace-card-shuffle-out {
          0% { opacity: 1; transform: translateY(0) rotateX(0); }
          100% { opacity: 0; transform: translateY(18%) rotateX(82deg) scale(.82); }
        }
        .super-ace-card-drop { animation: super-ace-card-drop .62s cubic-bezier(.22,1,.36,1) both; }
        .super-ace-card-clear { animation: super-ace-card-clear .72s ease-in both; }
        .super-ace-card-shuffle-out { animation: super-ace-card-shuffle-out .2s ease-in both; }

        @keyframes super-ace-winning-card {
          0%, 100% { transform: scale(1.02); filter: brightness(1.2) saturate(1.12); }
          50% { transform: scale(1.075); filter: brightness(1.55) saturate(1.3); }
        }
        @keyframes super-ace-golden-win {
          0%, 100% { box-shadow: 0 0 16px rgba(255,215,0,.7), inset 0 0 14px rgba(255,235,120,.55); }
          50% { box-shadow: 0 0 34px rgba(255,149,0,.98), inset 0 0 22px rgba(255,247,170,.9); }
        }
        .super-ace-shuffling { animation: super-ace-card-shuffle .34s cubic-bezier(.4,0,.2,1) both; backface-visibility: hidden; }
        .super-ace-winning { animation: super-ace-winning-card 1.15s ease-in-out infinite, super-ace-golden-win 1.15s ease-in-out infinite; }
      `}</style>

      {/* Free Game banner */}
      {inFreeGame && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-r from-[#e6b800] to-[#ff9500] py-1.5 px-3 flex items-center justify-between" style={{ zIndex: 30 }}>
          <div className="flex items-center gap-1.5">
            <Gift size={13} className="text-[#1a1f2e]" fill="currentColor" />
            <span className="text-[#1a1f2e] font-bold text-xs">FREE GAMES</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#1a1f2e] font-bold text-xs">{freeSpinsRemaining}/{freeSpinsTotal} left</span>
            <span className="text-[#1a1f2e] font-bold text-xs">Won: ৳{freeGameWin.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Overlays for free game intro/summary/scatter */}
      {freeGameIntro && (
        <div className="absolute inset-0 z-50">
          <FreeGameIntroOverlay onComplete={() => { setFreeGameIntro(null); spin(); }} />
        </div>
      )}
      {freeGameSummary !== null && (
        <div className="absolute inset-0 z-50">
          <FreeGameWinOverlay amount={freeGameSummary} onComplete={() => setFreeGameSummary(null)} />
        </div>
      )}
      {scatterTrigger && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-[#ff9500]/90 backdrop-blur-sm rounded-2xl px-6 py-4 border-2 border-[#ffaa00] animate-scale-in shadow-[0_0_30px_rgba(255,149,0,0.6)]">
            <div className="flex items-center gap-2 mb-1">
              <img src={SCATTER_IMAGE} alt="Scatter" className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <p className="text-[#1a1f2e] font-display font-bold text-lg">FREE SPINS!</p>
                <p className="text-[#1a1f2e] text-xs font-bold">Scatter triggered</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Win display overlay on grid */}
      {lastWin !== null && lastWin > 0 && !showWinBanner && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="relative animate-win-amount text-center">
            <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-[#ff9d00]/35 blur-2xl" />
            <p className="font-display text-[clamp(2.8rem,16vw,6rem)] font-black leading-none tabular-nums text-[#ffe36b]"
              style={{ textShadow: '0 3px 0 #9a3b00, 0 0 8px #fff3a1, 0 0 22px #ffae00, 0 0 48px rgba(255,100,0,.9)' }}>
              {lastWin.toFixed(2)}
            </p>
            {chainLevel > 0 && (
              <p className="text-neon-gold text-[10px] font-bold text-center mt-0.5">Chain x{chainLevel}</p>
            )}
          </div>
        </div>
      )}

      {/* Win banner overlay */}
      {showWinBanner && totalWin > 0 && (
        <div className="absolute bottom-[20%] left-3 right-3 z-30">
          <div className="bg-gradient-to-r from-[#6b4308]/90 via-[#d99814]/60 to-[#6b4308]/90 rounded-xl border border-[#ffd54a]/80 px-4 py-2.5 animate-scale-in shadow-[0_0_22px_rgba(255,183,36,0.6)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#ffe7a0] font-bold uppercase tracking-wide">{t('superAce.totalWon')}</span>
              <span className="text-[#ffd54a] font-display text-2xl font-black tabular-nums"
                style={{ textShadow: '0 0 8px rgba(255,180,30,.85), 0 0 18px rgba(255,120,0,.55)' }}>
                ৳{bn(displayWin.toFixed(2))}
              </span>
            </div>
            {freeGameWin > 0 && (
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] text-[#ff9500] font-bold uppercase">{t('superAce.freeGameWon')}</span>
                <span className="text-[#ff9500] font-bold text-sm tabular-nums">৳{bn(freeGameWin.toFixed(2))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result message */}
      {resultMsg && !showWinBanner && (
        <div className="absolute bottom-[20%] left-3 right-3 z-30">
          <div className="bg-black/55 rounded-lg px-3 py-1.5 text-center backdrop-blur-sm">
            <p className={`text-xs font-bold ${lastWin ? 'text-neon-green' : 'text-gray-400'}`}>{resultMsg}</p>
          </div>
        </div>
      )}

      {/* Stage matches the background image's aspect ratio so cards and tap zones stay aligned with the artwork */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ containerType: 'size' }}>
      <div className="relative" style={{ width: 'min(100cqw, calc(100cqh * 777 / 1478))', aspectRatio: '777 / 1478' }}>
      <img
        src="/assets/IMG_20261113_031303.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
        style={{ zIndex: 0 }}
      />
      <div
        className="absolute"
        style={{ top: '25.5%', left: '2.1%', right: '2.1%', zIndex: 10 }}
      >
        {/* Bet menu popup */}
        {!inFreeGame && showBetMenu && (
          <div className="absolute top-0 left-2 right-2 z-30 overflow-hidden rounded-xl border-2 border-[#a88f45] bg-[#211d16]/95 shadow-[0_4px_18px_rgba(0,0,0,.8)]">
            <div className="grid grid-cols-3">
              {BET_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    if (betClickSoundRef.current) { betClickSoundRef.current.currentTime = 0; betClickSoundRef.current.play().catch(() => {}); }
                    setBet(amount);
                    setShowBetMenu(false);
                  }}
                  disabled={spinning}
                  className={`border border-[#554c37] py-2.5 text-sm font-semibold tabular-nums transition-colors disabled:opacity-40 ${
                    bet === amount ? 'bg-[#77734a] text-white ring-2 ring-inset ring-[#d8d18a]' : 'text-gray-100 hover:bg-[#393326]'
                  }`}
                >
                  {bn(amount)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative w-full">
          <div
            className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, columnGap: '2.1%', rowGap: '12px' }}
          >
            {grid.map((cell, idx) => {
              const style = SYMBOL_STYLES[cell.symbol];
              const isMatched = matchedCells.has(idx);
              const isWinning = winningCells.has(idx);
              const isGolden = cell.symbol === 'GOLD' || cell.isGolden;
              const isScatter = cell.symbol === 'SCATTER' || cell.isScatter;
              const isTransformed = cell.transformedFromGolden;
              const isTransforming = goldenTransforming.has(idx);
              const isShufflingOut = cell.isShufflingOut;
              const isDropping = cell.isDropping && !isShufflingOut;

              return (
                <div
                  key={cell.id}
                  onClick={spin}
                  className={`aspect-[3/4] rounded-[6px] relative overflow-hidden transition-all duration-300 cursor-pointer ${
                    isDropping ? 'super-ace-card-drop'
                    : isMatched ? 'super-ace-card-clear z-10'
                    : isTransforming ? 'scale-125 z-20 animate-pulse-glow'
                    : isWinning && !spinning ? 'super-ace-winning z-10'
                    : winningCells.size > 0 ? 'opacity-25 grayscale-[0.55] saturate-[0.5] brightness-[0.72]'
                    : 'hover:-translate-y-0.5'
                  }`}
                  style={{
                    background: style.gradient,
                    animationDelay: isDropping
                      ? `${(idx % COLS) * 110 + Math.floor(idx / COLS) * 28}ms`
                      : spinning ? `${(idx % COLS) * 35}ms` : undefined,
                    boxShadow: isMatched || isWinning
                      ? `0 0 18px ${style.glowColor}, inset 0 0 10px ${style.glowColor}`
                      : isScatter ? `0 0 12px rgba(255,149,0,0.5), inset 0 0 8px rgba(255,149,0,0.3)`
                      : isGolden ? `0 0 12px rgba(255,170,0,0.5), inset 0 0 8px rgba(255,170,0,0.3)`
                      : '0 2px 4px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.8)',
                  }}
                >
                  <span className="absolute top-0.5 left-1 text-[8px] font-bold leading-none flex flex-col items-center"
                    style={{ color: style.suitColor, textShadow: `0 0 4px ${style.glowColor}` }}>
                    <span className="leading-none">{style.rankChar}</span>
                    <span className="leading-none text-[7px]">{style.suitChar}</span>
                  </span>
                  <span className="absolute bottom-0.5 right-1 text-[8px] font-bold leading-none flex flex-col items-center rotate-180"
                    style={{ color: style.suitColor, textShadow: `0 0 4px ${style.glowColor}` }}>
                    <span className="leading-none">{style.rankChar}</span>
                    <span className="leading-none text-[7px]">{style.suitChar}</span>
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center p-1">
                    <img src={style.image} alt={`${style.label} card`} loading="lazy" className="w-full h-full object-cover rounded-[4px]"
                      style={{
                        filter: isMatched || isWinning
                          ? 'drop-shadow(0 0 10px rgba(255,215,0,0.95)) brightness(1.3) saturate(1.2)'
                          : isScatter ? 'drop-shadow(0 0 4px rgba(255,149,0,0.6)) brightness(1.1)'
                          : isGolden ? 'drop-shadow(0 0 4px rgba(255,170,0,0.6)) brightness(1.1)'
                          : 'none',
                      }}
                    />
                  </div>
                  {isScatter && (
                    <div className="absolute top-0.5 right-1 bg-[#ff9500] text-[#1a1f2e] text-[7px] font-bold px-1 py-0.5 rounded-full">SCATTER</div>
                  )}
                  {isGolden && (
                    <div className="absolute top-0.5 right-1 bg-[#ffaa00] text-[#1a1f2e] text-[7px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5">
                      <Crown size={7} fill="currentColor" />GOLD
                    </div>
                  )}
                  {isTransforming && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="text-[#e879f9] text-lg font-bold animate-ping">✦</div>
                    </div>
                  )}
                  {isTransformed && (
                    <div className="absolute bottom-0.5 left-1 bg-[#e879f9]/30 text-[#e879f9] text-[6px] font-bold px-1 py-0.5 rounded-full border border-[#e879f9]/50">★ WILD</div>
                  )}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0) 60%, rgba(0,0,0,0.06) 100%)' }}
                  />
                  {(isMatched || isWinning) && (
                    <div className="absolute inset-0 pointer-events-none border-2 rounded-lg animate-pulse" style={{ borderColor: style.suitColor }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Invisible tap zones over bottom bar buttons in the background image */}
      {/* Bet button tap area */}
      <button
        type="button"
        onClick={() => {
          if (betClickSoundRef.current) { betClickSoundRef.current.currentTime = 0; betClickSoundRef.current.play().catch(() => {}); }
          if (!inFreeGame) setShowBetMenu((v) => !v);
        }}
        disabled={spinning}
        aria-label="Choose bet"
        className="absolute left-[24%] top-[85%] w-[14%] h-[8%] opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      {/* Spin button tap area */}
      <button
        onClick={spin}
        disabled={freeGameSummary !== null || (!inFreeGame && (balance < bet || bet <= 0))}
        aria-label="Spin"
        className="absolute left-[38%] top-[83%] w-[24%] h-[13%] opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      {/* Auto spin tap area */}
      {autoSpinRemaining === 0 && !inFreeGame && (
        <button
          onClick={() => setShowAutoSpin(true)}
          disabled={spinning || balance < bet}
          aria-label="Auto spin"
          className="absolute left-[64%] top-[85%] w-[14%] h-[8%] opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      )}
      {/* Stop auto spin */}
      {autoSpinRemaining > 0 && (
        <button
          onClick={() => setAutoSpinRemaining(0)}
          aria-label="Stop auto"
          className="absolute left-[64%] top-[85%] w-[14%] h-[8%] opacity-0 cursor-pointer"
        />
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
        betAmount={bet}
        balance={balance}
      />
    </div>
  );
}
