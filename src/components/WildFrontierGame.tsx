import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Minus, Plus, Wallet } from 'lucide-react';
import { SymbolGraphic } from './Symbols';

const COLS = 5;
const ROWS = 3;
const BET_OPTIONS = [20, 50, 100, 200, 500, 1000];
const DEFAULT_BET_INDEX = 2;
const STAKE_DIVISOR = 10;
const WILD = 'WILD';
const SCATTER = 'SCATTER';

interface PayingSymbol {
  id: string;
  weight: number;
  pays: Record<number, number>;
}

const PAYING_SYMBOLS: PayingSymbol[] = [
  { id: 'OUTLAW', weight: 6, pays: { 3: 6, 4: 15, 5: 40 } },
  { id: 'GUN', weight: 8, pays: { 3: 5, 4: 12, 5: 30 } },
  { id: 'HAT', weight: 10, pays: { 3: 4, 4: 10, 5: 25 } },
  { id: 'BOTTLE', weight: 10, pays: { 3: 4, 4: 10, 5: 25 } },
  { id: 'A', weight: 14, pays: { 3: 2, 4: 4, 5: 10 } },
  { id: 'K', weight: 14, pays: { 3: 2, 4: 4, 5: 10 } },
  { id: 'Q', weight: 16, pays: { 3: 1, 4: 2, 5: 5 } },
  { id: 'J', weight: 16, pays: { 3: 1, 4: 2, 5: 5 } },
];

const SCATTER_PAYS: Record<number, number> = { 3: 1, 4: 3, 5: 10 };

const POOL: { id: string; weight: number }[] = [
  ...PAYING_SYMBOLS.map(({ id, weight }) => ({ id, weight })),
  { id: WILD, weight: 2 },
  { id: SCATTER, weight: 2 },
];
const POOL_TOTAL = POOL.reduce((sum, s) => sum + s.weight, 0);

function randomSymbol(): string {
  let r = Math.random() * POOL_TOTAL;
  for (const s of POOL) {
    r -= s.weight;
    if (r < 0) return s.id;
  }
  return POOL[POOL.length - 1].id;
}

function randomGrid(): string[][] {
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, randomSymbol));
}

function evaluateGrid(grid: string[][], bet: number) {
  const stake = bet / STAKE_DIVISOR;
  const cells = new Set<string>();
  let total = 0;

  for (const sym of PAYING_SYMBOLS) {
    let ways = 1;
    let reelsHit = 0;
    for (let c = 0; c < COLS; c++) {
      const matches = grid[c].filter((s) => s === sym.id || s === WILD).length;
      if (matches === 0) break;
      ways *= matches;
      reelsHit++;
    }
    const pay = sym.pays[reelsHit];
    if (reelsHit >= 3 && pay) {
      total += pay * ways * stake;
      for (let c = 0; c < reelsHit; c++) {
        grid[c].forEach((s, r) => {
          if (s === sym.id || s === WILD) cells.add(`${c}-${r}`);
        });
      }
    }
  }

  const scatterHits: string[] = [];
  grid.forEach((col, c) => col.forEach((s, r) => {
    if (s === SCATTER) scatterHits.push(`${c}-${r}`);
  }));
  if (SCATTER_PAYS[scatterHits.length]) {
    total += SCATTER_PAYS[scatterHits.length] * bet;
    scatterHits.forEach((k) => cells.add(k));
  }

  return { total, cells };
}

interface WildFrontierGameProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  onBack: () => void;
}

