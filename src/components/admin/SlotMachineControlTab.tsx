import { useState, useEffect } from 'react';
import { db, ref, get, set, onValue } from '@/lib/firebase';
import { Gamepad2, Check, Settings, Zap, BarChart3, ToggleLeft, ToggleRight, TrendingUp, AlertCircle, Coins } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

const DIFFICULTY_PRESETS: Record<Difficulty, { label: string; color: string; rtp: number; winRate: number; scatterFreq: string; description: string }> = {
  easy:       { label: 'Easy',       color: '#00ff88', rtp: 95, winRate: 90, scatterFreq: '1 / 8-15 spins',  description: 'Player-friendly odds' },
  medium:     { label: 'Medium',     color: '#ffd700', rtp: 85, winRate: 75, scatterFreq: '1 / 20-40 spins',  description: 'Balanced house edge' },
  hard:       { label: 'Hard',       color: '#ff9500', rtp: 70, winRate: 55, scatterFreq: '1 / 60-100 spins', description: 'Tough for players' },
  impossible: { label: 'Impossible', color: '#ff3366', rtp: 50, winRate: 35, scatterFreq: '1 / 200+ spins',   description: 'Very high house edge' },
};

const SLOT_SYMBOLS = [
  { name: 'Sym1', image: 'https://i.postimg.cc/Nfw3yvVp/Chat-GPT-Image-Sep-27-2026-02-49-47-PM.png', color: '#00d4ff' },
  { name: 'Sym2', image: 'https://i.postimg.cc/d3GgW57t/IMG-20260927-145022.png', color: '#ffd700' },
  { name: 'Sym3', image: 'https://i.postimg.cc/bJD7nypL/IMG-20260927-145037.png', color: '#ff9500' },
  { name: 'Sym4', image: 'https://i.postimg.cc/6Q3J9VPj/IMG-20260927-145100.png', color: '#00ff88' },
  { name: 'Sym5', image: 'https://i.postimg.cc/mgVWfpmF/IMG-20260927-145125.png', color: '#ff3366' },
  { name: 'Scatter', image: 'https://i.postimg.cc/yYmzn89M/IMG-20260927-145143.png', color: '#ff44aa' },
  { name: 'Sym7', image: 'https://i.postimg.cc/zXZrngLj/IMG-20260927-145216.png', color: '#ffdd00' },
  { name: 'Sym8', image: 'https://i.postimg.cc/rytT0Jp2/IMG-20260927-145312.png', color: '#e67e22' },
  { name: 'Sym9', image: 'https://i.postimg.cc/sXbRHBTx/IMG-20260927-145339.png', color: '#2ecc71' },
  { name: 'Sym10', image: 'https://i.postimg.cc/TwK6cjqB/IMG-20260927-145505.png', color: '#f1c40f' },
  { name: 'Sym11', image: 'https://i.postimg.cc/3wShpfpk/IMG-20260927-145519.png', color: '#e74c3c' },
  { name: 'Sym12', image: 'https://i.postimg.cc/6pht6ppn/IMG-20260927-145613.png', color: '#3498db' },
];

const DEFAULT_SYMBOL_MULT = SLOT_SYMBOLS.reduce((acc, s) => {
  const defaults: Record<string, { payout3: number; payout2: number }> = {
    Sym1: { payout3: 50, payout2: 5 }, Sym2: { payout3: 30, payout2: 4 },
    Sym3: { payout3: 20, payout2: 3 }, Sym4: { payout3: 15, payout2: 3 },
    Sym5: { payout3: 12, payout2: 2 }, Scatter: { payout3: 0, payout2: 0 },
    Sym7: { payout3: 10, payout2: 2 }, Sym8: { payout3: 8, payout2: 0 },
    Sym9: { payout3: 6, payout2: 0 }, Sym10: { payout3: 5, payout2: 0 },
    Sym11: { payout3: 4, payout2: 0 }, Sym12: { payout3: 3, payout2: 0 },
  };
  acc[s.name] = defaults[s.name];
  return acc;
}, {} as Record<string, { payout3: number; payout2: number }>);

