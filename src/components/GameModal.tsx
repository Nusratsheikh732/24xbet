import { useState, useRef, useEffect } from 'react';
import { X, Play, RotateCcw, Coins, Dices, Disc, Spade, ChevronRight } from 'lucide-react';
import { openModal, closeModal } from '@/hooks/useModalState';
import type { Game } from '@/types';

interface GameModalProps {
  game: Game;
  balance: number;
  onClose: () => void;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
}

const QUICK_BETS = [5, 10, 50, 100];

// ── Slot Machine ──────────────────────────────────────
const SLOT_SYMBOLS = ['7', 'BAR', '★', '♦', '♣', '♥'];

function SlotsGame({ balance, onBetPlaced, onWin }: { balance: number; onBetPlaced: (a: number) => void; onWin: (a: number) => void }) {
  const [bet, setBet] = useState(10);
  const [reels, setReels] = useState(['7', '★', '♦']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (spinRef.current) clearInterval(spinRef.current); };
  }, []);

  const spin = () => {
    if (spinning || balance < bet || bet <= 0) return;
    setSpinning(true);
    setResult(null);
    setLastWin(null);
    onBetPlaced(bet);

    let ticks = 0;
    spinRef.current = setInterval(() => {
      setReels([
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      ]);
      ticks++;
      if (ticks > 20) {
        if (spinRef.current) clearInterval(spinRef.current);
        // Final result — 15% chance of win
        const win = Math.random() < 0.15;
        if (win) {
          const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          setReels([sym, sym, sym]);
          const mult = sym === '7' ? 10 : sym === 'BAR' ? 5 : 3;
          const winAmt = bet * mult;
          setLastWin(winAmt);
          onWin(winAmt);
          setResult(`JACKPOT! ${sym} x3 — ${mult}x win!`);
        } else {
          const r1 = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          let r2 = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          let r3 = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          // Ensure not all 3 match
          if (r1 === r2 && r2 === r3) r3 = SLOT_SYMBOLS[(SLOT_SYMBOLS.indexOf(r3) + 1) % SLOT_SYMBOLS.length];
          setReels([r1, r2, r3]);
          // Check for 2-match partial win
          if (r1 === r2 || r2 === r3 || r1 === r3) {
            const winAmt = bet * 1.5;
            setLastWin(winAmt);
            onWin(winAmt);
            setResult('Two matched — 1.5x partial win!');
          } else {
            setResult('No match — try again!');
          }
        }
        setSpinning(false);
      }
    }, 80);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 py-6 bg-gradient-to-b from-dark-card2 to-dark-bg rounded-xl border border-dark-border">
        {reels.map((r, i) => (
          <div
            key={i}
            className={`w-16 h-20 rounded-lg flex items-center justify-center font-display text-2xl font-bold border-2 transition-all ${
              spinning ? 'border-neon-green/30 animate-pulse-soft' : 'border-neon-gold/40'
            } bg-dark-card`}
            style={{ color: r === '7' ? '#ffd700' : r === 'BAR' ? '#ff3366' : '#00ff88' }}
          >
            {spinning ? '⟳' : r}
          </div>
        ))}
      </div>

      {result && (
        <div className={`text-center text-sm font-bold animate-scale-in ${lastWin ? 'text-neon-green' : 'text-gray-400'}`}>
          {result}
          {lastWin && <div className="text-neon-green text-lg mt-1">+৳{lastWin.toFixed(2)}</div>}
        </div>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={spinning} balance={balance} />
      <button
        onClick={spin}
        disabled={spinning || balance < bet || bet <= 0}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        <Coins size={18} strokeWidth={2.5} />
        {spinning ? 'Spinning...' : `Spin ৳${bet}`}
      </button>
    </div>
  );
}

// ── Dice Game ─────────────────────────────────────────
function DiceGame({ balance, onBetPlaced, onWin }: { balance: number; onBetPlaced: (a: number) => void; onWin: (a: number) => void }) {
  const [bet, setBet] = useState(10);
  const [prediction, setPrediction] = useState<'over' | 'under'>('over');
  const [target, setTarget] = useState(50);
  const [dice, setDice] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);

  const roll = () => {
    if (rolling || balance < bet || bet <= 0) return;
    setRolling(true);
    setResult(null);
    setLastWin(null);
    onBetPlaced(bet);

    let ticks = 0;
    const interval = setInterval(() => {
      setDice(Math.floor(Math.random() * 100) + 1);
      ticks++;
      if (ticks > 15) {
        clearInterval(interval);
        const final = Math.floor(Math.random() * 100) + 1;
        setDice(final);
        const won = prediction === 'over' ? final > target : final < target;
        if (won) {
          // Payout based on probability
          const prob = prediction === 'over' ? (100 - target) / 100 : target / 100;
          const mult = Math.max(1.1, (0.97 / prob));
          const winAmt = parseFloat((bet * mult).toFixed(2));
          setLastWin(winAmt);
          onWin(winAmt);
          setResult(`Rolled ${final} — You won!`);
        } else {
          setResult(`Rolled ${final} — You lost!`);
        }
        setRolling(false);
      }
    }, 60);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-6 bg-gradient-to-b from-dark-card2 to-dark-bg rounded-xl border border-dark-border">
        <div className={`w-20 h-20 rounded-2xl bg-dark-card border-2 border-neon-green/40 flex items-center justify-center font-display text-3xl font-bold text-neon-green ${rolling ? 'animate-pulse-soft' : ''}`}>
          {dice ?? '?'}
        </div>
        <p className="text-xs text-gray-500 mt-2">Roll: 1–100</p>
      </div>

      {/* Prediction selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setPrediction('under')}
          className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
            prediction === 'under' ? 'bg-neon-blue/15 border-neon-blue text-neon-blue' : 'bg-dark-card2 border-dark-border text-gray-400'
          }`}
        >
          Roll Under {target}
        </button>
        <button
          onClick={() => setPrediction('over')}
          className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
            prediction === 'over' ? 'bg-neon-green/15 border-neon-green text-neon-green' : 'bg-dark-card2 border-dark-border text-gray-400'
          }`}
        >
          Roll Over {target}
        </button>
      </div>

      {/* Target slider */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Target: {target}</span>
          <span>Payout: {(prediction === 'over' ? (0.97 / ((100 - target) / 100)) : (0.97 / (target / 100))).toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min="5"
          max="95"
          value={target}
          onChange={(e) => setTarget(parseInt(e.target.value))}
          disabled={rolling}
          className="w-full accent-neon-green"
        />
      </div>

      {result && (
        <div className={`text-center text-sm font-bold animate-scale-in ${lastWin ? 'text-neon-green' : 'text-neon-red'}`}>
          {result}
          {lastWin && <div className="text-neon-green text-lg mt-1">+৳{lastWin.toFixed(2)}</div>}
        </div>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={rolling} balance={balance} />
      <button
        onClick={roll}
        disabled={rolling || balance < bet || bet <= 0}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        <Dices size={18} strokeWidth={2.5} />
        {rolling ? 'Rolling...' : `Roll Dice ৳${bet}`}
      </button>
    </div>
  );
}

// ── Coin Flip ─────────────────────────────────────────
function CoinFlipGame({ balance, onBetPlaced, onWin }: { balance: number; onBetPlaced: (a: number) => void; onWin: (a: number) => void }) {
  const [bet, setBet] = useState(10);
  const [pick, setPick] = useState<'heads' | 'tails'>('heads');
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [coinSide, setCoinSide] = useState<'heads' | 'tails' | null>(null);

  const flip = () => {
    if (flipping || balance < bet || bet <= 0) return;
    setFlipping(true);
    setResult(null);
    setLastWin(null);
    onBetPlaced(bet);

    let ticks = 0;
    const interval = setInterval(() => {
      setCoinSide(Math.random() < 0.5 ? 'heads' : 'tails');
      ticks++;
      if (ticks > 15) {
        clearInterval(interval);
        const final = Math.random() < 0.48 ? pick : (pick === 'heads' ? 'tails' : 'heads');
        setCoinSide(final);
        if (final === pick) {
          const winAmt = bet * 1.96;
          setLastWin(winAmt);
          onWin(winAmt);
          setResult(`${final.toUpperCase()} — You won!`);
        } else {
          setResult(`${final.toUpperCase()} — You lost!`);
        }
        setFlipping(false);
      }
    }, 80);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-6 bg-gradient-to-b from-dark-card2 to-dark-bg rounded-xl border border-dark-border">
        <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-neon-gold to-yellow-600 flex items-center justify-center font-display text-2xl font-bold text-dark-bg border-4 border-neon-gold/50 ${flipping ? 'animate-spin-slow' : ''}`}>
          {coinSide ? coinSide === 'heads' ? 'H' : 'T' : '?'}
        </div>
        <p className="text-xs text-gray-500 mt-2">{flipping ? 'Flipping...' : coinSide ? coinSide.toUpperCase() : 'Ready'}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['heads', 'tails'] as const).map((side) => (
          <button
            key={side}
            onClick={() => setPick(side)}
            disabled={flipping}
            className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
              pick === side ? 'bg-neon-gold/15 border-neon-gold text-neon-gold' : 'bg-dark-card2 border-dark-border text-gray-400'
            }`}
          >
            {side.toUpperCase()}
          </button>
        ))}
      </div>

      {result && (
        <div className={`text-center text-sm font-bold animate-scale-in ${lastWin ? 'text-neon-green' : 'text-neon-red'}`}>
          {result}
          {lastWin && <div className="text-neon-green text-lg mt-1">+৳{lastWin.toFixed(2)}</div>}
        </div>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={flipping} balance={balance} />
      <button
        onClick={flip}
        disabled={flipping || balance < bet || bet <= 0}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        <Disc size={18} strokeWidth={2.5} />
        {flipping ? 'Flipping...' : `Flip Coin ৳${bet}`}
      </button>
    </div>
  );
}

// ── Lucky Wheel ───────────────────────────────────────
const WHEEL_SEGMENTS = [
  { label: '2x', mult: 2, color: '#ff3366' },
  { label: '0', mult: 0, color: '#333' },
  { label: '3x', mult: 3, color: '#00ff88' },
  { label: '0', mult: 0, color: '#333' },
  { label: '5x', mult: 5, color: '#ffd700' },
  { label: '0', mult: 0, color: '#333' },
  { label: '2x', mult: 2, color: '#ff9500' },
  { label: '10x', mult: 10, color: '#00d4ff' },
];

function WheelGame({ balance, onBetPlaced, onWin }: { balance: number; onBetPlaced: (a: number) => void; onWin: (a: number) => void }) {
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);

  const spin = () => {
    if (spinning || balance < bet || bet <= 0) return;
    setSpinning(true);
    setResult(null);
    setLastWin(null);
    onBetPlaced(bet);

    // Weighted result — 60% lose
    const isLose = Math.random() < 0.6;
    let segmentIdx;
    if (isLose) {
      segmentIdx = [1, 3, 5][Math.floor(Math.random() * 3)];
    } else {
      segmentIdx = [0, 2, 4, 6, 7][Math.floor(Math.random() * 5)];
    }

    const segAngle = 360 / WHEEL_SEGMENTS.length;
    const targetAngle = 360 - (segmentIdx * segAngle) - segAngle / 2;
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const newRotation = rotation + fullSpins * 360 + targetAngle;

    setRotation(newRotation);

    setTimeout(() => {
      const seg = WHEEL_SEGMENTS[segmentIdx];
      if (seg.mult > 0) {
        const winAmt = bet * seg.mult;
        setLastWin(winAmt);
        onWin(winAmt);
        setResult(`Landed on ${seg.label} — You won!`);
      } else {
        setResult('Landed on 0 — No win!');
      }
      setSpinning(false);
    }, 3500);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4 bg-gradient-to-b from-dark-card2 to-dark-bg rounded-xl border border-dark-border">
        <div className="relative w-40 h-40">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 text-neon-green text-xl">▼</div>
          {/* Wheel */}
          <div
            className="w-full h-full rounded-full border-4 border-dark-border overflow-hidden relative"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            {WHEEL_SEGMENTS.map((seg, i) => {
              const angle = (360 / WHEEL_SEGMENTS.length) * i;
              return (
                <div
                  key={i}
                  className="absolute top-0 left-0 w-1/2 h-1/2 origin-bottom-right flex items-center justify-center"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: 'bottom right',
                  }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      background: seg.color,
                      clipPath: `polygon(0 0, 100% 0, 100% 100%)`,
                    }}
                  />
                  <span
                    className="absolute font-display text-xs font-bold text-white"
                    style={{
                      transform: `rotate(${angle + 22.5}deg) translateY(-55px)`,
                    }}
                  >
                    {seg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {result && (
        <div className={`text-center text-sm font-bold animate-scale-in ${lastWin ? 'text-neon-green' : 'text-gray-400'}`}>
          {result}
          {lastWin && <div className="text-neon-green text-lg mt-1">+৳{lastWin.toFixed(2)}</div>}
        </div>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={spinning} balance={balance} />
      <button
        onClick={spin}
        disabled={spinning || balance < bet || bet <= 0}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        <Disc size={18} strokeWidth={2.5} className={spinning ? 'animate-spin-slow' : ''} />
        {spinning ? 'Spinning...' : `Spin Wheel ৳${bet}`}
      </button>
    </div>
  );
}

// ── Card Battle ───────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function drawCard() {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const value = rank === 'A' ? 14 : rank === 'K' ? 13 : rank === 'Q' ? 12 : rank === 'J' ? 11 : parseInt(rank);
  return { suit, rank, value };
}

function CardBattleGame({ balance, onBetPlaced, onWin }: { balance: number; onBetPlaced: (a: number) => void; onWin: (a: number) => void }) {
  const [bet, setBet] = useState(10);
  const [pick, setPick] = useState<'higher' | 'lower'>('higher');
  const [playerCard, setPlayerCard] = useState<{ suit: string; rank: string; value: number } | null>(null);
  const [dealerCard, setDealerCard] = useState<{ suit: string; rank: string; value: number } | null>(null);
  const [dealing, setDealing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);

  const deal = () => {
    if (dealing || balance < bet || bet <= 0) return;
    setDealing(true);
    setResult(null);
    setLastWin(null);
    onBetPlaced(bet);

    const pCard = drawCard();
    setPlayerCard(pCard);

    setTimeout(() => {
      const dCard = drawCard();
      setDealerCard(dCard);
      const won = pick === 'higher' ? dCard.value > pCard.value : dCard.value < pCard.value;
      if (won) {
        const winAmt = bet * 2;
        setLastWin(winAmt);
        onWin(winAmt);
        setResult(`Dealer: ${dCard.rank}${dCard.suit} — You won!`);
      } else {
        setResult(`Dealer: ${dCard.rank}${dCard.suit} — You lost!`);
      }
      setDealing(false);
    }, 800);
  };

  const cardColor = (suit: string) => (suit === '♥' || suit === '♦' ? '#ff3366' : '#ffffff');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4 py-6 bg-gradient-to-b from-dark-card2 to-dark-bg rounded-xl border border-dark-border">
        {/* Player card */}
        <div className="text-center">
          <p className="text-[10px] text-gray-500 mb-1">YOU</p>
          {playerCard ? (
            <div className="w-16 h-22 rounded-lg bg-white flex flex-col items-center justify-center font-display text-2xl font-bold" style={{ color: cardColor(playerCard.suit), minHeight: '88px' }}>
              <span>{playerCard.rank}</span>
              <span className="text-lg">{playerCard.suit}</span>
            </div>
          ) : (
            <div className="w-16 rounded-lg bg-dark-card border-2 border-dark-border flex items-center justify-center" style={{ minHeight: '88px' }}>
              <Spade size={24} className="text-gray-700" />
            </div>
          )}
        </div>

        <span className="text-xs text-gray-600 font-bold">VS</span>

        {/* Dealer card */}
        <div className="text-center">
          <p className="text-[10px] text-gray-500 mb-1">DEALER</p>
          {dealerCard ? (
            <div className="w-16 h-22 rounded-lg bg-white flex flex-col items-center justify-center font-display text-2xl font-bold animate-scale-in" style={{ color: cardColor(dealerCard.suit), minHeight: '88px' }}>
              <span>{dealerCard.rank}</span>
              <span className="text-lg">{dealerCard.suit}</span>
            </div>
          ) : (
            <div className={`w-16 rounded-lg bg-dark-card border-2 ${dealing ? 'border-neon-green/40 animate-pulse-soft' : 'border-dark-border'} flex items-center justify-center`} style={{ minHeight: '88px' }}>
              <Spade size={24} className={dealing ? 'text-neon-green/40' : 'text-gray-700'} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setPick('higher')}
          disabled={dealing}
          className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
            pick === 'higher' ? 'bg-neon-green/15 border-neon-green text-neon-green' : 'bg-dark-card2 border-dark-border text-gray-400'
          }`}
        >
          Higher ▲
        </button>
        <button
          onClick={() => setPick('lower')}
          disabled={dealing}
          className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
            pick === 'lower' ? 'bg-neon-red/15 border-neon-red text-neon-red' : 'bg-dark-card2 border-dark-border text-gray-400'
          }`}
        >
          Lower ▼
        </button>
      </div>

      {result && (
        <div className={`text-center text-sm font-bold animate-scale-in ${lastWin ? 'text-neon-green' : 'text-neon-red'}`}>
          {result}
          {lastWin && <div className="text-neon-green text-lg mt-1">+৳{lastWin.toFixed(2)}</div>}
        </div>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={dealing} balance={balance} />
      <button
        onClick={deal}
        disabled={dealing || balance < bet || bet <= 0}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        <Spade size={18} strokeWidth={2.5} />
        {dealing ? 'Dealing...' : `Deal Cards ৳${bet}`}
      </button>
    </div>
  );
}

// ── Roulette ──────────────────────────────────────────
const ROULETTE_NUMBERS = [
  { num: 0, color: 'green' },
  { num: 32, color: 'red' }, { num: 15, color: 'black' }, { num: 19, color: 'red' },
  { num: 4, color: 'black' }, { num: 21, color: 'red' }, { num: 2, color: 'black' },
  { num: 25, color: 'red' }, { num: 17, color: 'black' }, { num: 34, color: 'red' },
  { num: 6, color: 'black' }, { num: 27, color: 'red' }, { num: 13, color: 'black' },
  { num: 36, color: 'red' }, { num: 11, color: 'black' }, { num: 30, color: 'red' },
  { num: 8, color: 'black' }, { num: 23, color: 'red' }, { num: 10, color: 'black' },
  { num: 5, color: 'red' }, { num: 24, color: 'black' }, { num: 16, color: 'red' },
  { num: 33, color: 'black' }, { num: 1, color: 'red' }, { num: 20, color: 'black' },
  { num: 14, color: 'red' }, { num: 31, color: 'black' }, { num: 9, color: 'red' },
  { num: 22, color: 'black' }, { num: 18, color: 'red' }, { num: 29, color: 'black' },
  { num: 7, color: 'red' }, { num: 28, color: 'black' }, { num: 12, color: 'red' },
  { num: 35, color: 'black' }, { num: 3, color: 'red' }, { num: 26, color: 'black' },
];

function RouletteGame({ balance, onBetPlaced, onWin }: { balance: number; onBetPlaced: (a: number) => void; onWin: (a: number) => void }) {
  const [bet, setBet] = useState(10);
  const [pick, setPick] = useState<'red' | 'black' | 'green'>('red');
  const [spinning, setSpinning] = useState(false);
  const [resultNum, setResultNum] = useState<number | null>(null);
  const [resultColor, setResultColor] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);

  const spin = () => {
    if (spinning || balance < bet || bet <= 0) return;
    setSpinning(true);
    setResult(null);
    setLastWin(null);
    onBetPlaced(bet);

    let ticks = 0;
    const interval = setInterval(() => {
      const r = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];
      setResultNum(r.num);
      setResultColor(r.color);
      ticks++;
      if (ticks > 20) {
        clearInterval(interval);
        // Weighted: 47% win on red/black, 3% on green
        const winChance = pick === 'green' ? 0.03 : 0.47;
        const isWin = Math.random() < winChance;
        let finalEntry;
        if (isWin) {
          finalEntry = ROULETTE_NUMBERS.find((n) => n.color === pick) || ROULETTE_NUMBERS[0];
        } else {
          const losing = ROULETTE_NUMBERS.filter((n) => n.color !== pick);
          finalEntry = losing[Math.floor(Math.random() * losing.length)];
        }
        setResultNum(finalEntry.num);
        setResultColor(finalEntry.color);
        if (finalEntry.color === pick) {
          const mult = pick === 'green' ? 14 : 2;
          const winAmt = bet * mult;
          setLastWin(winAmt);
          onWin(winAmt);
          setResult(`${finalEntry.num} ${finalEntry.color.toUpperCase()} — You won!`);
        } else {
          setResult(`${finalEntry.num} ${finalEntry.color.toUpperCase()} — You lost!`);
        }
        setSpinning(false);
      }
    }, 70);
  };

  const colorBg = (c: string | null) => c === 'red' ? '#ff3366' : c === 'black' ? '#1a1a1a' : c === 'green' ? '#00ff88' : '#333';

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-6 bg-gradient-to-b from-dark-card2 to-dark-bg rounded-xl border border-dark-border">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center font-display text-3xl font-bold border-4 ${spinning ? 'animate-pulse-soft' : ''}`}
          style={{
            backgroundColor: colorBg(resultColor),
            color: resultColor === 'green' || resultColor === 'red' ? '#fff' : '#fff',
            borderColor: resultColor === 'green' ? '#00ff88' : resultColor === 'red' ? '#ff3366' : '#444',
          }}
        >
          {resultNum ?? '?'}
        </div>
        <p className="text-xs text-gray-500 mt-2">{spinning ? 'Spinning...' : resultNum !== null ? `${resultColor?.toUpperCase()}` : 'Place your bet'}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['red', 'black', 'green'] as const).map((color) => (
          <button
            key={color}
            onClick={() => setPick(color)}
            disabled={spinning}
            className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
              pick === color
                ? color === 'red' ? 'bg-neon-red/15 border-neon-red text-neon-red'
                : color === 'black' ? 'bg-gray-700 border-gray-500 text-white'
                : 'bg-neon-green/15 border-neon-green text-neon-green'
                : 'bg-dark-card2 border-dark-border text-gray-400'
            }`}
          >
            {color === 'green' ? 'Green 14x' : color.toUpperCase()}
          </button>
        ))}
      </div>

      {result && (
        <div className={`text-center text-sm font-bold animate-scale-in ${lastWin ? 'text-neon-green' : 'text-neon-red'}`}>
          {result}
          {lastWin && <div className="text-neon-green text-lg mt-1">+৳{lastWin.toFixed(2)}</div>}
        </div>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={spinning} balance={balance} />
      <button
        onClick={spin}
        disabled={spinning || balance < bet || bet <= 0}
        className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
      >
        <Disc size={18} strokeWidth={2.5} className={spinning ? 'animate-spin-slow' : ''} />
        {spinning ? 'Spinning...' : `Spin ৳${bet}`}
      </button>
    </div>
  );
}

// ── Shared Bet Controls ───────────────────────────────
function BetControls({ bet, setBet, disabled, balance }: {
  bet: number;
  setBet: (n: number) => void;
  disabled: boolean;
  balance: number;
}) {
  return (
    <>
      <div className="flex items-center bg-dark-card2 rounded-xl border border-dark-border px-3 py-2.5">
        <span className="text-neon-gold font-bold text-sm mr-1">৳</span>
        <input
          type="number"
          value={bet || ''}
          onChange={(e) => setBet(Math.max(0, parseFloat(e.target.value) || 0))}
          placeholder="Enter bet"
          disabled={disabled}
          className="bg-transparent text-white font-semibold w-full outline-none text-sm disabled:opacity-50"
        />
      </div>
      <div className="flex gap-2">
        {QUICK_BETS.map((amt) => (
          <button
            key={amt}
            onClick={() => setBet(amt)}
            disabled={disabled}
            className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all disabled:opacity-50 ${
              bet === amt
                ? 'bg-neon-green/15 text-neon-green border border-neon-green/40'
                : 'bg-dark-card2 text-gray-300 border border-dark-border hover:bg-dark-border'
            }`}
          >
            ৳{amt}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Balance</span>
        <span className="text-neon-gold font-bold">৳{balance.toFixed(2)}</span>
      </div>
    </>
  );
}

