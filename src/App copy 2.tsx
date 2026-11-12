import React, { useState, useEffect, useRef } from 'react';
import { SymbolGraphic } from './Symbols';

// Exact user-provided clean background image URL
const BG_IMAGE_URL = 'https://i.postimg.cc/Yq0wYs99/1793800804316.jpg';

const REEL_SIZES = [3, 4, 5, 5, 4, 3];
const MULTIPLIERS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
const BET_OPTIONS = [20, 50, 100, 200, 300, 400, 500, 1000];

const MARQUEE_TIPS = [
  'WIN UP TO 3600 WAYS!',
  'MULTIPLIER DOUBLES AFTER EVERY WIN!',
  '3 OR MORE SCATTER TRIGGER 10 OR MORE FREE SPINS!',
  'GET WILD WITH GOLD FRAMED SYMBOLS!',
];

interface SymbolDef {
  id: string;
  pays: Record<number, number>;
  weight: number;
}

const SYMBOLS: Record<string, SymbolDef> = {
  WILD:    { id: 'WILD',    pays: {}, weight: 0 },
  SCATTER: { id: 'SCATTER', pays: {}, weight: 3 },
  OUTLAW:  { id: 'OUTLAW',  pays: { 3: 10, 4: 20, 5: 30, 6: 50 }, weight: 7 },
  GUN:     { id: 'GUN',     pays: { 3: 8,  4: 15, 5: 20, 6: 30 }, weight: 9 },
  HAT:     { id: 'HAT',     pays: { 3: 5,  4: 10, 5: 15, 6: 20 }, weight: 12 },
  BOTTLE:  { id: 'BOTTLE',  pays: { 3: 5,  4: 10, 5: 15, 6: 20 }, weight: 12 },
  A:       { id: 'A',       pays: { 3: 2,  4: 4,  5: 6,  6: 10 }, weight: 18 },
  K:       { id: 'K',       pays: { 3: 2,  4: 4,  5: 6,  6: 10 }, weight: 18 },
  Q:       { id: 'Q',       pays: { 3: 1,  4: 2,  5: 3,  6: 5  }, weight: 22 },
  J:       { id: 'J',       pays: { 3: 1,  4: 2,  5: 3,  6: 5  }, weight: 22 },
};

interface Cell {
  sym: string;
  goldFrame: boolean;
  winning: boolean;
  shattering: boolean;
  key: string;
}