export default function SlotMachineControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [rtp, setRtp] = useState(92);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [forceOutcome, setForceOutcome] = useState<'none' | 'win' | 'loss'>('none');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | null>(null);
  const [gameActive, setGameActive] = useState(true);

  const [symbolMultipliers, setSymbolMultipliers] = useState<Record<string, { payout3: number; payout2: number }>>(DEFAULT_SYMBOL_MULT);

  const [stats, setStats] = useState({ totalBets: 0, totalPayouts: 0, houseProfit: 0, activePlayers: 0 });

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/slots'));
        if (snap.exists()) {
          const s = snap.val();
          setRtp(s.rtp ?? 92);
          setOverrideEnabled(s.overrideEnabled ?? false);
          setForceOutcome(s.forceOutcome ?? 'none');
          const d = (s.difficulty as Difficulty) ?? 'medium';
          setDifficulty(d);
          setActiveDifficulty(d);
          setGameActive(s.active ?? true);
          if (s.symbolMultipliers) setSymbolMultipliers(s.symbolMultipliers);
        }
      } catch { /* defaults */ }
      setLoading(false);
    })();

    const settingsUnsub = onValue(ref(db, 'game_settings/slots'), (snap) => {
      if (snap.exists()) {
        const v = snap.val();
        const d = (v.difficulty as Difficulty) ?? 'medium';
        setActiveDifficulty(d);
        setRtp(v.rtp ?? 92);
        setGameActive(v.active ?? true);
      }
    });

    const statsUnsub = onValue(
      ref(db, 'slots_bets'),
      (snap) => {
        let totalBets = 0;
        let totalPayouts = 0;
        const players = new Set<string>();
        if (snap.exists()) {
          const all = snap.val();
          for (const id in all) {
            const data = all[id];
            totalBets += data.betAmount || 0;
            totalPayouts += data.payout || 0;
            if (data.userId) players.add(data.userId);
          }
        }
        setStats({ totalBets, totalPayouts, houseProfit: totalBets - totalPayouts, activePlayers: players.size });
      }
    );
    return () => { settingsUnsub(); statsUnsub(); };
  }, []);

  const handleDifficultySelect = (d: Difficulty) => {
    setDifficulty(d);
    setRtp(DIFFICULTY_PRESETS[d].rtp);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/slots'), {
        rtp,
        overrideEnabled,
        forceOutcome,
        difficulty,
        active: gameActive,
        symbolMultipliers,
        updatedAt: Date.now(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading Slot Machine settings...</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">Slot Machine Game Control</h3>
          <button
            onClick={() => setGameActive((v) => !v)}
            className="ml-auto shrink-0 transition-transform active:scale-90"
            title={gameActive ? 'Deactivate game' : 'Activate game'}
          >
            {gameActive ? (
              <ToggleRight size={32} className="text-neon-green" />
            ) : (
              <ToggleLeft size={32} className="text-gray-600" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Control the RTP, win probability, and free-spin scatter frequency. Changes take effect on the next spin in real time.
        </p>
      </div>

      {/* Difficulty Mode Selector */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Slot Machine Difficulty</h4>
          {activeDifficulty && (
            <span
              className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full"
              style={{
                color: DIFFICULTY_PRESETS[activeDifficulty].color,
                backgroundColor: `${DIFFICULTY_PRESETS[activeDifficulty].color}18`,
                border: `1px solid ${DIFFICULTY_PRESETS[activeDifficulty].color}30`,
              }}
            >
              Active: {DIFFICULTY_PRESETS[activeDifficulty].label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Selecting a difficulty directly controls RTP, win chance, and scatter frequency for all players.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(DIFFICULTY_PRESETS) as Difficulty[]).map((d) => {
            const cfg = DIFFICULTY_PRESETS[d];
            const isSelected = difficulty === d;
            return (
              <button
                key={d}
                onClick={() => handleDifficultySelect(d)}
                className={`rounded-xl border p-3 text-left transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-dark-card2'
                    : 'bg-dark-card2/50 border-dark-border hover:bg-dark-card2'
                }`}
                style={isSelected ? { borderColor: cfg.color, boxShadow: `0 0 12px ${cfg.color}30` } : {}}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                  />
                  <span className="text-sm font-bold" style={{ color: isSelected ? cfg.color : '#fff' }}>
                    {cfg.label}
                  </span>
                  {isSelected && <Check size={14} style={{ color: cfg.color }} />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-gray-500">RTP: <span className="text-gray-300 font-semibold">{cfg.rtp}%</span></p>
                  <p className="text-[10px] text-gray-500">Win Rate: <span className="text-gray-300 font-semibold">{cfg.winRate}%</span></p>
                  <p className="text-[10px] text-gray-500">Scatter: <span className="text-gray-300 font-semibold">{cfg.scatterFreq}</span></p>
                  <p className="text-[10px] text-gray-500">{cfg.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RTP Slider */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Return to Player (RTP)</h4>
        </div>
        <p className="text-xs text-gray-500">
          Fine-tune the exact RTP percentage. This controls how often the slot pays out vs. keeps the bet.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="20"
            max="98"
            step="1"
            value={rtp}
            onChange={(e) => setRtp(parseInt(e.target.value))}
            className="flex-1 accent-neon-gold"
          />
          <span className="font-display text-lg font-bold text-neon-gold w-14 text-right">{rtp}%</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Tight', val: 50 },
            { label: 'Normal', val: 75 },
            { label: 'Loose', val: 90 },
            { label: 'Max', val: 96 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => setRtp(preset.val)}
              className={`text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                rtp === preset.val
                  ? 'bg-neon-gold text-dark-bg'
                  : 'bg-dark-card2 text-gray-400 border border-dark-border hover:bg-dark-border'
              }`}
            >
              {preset.label} ({preset.val}%)
            </button>
          ))}
        </div>
      </div>

      {/* Symbol Multiplier Editor */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Symbol Payout Control</h4>
        </div>
        <p className="text-xs text-gray-500">
          Adjust each symbol's multiplier (x3 and x2 payouts). Changes apply instantly to all players on the next spin.
        </p>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {SLOT_SYMBOLS.map((sym) => (
            <div key={sym.name} className="flex items-center gap-2 bg-dark-card2 rounded-lg border border-dark-border p-2">
              <img src={sym.image} alt={sym.name} className="w-8 h-8 object-contain shrink-0 rounded" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white block">{sym.name}</span>
                <span className="text-[9px] text-gray-500">{sym.name === 'Scatter' ? 'Free spin trigger' : 'Payline symbol'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-500 mb-0.5">x3</span>
                  <input
                    type="number"
                    min="0"
                    value={symbolMultipliers[sym.name]?.payout3 ?? 0}
                    onChange={(e) => setSymbolMultipliers((prev) => ({
                      ...prev,
                      [sym.name]: { ...prev[sym.name], payout3: Math.max(0, parseInt(e.target.value) || 0) },
                    }))}
                    className="w-14 bg-dark-bg border border-dark-border rounded text-center text-xs text-white py-1"
                  />
                </label>
                <label className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-500 mb-0.5">x2</span>
                  <input
                    type="number"
                    min="0"
                    value={symbolMultipliers[sym.name]?.payout2 ?? 0}
                    onChange={(e) => setSymbolMultipliers((prev) => ({
                      ...prev,
                      [sym.name]: { ...prev[sym.name], payout2: Math.max(0, parseInt(e.target.value) || 0) },
                    }))}
                    className="w-14 bg-dark-bg border border-dark-border rounded text-center text-xs text-white py-1"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setSymbolMultipliers(DEFAULT_SYMBOL_MULT)}
          className="text-[10px] text-gray-500 hover:text-gray-300 font-semibold"
        >
          Reset to defaults
        </button>
      </div>

      {/* Live Statistics */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-neon-green" />
          <h4 className="text-sm font-bold text-white">Live Statistics</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Total Bets</p>
            <p className="font-display text-lg font-bold text-white">৳{stats.totalBets.toFixed(2)}</p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Total Payouts</p>
            <p className="font-display text-lg font-bold text-neon-green">৳{stats.totalPayouts.toFixed(2)}</p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">House Profit</p>
            <p className={`font-display text-lg font-bold ${stats.houseProfit >= 0 ? 'text-neon-gold' : 'text-neon-red'}`}>
              ৳{stats.houseProfit.toFixed(2)}
            </p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Active Players</p>
            <p className="font-display text-lg font-bold text-neon-blue">{stats.activePlayers}</p>
          </div>
        </div>
      </div>

      {/* Manual Result Override */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-neon-red" />
            <h4 className="text-sm font-bold text-white">Manual Result Override</h4>
          </div>
          <button
            onClick={() => setOverrideEnabled((v) => !v)}
            className="shrink-0 transition-transform active:scale-90"
          >
            {overrideEnabled ? (
              <ToggleRight size={32} className="text-neon-green" />
            ) : (
              <ToggleLeft size={32} className="text-gray-600" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Force the next spin to always win or always lose for testing. Disable to return to normal RNG.
        </p>
        {overrideEnabled && (
          <div className="grid grid-cols-3 gap-2">
            {(['none', 'win', 'loss'] as const).map((outcome) => (
              <button
                key={outcome}
                onClick={() => setForceOutcome(outcome)}
                className={`text-xs font-bold py-2.5 rounded-lg transition-all ${
                  forceOutcome === outcome
                    ? outcome === 'win'
                      ? 'bg-neon-green text-dark-bg'
                      : outcome === 'loss'
                        ? 'bg-neon-red text-white'
                        : 'bg-neon-gold text-dark-bg'
                    : 'bg-dark-card2 text-gray-400 border border-dark-border'
                }`}
              >
                {outcome === 'none' ? 'Normal' : outcome === 'win' ? 'Force Win' : 'Force Loss'}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-neon-gold text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-gold/90 disabled:opacity-50 neon-gold-glow flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : saveError ? (
          <><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>
        ) : saved ? (
          <><Check size={18} strokeWidth={2.5} /> Saved successfully!</>
        ) : (
          <><Settings size={18} strokeWidth={2.5} /> Save Settings</>
        )}
      </button>
    </div>
  );
}
