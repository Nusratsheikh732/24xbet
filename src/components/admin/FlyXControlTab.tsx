import { useState, useEffect } from 'react';
import { db, ref, get, set, onValue } from '@/lib/firebase';
import { Plane, TrendingUp, Check, Settings, BarChart3, AlertCircle } from 'lucide-react';

export default function FlyXControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [earlyRatio, setEarlyRatio] = useState('0.8');
  const [minCrash, setMinCrash] = useState('1.01');
  const [maxEarly, setMaxEarly] = useState('1.50');
  const [maxLate, setMaxLate] = useState('9.50');

  const [stats, setStats] = useState({ totalBets: 0, totalPayouts: 0, houseProfit: 0, activePlayers: 0 });

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, 'game_settings/flyx'));
        if (snap.exists()) {
          const s = snap.val();
          setEarlyRatio((s.early_crash_ratio ?? 0.8).toString());
          setMinCrash((s.min_crash_mult ?? 1.01).toString());
          setMaxEarly((s.max_early_crash ?? 1.50).toString());
          setMaxLate((s.max_late_crash ?? 9.50).toString());
        }
      } catch { /* defaults */ }
      setLoading(false);
    })();

    const statsUnsub = onValue(
      ref(db, 'flyx_bets'),
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
    return () => { statsUnsub(); };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/flyx'), {
        early_crash_ratio: parseFloat(earlyRatio),
        min_crash_mult: parseFloat(minCrash),
        max_early_crash: parseFloat(maxEarly),
        max_late_crash: parseFloat(maxLate),
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

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading FlyX settings...</p>;

  const earlyPercent = Math.round(parseFloat(earlyRatio || '0') * 100);

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Plane size={18} className="text-neon-red" />
          <h3 className="font-display text-base font-bold text-white">FlyX Crash Settings</h3>
        </div>
        <p className="text-xs text-gray-500">
          Control the crash probability and multiplier ranges for FlyX. Changes take effect on the next round.
        </p>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Early Crash Probability</h4>
        </div>
        <p className="text-xs text-gray-500">
          Percentage of rounds that crash before {maxEarly}x. Currently: <span className="text-neon-gold font-bold">{earlyPercent}%</span>
        </p>
        <div className="flex items-center gap-3">
          <input type="range" min="0" max="1" step="0.05" value={earlyRatio} onChange={(e) => setEarlyRatio(e.target.value)} className="flex-1 accent-neon-red" />
          <span className="font-display text-lg font-bold text-neon-red w-12 text-right">{earlyPercent}%</span>
        </div>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <h4 className="text-sm font-bold text-white">Multiplier Ranges</h4>
        <div>
          <label className="text-xs text-gray-500 font-semibold">Min crash multiplier</label>
          <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 mt-1">
            <span className="text-neon-red font-bold text-sm mr-1">x</span>
            <input type="number" step="0.01" value={minCrash} onChange={(e) => setMinCrash(e.target.value)} className="bg-transparent text-white text-sm w-full outline-none" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-semibold">Max early crash multiplier (under this = early)</label>
          <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 mt-1">
            <span className="text-neon-red font-bold text-sm mr-1">x</span>
            <input type="number" step="0.01" value={maxEarly} onChange={(e) => setMaxEarly(e.target.value)} className="bg-transparent text-white text-sm w-full outline-none" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-semibold">Max late crash multiplier</label>
          <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 mt-1">
            <span className="text-neon-red font-bold text-sm mr-1">x</span>
            <input type="number" step="0.01" value={maxLate} onChange={(e) => setMaxLate(e.target.value)} className="bg-transparent text-white text-sm w-full outline-none" />
          </div>
        </div>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-2">
        <h4 className="text-sm font-bold text-white">Quick Presets</h4>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => { setEarlyRatio('0.8'); setMaxEarly('1.50'); setMaxLate('9.50'); }} className="bg-dark-card2 border border-dark-border text-xs font-semibold text-gray-300 py-2 rounded-lg hover:bg-dark-border transition-colors">Default (80%)</button>
          <button onClick={() => { setEarlyRatio('0.5'); setMaxEarly('1.50'); setMaxLate('12.00'); }} className="bg-dark-card2 border border-dark-border text-xs font-semibold text-gray-300 py-2 rounded-lg hover:bg-dark-border transition-colors">Easy (50%)</button>
          <button onClick={() => { setEarlyRatio('0.95'); setMaxEarly('1.30'); setMaxLate('5.00'); }} className="bg-dark-card2 border border-dark-border text-xs font-semibold text-gray-300 py-2 rounded-lg hover:bg-dark-border transition-colors">Hard (95%)</button>
        </div>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-neon-red" />
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

      <button onClick={handleSave} disabled={saving} className="w-full bg-neon-red text-white font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-red/90 disabled:opacity-50 flex items-center justify-center gap-2" style={{ boxShadow: '0 0 12px rgba(255,51,102,0.3)' }}>
        {saving ? 'Saving...' : saveError ? (<><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>) : saved ? (<><Check size={18} strokeWidth={2.5} /> Saved successfully!</>) : (<><Settings size={18} strokeWidth={2.5} /> Save Settings</>)}
      </button>
    </div>
  );
}
