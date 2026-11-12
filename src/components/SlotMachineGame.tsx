import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Coins,
  Crosshair,
  Crown,
  FlaskConical,
  Gift,
  Gem,
  Info,
  Minus,
  Plus,
  RotateCw,
  Shield,
  Sparkles,
  UserRound,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import AutoSpinModal from './AutoSpinModal';
import { SlotMachineSound } from '@/lib/slotMachineSound';

interface SlotMachineGameProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
}

type SymbolId = 'wild' | 'scatter' | 'sheriff' | 'outlaw' | 'cowgirl' | 'revolver' | 'whiskey' | 'gold' | 'A' | 'K' | 'Q' | 'J' | '10' | '9';
type SymbolIcon = typeof Crown;

interface SlotSymbol {
  id: SymbolId;
  label: string;
  shortLabel: string;
  icon: SymbolIcon;
  color: string;
  value: number;
  premium?: boolean;
}

interface Cell {
  symbol: SlotSymbol;
  multiplier: number;
}

const SYMBOLS: SlotSymbol[] = [
  { id: 'wild', label: 'Wild Rider', shortLabel: 'WILD', icon: UserRound, color: '#f8c15c', value: 60 },
  { id: 'scatter', label: 'Sheriff Badge', shortLabel: 'SCATTER', icon: Badge, color: '#ffdf75', value: 0 },
  { id: 'sheriff', label: 'Sheriff', shortLabel: 'SHERIFF', icon: Shield, color: '#d9a441', value: 28, premium: true },
  { id: 'outlaw', label: 'Outlaw', shortLabel: 'OUTLAW', icon: Crosshair, color: '#d97954', value: 22, premium: true },
  { id: 'cowgirl', label: 'Cowgirl', shortLabel: 'COWGIRL', icon: UserRound, color: '#f18a72', value: 18, premium: true },
  { id: 'revolver', label: 'Revolver', shortLabel: 'REVOLVER', icon: Crosshair, color: '#b9d6dd', value: 14, premium: true },
  { id: 'whiskey', label: 'Whiskey', shortLabel: 'WHISKEY', icon: FlaskConical, color: '#e89b44', value: 12, premium: true },
  { id: 'gold', label: 'Gold Bar', shortLabel: 'GOLD', icon: Gem, color: '#f7d66b', value: 10, premium: true },
  { id: 'A', label: 'Ace', shortLabel: 'A', icon: Crown, color: '#f4d27c', value: 8 },
  { id: 'K', label: 'King', shortLabel: 'K', icon: Crown, color: '#e77966', value: 7 },
  { id: 'Q', label: 'Queen', shortLabel: 'Q', icon: Crown, color: '#8dc3a2', value: 6 },
  { id: 'J', label: 'Jack', shortLabel: 'J', icon: Crown, color: '#9fc7dc', value: 5 },
  { id: '10', label: 'Ten', shortLabel: '10', icon: Crown, color: '#cf986b', value: 4 },
  { id: '9', label: 'Nine', shortLabel: '9', icon: Crown, color: '#a4b276', value: 3 },
];

const PAYTABLE = [
  { ids: ['wild'], title: 'Wild Rider', values: '3: 8x  •  4: 20x  •  5: 60x' },
  { ids: ['sheriff', 'outlaw', 'cowgirl'], title: 'Premium characters', values: '3: 4x  •  4: 9x  •  5: 28x' },
  { ids: ['revolver', 'whiskey', 'gold'], title: 'Premium treasures', values: '3: 3x  •  4: 6x  •  5: 14x' },
  { ids: ['A', 'K', 'Q', 'J', '10', '9'], title: 'Card symbols', values: '3: 1x  •  4: 3x  •  5: 8x' },
];

const MULTIPLIERS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
const BETS = [1, 2, 5, 10, 20, 50, 100];
const REELS = 5;
const ROWS = 3;

function weightedSymbol(): SlotSymbol {
  const pool = SYMBOLS.flatMap((symbol) => Array(Math.max(1, 22 - symbol.value)).fill(symbol));
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeBoard(): Cell[][] {
  return Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => ({ symbol: weightedSymbol(), multiplier: 0 })));
}

function payoutFor(symbol: SlotSymbol, count: number): number {
  if (count < 3 || symbol.id === 'scatter') return 0;
  const base = symbol.value;
  return count === 3 ? Math.max(1, Math.round(base / 7)) : count === 4 ? Math.max(2, Math.round(base / 3)) : base;
}