// ── Main GameModal ────────────────────────────────────
export default function GameModal({ game, balance, onClose, onBetPlaced, onWin }: GameModalProps) {
  useEffect(() => {
    openModal();
    return () => closeModal();
  }, []);
  const gameTypeLabels: Record<string, string> = {
    slots: 'Slot Machine',
    dice: 'Dice Roll',
    coinflip: 'Coin Flip',
    wheel: 'Lucky Wheel',
    cards: 'Card Battle',
    roulette: 'Roulette',
  };

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-dark-border animate-fade-in-up max-h-[calc(90vh-7rem)] mb-28 sm:mb-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <img src={game.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
            <div>
              <h3 className="font-display text-base font-bold text-white">{game.name}</h3>
              <p className="text-[10px] text-neon-green font-semibold uppercase">{gameTypeLabels[game.gameType]}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Game body */}
        <div className="p-4">
          {game.gameType === 'slots' && <SlotsGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />}
          {game.gameType === 'dice' && <DiceGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />}
          {game.gameType === 'coinflip' && <CoinFlipGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />}
          {game.gameType === 'wheel' && <WheelGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />}
          {game.gameType === 'cards' && <CardBattleGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />}
          {game.gameType === 'roulette' && <RouletteGame balance={balance} onBetPlaced={onBetPlaced} onWin={onWin} />}
        </div>
      </div>
    </div>
  );
}
