import { useState, useEffect } from 'react';
import { db, ref, get, set, onValue } from '@/lib/firebase';
import { Disc, Check, Settings, Zap, BarChart3, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

const DIFFICULTY_PRESETS: Record<Difficulty, { label: string; color: string; rtp: number; winRate: number; description: string }> = {
  easy: { label: 'Easy', color: '#00ff88', rtp: 95, winRate: 90, description: 'Player-friendly odds' },
  medium: { label: 'Medium', color: '#ffd700', rtp: 85, winRate: 75, description: 'Balanced house edge' },
  hard: { label: 'Hard', color: '#ff9500', rtp: 70, winRate: 55, description: 'Tough for players' },
  impossible: { label: 'Impossible', color: '#ff3366', rtp: 50, winRate: 35, description: 'Very high house edge' },
};

export default function RouletteControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [forceOutcome, setForceOutcome] = useState<'none' | 'win' | 'loss'>('none');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | null>(null);

  const [stats, setStats] = useState({ totalBets: 0, totalPayouts: 0, houseProfit: 0, activePlayers: 0 });

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/roulette'));
        if (snap.exists()) {
          const s = snap.val();
          setOverrideEnabled(s.overrideEnabled ?? false);
          setForceOutcome(s.forceOutcome ?? 'none');
          const d = (s.difficulty as Difficulty) ?? 'medium';
          setDifficulty(d);
          setActiveDifficulty(d);
        }
      } catch { /* defaults */ }
      setLoading(false);
    })();

    const settingsUnsub = onValue(ref(db, 'game_settings/roulette'), (snap) => {
      if (snap.exists()) {
        const d = (snap.val().difficulty as Difficulty) ?? 'medium';
        setActiveDifficulty(d);
      }
    });

    const statsUnsub = onValue(
      ref(db, 'roulette_bets'),
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

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      const cfg = DIFFICULTY_PRESETS[difficulty];
      await set(ref(db, 'game_settings/roulette'), {
        rtp: cfg.rtp,
        overrideEnabled,
        forceOutcome,
        difficulty,
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

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading Roulette settings...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Disc size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">Roulette Game Control</h3>
        </div>
        <p className="text-xs text-gray-500">
          Select a difficulty preset to control RTP and win probability. Changes take effect on the next spin.
        </p>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Roulette Difficulty</h4>
          {activeDifficulty && (
            <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: DIFFICULTY_PRESETS[activeDifficulty].color, backgroundColor: `${DIFFICULTY_PRESETS[activeDifficulty].color}18`, border: `1px solid ${DIFFICULTY_PRESETS[activeDifficulty].color}30` }}>
              Active: {DIFFICULTY_PRESETS[activeDifficulty].label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Selecting a difficulty controls the RTP and win probability for all players.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(DIFFICULTY_PRESETS) as Difficulty[]).map((d) => {
            const cfg = DIFFICULTY_PRESETS[d];
            const isSelected = difficulty === d;
            return (
              <button key={d} onClick={() => { setDifficulty(d); }} className={`rounded-xl border p-3 text-left transition-all active:scale-95 ${isSelected ? 'bg-dark-card2' : 'bg-dark-card2/50 border-dark-border hover:bg-dark-card2'}`} style={isSelected ? { borderColor: cfg.color, boxShadow: `0 0 12px ${cfg.color}30` } : {}}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                  <span className="text-sm font-bold" style={{ color: isSelected ? cfg.color : '#fff' }}>{cfg.label}</span>
                  {isSelected && <Check size={14} style={{ color: cfg.color }} />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-gray-500">RTP: <span className="text-gray-300 font-semibold">{cfg.rtp}%</span></p>
                  <p className="text-[10px] text-gray-500">Win Rate: <span className="text-gray-300 font-semibold">{cfg.winRate}%</span></p>
                  <p className="text-[10px] text-gray-500">{cfg.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-neon-gold" />
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
            <p className={`font-display text-lg font-bold ${stats.houseProfit >= 0 ? 'text-neon-gold' : 'text-neon-red'}`}>৳{stats.houseProfit.toFixed(2)}</p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Active Players</p>
            <p className="font-display text-lg font-bold text-neon-blue">{stats.activePlayers}</p>
          </div>
        </div>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-neon-red" />
            <h4 className="text-sm font-bold text-white">Manual Result Override</h4>
          </div>
          <button onClick={() => setOverrideEnabled((v) => !v)} className="shrink-0 transition-transform active:scale-90">
            {overrideEnabled ? (<ToggleRight size={32} className="text-neon-green" />) : (<ToggleLeft size={32} className="text-gray-600" />)}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Force the next spin to always win or always lose for testing. Disable to return to normal RNG.
        </p>
        {overrideEnabled && (
          <div className="grid grid-cols-3 gap-2">
            {(['none', 'win', 'loss'] as const).map((outcome) => (
              <button key={outcome} onClick={() => setForceOutcome(outcome)} className={`text-xs font-bold py-2.5 rounded-lg transition-all ${forceOutcome === outcome ? outcome === 'win' ? 'bg-neon-green text-dark-bg' : outcome === 'loss' ? 'bg-neon-red text-white' : 'bg-neon-gold text-dark-bg' : 'bg-dark-card2 text-gray-400 border border-dark-border'}`}>
                {outcome === 'none' ? 'Normal' : outcome === 'win' ? 'Force Win' : 'Force Loss'}
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="w-full bg-neon-gold text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-gold/90 disabled:opacity-50 neon-gold-glow flex items-center justify-center gap-2">
        {saving ? 'Saving...' : saveError ? (<><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>) : saved ? (<><Check size={18} strokeWidth={2.5} /> Saved successfully!</>) : (<><Settings size={18} strokeWidth={2.5} /> Save Settings</>)}
      </button>
    </div>
  );
}