function matches(symbol: SlotSymbol, target: SlotSymbol): boolean {
  return symbol.id === target.id || symbol.id === 'wild' || target.id === 'wild';
}

function SymbolTile({ cell, active, compact = false }: { cell: Cell; active: boolean; compact?: boolean }) {
  const Icon = cell.symbol.icon;
  return (
    <div
      className={`relative flex h-full min-h-0 items-center justify-center overflow-hidden rounded-lg border transition-all duration-300 ${
        active ? 'border-[#ffe28b] bg-[#5a351f] shadow-[0_0_18px_rgba(255,199,71,.8)] scale-[1.04]' : 'border-[#8c5a31]/80 bg-[#291811]/90'
      }`}
      style={{ color: cell.symbol.color }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,226,139,.16),transparent_62%)]" />
      <div className="relative flex flex-col items-center justify-center gap-1">
        <div className={`${compact ? 'h-7 w-7' : 'h-11 w-11'} flex items-center justify-center rounded-full border border-current/50 bg-black/20 shadow-inner`}>
          <Icon size={compact ? 15 : 25} strokeWidth={1.8} />
        </div>
        <span className={`${compact ? 'text-[6px]' : 'text-[8px]'} max-w-full px-1 text-center font-black tracking-[.08em] text-[#f8e7b0]`}>
          {cell.symbol.shortLabel}
        </span>
      </div>
      {cell.multiplier > 0 && (
        <span className="absolute right-1 top-1 rounded-full border border-[#ffe28b] bg-[#9a4c18] px-1 py-0.5 text-[7px] font-black text-[#fff4bf] shadow-[0_0_8px_rgba(255,187,43,.8)]">
          x{cell.multiplier}
        </span>
      )}
    </div>
  );
}

