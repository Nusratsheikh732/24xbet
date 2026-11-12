import { useState, useEffect } from 'react';
import { db, ref, get, set, onValue } from '@/lib/firebase';
import { Disc, Check, Settings, Zap, TrendingUp, AlertCircle, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface SpinSegment {
  label: string;
  mult: number;
  weight: number;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

const DIFFICULTY_PRESETS: Record<Difficulty, { label: string; color: string; rtp: number; winRate: number; description: string }> = {
  easy:       { label: 'Easy',       color: '#00ff88', rtp: 95, winRate: 90, description: 'Player-friendly odds' },
  medium:     { label: 'Medium',     color: '#ffd700', rtp: 85, winRate: 75, description: 'Balanced house edge' },
  hard:       { label: 'Hard',       color: '#ff9500', rtp: 70, winRate: 55, description: 'Tough for players' },
  impossible: { label: 'Impossible', color: '#ff3366', rtp: 50, winRate: 35, description: 'Very high house edge' },
};

const DEFAULT_SEGMENTS: SpinSegment[] = [
  { label: 'Bad luck', mult: 0, weight: 15 },
  { label: '1.5x', mult: 1.5, weight: 12 },
  { label: '0x', mult: 0, weight: 14 },
  { label: '2x', mult: 2, weight: 10 },
  { label: '0.1x', mult: 0.1, weight: 8 },
  { label: '3x', mult: 3, weight: 4 },
  { label: '0.5x', mult: 0.5, weight: 15 },
  { label: '2.5x', mult: 2.5, weight: 6 },
  { label: '1.1x', mult: 1.1, weight: 14 },
  { label: '5x', mult: 5, weight: 2 },
];

function computeRtp(segments: SpinSegment[]): number {
  const totalW = segments.reduce((s, x) => s + x.weight, 0);
  if (totalW === 0) return 0;
  return parseFloat(((segments.reduce((s, x) => s + x.mult * x.weight, 0) / totalW) * 100).toFixed(2));
}

// Re-weight segments so that the computed RTP approximates the target.
// Winning segments (mult >= 1) are scaled up or down; losing segments stay fixed.
function reweightForRtp(segments: SpinSegment[], targetRtp: number): SpinSegment[] {
  const totalW = segments.reduce((s, x) => s + x.weight, 0);
  if (totalW === 0) return segments;

  const losing = segments.filter((s) => s.mult < 1);
  const winning = segments.filter((s) => s.mult >= 1);
  if (winning.length === 0) return segments;

  const losingW = losing.reduce((s, x) => s + x.weight, 0);
  const losingContribution = losing.reduce((s, x) => s + x.mult * x.weight, 0);

  // We need: (losingContribution + W * avgMult) / (losingW + W) = targetRtp/100
  // where W = total winning weight, avgMult = weighted avg of winning multipliers
  // Solve for the winning weight scale factor.
  const avgMult = winning.reduce((s, x) => s + x.mult * x.weight, 0) / winning.reduce((s, x) => s + x.weight, 0);
  const target = targetRtp / 100;

  // target = (losingContribution + W * avgMult) / (losingW + W)
  // target * (losingW + W) = losingContribution + W * avgMult
  // target * losingW + target * W = losingContribution + W * avgMult
  // W * (target - avgMult) = losingContribution - target * losingW
  // W = (losingContribution - target * losingW) / (avgMult - target)
  const denom = avgMult - target;
  if (Math.abs(denom) < 0.001) return segments;

  const targetWinW = (losingContribution - target * losingW) / denom;
  if (targetWinW <= 0) return segments;

  const currentWinW = winning.reduce((s, x) => s + x.weight, 0);
  const scale = targetWinW / currentWinW;

  return segments.map((s) =>
    s.mult >= 1 ? { ...s, weight: Math.max(1, Math.round(s.weight * scale)) } : s
  );
}

export default function SpinWheelControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [segments, setSegments] = useState<SpinSegment[]>(DEFAULT_SEGMENTS);
  const [rtp, setRtp] = useState(92);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newMult, setNewMult] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [forceOutcome, setForceOutcome] = useState<'none' | 'win' | 'medium' | 'loss'>('none');

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/spinwheel'));
        if (snap.exists()) {
          const s = snap.val();
          if (Array.isArray(s.segments) && s.segments.length > 0) {
            setSegments(s.segments);
          }
          setRtp(s.rtp ?? 92);
          const d = (s.difficulty as Difficulty) ?? 'medium';
          setDifficulty(d);
          setActiveDifficulty(d);
          setOverrideEnabled(s.overrideEnabled ?? false);
          setForceOutcome(s.forceOutcome ?? 'none');
        }
      } catch { /* defaults */ }
      setLoading(false);
    })();

    const unsub = onValue(ref(db, 'game_settings/spinwheel'), (snap) => {
      if (snap.exists()) {
        const s = snap.val();
        if (Array.isArray(s.segments) && s.segments.length > 0) {
          setSegments(s.segments);
        }
        setRtp(s.rtp ?? 92);
        const d = (s.difficulty as Difficulty) ?? 'medium';
        setActiveDifficulty(d);
        setOverrideEnabled(s.overrideEnabled ?? false);
        setForceOutcome(s.forceOutcome ?? 'none');
      }
    });
    return () => unsub();
  }, []);

  const computedRtp = computeRtp(segments);

  const handleDifficultySelect = (d: Difficulty) => {
    setDifficulty(d);
    const targetRtp = DIFFICULTY_PRESETS[d].rtp;
    setRtp(targetRtp);
    setSegments((prev) => reweightForRtp(prev, targetRtp));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/spinwheel'), {
        segments,
        rtp,
        difficulty,
        overrideEnabled,
        forceOutcome,
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

  const handleAddSegment = () => {
    const mult = parseFloat(newMult);
    const weight = parseInt(newWeight);
    if (isNaN(mult) || isNaN(weight) || weight <= 0 || !newLabel.trim()) return;
    setSegments((prev) => [...prev, { label: newLabel.trim(), mult, weight }]);
    setNewLabel('');
    setNewMult('');
    setNewWeight('');
  };

  const handleRemoveSegment = (index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSegment = (index: number, field: keyof SpinSegment, value: string) => {
    setSegments((prev) => prev.map((seg, i) => {
      if (i !== index) return seg;
      if (field === 'label') return { ...seg, label: value };
      if (field === 'mult') return { ...seg, mult: parseFloat(value) || 0 };
      if (field === 'weight') return { ...seg, weight: parseInt(value) || 0 };
      return seg;
    }));
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading Spin Wheel settings...</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Disc size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">Spin Wheel Game Control</h3>
        </div>
        <p className="text-xs text-gray-500">
          Control the wheel segments, multipliers, and outcome weights. The difficulty selector auto-adjusts segment weights to match the target RTP.
        </p>
      </div>

      {/* Difficulty Mode Selector */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Spin Wheel Difficulty</h4>
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
          Selecting a difficulty re-weights winning segments to match the target RTP. Save to apply to all players.
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
          Target RTP percentage. Current segment RTP: <span className="text-neon-gold font-bold">{computedRtp}%</span>
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
      </div>

      {/* Segment Editor */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <h4 className="text-sm font-bold text-white">Wheel Segments</h4>
        <p className="text-xs text-gray-500">
          Each segment has a label, multiplier (payout = bet × multiplier), and weight (probability). Higher weight = more likely to land.
        </p>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2 bg-dark-card2 rounded-lg border border-dark-border p-2">
              <span className="text-[10px] text-gray-600 font-bold w-5 shrink-0">#{i + 1}</span>
              <input
                type="text"
                value={seg.label}
                onChange={(e) => handleUpdateSegment(i, 'label', e.target.value)}
                className="flex-1 bg-transparent text-white text-xs outline-none min-w-0"
              />
              <div className="flex items-center bg-dark-bg border border-dark-border rounded px-2 py-1 w-16 shrink-0">
                <span className="text-[9px] text-gray-500 mr-0.5">x</span>
                <input
                  type="number"
                  step="0.1"
                  value={seg.mult}
                  onChange={(e) => handleUpdateSegment(i, 'mult', e.target.value)}
                  className="bg-transparent text-white text-xs w-full outline-none"
                />
              </div>
              <div className="flex items-center bg-dark-bg border border-dark-border rounded px-2 py-1 w-14 shrink-0">
                <input
                  type="number"
                  min="1"
                  value={seg.weight}
                  onChange={(e) => handleUpdateSegment(i, 'weight', e.target.value)}
                  className="bg-transparent text-white text-xs w-full outline-none"
                />
              </div>
              <button
                onClick={() => handleRemoveSegment(i)}
                className="w-7 h-7 rounded-lg bg-neon-red/15 text-neon-red flex items-center justify-center shrink-0 hover:bg-neon-red/25 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new segment */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="flex-1 bg-dark-card2 border border-dark-border rounded-lg px-3 py-2 text-white text-xs outline-none min-w-0"
          />
          <input
            type="number"
            step="0.1"
            value={newMult}
            onChange={(e) => setNewMult(e.target.value)}
            placeholder="Mult"
            className="w-16 bg-dark-card2 border border-dark-border rounded-lg px-2 py-2 text-white text-xs outline-none text-center"
          />
          <input
            type="number"
            min="1"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="Wt"
            className="w-14 bg-dark-card2 border border-dark-border rounded-lg px-2 py-2 text-white text-xs outline-none text-center"
          />
          <button
            onClick={handleAddSegment}
            disabled={!newLabel.trim() || !newMult || !newWeight}
            className="bg-neon-gold text-dark-bg font-bold text-xs px-3 py-2 rounded-lg active:scale-95 disabled:opacity-50 flex items-center gap-1 shrink-0"
          >
            <Plus size={12} strokeWidth={2.5} /> Add
          </button>
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
          <div className="grid grid-cols-2 gap-2">
            {(['none', 'win', 'medium', 'loss'] as const).map((outcome) => (
              <button
                key={outcome}
                onClick={() => setForceOutcome(outcome)}
                className={`text-xs font-bold py-2.5 rounded-lg transition-all ${
                  forceOutcome === outcome
                    ? outcome === 'win'
                      ? 'bg-neon-green text-dark-bg'
                      : outcome === 'loss'
                        ? 'bg-neon-red text-white'
                        : outcome === 'medium'
                          ? 'bg-neon-gold text-dark-bg'
                          : 'bg-neon-blue text-dark-bg'
                    : 'bg-dark-card2 text-gray-400 border border-dark-border'
                }`}
              >
                {outcome === 'none' ? 'Normal' : outcome === 'win' ? 'Force Win' : outcome === 'medium' ? 'Medium between Normal & Force loss' : 'Force Loss'}
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
