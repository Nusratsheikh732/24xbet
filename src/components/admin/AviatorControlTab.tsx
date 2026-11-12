import { useState, useEffect } from 'react';
import { db, ref, update, onValue } from '@/lib/firebase';
import { Plane, Check, Settings, ToggleLeft, ToggleRight, ListOrdered, Plus, Trash2, X, Play, AlertCircle } from 'lucide-react';

export default function AviatorControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [gameActive, setGameActive] = useState(true);
  const [sequence, setSequence] = useState<number[]>([]);
  const [newCrash, setNewCrash] = useState('');
  const [seqError, setSeqError] = useState(false);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'game_settings/aviator'),
      (snap) => {
        if (snap.exists()) {
          const s = snap.val();
          setGameActive(s.active ?? true);
          setSequence(Array.isArray(s.crashSequence) ? s.crashSequence : []);
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const persist = async (active: boolean, seq: number[]) => {
    setSaving(true);
    setSaveError(false);
    try {
      await update(ref(db, 'game_settings/aviator'), {
        active,
        crashSequence: seq,
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

  const handleToggleActive = async () => {
    const next = !gameActive;
    setGameActive(next);
    await persist(next, sequence);
  };

  const handleAddCrash = async () => {
    const val = parseFloat(newCrash);
    if (isNaN(val) || val < 1.01) {
      setSeqError(true);
      return;
    }
    setSeqError(false);
    const updated = [...sequence, parseFloat(val.toFixed(2))];
    setSequence(updated);
    setNewCrash('');
    await persist(gameActive, updated);
  };

  const handleRemoveCrash = async (index: number) => {
    const updated = sequence.filter((_, i) => i !== index);
    setSequence(updated);
    await persist(gameActive, updated);
  };

  const handleClearAll = async () => {
    setSequence([]);
    await persist(gameActive, []);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading Aviator settings...</p>;

  return (
    <div className="space-y-4">
      {/* Header + on/off */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Plane size={18} className="text-neon-green" />
          <h3 className="font-display text-base font-bold text-white">Aviator Game Control</h3>
          <button
            onClick={handleToggleActive}
            className="ml-auto shrink-0 transition-transform active:scale-90"
            title={gameActive ? 'Game is ON' : 'Game is OFF'}
          >
            {gameActive ? (
              <ToggleRight size={32} className="text-neon-green" />
            ) : (
              <ToggleLeft size={32} className="text-gray-600" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {gameActive
            ? 'Aviator is currently live. Players can join and bet.'
            : 'Aviator is OFF. Players see a maintenance screen and cannot play.'}
        </p>
      </div>

      {/* Crash Point Sequence (Next 100 Rounds) */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ListOrdered size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Crash Point Sequence (Next Rounds)</h4>
          {sequence.length > 0 && (
            <span className="ml-auto text-[10px] font-bold bg-neon-gold/15 text-neon-gold px-2 py-0.5 rounded-full">
              {sequence.length} preset
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Pre-set the exact crash multiplier for upcoming rounds. The game follows this sequence in order.
          When the sequence runs out, the game falls back to the random crash algorithm.
        </p>

        {/* Info banner */}
        {sequence.length === 0 ? (
          <div className="flex items-start gap-2 bg-dark-card2 rounded-lg border border-dark-border p-3">
            <AlertCircle size={14} className="text-gray-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-500">
              No crash points set. The game uses the random algorithm from Crash Settings. Add values below to control upcoming rounds.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-neon-gold/5 rounded-lg border border-neon-gold/20 p-3">
            <AlertCircle size={14} className="text-neon-gold mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-400">
              The next <span className="text-neon-gold font-bold">{sequence.length}</span> rounds will crash at the values below, in order. After that, the random algorithm takes over.
            </p>
          </div>
        )}

        {/* Add new crash point */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2 flex-1">
            <span className="text-neon-green font-bold text-sm mr-1">x</span>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={newCrash}
              onChange={(e) => { setNewCrash(e.target.value); setSeqError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCrash()}
              placeholder="e.g. 2.50"
              className="bg-transparent text-white text-sm w-full outline-none placeholder:text-gray-600"
            />
          </div>
          <button
            onClick={handleAddCrash}
            disabled={saving || !newCrash.trim()}
            className="bg-neon-green text-dark-bg font-bold text-sm px-3 py-2 rounded-lg active:scale-95 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={14} strokeWidth={2.5} /> Add
          </button>
        </div>
        {seqError && <p className="text-xs text-neon-red">Enter a valid multiplier (minimum 1.01x).</p>}

        {/* Sequence list */}
        {sequence.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase font-bold">Upcoming Rounds</span>
              <button
                onClick={handleClearAll}
                className="text-[10px] text-neon-red font-bold flex items-center gap-1 hover:underline"
              >
                <Trash2 size={11} /> Clear All
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto">
              {sequence.map((mult, i) => (
                <div
                  key={i}
                  className="relative bg-dark-card2 border border-dark-border rounded-lg p-2 text-center group"
                >
                  <span className="text-[9px] text-gray-600 font-bold absolute top-1 left-1.5">#{i + 1}</span>
                  <p className="font-display text-sm font-bold text-white mt-2">{mult.toFixed(2)}x</p>
                  <button
                    onClick={() => handleRemoveCrash(i)}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-neon-red/20 text-neon-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={9} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick fill buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const filled = Array.from({ length: 10 }, () => parseFloat((Math.random() * 3 + 1.2).toFixed(2)));
              setSequence(filled);
              persist(gameActive, filled);
            }}
            className="flex-1 bg-dark-card2 border border-dark-border text-[10px] font-bold text-gray-300 py-2 rounded-lg hover:bg-dark-border transition-colors"
          >
            Random 10
          </button>
          <button
            onClick={() => {
              const filled = Array.from({ length: 20 }, () => parseFloat((Math.random() * 5 + 1.1).toFixed(2)));
              setSequence(filled);
              persist(gameActive, filled);
            }}
            className="flex-1 bg-dark-card2 border border-dark-border text-[10px] font-bold text-gray-300 py-2 rounded-lg hover:bg-dark-border transition-colors"
          >
            Random 20
          </button>
          <button
            onClick={() => {
              const filled = Array.from({ length: 50 }, () => parseFloat((Math.random() * 8 + 1.05).toFixed(2)));
              setSequence(filled);
              persist(gameActive, filled);
            }}
            className="flex-1 bg-dark-card2 border border-dark-border text-[10px] font-bold text-gray-300 py-2 rounded-lg hover:bg-dark-border transition-colors"
          >
            Random 50
          </button>
        </div>
      </div>

      {/* Save toast */}
      {saved && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-neon-green text-dark-bg text-xs font-bold px-4 py-2 rounded-full neon-green-glow flex items-center gap-1.5 z-50">
          <Check size={14} strokeWidth={2.5} /> Saved successfully!
        </div>
      )}
      {saveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-neon-red text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 z-50">
          <AlertCircle size={14} strokeWidth={2.5} /> Failed to save. Check connection.
        </div>
      )}
    </div>
  );
}