export default function SlotMachineGame({ balance: _balance, onBetPlaced: _onBetPlaced, onWin: _onWin }: SlotMachineGameProps) {
  const [board, setBoard] = useState<Cell[][]>(() => makeBoard());
  const [bet, setBet] = useState(5);
  const [demoCredits, setDemoCredits] = useState(5000);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [win, setWin] = useState(0);
  const [message, setMessage] = useState('Place your bet and ride into the sunset');
  const [freeSpins, setFreeSpins] = useState(0);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [showPaytable, setShowPaytable] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [autoSpins, setAutoSpins] = useState(0);
  const [showAuto, setShowAuto] = useState(false);
  const soundRef = useRef<SlotMachineSound | null>(null);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sound = useCallback((name: 'spin' | 'win' | 'click') => {
    if (!soundRef.current) return;
    soundRef.current.unlock();
    if (name === 'spin') soundRef.current.startSpin();
    if (name === 'win') soundRef.current.playWin();
    if (name === 'click') soundRef.current.playClick();
  }, []);

  useEffect(() => {
    soundRef.current = new SlotMachineSound();
    setMuted(soundRef.current.isMuted());
    return () => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
      soundRef.current?.stopSpin();
    };
  }, []);

  const totalWin = useMemo(() => win + bonusTotal, [bonusTotal, win]);

  const spin = useCallback((bonusSpin = false) => {
    if (spinning) return;
    const cost = bonusSpin ? 0 : bet;
    if (!bonusSpin && demoCredits < cost) {
      setMessage('Not enough demo credits');
      return;
    }
    setSpinning(true);
    setWin(0);
    setBonusTotal(0);
    setHighlighted(new Set());
    if (!bonusSpin) setDemoCredits((current) => current - cost);
    sound('spin');
    const next = makeBoard();
    const nextHighlight = new Set<string>();
    const target = weightedSymbol();
    if (Math.random() < 0.34) {
      for (let reel = 0; reel < 3 + Math.floor(Math.random() * 3); reel++) next[reel][1] = { symbol: target, multiplier: 0 };
    }
    if (Math.random() < 0.11) {
      const scatterCount = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < scatterCount; i++) {
        const reel = Math.floor(Math.random() * REELS);
        const row = Math.floor(Math.random() * ROWS);
        next[reel][row] = { symbol: SYMBOLS[1], multiplier: 0 };
      }
    }
    for (let reel = 2; reel < REELS; reel++) {
      for (let row = 0; row < ROWS; row++) {
        if (next[reel][row].symbol.premium && Math.random() < 0.16) {
          next[reel][row].multiplier = MULTIPLIERS[Math.floor(Math.random() * 5)];
        }
      }
    }
    const delay = turbo ? 650 : 1850;
    spinTimer.current = setTimeout(() => {
      let baseWin = 0;
      for (const symbol of SYMBOLS.filter((item) => item.id !== 'scatter' && item.id !== 'wild')) {
        let count = 0;
        for (let reel = 0; reel < REELS; reel++) {
          if (next[reel].some((cell) => matches(cell.symbol, symbol))) count++;
          else break;
        }
        if (count >= 3) {
          baseWin += payoutFor(symbol, count) * bet;
          for (let reel = 0; reel < count; reel++) {
            next[reel].forEach((cell, row) => {
              if (matches(cell.symbol, symbol)) nextHighlight.add(`${reel}-${row}`);
            });
          }
        }
      }
      const scatterCount = next.flat().filter((cell) => cell.symbol.id === 'scatter').length;
      const frameMultiplier = next.flat().filter((cell) => cell.multiplier > 0).reduce((sum, cell) => sum + cell.multiplier, 0);
      const payout = baseWin * Math.max(1, frameMultiplier || 1);
      const earnedFreeSpins = scatterCount >= 3 ? 8 + Math.max(0, scatterCount - 3) * 2 : 0;
      setBoard(next);
      setHighlighted(nextHighlight);
      setWin(payout);
      setDemoCredits((current) => current + payout);
      if (earnedFreeSpins > 0) {
        setFreeSpins((current) => current + earnedFreeSpins);
        setMessage(`${earnedFreeSpins} free spins unlocked`);
      } else if (payout > 0) {
        setMessage(payout >= bet * 20 ? 'BIG WIN — the bounty is yours' : 'Winning ways');
        sound('win');
      } else {
        setMessage('No bounty this round — spin again');
      }
      soundRef.current?.stopSpin();
      setSpinning(false);
      if (bonusSpin) setBonusTotal(payout);
      if (autoSpins > 0) setAutoSpins((current) => current - 1);
    }, delay);
  }, [autoSpins, bet, demoCredits, sound, spinning, turbo]);

  useEffect(() => {
    if (!spinning && freeSpins > 0) {
      const timer = setTimeout(() => {
        setFreeSpins((current) => current - 1);
        spin(true);
      }, turbo ? 450 : 900);
      return () => clearTimeout(timer);
    }
    if (!spinning && freeSpins === 0 && autoSpins > 0) {
      const timer = setTimeout(() => spin(false), turbo ? 250 : 700);
      return () => clearTimeout(timer);
    }
  }, [autoSpins, freeSpins, spin, spinning, turbo]);

  const buyFeature = () => {
    const price = bet * 100;
    if (demoCredits < price) {
      setMessage('Not enough demo credits for Feature Buy');
      setShowBuy(false);
      return;
    }
    setDemoCredits((current) => current - price);
    setFreeSpins((current) => current + 8);
    setMessage('Feature Buy complete — bonus round ready');
    setShowBuy(false);
    sound('win');
  };

  const adjustBet = (direction: number) => {
    sound('click');
    const index = BETS.indexOf(bet);
    setBet(BETS[Math.max(0, Math.min(BETS.length - 1, index + direction))]);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#100b09] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(177,106,39,.42),transparent_44%),linear-gradient(180deg,#2c180f_0%,#110b09_50%,#080707_100%)]" />
      <div className="relative shrink-0 border-b border-[#a46b32]/50 bg-[#3a2115]/90 px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f3c867] bg-[#5c2e17] text-[#ffd978] shadow-[0_0_14px_rgba(255,191,54,.35)]"><Crown size={19} /></div>
            <div><p className="font-display text-sm font-black tracking-[.12em] text-[#ffe2a0]">WILD FRONTIER</p><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#bd8550]">Bounty reels</p></div>
          </div>
          <button onClick={() => { sound('click'); setShowPaytable(true); }} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#9e6a35] bg-black/20 text-[#f6d27b] active:scale-90"><Info size={17} /></button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 pt-2">
        <div className="mx-auto w-full max-w-md">
          <div className="relative mb-2 overflow-hidden rounded-[22px] border-2 border-[#bf843a] bg-[#542c19] px-3 py-2 shadow-[0_5px_24px_rgba(0,0,0,.5),inset_0_1px_rgba(255,224,140,.28)]">
            <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_7px,rgba(255,224,140,.06)_8px),linear-gradient(90deg,transparent,rgba(255,213,112,.22),transparent)]" />
            <div className="relative flex items-center justify-between text-center">
              <div><p className="text-[9px] font-black text-[#d69c58]">GOLD FRAMES</p><p className="text-[10px] font-bold text-[#ffe8ac]">REELS 3–5</p></div>
              <div className="border-x border-[#d99b4b]/40 px-5"><p className="font-display text-3xl font-black text-[#ffeab0] drop-shadow-[0_2px_2px_rgba(0,0,0,.75)]">x{Math.max(1, board.flat().reduce((sum, cell) => sum + cell.multiplier, 0) || 1)}</p><p className="text-[8px] font-black uppercase tracking-[.2em] text-[#c68a49]">bounty multiplier</p></div>
              <div><p className="text-[9px] font-black text-[#d69c58]">WAYS</p><p className="text-[10px] font-bold text-[#ffe8ac]">3125</p></div>
            </div>
          </div>

          <div className="relative rounded-[22px] border-2 border-[#9d642c] bg-[#2a1710] p-2 shadow-[0_8px_30px_rgba(0,0,0,.65),inset_0_0_30px_rgba(0,0,0,.65)]">
            <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-[31%] -translate-y-1/2 rounded border-y border-[#f4be4e]/30 bg-[#f2b64d]/[.04]" />
            <div className="grid grid-cols-5 gap-1.5">
              {board.map((reel, reelIndex) => (
                <div key={reelIndex} className={`grid aspect-[.7] grid-rows-3 gap-1 overflow-hidden rounded-lg bg-[#170d09] p-1 ${spinning ? 'animate-pulse' : ''}`} style={{ animationDelay: `${reelIndex * 70}ms` }}>
                  {reel.map((cell, row) => <SymbolTile key={`${reelIndex}-${row}`} cell={cell} active={highlighted.has(`${reelIndex}-${row}`)} />)}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-[#9b632e]/60 bg-[#120b08]/80 px-3 py-1.5">
              <span className="text-[9px] font-black uppercase tracking-[.16em] text-[#c79459]">{message}</span>
              {freeSpins > 0 && <span className="flex items-center gap-1 text-[10px] font-black text-[#ffe07b]"><Sparkles size={12} /> {freeSpins} FREE</span>}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between rounded-xl border border-[#744922] bg-[#27150d]/90 px-3 py-2">
            <div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#a7754a]">Demo credits</p><p className="font-display text-lg font-black text-[#f5cf73]">৳{demoCredits.toFixed(2)}</p></div>
            <div className="text-right"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#a7754a]">Last win</p><p className="font-display text-lg font-black text-[#e9a74b]">৳{totalWin.toFixed(2)}</p></div>
          </div>

          <div className="mt-2 flex gap-2">
            <button onClick={() => setShowBuy(true)} disabled={spinning} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#c8873d] bg-gradient-to-b from-[#78421f] to-[#3f2113] px-2 py-2 text-[10px] font-black uppercase tracking-[.1em] text-[#ffe1a0] shadow-[inset_0_1px_rgba(255,239,172,.2)] disabled:opacity-50"><Gift size={14} /> Feature Buy</button>
            <button onClick={() => { setTurbo((value) => !value); sound('click'); }} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[.1em] ${turbo ? 'border-[#f5cc68] bg-[#aa641d] text-white' : 'border-[#744922] bg-[#27150d] text-[#c99b60]'}`}><Zap size={14} /> Turbo</button>
          </div>
        </div>
      </div>

      <div className="relative shrink-0 border-t border-[#8d5a2b] bg-[#24130d]/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_25px_rgba(0,0,0,.4)]">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <button onClick={() => { setMuted((value) => { soundRef.current?.setMuted(!value); return !value; }); sound('click'); }} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#70471f] bg-[#160d09] text-[#d6a25b] active:scale-90">{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
          <button onClick={() => adjustBet(-1)} disabled={spinning} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#70471f] bg-[#160d09] text-[#e7bd6b] disabled:opacity-40"><Minus size={18} /></button>
          <div className="min-w-[78px] text-center"><p className="text-[8px] font-black uppercase tracking-[.18em] text-[#a7754a]">Bet</p><p className="font-display text-xl font-black text-[#ffe092]">৳{bet.toFixed(2)}</p></div>
          <button onClick={() => adjustBet(1)} disabled={spinning} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#70471f] bg-[#160d09] text-[#e7bd6b] disabled:opacity-40"><Plus size={18} /></button>
          <button onClick={() => spin(false)} disabled={spinning} className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border-4 border-[#f3cb65] bg-[radial-gradient(circle_at_35%_25%,#fbd879,#ad5b1b_48%,#4b2110)] text-[#fff0b0] shadow-[0_0_20px_rgba(244,177,57,.55),inset_0_-6px_10px_rgba(56,17,3,.5)] active:scale-95 disabled:animate-pulse disabled:opacity-70"><RotateCw size={30} className={spinning ? 'animate-spin' : ''} /></button>
          <button onClick={() => setShowAuto(true)} disabled={spinning} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#70471f] bg-[#160d09] text-[#d6a25b] disabled:opacity-40"><Sparkles size={17} /></button>
        </div>
        <p className="mt-1 text-center text-[8px] font-bold uppercase tracking-[.18em] text-[#865a36]">Play-money mode • no real balance changes</p>
      </div>

      <AutoSpinModal isOpen={showAuto} onClose={() => setShowAuto(false)} onStart={(count) => { setAutoSpins(count); setShowAuto(false); spin(false); }} betAmount={bet} balance={demoCredits} />

      {showBuy && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm" onClick={() => setShowBuy(false)}><div className="w-full max-w-sm rounded-2xl border border-[#d69b4a] bg-[#2a1710] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-display text-xl font-black text-[#ffe09a]">Feature Buy</h2><button onClick={() => setShowBuy(false)} className="text-[#d4a264]"><X size={20} /></button></div><p className="mt-2 text-sm leading-6 text-[#cda77d]">Enter the bonus round with 8 free spins and boosted gold-frame potential.</p><div className="my-4 rounded-xl border border-[#85532a] bg-black/20 p-3 text-center"><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#a87548]">Demo price</p><p className="font-display text-3xl font-black text-[#f4ca70]">৳{(bet * 100).toFixed(2)}</p></div><button onClick={buyFeature} className="w-full rounded-xl bg-gradient-to-r from-[#c37b2c] to-[#f2c765] py-3 font-black uppercase tracking-[.12em] text-[#2d1609]">Confirm Feature Buy</button></div></div>}

      {showPaytable && <div className="absolute inset-0 z-30 overflow-y-auto bg-[#17100d]/95 p-4 backdrop-blur-sm"><div className="mx-auto max-w-sm pb-8"><div className="mb-5 flex items-center justify-between"><div><p className="font-display text-2xl font-black text-[#ffe09a]">Paytable</p><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a87648]">Wild Frontier rules</p></div><button onClick={() => setShowPaytable(false)} className="text-[#d4a264]"><X size={22} /></button></div><div className="space-y-2">{PAYTABLE.map((entry) => <div key={entry.title} className="rounded-xl border border-[#704721] bg-[#2a1710] p-3"><div className="flex items-center gap-2">{entry.ids.slice(0, 3).map((id) => { const symbol = SYMBOLS.find((item) => item.id === id)!; return <SymbolTile key={id} cell={{ symbol, multiplier: 0 }} active={false} compact />; })}<div><p className="text-sm font-black text-[#f7d589]">{entry.title}</p><p className="mt-1 text-[10px] font-bold text-[#c99b68]">{entry.values}</p></div></div></div>)}</div><div className="mt-3 rounded-xl border border-[#704721] bg-[#2a1710] p-4 text-xs leading-6 text-[#d0ad82]"><p><strong className="text-[#f7d589]">Wild:</strong> substitutes for every symbol except Scatter.</p><p><strong className="text-[#f7d589]">Scatter:</strong> 3 or more awards 8 free spins; extra scatters add spins.</p><p><strong className="text-[#f7d589]">Gold frames:</strong> appear on reels 3–5 and add only the multiplier actually shown.</p><p><strong className="text-[#f7d589]">Feature Buy:</strong> costs 100x the selected bet in demo credits.</p></div></div></div>}
    </div>
  );
}
