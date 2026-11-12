import { useState, useEffect } from 'react';
import { db, ref, get, set, onValue } from '@/lib/firebase';
import { Dice5, Check, Settings, Zap, AlertCircle, ToggleLeft, ToggleRight, Trophy } from 'lucide-react';

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

const DIFFICULTY_PRESETS: Record<Difficulty, { label: string; color: string; description: string; botAccuracy: number; botLuck: number }> = {
  easy:       { label: 'Easy',       color: '#00ff88', description: 'Bot makes random moves',         botAccuracy: 30, botLuck: 10 },
  medium:     { label: 'Medium',     color: '#ffd700', description: 'Bot plays decent strategy',       botAccuracy: 60, botLuck: 25 },
  hard:       { label: 'Hard',       color: '#ff9500', description: 'Bot plays optimally with luck',    botAccuracy: 85, botLuck: 45 },
  impossible: { label: 'Impossible', color: '#ff3366', description: 'Bot near-perfect with high luck',  botAccuracy: 98, botLuck: 70 },
};

export default function LudoControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [forceResult, setForceResult] = useState<'none' | 'bot_win' | 'player_win'>('none');

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/ludo'));
        if (snap.exists()) {
          const s = snap.val();
          const d = (s.botDifficulty as Difficulty) ?? 'medium';
          setDifficulty(d);
          setActiveDifficulty(d);
          setOverrideEnabled(s.overrideEnabled ?? false);
          setForceResult(s.forceResult ?? 'none');
        }
      } catch { /* defaults */ }
      setLoading(false);
    })();

    const unsub = onValue(ref(db, 'game_settings/ludo'), (snap) => {
      if (snap.exists()) {
        const s = snap.val();
        const d = (s.botDifficulty as Difficulty) ?? 'medium';
        setActiveDifficulty(d);
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/ludo'), {
        botDifficulty: difficulty,
        overrideEnabled,
        forceResult,
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

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading Ludo settings...</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Dice5 size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">Ludo Game Control</h3>
        </div>
        <p className="text-xs text-gray-500">
          Control the Bot difficulty for offline Bot mode. Online mode uses real players only — these settings affect Bot matches only.
        </p>
      </div>

      {/* Difficulty Mode Selector */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Bot Difficulty</h4>
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
          Higher difficulty = smarter moves + luckier dice for the bot. Save to apply to all Bot mode games.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(DIFFICULTY_PRESETS) as Difficulty[]).map((d) => {
            const cfg = DIFFICULTY_PRESETS[d];
            const isSelected = difficulty === d;
            return (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
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
                  <p className="text-[10px] text-gray-500">{cfg.description}</p>
                  <p className="text-[10px] text-gray-500">Strategy: <span className="text-gray-300 font-semibold">{cfg.botAccuracy}%</span></p>
                  <p className="text-[10px] text-gray-500">Dice Luck: <span className="text-gray-300 font-semibold">{cfg.botLuck}%</span></p>
                </div>
              </button>
            );
          })}
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
          Force every Bot match to always end with the bot winning or the player winning. Disable to return to normal gameplay.
        </p>
        {overrideEnabled && (
          <div className="grid grid-cols-3 gap-2">
            {(['none', 'bot_win', 'player_win'] as const).map((outcome) => (
              <button
                key={outcome}
                onClick={() => setForceResult(outcome)}
                className={`text-xs font-bold py-2.5 rounded-lg transition-all ${
                  forceResult === outcome
                    ? outcome === 'bot_win'
                      ? 'bg-neon-red text-white'
                      : outcome === 'player_win'
                        ? 'bg-neon-green text-dark-bg'
                        : 'bg-neon-gold text-dark-bg'
                    : 'bg-dark-card2 text-gray-400 border border-dark-border'
                }`}
              >
                {outcome === 'none' ? 'Normal' : outcome === 'bot_win' ? 'Bot Wins' : 'Player Wins'}
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