export default function WildFrontierGame({ balance, onBetPlaced, onWin, onBack }: WildFrontierGameProps) {
  const [betIndex, setBetIndex] = useState<number>(DEFAULT_BET_INDEX);
  const [reels, setReels] = useState<string[][]>(randomGrid);
  const [spinningReels, setSpinningReels] = useState<boolean[]>(() => Array(COLS).fill(false));
  const [winCells, setWinCells] = useState<Set<string>>(() => new Set());
  const [lastWin, setLastWin] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('Place your bet and spin');
  const timersRef = useRef<number[]>([]);

  const bet = BET_OPTIONS[betIndex];
  const hasWinners = winCells.size > 0;

  useEffect(() => () => {
    timersRef.current.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
  }, []);

  const changeBet = (delta: number) => {
    setBetIndex((i) => Math.min(BET_OPTIONS.length - 1, Math.max(0, i + delta)));
  };

  const spin = () => {
    if (isSpinning) return;
    if (balance < bet) {
      setMessage('Not enough balance for this bet');
      return;
    }

    const finalGrid = randomGrid();
    const { total, cells } = evaluateGrid(finalGrid, bet);
    const active = Array<boolean>(COLS).fill(true);
    timersRef.current = [];

    setIsSpinning(true);
    setLastWin(0);
    setWinCells(new Set());
    setMessage('Good luck, partner');
    setSpinningReels([...active]);
    onBetPlaced(bet);

    const tick = window.setInterval(() => {
      setReels((prev) => prev.map((col, c) => (active[c] ? col.map(() => randomSymbol()) : col)));
    }, 80);
    timersRef.current.push(tick);

    for (let c = 0; c < COLS; c++) {
      const stopAt = window.setTimeout(() => {
        active[c] = false;
        setReels((prev) => prev.map((col, i) => (i === c ? finalGrid[c] : col)));
        setSpinningReels((prev) => prev.map((v, i) => (i === c ? false : v)));
      }, 700 + c * 350);
      timersRef.current.push(stopAt);
    }

    const finish = window.setTimeout(() => {
      clearInterval(tick);
      setIsSpinning(false);
      setWinCells(cells);
      setLastWin(total);
      if (total > 0) {
        onWin(total);
        setMessage(`You won ${total.toFixed(2)}!`);
      } else {
        setMessage('No win this time. Spin again');
      }
    }, 700 + (COLS - 1) * 350 + 150);
    timersRef.current.push(finish);
  };

  return (
    <div className="fixed inset-0 z-50 flex max-w-md mx-auto flex-col overflow-hidden bg-[#1a0d07] text-[#f7e6c4]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#704721] bg-[#24130d]/95 px-3 backdrop-blur-sm">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#704721] bg-[#2a1710] text-[#d4a264] transition-transform active:scale-90"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-display text-lg font-black tracking-[.2em] text-[#ffe09a]">PG</h1>
        <div className="flex items-center gap-1.5 rounded-lg border border-[#704721] bg-[#2a1710] px-2.5 py-1.5">
          <Wallet size={14} className="text-[#ffd76a]" />
          <span className="text-sm font-bold tabular-nums leading-none text-white">{balance.toFixed(2)}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-6">
        <div className="w-full rounded-2xl border-2 border-[#b07a34] bg-gradient-to-b from-[#4a2412] via-[#2a1408] to-[#1a0c05] p-3 shadow-[inset_0_0_24px_rgba(255,174,0,0.25)]">
          <div className="grid grid-cols-5 gap-1.5">
            {reels.map((col, c) =>
              col.map((sym, r) => {
                const key = `${c}-${r}`;
                const won = winCells.has(key);
                const dimmed = hasWinners && !won;
                return (
                  <div
                    key={key}
                    className={`aspect-square rounded-lg bg-[#120804]/70 p-1 transition-all duration-200 ${
                      won ? 'ring-2 ring-[#ffd700] shadow-[0_0_14px_rgba(255,215,0,0.7)] scale-[1.03]' : ''
                    } ${dimmed ? 'opacity-40' : ''} ${spinningReels[c] ? 'blur-[1px]' : ''}`}
                  >
                    <SymbolGraphic id={sym} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="min-h-[3.5rem] text-center">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d4a264]">{message}</p>
          {lastWin > 0 && (
            <p className="mt-1 font-display text-2xl font-black text-[#ffd76a] animate-fade-in-up">+{lastWin.toFixed(2)}</p>
          )}
        </div>

        <div className="flex w-full items-center justify-between rounded-xl border border-[#704721] bg-[#2a1710] px-3 py-2.5">
          <button
            onClick={() => changeBet(-1)}
            disabled={isSpinning || betIndex === 0}
            aria-label="Decrease bet"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#704721] text-[#d4a264] transition-colors hover:bg-[#3a1f12] disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a87648]">Bet</p>
            <p className="font-bold tabular-nums text-white">{bet.toFixed(2)}</p>
          </div>
          <button
            onClick={() => changeBet(1)}
            disabled={isSpinning || betIndex === BET_OPTIONS.length - 1}
            aria-label="Increase bet"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#704721] text-[#d4a264] transition-colors hover:bg-[#3a1f12] disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          onClick={spin}
          disabled={isSpinning}
          className="w-full rounded-2xl bg-gradient-to-b from-[#e0572a] to-[#8f1d14] py-4 font-display text-lg font-black tracking-[.2em] text-[#fff3d1] shadow-[0_6px_20px_rgba(224,87,42,0.35)] transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {isSpinning ? 'SPINNING...' : 'SPIN'}
        </button>
      </div>
    </div>
  );
}