export default function App() {
  const [balance, setBalance] = useState<number>(57563.40);
  const [betIndex, setBetIndex] = useState<number>(4); // Default 300.00
  const [currency, setCurrency] = useState<'৳' | '₱' | 'Tk'>('৳');

  const [grid, setGrid] = useState<Cell[][]>([]);
  const [rollingCols, setRollingCols] = useState<boolean[]>([false, false, false, false, false, false]);
  const [teaseCol, setTeaseCol] = useState<number | null>(null);

  const [multIndex, setMultIndex] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [isTurbo, setIsTurbo] = useState<boolean>(false);
  const [turboToast, setTurboToast] = useState<boolean>(false);

  // Auto Spin Drawer & Counter
  const [showAutoDrawer, setShowAutoDrawer] = useState<boolean>(false);
  const [selectedAutoCount, setSelectedAutoCount] = useState<number>(10);
  const [autoSpinsLeft, setAutoSpinsLeft] = useState<number>(0);

  // Banner State
  const [tipIndex, setTipIndex] = useState<number>(0);
  const [bannerState, setBannerState] = useState<{
    mode: 'marquee' | 'one_more' | 'free_spins_won' | 'step_base' | 'step_win' | 'total_win';
    amount?: number;
  }>({ mode: 'marquee' });

  const [spinWinTotal, setSpinWinTotal] = useState<number>(0);
  const [centerMultAnim, setCenterMultAnim] = useState<number | null>(null);

  // Free Spins Mode States
  const [fsSplashOpen, setFsSplashOpen] = useState<boolean>(false);
  const [fsAwardedCount, setFsAwardedCount] = useState<number>(10);
  const [inFreeSpins, setInFreeSpins] = useState<boolean>(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState<number>(0);
  const [fsTotalWin, setFsTotalWin] = useState<number>(0);
  const [fsIntroSweep, setFsIntroSweep] = useState<boolean>(false);
  const [fsSummaryOpen, setFsSummaryOpen] = useState<boolean>(false);
  const [fsSummaryCountUp, setFsSummaryCountUp] = useState<number>(0);

  // Tiered Big Win / Mega Win / Super Mega Win Overlay
  const [bigWinData, setBigWinData] = useState<{ total: number; current: number; bet: number } | null>(null);

  // Modals
  const [showFeatureBuyModal, setShowFeatureBuyModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Refs for async loops
  const audioCtxRef = useRef<AudioContext | null>(null);
  const turboRef = useRef(isTurbo);
  turboRef.current = isTurbo;
  const autoLeftRef = useRef(autoSpinsLeft);
  autoLeftRef.current = autoSpinsLeft;
  const fsTotalWinRef = useRef(fsTotalWin);
  fsTotalWinRef.current = fsTotalWin;

  // Web Audio Western Acoustic Guitar & Gunshot SFX Engine
  const getAudioCtx = (): AudioContext | null => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  const playTone = (freq: number, type: OscillatorType = 'sine', duration = 0.14, vol = 0.12, delay = 0) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  };

  const playGunshotAndRicochet = (count = 1) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    for (let i = 0; i < Math.min(count, 4); i++) {
      const offset = i * 0.065;
      const bufferSize = ctx.sampleRate * 0.14;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.035));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime + offset);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.14);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime + offset);

      playTone(110, 'sawtooth', 0.12, 0.22, offset);
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + 0.12;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, t0);
    osc.frequency.exponentialRampToValueAtTime(340, t0 + 0.26);
    g.gain.setValueAtTime(0.14, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
  };

  const playReelStopThud = (colIndex: number, hasScatter: boolean) => {
    playTone(95 + colIndex * 10, 'triangle', 0.08, 0.16);
    if (hasScatter) {
      playTone(680 + colIndex * 90, 'sine', 0.28, 0.18, 0.02);
    }
  };

  const playTeaseRiser = () => {
    playTone(320, 'sawtooth', 0.45, 0.09, 0);
    playTone(460, 'sawtooth', 0.45, 0.11, 0.18);
  };

  const playMultiplierWhoosh = (multVal: number) => {
    const pitch = Math.min(280 + Math.log2(multVal) * 75, 980);
    playTone(pitch, 'triangle', 0.22, 0.18, 0);
    playTone(pitch * 1.5, 'sine', 0.3, 0.2, 0.08);
  };

  const getRandomSymbol = (colIndex: number): string => {
    const pool: { id: string; weight: number }[] = [];
    Object.values(SYMBOLS).forEach((sym) => {
      if (sym.id === 'WILD') {
        if (colIndex >= 1 && colIndex <= 4) {
          pool.push({ id: 'WILD', weight: 2 });
        }
      } else {
        pool.push({ id: sym.id, weight: sym.weight });
      }
    });
    const totalWeight = pool.reduce((acc, item) => acc + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const item of pool) {
      if (rand < item.weight) return item.id;
      rand -= item.weight;
    }
    return 'J';
  };

  const createCell = (colIndex: number): Cell => {
    const symId = getRandomSymbol(colIndex);
    let goldFrame = false;
    if ((colIndex === 2 || colIndex === 3) && symId !== 'WILD' && symId !== 'SCATTER') {
      goldFrame = Math.random() < 0.35;
    }
    return {
      sym: symId,
      goldFrame,
      winning: false,
      shattering: false,
      key: Math.random().toString(36).substring(2, 9),
    };
  };

  const generateFreshBoard = (forceScatters = false): Cell[][] => {
    const newGrid: Cell[][] = [];
    for (let c = 0; c < 6; c++) {
      const col: Cell[] = [];
      for (let r = 0; r < REEL_SIZES[c]; r++) {
        col.push(createCell(c));
      }
      newGrid.push(col);
    }
    if (forceScatters) {
      const cols = [0, 2, 4];
      cols.forEach((c) => {
        const r = Math.floor(Math.random() * REEL_SIZES[c]);
        newGrid[c][r] = {
          sym: 'SCATTER',
          goldFrame: false,
          winning: false,
          shattering: false,
          key: Math.random().toString(36).substring(2, 9),
        };
      });
    }
    return newGrid;
  };

  useEffect(() => {
    setGrid(generateFreshBoard());
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % MARQUEE_TIPS.length);
    }, 4500);
    return () => clearInterval(tipTimer);
  }, []);

  const sleep = (ms: number) => {
    const factor = turboRef.current ? 0.45 : 1;
    return new Promise((res) => setTimeout(res, ms * factor));
  };

  const evaluateWays = (board: Cell[][], betAmount: number) => {
    let totalBaseWin = 0;
    const winningPositions: Set<number>[] = Array.from({ length: 6 }, () => new Set<number>());

    Object.keys(SYMBOLS).forEach((symId) => {
      if (symId === 'WILD' || symId === 'SCATTER') return;
      let consecutiveReels = 0;
      let waysCount = 1;
      const matchedPerReel: { col: number; rows: number[] }[] = [];

      for (let c = 0; c < 6; c++) {
        const matchingRows: number[] = [];
        for (let r = 0; r < REEL_SIZES[c]; r++) {
          const cellSym = board[c][r].sym;
          if (cellSym === symId || cellSym === 'WILD') {
            matchingRows.push(r);
          }
        }
        if (matchingRows.length > 0) {
          consecutiveReels++;
          waysCount *= matchingRows.length;
          matchedPerReel.push({ col: c, rows: matchingRows });
        } else {
          break;
        }
      }

      if (consecutiveReels >= 3) {
        const payVal = SYMBOLS[symId].pays[consecutiveReels] || 0;
        const betScale = betAmount / 20;
        totalBaseWin += payVal * waysCount * betScale;
        matchedPerReel.forEach((item) => {
          item.rows.forEach((r) => winningPositions[item.col].add(r));
        });
      }
    });

    return { totalBaseWin, winningPositions };
  };

  const runBigWinPresentation = (finalWin: number, betAmt: number): Promise<void> => {
    return new Promise((resolve) => {
      setBigWinData({ total: finalWin, current: 0, bet: betAmt });
      playGunshotAndRicochet(3);
      const duration = 3800;
      const startTime = performance.now();
      let settled = false;

      const step = (now: number) => {
        if (settled) return;
        const progress = Math.min((now - startTime) / duration, 1);
        const currentVal = finalWin * progress;
        setBigWinData({ total: finalWin, current: currentVal, bet: betAmt });
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setTimeout(() => {
            if (!settled) {
              settled = true;
              setBigWinData(null);
              resolve();
            }
          }, 1100);
        }
      };
      requestAnimationFrame(step);
    });
  };

  const triggerSpin = async (options?: {
    forceFeatureBuy?: boolean;
    isFreeSpinMode?: boolean;
    fsRemaining?: number;
    overrideBalance?: number;
  }) => {
    if (isSpinning) return;

    const betAmt = BET_OPTIONS[betIndex];
    const isFs = options?.isFreeSpinMode !== undefined ? options.isFreeSpinMode : inFreeSpins;
    const fsLeft = options?.fsRemaining !== undefined ? options.fsRemaining : freeSpinsLeft;
    let currentBal = options?.overrideBalance !== undefined ? options.overrideBalance : balance;

    if (!isFs && !options?.forceFeatureBuy && currentBal < betAmt) {
      alert('Insufficient Balance!');
      setAutoSpinsLeft(0);
      return;
    }

    setIsSpinning(true);
    setSpinWinTotal(0);
    setBannerState({ mode: 'marquee' });

    let activeMultIdx = isFs ? 3 : 0;
    setMultIndex(activeMultIdx);

    let nextFsLeft = fsLeft;
    if (!isFs && !options?.forceFeatureBuy) {
      currentBal -= betAmt;
      setBalance(currentBal);
    } else if (isFs) {
      nextFsLeft = Math.max(0, fsLeft - 1);
      setFreeSpinsLeft(nextFsLeft);
    }

    setRollingCols([true, true, true, true, true, true]);
    const targetBoard = generateFreshBoard(Boolean(options?.forceFeatureBuy));

    let scattersSeen = 0;
    for (let c = 0; c < 6; c++) {
      const isTeasing = scattersSeen >= 2;
      if (isTeasing && !turboRef.current) {
        setTeaseCol(c);
        setBannerState({ mode: 'one_more' });
        playTeaseRiser();
        await sleep(620);
      } else {
        await sleep(115);
      }

      const colHasScatter = targetBoard[c].some((cell) => cell.sym === 'SCATTER');
      if (colHasScatter) scattersSeen++;

      setGrid((prev) => {
        const copy = [...prev];
        copy[c] = targetBoard[c];
        return copy;
      });
      setRollingCols((prev) => {
        const copy = [...prev];
        copy[c] = false;
        return copy;
      });
      setTeaseCol(null);
      playReelStopThud(c, colHasScatter);
    }

    let currentBoard = targetBoard;
    await sleep(180);

    let runningSpinWin = 0;

    while (true) {
      const { totalBaseWin, winningPositions } = evaluateWays(currentBoard, betAmt);
      if (totalBaseWin <= 0) break;

      const activeMult = MULTIPLIERS[activeMultIdx];
      const stepFinalWin = totalBaseWin * activeMult;

      let winningCount = 0;
      currentBoard = currentBoard.map((col, c) =>
        col.map((cell, r) => {
          const isWin = winningPositions[c].has(r);
          if (isWin) winningCount++;
          return { ...cell, winning: isWin, shattering: false };
        })
      );
      setGrid([...currentBoard]);

      setBannerState({ mode: 'step_base', amount: totalBaseWin });
      await sleep(340);

      if (activeMult > 1) {
        setCenterMultAnim(activeMult);
        playMultiplierWhoosh(activeMult);
        await sleep(520);
        setCenterMultAnim(null);
      }

      runningSpinWin += stepFinalWin;
      setSpinWinTotal(runningSpinWin);
      setBannerState({ mode: 'step_win', amount: stepFinalWin });

      playGunshotAndRicochet(winningCount);
      currentBoard = currentBoard.map((col) =>
        col.map((cell) => (cell.winning ? { ...cell, shattering: true } : cell))
      );
      setGrid([...currentBoard]);
      await sleep(360);

      const cascadedBoard: Cell[][] = [];
      for (let c = 0; c < 6; c++) {
        const newCol: Cell[] = [];
        for (let r = 0; r < REEL_SIZES[c]; r++) {
          const cell = currentBoard[c][r];
          if (cell.winning) {
            if (cell.goldFrame) {
              newCol.push({
                sym: 'WILD',
                goldFrame: false,
                winning: false,
                shattering: false,
                key: Math.random().toString(36).substring(2, 9),
              });
            }
          } else {
            newCol.push(cell);
          }
        }
        while (newCol.length < REEL_SIZES[c]) {
          newCol.unshift(createCell(c));
        }
        cascadedBoard.push(newCol);
      }

      if (activeMultIdx < MULTIPLIERS.length - 1) {
        activeMultIdx++;
        setMultIndex(activeMultIdx);
      }

      currentBoard = cascadedBoard;
      setGrid([...currentBoard]);
      await sleep(340);
    }

    if (runningSpinWin > 0) {
      setBannerState({ mode: 'total_win', amount: runningSpinWin });
      currentBal += runningSpinWin;
      setBalance(currentBal);

      if (isFs) {
        const updatedFsWin = fsTotalWinRef.current + runningSpinWin;
        fsTotalWinRef.current = updatedFsWin;
        setFsTotalWin(updatedFsWin);
      }

      if (runningSpinWin >= betAmt * 15) {
        await runBigWinPresentation(runningSpinWin, betAmt);
      } else {
        await sleep(450);
      }
    }

    let totalScatters = 0;
    currentBoard.forEach((col) =>
      col.forEach((cell) => {
        if (cell.sym === 'SCATTER') totalScatters++;
      })
    );

    if (totalScatters >= 3) {
      const awarded = 10 + (totalScatters - 3) * 2;
      setBannerState({ mode: 'free_spins_won' });
      playGunshotAndRicochet(3);
      await sleep(1100);

      if (!isFs) {
        setFsAwardedCount(awarded);
        setFsTotalWin(0);
        fsTotalWinRef.current = 0;
        setFsSplashOpen(true);
        setIsSpinning(false);
        return;
      } else {
        nextFsLeft += awarded;
        setFreeSpinsLeft(nextFsLeft);
      }
    }

    if (isFs) {
      if (nextFsLeft > 0) {
        setIsSpinning(false);
        await sleep(480);
        triggerSpin({ isFreeSpinMode: true, fsRemaining: nextFsLeft, overrideBalance: currentBal });
        return;
      } else {
        setIsSpinning(false);
        openFreeSpinsSummary(fsTotalWinRef.current);
        return;
      }
    }

    setIsSpinning(false);

    if (autoLeftRef.current > 0) {
      const nextAuto = autoLeftRef.current - 1;
      autoLeftRef.current = nextAuto;
      setAutoSpinsLeft(nextAuto);
      if (nextAuto > 0) {
        await sleep(420);
        triggerSpin({ overrideBalance: currentBal });
      }
    }
  };

  const startFreeSpinsFeature = async () => {
    setFsSplashOpen(false);
    setInFreeSpins(true);
    setFreeSpinsLeft(fsAwardedCount);
    setMultIndex(0);

    setFsIntroSweep(true);
    for (let idx = 0; idx <= 3; idx++) {
      setMultIndex(idx);
      playMultiplierWhoosh(MULTIPLIERS[idx]);
      await sleep(280);
    }
    await sleep(350);
    setFsIntroSweep(false);

    triggerSpin({ isFreeSpinMode: true, fsRemaining: fsAwardedCount });
  };

  const openFreeSpinsSummary = (totalAmount: number) => {
    setFsSummaryOpen(true);
    setFsSummaryCountUp(0);
    const duration = 1800;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setFsSummaryCountUp(totalAmount * p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const collectFreeSpinsSummary = () => {
    setFsSummaryOpen(false);
    setInFreeSpins(false);
    setMultIndex(3);
  };

  const prev2 = MULTIPLIERS[(multIndex - 2 + MULTIPLIERS.length) % MULTIPLIERS.length];
  const prev1 = MULTIPLIERS[(multIndex - 1 + MULTIPLIERS.length) % MULTIPLIERS.length];
  const activeMult = MULTIPLIERS[multIndex];
  const next1 = MULTIPLIERS[Math.min(multIndex + 1, MULTIPLIERS.length - 1)];
  const next2 = MULTIPLIERS[Math.min(multIndex + 2, MULTIPLIERS.length - 1)];

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#070402] font-roboto select-none">
      {/* Exact Aspect Ratio Container matching 1152x2048 (9:16) Background Image */}
      <div
        className="relative w-full max-w-[432px] h-screen max-h-[768px] overflow-hidden shadow-[0_0_60px_#000] bg-no-repeat bg-cover bg-center"
        style={{
          backgroundImage: `url('${BG_IMAGE_URL}')`,
          backgroundSize: '100% 100%',
        }}
      >
        {/* Free Spins Green Saloon Tint Overlay */}
        {inFreeSpins && (
          <div className="absolute inset-0 bg-emerald-950/35 pointer-events-none z-0 transition-opacity duration-500" />
        )}

        {/* Top Left Lobby & Currency Toggle */}
        <div className="absolute top-[1.2%] left-[2.5%] z-30 flex items-center gap-1.5">
          <button
            onClick={() => setShowInfoModal(true)}
            className="bg-black/65 border border-white/25 rounded-lg px-2 py-1 flex flex-col items-center text-white text-[10px] shadow-md active:scale-95"
          >
            <span>🏠</span>
            <span className="font-bold leading-none mt-0.5">Lobby</span>
          </button>
          <button
            onClick={() => setCurrency((c) => (c === '৳' ? '₱' : c === '₱' ? 'Tk' : '৳'))}
            className="bg-black/65 border border-[#d49b35]/60 rounded-lg px-2 py-1 text-[11px] font-bold text-[#ffd86b]"
            title="Switch Currency"
          >
            {currency}
          </button>
        </div>

        {/* 1. Top Multiplier Text Overlay positioned directly on the Wooden Arch of the Background Image */}
        <div className="absolute top-[11.5%] left-[7%] right-[7%] h-[8.5%] flex items-center justify-between px-4 font-rye z-20 pointer-events-none">
          <span className="text-[13px] text-[#b38358] -rotate-12 translate-y-[-2px] opacity-85">
            x{prev2}
          </span>
          <span className="text-[15px] text-[#cfa16b] -rotate-6 translate-y-[1px]">
            x{prev1}
          </span>
          <span
            key={activeMult}
            className="text-[31px] text-[#ffe588] drop-shadow-[0_3px_6px_rgba(0,0,0,0.95)] scale-110 transition-transform duration-200"
            style={{ WebkitTextStroke: '1px #4a2103' }}
          >
            x{activeMult}
          </span>
          <span className="text-[16px] text-[#cfa16b] rotate-6 translate-y-[1px]">
            x{next1}
          </span>
          <span className="text-[13px] text-[#b38358] rotate-12 translate-y-[-2px] opacity-85">
            x{next2}
          </span>
        </div>

        {/* 2. 6-Reel Slot Grid positioned directly inside the Wooden Shield of the Background Image */}
        <div className="absolute top-[23.5%] left-[3.5%] right-[3.5%] h-[42.5%] z-10 flex items-center justify-center">
          <div className="grid grid-cols-6 gap-[3px] w-full h-full items-center">
            {grid.map((col, cIdx) => {
              const isRolling = rollingCols[cIdx];
              const isTease = teaseCol === cIdx;
              return (
                <div
                  key={cIdx}
                  className={`flex flex-col justify-center gap-[3px] h-full relative rounded-md overflow-hidden ${
                    isTease
                      ? 'ring-2 ring-[#ffd700] bg-gradient-to-b from-yellow-500/35 via-amber-400/20 to-yellow-500/35 animate-pulse'
                      : ''
                  }`}
                >
                  {col.map((cell) => (
                    <div
                      key={cell.key}
                      className={`w-full h-[52px] rounded-[6px] relative flex items-center justify-center transition-transform ${
                        isRolling ? 'reel-rolling' : 'cascade-drop'
                      } ${
                        cell.goldFrame
                          ? 'p-[2.5px] bg-gradient-to-br from-[#fff6a9] via-[#eab308] to-[#854d0e] shadow-[0_0_10px_rgba(255,215,0,0.85)]'
                          : ''
                      } ${cell.shattering ? 'shatter-anim' : ''}`}
                    >
                      <div
                        className={`w-full h-full rounded-[4px] flex items-center justify-center relative overflow-hidden ${
                          cell.goldFrame ? 'bg-[#3b1d08]/85' : 'bg-transparent'
                        }`}
                      >
                        <SymbolGraphic id={cell.sym} goldFrame={cell.goldFrame} />
                      </div>

                      {/* Golden Target Crosshair on Winning Symbols */}
                      {cell.winning && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 crosshair-target">
                          <div className="w-11 h-11 rounded-full border-[2.5px] border-[#ffe875] shadow-[0_0_15px_#ffae00,inset_0_0_8px_#ffae00] flex items-center justify-center">
                            <div className="w-full h-[1.5px] bg-[#ffe875]/80 absolute" />
                            <div className="h-full w-[1.5px] bg-[#ffe875]/80 absolute" />
                            <div className="w-2.5 h-2.5 rounded-full border border-white bg-[#ffae00]/70" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Center Giant Multiplier Zoom Animation */}
          {centerMultAnim !== null && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div
                className="font-rye text-7xl text-[#ffe380] center-mult-anim"
                style={{
                  WebkitTextStroke: '3px #6b3105',
                  textShadow: '0 0 35px #ff8c00, 0 6px 12px #000',
                }}
              >
                x{centerMultAnim}
              </div>
            </div>
          )}

          {/* Free Spins Intro Center Arch Sweep */}
          {fsIntroSweep && (
            <div className="absolute inset-0 bg-black/55 z-30 flex items-center justify-center rounded-2xl">
              <div className="w-[94%] h-20 bg-gradient-to-b from-[#6e3b18] to-[#2e1505] border-4 border-[#ffd700] rounded-full flex items-center justify-around px-6 shadow-[0_0_40px_#ffae00] font-rye animate-pulse">
                <span className="text-lg text-[#cfa16b]">x2</span>
                <span className="text-xl text-[#cfa16b]">x4</span>
                <span className="text-5xl text-[#ffe588] drop-shadow-[0_0_15px_#ff9900]">
                  x{MULTIPLIERS[multIndex]}
                </span>
                <span className="text-xl text-[#cfa16b]">x16</span>
                <span className="text-lg text-[#cfa16b]">x32</span>
              </div>
            </div>
          )}
        </div>

        {/* 3. Transparent Hotspot over the Background's FEATURE BUY Plaque */}
        {!inFreeSpins && (
          <button
            onClick={() => !isSpinning && setShowFeatureBuyModal(true)}
            className="absolute top-[59.5%] right-[0%] w-[31%] h-[8.5%] z-20 cursor-pointer rounded-l-xl active:scale-95 transition hover:bg-amber-400/10"
            title="Feature Buy"
          />
        )}

        {/* 4. Win Announcement / Marquee Banner Overlay covering the Background's Horseshoe Bar text */}
        <div
          className="absolute top-[69.2%] left-[5.5%] right-[5.5%] h-[4.8%] z-20 rounded-md flex items-center justify-center overflow-hidden px-3"
          style={{
            background: 'linear-gradient(180deg, #5c3318 0%, #44230e 50%, #301707 100%)',
          }}
        >
          {bannerState.mode === 'marquee' && (
            <span className="font-rye text-[12px] tracking-wider text-[#e2d4b7] uppercase truncate">
              {MARQUEE_TIPS[tipIndex]}
            </span>
          )}

          {bannerState.mode === 'one_more' && (
            <div className="font-rye text-sm text-[#ffd700] flex items-center gap-2 animate-pulse">
              <span>ONE MORE</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-600 text-[10px] text-white border border-yellow-300">
                SCATTER
              </span>
              <span>!</span>
            </div>
          )}

          {bannerState.mode === 'free_spins_won' && (
            <div className="font-rye text-base text-[#ffe57f] tracking-wider animate-bounce">
              FREE SPINS WON!
            </div>
          )}

          {bannerState.mode === 'step_base' && (
            <div className="font-rye text-lg text-[#fff3b0] drop-shadow">
              {(bannerState.amount || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          )}

          {bannerState.mode === 'step_win' && (
            <div className="font-rye text-lg text-[#ffd700] drop-shadow-[0_0_10px_#ff8c00] flex items-center gap-2">
              <span className="text-xs text-[#ffdd80]">WIN</span>
              <span>
                {(bannerState.amount || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {bannerState.mode === 'total_win' && (
            <div className="font-rye text-lg text-[#ffe57f] drop-shadow-[0_0_12px_#ffae00] flex items-center gap-2">
              <span className="text-[10px] leading-tight text-right text-[#ffd269]">
                TOTAL<br />WIN
              </span>
              <span className="text-xl">
                {(bannerState.amount || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
        </div>

        {/* 5. Status Values positioned inside the 3 Pill Boxes of the Background Image */}
        {/* Left Pill: Balance */}
        <div className="absolute top-[74.8%] left-[9%] w-[29%] h-[4.4%] z-20 flex items-center justify-center">
          <span className="text-[12px] font-bold text-[#f5deb3] drop-shadow-[0_1px_2px_#000]">
            {currency}
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Center Pill: Bet Amount */}
        <div className="absolute top-[74.8%] left-[39.5%] w-[21%] h-[4.4%] z-20 flex items-center justify-center">
          <span className="text-[12px] font-bold text-[#ffd86b] drop-shadow-[0_1px_2px_#000]">
            {currency}
            {BET_OPTIONS[betIndex].toFixed(2)}
          </span>
        </div>

        {/* Right Pill: Current Win */}
        <div className="absolute top-[74.8%] right-[9%] w-[29%] h-[4.4%] z-20 flex items-center justify-center">
          <span className="text-[12px] font-bold text-[#f5deb3] drop-shadow-[0_1px_2px_#000]">
            {currency}
            {(inFreeSpins ? fsTotalWin : spinWinTotal).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* 6. Bottom Controls Mapped Directly Over Background Buttons */}
        {inFreeSpins ? (
          <div className="absolute bottom-0 inset-x-0 h-[19%] bg-gradient-to-b from-[#3d1e0a]/95 to-[#1a0b03]/95 border-t-[3px] border-[#d49b35] flex items-center justify-center z-20">
            {freeSpinsLeft === 0 ? (
              <div className="font-rye text-2xl text-[#ffd86b] tracking-widest drop-shadow-[0_2px_6px_#000]">
                LAST FREE SPIN
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="font-rye text-sm text-[#e6b875] leading-tight text-right">
                  REMAINING<br />FREE SPINS
                </div>
                <div className="font-rye text-5xl text-[#ffe380] drop-shadow-[0_0_15px_#ff8c00]">
                  {freeSpinsLeft}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Turbo Spin Toast Notification */}
            {turboToast && (
              <div className="absolute top-[79.5%] left-1/2 -translate-x-1/2 bg-black/85 border border-[#ffd700] rounded-full px-3.5 py-1 text-xs font-bold text-[#ffe380] shadow-lg whitespace-nowrap z-30">
                ⚡ {isTurbo ? 'Turbo Spin Enabled' : 'Turbo Spin Disabled'}
              </div>
            )}

            {/* Turbo Button Hotspot (aligned with lightning icon at bottom-left of background) */}
            <button
              onClick={() => {
                const next = !isTurbo;
                setIsTurbo(next);
                setTurboToast(true);
                setTimeout(() => setTurboToast(false), 1400);
              }}
              className={`absolute top-[81.5%] left-[5.5%] w-[11%] aspect-square rounded-full z-20 flex items-center justify-center transition ${
                isTurbo ? 'ring-2 ring-[#ffd700] bg-amber-500/25 shadow-[0_0_12px_#ffd700]' : 'hover:bg-white/10'
              }`}
              title="Turbo Spin"
            />

            {/* Minus Bet Hotspot (aligned with '-' circle on background) */}
            <button
              onClick={() => !isSpinning && betIndex > 0 && setBetIndex(betIndex - 1)}
              className="absolute top-[81.5%] left-[22%] w-[11%] aspect-square rounded-full z-20 active:scale-90 transition hover:bg-white/10"
              title="Decrease Bet"
            />

            {/* Center Wooden Bull-Horn Spin Button */}
            <button
              onClick={() => triggerSpin()}
              className="absolute top-[79.2%] left-1/2 -translate-x-1/2 w-[20.5%] aspect-square rounded-full bg-[radial-gradient(circle,#8c4c1e_0%,#421d06_85%)] border-4 border-[#d49b35] shadow-[0_0_24px_rgba(255,180,50,0.65),inset_0_0_14px_#000] flex items-center justify-center active:scale-95 transition z-20"
              title="Spin"
            >
              <svg
                viewBox="0 0 60 60"
                className={`w-11 h-11 ${isSpinning ? 'animate-spin' : ''}`}
              >
                <path
                  d="M15 24 A16 16 0 1 1 45 24"
                  fill="none"
                  stroke="#ffe082"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <polygon points="45,16 52,26 40,26" fill="#ffe082" />
                <path
                  d="M45 36 A16 16 0 1 1 15 36"
                  fill="none"
                  stroke="#ffe082"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <polygon points="15,44 8,34 20,34" fill="#ffe082" />
              </svg>
            </button>

            {/* Plus Bet Hotspot (aligned with '+' circle on background) */}
            <button
              onClick={() => !isSpinning && betIndex < BET_OPTIONS.length - 1 && setBetIndex(betIndex + 1)}
              className="absolute top-[81.5%] left-[67%] w-[11%] aspect-square rounded-full z-20 active:scale-90 transition hover:bg-white/10"
              title="Increase Bet"
            />

            {/* Auto Spin Hotspot (aligned with auto-play circle at bottom-right of background) */}
            <button
              onClick={() => {
                if (autoSpinsLeft > 0) {
                  setAutoSpinsLeft(0);
                } else {
                  setShowAutoDrawer(true);
                }
              }}
              className={`absolute top-[81.5%] left-[83.8%] w-[11%] aspect-square rounded-full z-20 flex items-center justify-center transition ${
                autoSpinsLeft > 0
                  ? 'ring-2 ring-[#ffd700] bg-[#8a5219]/90 text-white font-black text-xs'
                  : 'hover:bg-white/10'
              }`}
              title="Auto Spin"
            >
              {autoSpinsLeft > 0 ? autoSpinsLeft : null}
            </button>
          </>
        )}

        {/* Auto Spin Bottom Sheet Drawer */}
        {showAutoDrawer && (
          <div className="absolute inset-0 bg-black/70 z-40 flex flex-col justify-end">
            <div className="bg-[#24262b] border-t-2 border-[#8c6b3f] rounded-t-2xl p-4 text-white">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-sm text-gray-200">Auto Spin</h4>
                <button onClick={() => setShowAutoDrawer(false)} className="text-gray-400 text-lg">
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">Number of Auto Spins</p>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[10, 30, 50, 80, 1000].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedAutoCount(num)}
                    className={`py-2 rounded-lg font-bold text-xs border ${
                      selectedAutoCount === num
                        ? 'bg-[#3b2d1d] border-[#ffd700] text-[#ffd700]'
                        : 'bg-[#1a1c20] border-gray-700 text-gray-300'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowAutoDrawer(false);
                  setAutoSpinsLeft(selectedAutoCount);
                  autoLeftRef.current = selectedAutoCount;
                  triggerSpin();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-b from-[#d49b35] to-[#8c5818] text-[#1f0e03] font-black text-sm shadow-lg"
              >
                Start Auto Spin
              </button>
            </div>
          </div>
        )}

        {/* Feature Buy Parchment Modal */}
        {showFeatureBuyModal && (
          <div className="absolute inset-0 bg-black/80 z-40 flex items-center justify-center p-5">
            <div className="bg-gradient-to-b from-[#d9be96] to-[#b59469] border-4 border-[#5e3414] rounded-2xl p-5 text-center w-full max-w-[330px] shadow-2xl text-[#3b1d08]">
              <div className="bg-[#5e3414] text-[#ffd86b] font-rye text-xl py-1.5 px-4 rounded-lg inline-block -mt-9 mb-3 border-2 border-[#d49b35] shadow">
                FEATURE BUY
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#5e3414]">COST</p>
              <div className="font-rye text-3xl text-[#421d06] my-2">
                {currency}
                {(BET_OPTIONS[betIndex] * 75).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] font-bold text-[#4d290f] mb-5 leading-relaxed">
                SELECT &ldquo;START&rdquo; TO TRIGGER THE FREE SPINS FEATURE AT THE CURRENT BET SIZE &amp; BET LEVEL.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowFeatureBuyModal(false)}
                  className="bg-gradient-to-b from-[#7a3b1e] to-[#4a1f0b] border-2 border-[#d49b35] text-[#ffd86b] font-rye py-2.5 rounded-lg text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    const cost = BET_OPTIONS[betIndex] * 75;
                    if (balance < cost) {
                      alert('Insufficient Balance for Feature Buy!');
                      return;
                    }
                    const nextBal = balance - cost;
                    setBalance(nextBal);
                    setShowFeatureBuyModal(false);
                    triggerSpin({ forceFeatureBuy: true, overrideBalance: nextBal });
                  }}
                  className="bg-gradient-to-b from-[#ffd700] to-[#b86f09] border-2 border-[#fff3b0] text-[#2b1100] font-rye py-2.5 rounded-lg text-sm shadow-md"
                >
                  START
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 10 FREE SPINS Cowgirl Splash Screen */}
        {fsSplashOpen && (
          <div className="absolute inset-0 z-50 bg-[radial-gradient(circle_at_center,#f59e0b_0%,#7c2d12_65%,#1c0a03_100%)] flex flex-col items-center justify-between p-6 text-center">
            <div className="mt-6">
              <div className="text-7xl mb-2 drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]">🤠🔫</div>
              <div
                className="font-rye text-7xl text-[#ffe57f] leading-none"
                style={{ WebkitTextStroke: '3px #6b2f06', textShadow: '0 6px 15px #000' }}
              >
                {fsAwardedCount}
              </div>
              <div
                className="font-rye text-3xl text-[#ffd700] mt-1"
                style={{ WebkitTextStroke: '1.5px #5c2604' }}
              >
                FREE SPINS
              </div>
            </div>

            <p className="font-rye text-sm text-[#fff3c4] leading-relaxed drop-shadow max-w-[280px]">
              EVERY FREE SPIN STARTS WITH X8 MULTIPLIER! MULTIPLIER DOUBLES AFTER EVERY WIN!
            </p>

            <button
              onClick={startFreeSpinsFeature}
              className="mb-8 bg-gradient-to-b from-[#ffd700] via-[#d97706] to-[#78350f] border-[3px] border-[#fef08a] text-[#fff8d6] font-rye text-2xl px-12 py-3 rounded-xl shadow-[0_0_30px_rgba(255,215,0,0.8)] active:scale-95"
            >
              🔫 START 🔫
            </button>
          </div>
        )}

        {/* Free Spins TOTAL WIN Summary Screen */}
        {fsSummaryOpen && (
          <div className="absolute inset-0 z-50 bg-[radial-gradient(circle_at_center,#fbbf24_0%,#92400e_65%,#1c0a03_100%)] flex flex-col items-center justify-between p-6 text-center">
            <div className="mt-10">
              <div className="text-7xl mb-3">🤠✨</div>
              <h2
                className="font-rye text-4xl text-[#ffe57f] mb-3"
                style={{ WebkitTextStroke: '2px #5c2604', textShadow: '0 4px 10px #000' }}
              >
                TOTAL WIN
              </h2>
              <div
                className="font-rye text-5xl text-white"
                style={{ WebkitTextStroke: '2px #78350f', textShadow: '0 0 25px #ff8c00' }}
              >
                {fsSummaryCountUp.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            <button
              onClick={collectFreeSpinsSummary}
              className="mb-10 bg-gradient-to-b from-[#ffd700] via-[#d97706] to-[#78350f] border-[3px] border-[#fef08a] text-[#fff8d6] font-rye text-xl px-10 py-3 rounded-xl shadow-[0_0_25px_rgba(255,215,0,0.8)] active:scale-95"
            >
              🔫 COLLECT 🔫
            </button>
          </div>
        )}

        {/* Tiered BIG WIN / MEGA WIN / SUPER MEGA WIN Overlay */}
        {bigWinData !== null && (() => {
          const ratio = bigWinData.current / bigWinData.bet;
          const tier =
            ratio >= 50 ? 'SUPER MEGA WIN' : ratio >= 30 ? 'MEGA WIN' : 'BIG WIN';
          return (
            <div
              onClick={() => setBigWinData({ ...bigWinData, current: bigWinData.total })}
              className="absolute inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-5 text-center overflow-hidden"
            >
              <div className="absolute inset-0 pointer-events-none flex justify-around">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <span
                    key={n}
                    className="text-3xl coin-particle"
                    style={{ animationDelay: `${n * 0.22}s` }}
                  >
                    🪙
                  </span>
                ))}
              </div>

              <div className="relative bg-[radial-gradient(circle,#92400e_0%,#3b1704_75%)] border-4 border-[#ffd700] rounded-3xl p-7 w-full max-w-[350px] shadow-[0_0_60px_#ffae00]">
                <div className="text-6xl -mt-14 mb-2 drop-shadow">
                  {tier === 'SUPER MEGA WIN' ? '🤠⭐⭐⭐' : tier === 'MEGA WIN' ? '🎩✨' : '🤠'}
                </div>
                <h2
                  className="font-rye text-3xl text-[#ffd700] mb-3 leading-tight"
                  style={{ WebkitTextStroke: '1.5px #451a03', textShadow: '0 4px 10px #000' }}
                >
                  {tier}
                </h2>
                <div
                  className="font-rye text-4xl text-[#fff9c4]"
                  style={{ WebkitTextStroke: '2px #78350f', textShadow: '0 0 25px #ff9900' }}
                >
                  {bigWinData.current.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Paytable & Rules Modal */}
        {showInfoModal && (
          <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1b1b22] border-2 border-[#b58d3d] rounded-xl w-full max-w-[380px] max-h-[82vh] flex flex-col overflow-hidden">
              <div className="bg-[#121217] px-4 py-3 flex justify-between items-center border-b border-gray-700">
                <h3 className="text-[#e6c15c] font-bold text-sm">Paytable &amp; Game Rules</h3>
                <button onClick={() => setShowInfoModal(false)} className="text-gray-400 text-lg">
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto text-xs space-y-3 text-gray-200">
                <p className="text-[#ffd86b] font-bold">
                  Wild Bounty Showdown (3-4-5-5-4-3 Grid • 3,600 Ways)
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-gray-300">
                  <li>Gold Framed symbols appear on reels 3 &amp; 4 only and transform into WILD after winning.</li>
                  <li>Win Multiplier starts at x1 (or x8 in Free Spins) and doubles after every cascade up to x1024.</li>
                  <li>3 or more SCATTER symbols trigger 10 Free Spins (+2 for each additional Scatter).</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
